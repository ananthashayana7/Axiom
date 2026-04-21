import crypto from "node:crypto";
import { NextResponse } from "next/server";

interface RateLimiterConfig {
    maxTokens: number;
    refillRate: number;
    refillIntervalMs: number;
}

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
};

export type RateLimitName = "read" | "write" | "auth";

type RedisLike = {
    incrby(key: string, increment: number): Promise<number>;
    pexpire(key: string, milliseconds: number): Promise<number>;
    connect(): Promise<void>;
    disconnect(): void;
    on(event: "error", handler: (error: Error) => void): RedisLike;
};

const globalForRateLimit = globalThis as typeof globalThis & {
    __axiomRedisRateLimitClient?: Promise<RedisLike | null>;
};

let redisWarningLogged = false;

export function createRateLimiter(config: RateLimiterConfig) {
    const buckets = new Map<string, TokenBucket>();
    const { maxTokens, refillRate, refillIntervalMs } = config;

    if (typeof setInterval !== "undefined") {
        const cleanup = setInterval(() => {
            const now = Date.now();
            const staleThreshold = 10 * 60 * 1000;
            for (const [key, bucket] of buckets) {
                if (now - bucket.lastRefill > staleThreshold) {
                    buckets.delete(key);
                }
            }
        }, 5 * 60 * 1000);

        cleanup.unref?.();
    }

    function refill(bucket: TokenBucket, now: number): void {
        const elapsed = now - bucket.lastRefill;
        const intervalsElapsed = Math.floor(elapsed / refillIntervalMs);
        if (intervalsElapsed > 0) {
            bucket.tokens = Math.min(maxTokens, bucket.tokens + intervalsElapsed * refillRate);
            bucket.lastRefill = now;
        }
    }

    return {
        consume(key: string, cost: number = 1): RateLimitResult {
            const now = Date.now();

            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { tokens: maxTokens, lastRefill: now };
                buckets.set(key, bucket);
            }

            refill(bucket, now);

            if (bucket.tokens >= cost) {
                bucket.tokens -= cost;
                return { allowed: true, remaining: bucket.tokens };
            }

            const deficit = cost - bucket.tokens;
            const intervalsNeeded = Math.ceil(deficit / refillRate);
            const retryAfterMs = intervalsNeeded * refillIntervalMs;

            return { allowed: false, remaining: 0, retryAfterMs };
        },

        reset(key: string): void {
            buckets.delete(key);
        },

        getStatus(key: string): { tokens: number; maxTokens: number } {
            const bucket = buckets.get(key);
            if (!bucket) return { tokens: maxTokens, maxTokens };
            refill(bucket, Date.now());
            return { tokens: bucket.tokens, maxTokens };
        },
    };
}

export const rateLimitConfigs: Record<RateLimitName, RateLimiterConfig> = {
    read: {
        maxTokens: Number(process.env.RATE_LIMIT_READ_PER_MINUTE || 300),
        refillRate: Number(process.env.RATE_LIMIT_READ_PER_MINUTE || 300),
        refillIntervalMs: 60_000,
    },
    write: {
        maxTokens: Number(process.env.RATE_LIMIT_WRITE_PER_MINUTE || 60),
        refillRate: Number(process.env.RATE_LIMIT_WRITE_PER_MINUTE || 60),
        refillIntervalMs: 60_000,
    },
    auth: {
        maxTokens: Number(process.env.RATE_LIMIT_AUTH_PER_MINUTE || 5),
        refillRate: Number(process.env.RATE_LIMIT_AUTH_PER_MINUTE || 5),
        refillIntervalMs: 60_000,
    },
};

export const readLimiter = createRateLimiter(rateLimitConfigs.read);
export const writeLimiter = createRateLimiter(rateLimitConfigs.write);
export const authLimiter = createRateLimiter(rateLimitConfigs.auth);

const fallbackLimiters = {
    read: readLimiter,
    write: writeLimiter,
    auth: authLimiter,
};

async function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    if (!globalForRateLimit.__axiomRedisRateLimitClient) {
        globalForRateLimit.__axiomRedisRateLimitClient = (async () => {
            try {
                const { default: IORedis } = await import("ioredis");
                const client = new IORedis(redisUrl, {
                    enableOfflineQueue: false,
                    lazyConnect: true,
                    maxRetriesPerRequest: 1,
                }) as RedisLike;

                client.on("error", (error) => {
                    if (!redisWarningLogged) {
                        redisWarningLogged = true;
                        console.warn("[RateLimit] Redis unavailable; using local fallback.", error.message);
                    }
                });

                await client.connect();
                return client;
            } catch (error) {
                if (!redisWarningLogged) {
                    redisWarningLogged = true;
                    console.warn(
                        "[RateLimit] Failed to connect to Redis; using local fallback.",
                        error instanceof Error ? error.message : error,
                    );
                }
                return null;
            }
        })();
    }

    return globalForRateLimit.__axiomRedisRateLimitClient;
}

function scopedRedisKey(name: RateLimitName, key: string, bucket: number) {
    const namespace = process.env.RATE_LIMIT_NAMESPACE || "axiom";
    const hashedKey = crypto.createHash("sha256").update(key).digest("hex");
    return `rate:${namespace}:${name}:${bucket}:${hashedKey}`;
}

export async function consumeRateLimit(
    name: RateLimitName,
    key: string,
    cost: number = 1,
): Promise<RateLimitResult> {
    const config = rateLimitConfigs[name];
    const safeCost = Math.max(1, Math.ceil(cost));
    const redis = await getRedisClient();

    if (redis) {
        try {
            const now = Date.now();
            const windowBucket = Math.floor(now / config.refillIntervalMs);
            const redisKey = scopedRedisKey(name, key, windowBucket);
            const used = await redis.incrby(redisKey, safeCost);

            if (used === safeCost) {
                await redis.pexpire(redisKey, config.refillIntervalMs * 2);
            }

            if (used > config.maxTokens) {
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterMs: config.refillIntervalMs - (now % config.refillIntervalMs),
                };
            }

            return {
                allowed: true,
                remaining: Math.max(config.maxTokens - used, 0),
            };
        } catch (error) {
            if (!redisWarningLogged) {
                redisWarningLogged = true;
                console.warn(
                    "[RateLimit] Redis rate-limit operation failed; using local fallback.",
                    error instanceof Error ? error.message : error,
                );
            }
        }
    }

    return fallbackLimiters[name].consume(key, safeCost);
}

export function rateLimitResponse(retryAfterMs: number) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
        {
            error: "Too many requests. Please slow down.",
            retryAfterSeconds,
        },
        {
            status: 429,
            headers: {
                "Retry-After": retryAfterSeconds.toString(),
                "X-RateLimit-Reset": new Date(Date.now() + retryAfterMs).toISOString(),
            },
        },
    );
}

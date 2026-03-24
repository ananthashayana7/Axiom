// ─── In-Memory Token Bucket Rate Limiter ──────────────────────────────
// No external dependencies (Redis optional upgrade path)
// Usage: const limiter = createRateLimiter({ maxTokens: 100, refillRate: 100, refillIntervalMs: 60000 });
//        const result = limiter.consume(userId); → { allowed: true, remaining: 99 } or { allowed: false, retryAfterMs: 1234 }

interface RateLimiterConfig {
    maxTokens: number;
    refillRate: number; // tokens added per interval
    refillIntervalMs: number; // ms between refills
}

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

export function createRateLimiter(config: RateLimiterConfig) {
    const buckets = new Map<string, TokenBucket>();
    const { maxTokens, refillRate, refillIntervalMs } = config;

    // Periodic cleanup of stale entries (every 5 minutes)
    if (typeof setInterval !== 'undefined') {
        setInterval(() => {
            const now = Date.now();
            const staleThreshold = 10 * 60 * 1000; // 10 minutes
            for (const [key, bucket] of buckets) {
                if (now - bucket.lastRefill > staleThreshold) {
                    buckets.delete(key);
                }
            }
        }, 5 * 60 * 1000);
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
        consume(key: string, cost: number = 1): { allowed: boolean; remaining: number; retryAfterMs?: number } {
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

            // Calculate when tokens will be available
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

// ─── Pre-configured Rate Limiters ──────────────────────────────────────

/** 100 read requests per minute per user */
export const readLimiter = createRateLimiter({
    maxTokens: 100,
    refillRate: 100,
    refillIntervalMs: 60_000,
});

/** 20 write requests per minute per user */
export const writeLimiter = createRateLimiter({
    maxTokens: 20,
    refillRate: 20,
    refillIntervalMs: 60_000,
});

/** 5 auth attempts per minute per IP */
export const authLimiter = createRateLimiter({
    maxTokens: 5,
    refillRate: 5,
    refillIntervalMs: 60_000,
});

// ─── Middleware Helper ─────────────────────────────────────────────────

import { NextResponse } from 'next/server';

export function rateLimitResponse(retryAfterMs: number) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
        {
            error: 'Too many requests. Please slow down.',
            retryAfterSeconds,
        },
        {
            status: 429,
            headers: {
                'Retry-After': retryAfterSeconds.toString(),
                'X-RateLimit-Reset': new Date(Date.now() + retryAfterMs).toISOString(),
            },
        }
    );
}

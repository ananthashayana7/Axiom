import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function checkDatabase(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
        await Promise.race([
            db.execute(sql`select 1`),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('DB ping timed out')), 3_000)
            ),
        ]);
        return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : 'db check failed',
        };
    }
}

/**
 * Check Redis using the shared rate-limit client that is already warmed up.
 * Previously this created a fresh IORedis connection on every probe call,
 * which caused unnecessary connection churn (probes run every 30 s).
 *
 * If REDIS_URL is not configured we report ok=true / configured=false so that
 * a Redis-free deployment still passes readiness.
 */
async function checkRedis(): Promise<{ ok: boolean; configured: boolean; latencyMs?: number; error?: string }> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return { ok: true, configured: false };
    }

    const start = Date.now();

    try {
        // Reuse the shared IORedis client owned by the rate-limit module so we
        // don't open a brand-new connection on every readiness poll.
        const { default: IORedis } = await import('ioredis');

        // Access the module-level singleton if it exists, otherwise create a
        // lightweight one-shot client.  We use the globalThis slot that the
        // rate-limit module writes so we share the same connection.
        const globalStore = globalThis as typeof globalThis & {
            __axiomRedisRateLimitClient?: Promise<{ incrby: unknown; ping?: () => Promise<string> } | null>;
        };

        if (globalStore.__axiomRedisRateLimitClient) {
            const client = await globalStore.__axiomRedisRateLimitClient;
            if (client && typeof (client as { ping?: () => Promise<string> }).ping === 'function') {
                await Promise.race([
                    (client as { ping: () => Promise<string> }).ping(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Redis ping timed out')), 2_000)
                    ),
                ]);
                return { ok: true, configured: true, latencyMs: Date.now() - start };
            }
        }

        // Fallback: create a short-lived client just for this probe
        const tempClient = new IORedis(redisUrl, {
            enableOfflineQueue: false,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
        });

        try {
            await Promise.race([
                (async () => {
                    await tempClient.connect();
                    await tempClient.ping();
                })(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Redis ping timed out')), 2_000)
                ),
            ]);
            return { ok: true, configured: true, latencyMs: Date.now() - start };
        } finally {
            await tempClient.quit().catch(() => undefined);
        }
    } catch (error) {
        return {
            ok: false,
            configured: true,
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : 'redis check failed',
        };
    }
}

export async function GET() {
    const [dbStatus, redisStatus] = await Promise.all([
        checkDatabase(),
        checkRedis(),
    ]);
    const ready = dbStatus.ok && redisStatus.ok;

    return NextResponse.json(
        {
            status: ready ? 'ready' : 'not_ready',
            checks: {
                database: dbStatus,
                redis: redisStatus,
            },
            timestamp: new Date().toISOString(),
        },
        { status: ready ? 200 : 503 }
    );
}

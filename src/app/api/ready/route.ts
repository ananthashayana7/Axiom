import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function checkDatabase() {
    try {
        await db.execute(sql`select 1`);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'db check failed' };
    }
}

async function checkRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return { ok: true, configured: false };
    }

    type RedisHealthClient = {
        connect: () => Promise<void>;
        ping: () => Promise<string>;
        quit: () => Promise<unknown>;
    };

    let client: RedisHealthClient | null = null;
    try {
        const { default: IORedis } = await import('ioredis');
        client = new IORedis(redisUrl, {
            enableOfflineQueue: false,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
        }) as unknown as RedisHealthClient;

        await client.connect();
        await client.ping();
        return { ok: true, configured: true };
    } catch (error) {
        return { ok: false, configured: true, error: error instanceof Error ? error.message : 'redis check failed' };
    } finally {
        await client?.quit().catch(() => undefined);
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

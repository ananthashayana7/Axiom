import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Liveness probe — /api/health
 *
 * Returns 200 only when the process AND the database are reachable.
 * Returns 503 when the database is down so load-balancers and orchestrators
 * (Docker, Kubernetes, Azure App Service) can pull the instance out of rotation
 * rather than serving errors.
 *
 * Keep this fast: the DB ping uses a 3-second hard timeout so the probe
 * itself never blocks a restart cycle.
 */
async function checkDatabase(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
        // Race the DB ping against a 3-second timeout so a hung connection
        // never delays the liveness response indefinitely.
        await Promise.race([
            db.execute(sql`select 1`),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('DB ping timed out after 3s')), 3_000)
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

export async function GET() {
    const db = await checkDatabase();
    const healthy = db.ok;

    return NextResponse.json(
        {
            status: healthy ? 'ok' : 'degraded',
            service: 'axiom',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            nodeEnv: process.env.NODE_ENV || 'development',
            checks: { database: db },
        },
        { status: healthy ? 200 : 503 }
    );
}

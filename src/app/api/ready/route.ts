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

export async function GET() {
    const dbStatus = await checkDatabase();
    const ready = dbStatus.ok;

    return NextResponse.json(
        {
            status: ready ? 'ready' : 'not_ready',
            checks: {
                database: dbStatus,
            },
            timestamp: new Date().toISOString(),
        },
        { status: ready ? 200 : 503 }
    );
}

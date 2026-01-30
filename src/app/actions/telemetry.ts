'use server'

import { db } from "@/db";
import { systemTelemetry, users } from "@/db/schema";
import { auth } from "@/auth";
import { desc, eq, sql } from "drizzle-orm";

export async function getSystemTelemetry() {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') return [];

    try {
        const logs = await db.select({
            id: systemTelemetry.id,
            type: systemTelemetry.type,
            scope: systemTelemetry.scope,
            key: systemTelemetry.key,
            value: systemTelemetry.value,
            metadata: systemTelemetry.metadata,
            createdAt: systemTelemetry.createdAt,
            userName: users.name,
        })
            .from(systemTelemetry)
            .leftJoin(users, eq(systemTelemetry.userId, users.id))
            .orderBy(desc(systemTelemetry.createdAt))
            .limit(100);

        return logs;
    } catch (error) {
        console.error("Failed to fetch telemetry:", error);
        return [];
    }
}

export async function getTelemetryStats() {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') return null;

    try {
        const [errorCount] = await db.select({ count: sql<number>`count(*)` })
            .from(systemTelemetry)
            .where(eq(systemTelemetry.type, 'error'));

        const [avgLatency] = await db.select({ avg: sql<number>`avg(${systemTelemetry.value})` })
            .from(systemTelemetry)
            .where(sql`${systemTelemetry.key} LIKE '%latency%'`);

        return {
            errors: errorCount.count,
            avgLatency: Number(avgLatency.avg || 0).toFixed(2)
        };
    } catch (error) {
        console.error("Failed to fetch telemetry stats:", error);
        return null;
    }
}

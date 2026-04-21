import { db } from "@/db";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";

type LockResult<T> =
    | { acquired: true; value: T }
    | { acquired: false; value: null };

function lockKeys(name: string) {
    const digest = crypto.createHash("sha256").update(name).digest();
    return {
        namespace: digest.readInt32BE(0),
        key: digest.readInt32BE(4),
    };
}

function rowsFromExecute(result: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
    const rows = (result as { rows?: Array<Record<string, unknown>> })?.rows;
    return Array.isArray(rows) ? rows : [];
}

export async function withPgAdvisoryLock<T>(name: string, run: () => Promise<T>): Promise<LockResult<T>> {
    const key = lockKeys(name);
    const lockResult = await db.execute(sql`
        select pg_try_advisory_lock(${key.namespace}, ${key.key}) as locked
    `);

    const locked = rowsFromExecute(lockResult)[0]?.locked === true;
    if (!locked) {
        return { acquired: false, value: null };
    }

    try {
        return { acquired: true, value: await run() };
    } finally {
        await db.execute(sql`
            select pg_advisory_unlock(${key.namespace}, ${key.key})
        `);
    }
}


import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function numberFromEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sslConfig() {
    const sslMode = process.env.PGSSLMODE || new URL(process.env.DATABASE_URL || "postgres://localhost").searchParams.get("sslmode");
    const explicit = process.env.DB_SSL === "true";

    if (explicit || sslMode === "require") {
        return { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" };
    }

    return undefined;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: numberFromEnv("DB_POOL_MAX", 20),
    idleTimeoutMillis: numberFromEnv("DB_POOL_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMillis: numberFromEnv("DB_POOL_CONNECTION_TIMEOUT_MS", 5_000),
    maxUses: numberFromEnv("DB_POOL_MAX_USES", 7_500),
    statement_timeout: numberFromEnv("DB_STATEMENT_TIMEOUT_MS", 30_000),
    query_timeout: numberFromEnv("DB_QUERY_TIMEOUT_MS", 30_000),
    application_name: process.env.DB_APPLICATION_NAME || "axiom-web",
    ssl: sslConfig(),
});

pool.on("error", (error: Error) => {
    console.error("[DB] Unexpected idle client error", error);
});

export const db = drizzle(pool, { schema });
export { pool };


import { drizzle } from "drizzle-orm/node-postgres";
// @ts-ignore
import { Pool } from "pg";
import * as schema from "./schema";
import dotenv from "dotenv";

// @ts-ignore
dotenv.config({ path: ".env.local" });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });

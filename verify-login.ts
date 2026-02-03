import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq, or } from "drizzle-orm";
import { sql } from "drizzle-orm";

async function verifyLogin() {
    console.log("--- START VERIFICATION ---");

    // 1. Check Schema Columns directly via SQL
    try {
        const result = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        const columns = result.rows.map((r: any) => r.column_name);
        console.log("ACTUAL DB COLUMNS:", columns);

        const required = ['phone_number', 'two_factor_secret', 'department', 'employee_id', 'email'];
        const missing = required.filter(c => !columns.includes(c));

        if (missing.length > 0) {
            console.error("!!! CRITICAL: MISSING COLUMNS !!!", missing);
        } else {
            console.log("✅ All required columns appear to be present.");
        }

    } catch (e) {
        console.error("Failed to check schema:", e);
    }

    // 2. Try the Auth Query (Simulate auth.ts)
    console.log("\n--- TESTING QUERY ---");
    try {
        const identifier = "test_user";
        // This is the query from auth.ts
        const result = await db.select().from(users).where(
            or(
                eq(users.email, identifier),
                eq(users.employeeId, identifier),
                eq(users.phoneNumber, identifier)
            )
        );
        console.log("✅ Query executed successfully (Result length):", result.length);
    } catch (e) {
        console.error("!!! QUERY CRASHED !!!");
        console.error(e);
    }

    process.exit(0);
}

verifyLogin();

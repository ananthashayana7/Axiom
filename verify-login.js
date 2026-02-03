import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyLogin() {
    console.log("--- START VERIFICATION (JS) ---");
    const client = await pool.connect();

    try {
        // 1. Check Schema Columns directly via SQL
        const colRes = await client.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        const columns = colRes.rows.map(r => r.column_name);
        console.log("ACTUAL DB COLUMNS:", columns);

        const required = ['phone_number', 'two_factor_secret', 'department', 'employee_id', 'email'];
        const missing = required.filter(c => !columns.includes(c));

        if (missing.length > 0) {
            console.error("!!! CRITICAL: MISSING COLUMNS !!!", missing);
        } else {
            console.log("✅ All required columns appear to be present.");
        }

        // 2. Try the Auth Query (Simulate auth.ts logic)
        console.log("\n--- TESTING QUERY ---");
        const identifier = "test_user";
        // Raw SQL equivalent of the Drizzle query
        const query = `
            SELECT * FROM users 
            WHERE email = $1 
            OR employee_id = $1 
            OR phone_number = $1
        `;

        try {
            const userRes = await client.query(query, [identifier]);
            console.log("✅ Query executed successfully. Rows found:", userRes.rows.length);
        } catch (qErr) {
            console.error("!!! QUERY CRASHED !!!");
            console.error(qErr);
        }

    } catch (e) {
        console.error("Verification failed:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyLogin();

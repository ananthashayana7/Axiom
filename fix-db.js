import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log("Checking columns...");
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'goods_receipts';
        `);
        const columns = res.rows.map(r => r.column_name);
        console.log("Existing columns:", columns);

        if (!columns.includes('inspection_status')) {
            console.log("Adding inspection_status...");
            await client.query(`ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS inspection_status text DEFAULT 'pending';`);
        }
        if (!columns.includes('inspection_notes')) {
            console.log("Adding inspection_notes...");
            await client.query(`ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS inspection_notes text;`);
        }
        console.log("Schema fix completed.");
    } catch (err) {
        console.error("Error fixing schema:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();

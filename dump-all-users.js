import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dump() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, name, email, role, phone_number FROM users');
        console.log("Users:", JSON.stringify(res.rows, null, 2));
    } catch (e) { console.error(e) }
    finally { client.release(); pool.end(); }
}
dump();

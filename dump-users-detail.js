import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dump() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, email, employee_id, password FROM users');
        console.log("Users Data:", res.rows.map(u => ({
            ...u,
            password: u.password ? '[HASHED]' : 'NULL'
        })));
    } catch (e) { console.error(e) }
    finally { client.release(); pool.end(); }
}
dump();

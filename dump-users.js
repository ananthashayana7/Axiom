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
        console.log("Dumping users...");
        const res = await client.query(`
            SELECT id, name, email, employee_id, phone_number, role 
            FROM users;
        `);
        console.log("Users in DB:", JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error("Error dumping users:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();

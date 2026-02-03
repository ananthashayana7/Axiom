import { db } from './index';
import { sql } from 'drizzle-orm';

async function check() {
    const res = await db.execute(sql.raw("SELECT column_name FROM information_schema.columns WHERE table_name = 'parts'"));
    console.log("Columns in 'parts' table:");
    console.log(res.rows.map((r: any) => r.column_name));
    process.exit(0);
}

check();

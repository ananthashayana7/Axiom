import { db } from './index';
import { sql } from 'drizzle-orm';

async function check() {
    const tables = await db.execute(sql.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"));
    console.log("Existing tables:");
    console.log(tables.rows.map((r: any) => r.table_name).sort());

    const orderCols = await db.execute(sql.raw("SELECT column_name FROM information_schema.columns WHERE table_name = 'procurement_orders'"));
    console.log("\nColumns in 'procurement_orders':");
    console.log(orderCols.rows.map((r: any) => r.column_name).sort());

    process.exit(0);
}

check();

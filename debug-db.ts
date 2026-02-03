import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function checkSchema() {
    try {
        const result = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'goods_receipts';
        `);
        console.log("Goods Receipts Columns:", JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error("Error checking schema:", e);
    }
    process.exit(0);
}

checkSchema();

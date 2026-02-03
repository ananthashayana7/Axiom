import { db } from './index';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
    console.log("Reading migration SQL...");
    const sqlPath = path.join(process.cwd(), 'drizzle', '0002_colossal_dracula.sql');
    const fullSql = fs.readFileSync(sqlPath, 'utf8');

    // Split statements by --> statement-breakpoint
    const statements = fullSql.split('--> statement-breakpoint');

    console.log(`Executing ${statements.length} statements...`);

    for (const statement of statements) {
        if (!statement.trim()) continue;
        try {
            await db.execute(sql.raw(statement));
        } catch (error: any) {
            // Ignore "already exists" errors to make it idempotent
            if (error.message.includes('already exists') || error.message.includes('already a value')) {
                console.log(`Skipping: ${statement.slice(0, 50)}... (Already exists)`);
            } else {
                console.error(`Error executing: ${statement.slice(0, 50)}...`);
                console.error(error.message);
                // Continue despite errors to try and get as much as possible
            }
        }
    }

    console.log("Migration application attempt finished.");
    process.exit(0);
}

applyMigration();

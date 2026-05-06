import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL is not configured.");
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    application_name: "axiom-audit-worm-hardening",
});

const statements = [
    `
    create or replace function block_audit_log_mutation()
    returns trigger
    language plpgsql
    as $$
    begin
        raise exception 'audit_logs are immutable; % operations are blocked', tg_op;
    end;
    $$;
    `,
    `
    drop trigger if exists audit_logs_block_mutation on audit_logs;
    `,
    `
    create trigger audit_logs_block_mutation
    before update or delete on audit_logs
    for each row
    execute function block_audit_log_mutation();
    `,
    `
    alter table audit_logs enable always trigger audit_logs_block_mutation;
    `,
    `
    drop trigger if exists audit_logs_block_truncate on audit_logs;
    `,
    `
    create trigger audit_logs_block_truncate
    before truncate on audit_logs
    for each statement
    execute function block_audit_log_mutation();
    `,
    `
    alter table audit_logs enable always trigger audit_logs_block_truncate;
    `,
];

try {
    for (const statement of statements) {
        await pool.query(statement);
    }

    console.log("Audit log WORM hardening applied successfully.");
} catch (error) {
    console.error("Failed to harden audit logs:", error);
    process.exitCode = 1;
} finally {
    await pool.end();
}

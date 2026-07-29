/**
 * Axiom Platform — Automated Setup Script
 * 
 * Run: npm run setup
 * 
 * Prerequisites: Node.js, Docker Desktop (running)
 * 
 * This script handles everything:
 *   1. Creates .env.local from .env.example (if missing)
 *   2. Starts PostgreSQL via Docker Compose
 *   3. Waits for the database to be ready
 *   4. Ensures the procurement_db database exists
 *   5. Pushes the schema (drizzle-kit push)
 *   6. Seeds the database with default admin account
 */

import { execSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const ENV_LOCAL = join(ROOT, ".env.local");

// ANSI colors
const log = {
    step: (msg) => console.log(`\n\x1b[36m▸\x1b[0m ${msg}`),
    ok: (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`),
    warn: (msg) => console.log(`  \x1b[33m⚠\x1b[0m ${msg}`),
    error: (msg) => console.error(`  \x1b[31m✖\x1b[0m ${msg}`),
    info: (msg) => console.log(`  \x1b[90m${msg}\x1b[0m`),
};

function runSilent(cmd) {
    try {
        return execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 15_000 }).toString().trim();
    } catch {
        return "";
    }
}

function run(cmd, opts = {}) {
    try {
        return execSync(cmd, {
            cwd: ROOT,
            stdio: opts.silent ? "pipe" : "inherit",
            timeout: opts.timeout || 60_000,
        });
    } catch (err) {
        if (opts.ignoreError) return null;
        throw err;
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Step 1: Environment file ────────────────────────────────────────────────
function ensureEnvLocal() {
    log.step("Checking environment configuration...");

    if (existsSync(ENV_LOCAL)) {
        log.ok(".env.local already exists — skipping copy.");
        return;
    }

    if (!existsSync(ENV_EXAMPLE)) {
        log.error(".env.example not found! Cannot create .env.local.");
        process.exit(1);
    }

    copyFileSync(ENV_EXAMPLE, ENV_LOCAL);
    log.ok("Created .env.local from .env.example with local dev defaults.");
}

// ── Step 2: Start PostgreSQL via Docker ─────────────────────────────────────
function startDatabase() {
    log.step("Starting PostgreSQL via Docker...");

    // Check Docker is running
    if (!runSilent("docker info")) {
        log.error("Docker is not running!");
        log.info("Please start Docker Desktop and re-run: npm run setup");
        log.info("Download: https://www.docker.com/products/docker-desktop");
        process.exit(1);
    }

    // Check if container is already running
    const running = runSilent('docker ps --filter "name=procurement_db" --filter "status=running" -q');
    if (running) {
        log.ok("PostgreSQL container is already running.");
        return;
    }

    log.info("Starting PostgreSQL container...");
    run("docker compose up -d db", { timeout: 120_000 });
    log.ok("PostgreSQL container started.");
}

// ── Step 3: Wait for DB ─────────────────────────────────────────────────────
async function waitForDatabase(maxRetries = 30) {
    log.step("Waiting for database to accept connections...");

    for (let i = 1; i <= maxRetries; i++) {
        const ready =
            runSilent("docker exec procurement_db pg_isready -U postgres").includes("accepting") ||
            runSilent("docker exec procurement_db_dev pg_isready -U postgres").includes("accepting");

        if (ready) {
            log.ok("Database is ready.");
            return;
        }

        if (i < maxRetries) {
            process.stdout.write(`  \x1b[90m  Waiting... (${i}/${maxRetries})\x1b[0m\r`);
            await sleep(2000);
        }
    }

    log.error(`Database did not become ready after ${maxRetries} attempts.`);
    log.info("Check logs: docker compose logs db");
    process.exit(1);
}

// ── Step 4: Ensure database exists ──────────────────────────────────────────
function ensureDatabaseExists() {
    log.step("Ensuring 'procurement_db' database exists...");

    const check = runSilent(
        `docker exec procurement_db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'procurement_db'"`
    );

    if (check.includes("1")) {
        log.ok("Database 'procurement_db' exists.");
        return;
    }

    runSilent(`docker exec procurement_db createdb -U postgres procurement_db`);
    log.ok("Database 'procurement_db' created.");
}

// ── Step 5: Schema push ─────────────────────────────────────────────────────
function pushSchema() {
    log.step("Pushing database schema (drizzle-kit push)...");
    try {
        run("npx drizzle-kit push", { timeout: 120_000 });
        log.ok("Schema pushed successfully.");
    } catch {
        log.error("Schema push failed. Check the error above.");
        log.info("Retry manually: npm run db:push");
        process.exit(1);
    }
}

// ── Step 6: Seed ────────────────────────────────────────────────────────────
function seedDatabase() {
    log.step("Seeding database with default admin account...");
    try {
        run("npx tsx src/db/seed.ts", { timeout: 60_000 });
        log.ok("Database seeded.");
    } catch {
        log.warn("Seeding had issues (database may already contain data — this is OK).");
    }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log("\n\x1b[1m\x1b[35m╔══════════════════════════════════════╗\x1b[0m");
    console.log("\x1b[1m\x1b[35m║     Axiom Platform — First Setup     ║\x1b[0m");
    console.log("\x1b[1m\x1b[35m╚══════════════════════════════════════╝\x1b[0m");

    ensureEnvLocal();
    startDatabase();
    await waitForDatabase();
    ensureDatabaseExists();
    pushSchema();
    seedDatabase();

    console.log("\n\x1b[1m\x1b[32m══════════════════════════════════════\x1b[0m");
    console.log("\x1b[1m\x1b[32m  ✔ Setup complete!\x1b[0m");
    console.log("\x1b[1m\x1b[32m══════════════════════════════════════\x1b[0m");
    console.log(`
  \x1b[1mStart the app:\x1b[0m
    \x1b[36mnpm run dev\x1b[0m
    \x1b[90mOpen http://localhost:3001\x1b[0m

  \x1b[1mDefault admin login:\x1b[0m
    Email:    \x1b[36madmin@axiomprocure.com\x1b[0m
    Password: \x1b[36mpassword\x1b[0m
`);
}

main().catch((err) => {
    log.error("Setup failed unexpectedly:");
    console.error(err);
    process.exit(1);
});

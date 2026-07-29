/**
 * Axiom Platform — Automated Setup Script
 * 
 * Run: npm run setup
 * 
 * This script handles everything a new developer needs:
 *   1. Creates .env.local from .env.example (if missing)
 *   2. Starts the PostgreSQL Docker container
 *   3. Waits for the database to be ready
 *   4. Pushes the schema (drizzle-kit push)
 *   5. Seeds the database with default admin account
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const ENV_LOCAL = join(ROOT, ".env.local");

// ANSI colors for pretty output
const log = {
    step: (msg) => console.log(`\n\x1b[36m▸\x1b[0m ${msg}`),
    ok: (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`),
    warn: (msg) => console.log(`  \x1b[33m⚠\x1b[0m ${msg}`),
    error: (msg) => console.error(`  \x1b[31m✖\x1b[0m ${msg}`),
    info: (msg) => console.log(`  \x1b[90m${msg}\x1b[0m`),
};

function run(cmd, opts = {}) {
    try {
        return execSync(cmd, {
            cwd: ROOT,
            stdio: opts.silent ? "pipe" : "inherit",
            timeout: opts.timeout || 60_000,
            ...opts,
        });
    } catch (err) {
        if (opts.ignoreError) return null;
        throw err;
    }
}

function runSilent(cmd) {
    try {
        return execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 30_000 }).toString().trim();
    } catch {
        return "";
    }
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

// ── Step 2: Docker ──────────────────────────────────────────────────────────
function isDockerRunning() {
    const result = runSilent("docker info");
    return result.length > 0;
}

function isDbContainerRunning() {
    const result = runSilent('docker ps --filter "name=procurement_db" --filter "status=running" -q');
    return result.length > 0;
}

function startDatabase() {
    log.step("Starting PostgreSQL database via Docker...");

    if (!isDockerRunning()) {
        log.error("Docker is not running! Please start Docker Desktop and try again.");
        log.info("Download Docker Desktop: https://www.docker.com/products/docker-desktop");
        process.exit(1);
    }

    if (isDbContainerRunning()) {
        log.ok("PostgreSQL container is already running.");
        return;
    }

    // Start only the db service from docker-compose
    log.info("Starting PostgreSQL container...");
    run("docker compose up -d db", { timeout: 120_000 });
    log.ok("PostgreSQL container started.");
}

// ── Step 3: Wait for DB ─────────────────────────────────────────────────────
async function waitForDatabase(maxRetries = 30) {
    log.step("Waiting for database to accept connections...");

    for (let i = 1; i <= maxRetries; i++) {
        const result = runSilent('docker exec procurement_db pg_isready -U postgres');
        if (result.includes("accepting connections")) {
            log.ok("Database is ready.");
            return;
        }

        // Also check the dev container name
        const resultDev = runSilent('docker exec procurement_db_dev pg_isready -U postgres');
        if (resultDev.includes("accepting connections")) {
            log.ok("Database is ready (dev container).");
            return;
        }

        if (i < maxRetries) {
            process.stdout.write(`  \x1b[90m  Waiting... (${i}/${maxRetries})\x1b[0m\r`);
            await sleep(2000);
        }
    }

    log.error(`Database did not become ready after ${maxRetries} attempts.`);
    log.info("Check Docker logs: docker compose logs db");
    process.exit(1);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Step 4: Schema push ─────────────────────────────────────────────────────
function pushSchema() {
    log.step("Pushing database schema (drizzle-kit push)...");
    try {
        run("npx drizzle-kit push", { timeout: 120_000 });
        log.ok("Schema pushed successfully.");
    } catch (err) {
        log.error("Schema push failed. Check the error above.");
        log.info("You can retry manually: npm run db:push");
        process.exit(1);
    }
}

// ── Step 5: Seed ────────────────────────────────────────────────────────────
function seedDatabase() {
    log.step("Seeding database with default admin account...");
    try {
        run("npx tsx src/db/seed.ts", { timeout: 60_000 });
        log.ok("Database seeded.");
    } catch (err) {
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
    pushSchema();
    seedDatabase();

    console.log("\n\x1b[1m\x1b[32m══════════════════════════════════════\x1b[0m");
    console.log("\x1b[1m\x1b[32m  ✔ Setup complete!\x1b[0m");
    console.log("\x1b[1m\x1b[32m══════════════════════════════════════\x1b[0m");
    console.log(`
  \x1b[1mNext steps:\x1b[0m
    \x1b[36mnpm run dev\x1b[0m        Start the development server
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

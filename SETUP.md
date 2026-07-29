# Axiom Platform — Setup Guide

Everything is automated. Follow the steps below and the setup script will handle the rest.

---

## Prerequisites

Install these before you begin:

| Software | Download |
|---|---|
| **Node.js** (v18+) | [nodejs.org](https://nodejs.org/) |
| **Git** | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | [docker.com](https://www.docker.com/products/docker-desktop/) |

> [!IMPORTANT]
> Make sure **Docker Desktop is running** before you proceed to the setup steps.

---

## Setup Steps

```bash
git clone https://github.com/ananthashayana7/Axiom.git
cd Axiom
npm install
npm run setup
npm run dev
```

That's it. Open **http://localhost:3001** and log in:

| Field | Value |
|---|---|
| Email | `admin@axiomprocure.com` |
| Password | `password` |

---

## What `npm run setup` does

You don't need to do any of this manually — it's all automated:

1. ✅ Creates `.env.local` with correct local dev defaults
2. ✅ Starts PostgreSQL via Docker Compose
3. ✅ Waits for the database to be ready
4. ✅ Creates the `procurement_db` database
5. ✅ Pushes the full database schema
6. ✅ Seeds the default admin account

---

## Useful Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start development server (port 3001) |
| `npm run setup` | Full automated setup (safe to re-run) |
| `npm run db:push` | Push schema changes to database |
| `npm run db:seed` | Seed the database with default admin |
| `npm run build` | Production build |
| `npm run lint` | Run linter |
| `npm run test` | Run tests |
| `docker compose logs db` | View database logs |
| `docker compose down` | Stop all containers |

---

## Offline Setup (Restricted Networks)

If `npm install` doesn't work due to network restrictions, ask a colleague with internet access to create a dependency bundle:

```bash
cd Axiom
npm install
tar -czf axiom-deps.tar.gz node_modules
```

Transfer `axiom-deps.tar.gz` to your machine, extract it in the project root, then continue from `npm run setup`.

---

## Troubleshooting

### `ENOTFOUND your-postgres-host`
Your `.env.local` file is missing or has placeholder values. Fix:
```bash
npm run setup
```

### Port 5432 already in use
Stop whatever is using it:
```bash
docker stop procurement_db
# or on Windows: net stop postgresql-x64-15
```
Then re-run `npm run setup`.

### Docker: "Cannot connect to the Docker daemon"
Start Docker Desktop and wait for it to fully load, then re-run `npm run setup`.

### PowerShell: "scripts are disabled"
Run once as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Schema push fails
```bash
docker compose ps        # check DB is running
npm run db:push          # retry manually
```

---

## Production Deployment

For production, use `.env.production.example` as a reference:
1. Copy it to `.env.local` on your production server
2. Replace all placeholder values with real credentials
3. **Change `AUTH_SECRET`** to a cryptographically random string
4. Use `npm run build && npm start` or deploy via Docker

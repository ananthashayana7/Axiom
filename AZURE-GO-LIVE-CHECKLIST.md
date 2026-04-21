# Azure Go-Live Checklist

## 1) Runtime Configuration

Set these App Service (or container app) environment variables:

- `NODE_ENV=production`
- `DATABASE_URL=<azure postgres connection string>`
- `REDIS_URL=<azure redis connection string>`
- `NEXTAUTH_SECRET=<strong random secret>`
- `AUTH_SECRET=<same strong secret unless you intentionally rotate separately>`
- `CRON_SECRET=<strong random secret>`
- `AXIOM_ALLOWED_ORIGINS=<public app origin, e.g. https://your-app.azurewebsites.net>`
- `PGSSLMODE=require`
- `DB_POOL_MAX=20` (raise only after sizing Azure PostgreSQL max connections)
- `RATE_LIMIT_NAMESPACE=axiom-prod`
- `AZURE_STORAGE_CONNECTION_STRING=<blob storage connection string>`
- `AZURE_STORAGE_CONTAINER=axiom-docs`
- `ALLOW_DEMO_BYPASS=false`

## 2) Process Topology

Deploy both processes:

- Web app: `npm run start`
- Background worker: `npm run worker:supplier-score`

If using Docker Compose production profile, ensure `worker_supplier_score` is running.

## 3) Database and Migrations

Before enabling traffic:

1. Run schema sync/migrations on production DB.
2. Verify critical tables and columns exist (including `suppliers.segment`).
3. Run smoke read/write checks with a non-admin and admin account.

## 4) Security Controls Verification

- Cron endpoints must reject requests without `CRON_SECRET`.
- Supplier APIs must enforce role/scope (`admin` vs `supplier`).
- Upload API must return `503` if Blob storage is not configured in production.
- Rate limits should return HTTP `429` when exceeded.
- Browser-originated API mutations from unapproved origins should return HTTP `403`.
- Scheduled endpoints should return `202` with `skipped: true` if an earlier run is still holding the DB advisory lock.

## 5) Health and Readiness Probes

Configure probes:

- Liveness: `GET /api/health` (expect `200` + `status: ok`)
- Readiness: `GET /api/ready` (expect `200` + `status: ready`)

Readiness must return `503` if DB is unavailable.

## 6) Post-Deploy Validation

Run after deployment:

1. `npm run test:smoke` (or equivalent deployed smoke tests)
2. Trigger one supplier score job and verify worker processes it.
3. Upload a sample document and confirm Blob URL storage.
4. Trigger each cron endpoint with valid bearer token.
5. Confirm observability (logs/metrics/alerts) for web and worker.

## 7) Secrets and Access Hygiene

- Rotate all legacy local/dev secrets before first production cutover.
- Limit DB and storage credentials to least privilege.
- Restrict cron caller identity (private network or signed scheduler identity).
- Enable alerting for repeated `401`, `403`, `429`, and `5xx` spikes.

## 8) Rollback Plan

Document and test rollback:

- Previous image tag and deployment revision.
- DB rollback strategy (or forward-fix only with tested migrations).
- Traffic shift/slot swap rollback criteria.

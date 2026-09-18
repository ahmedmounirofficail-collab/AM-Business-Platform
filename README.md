# AM Business Platform

AM Business Platform is a TypeScript/React ERP operating platform with an Express
API and SQLite persistence.

## Quick start

Requirements: Node.js 22 or newer and npm 10 or newer. Node.js 22 LTS is the
recommended Windows version; Node.js 24 is also supported by the current
dependencies.

From Windows CMD:
```bat
npm ci
copy .env.example .env
npm run dev
```

From PowerShell:
```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The development server runs on `http://127.0.0.1:3000`. In a second terminal:

```bat
npm install
npm run smoke
```

Do not run `npm install` after `npm ci` unless you intentionally change the
dependency manifest. `package-lock.json` is committed so clean installs work.

## Configuration

Development can use the seeded local database. Production must provide:

- `NODE_ENV=production`
- `AUTH_TOKEN_SECRET` or `JWT_SECRET` with at least 32 characters
- `DATABASE_PATH` or `PERSISTENT_DATA_PATH` pointing to a durable volume
- `INITIAL_ADMIN_PASSWORD` and `INITIAL_CASHIER_PIN` when seeded users need credentials

Optional integrations include `GEMINI_API_KEY`, ETA credentials, and ZATCA
credentials. Missing optional integration credentials disable those integrations;
they must not be represented as statutory production certification.

The server prints a startup configuration summary without printing secret values.
Production fails fast when required security or persistence configuration is
missing. See [`.env.example`](./.env.example) and
[`docs/AM_MVP_DEPLOYMENT.md`](./docs/AM_MVP_DEPLOYMENT.md).

## Build and production start

```bat
npm run lint
npm run build
set NODE_ENV=production
set AUTH_TOKEN_SECRET=replace-with-a-local-secret-at-least-32-characters
npm start
```

Use a durable mounted volume for SQLite. Runtime database files, WAL files,
backups, and certification outputs are intentionally ignored by Git.

## Local handoff validation

Use the local handoff package before any Windows pilot validation run:

```bat
copy .env.example .env
npm ci
npm run lint
npm run build
npm run validate:local
npm run dev
```

For endpoint checks against a running local instance:

```bat
npm run validate:local -- --check-server
```

`validate:local` reports environment/build/database state. The
`--check-server` form additionally requires live `/api/health` and
`/api/readiness` responses and exits non-zero if either is unavailable.

## Clean customer mode

`DEMO_MODE=false` and `ALLOW_DEMO_SEED_DATA=false` are the safe defaults.
A blank database contains no customers, vendors, products, inventory,
transactions, or dashboard metrics. The fixtures used by certification tests
are explicit opt-in demo data and are never inserted in customer mode.

The full local handoff documentation is in [`LOCAL_HANDOFF.md`](./LOCAL_HANDOFF.md).

## Tests

```bat
npm run smoke       # requires npm run dev in another terminal
npm test            # full certification suites; may require significant memory
```

Critical focused checks include `npm run test:p0-boundary`,
`npm run test:p007`, and `npm run test:invoice-http`.

Certification scripts write runtime databases and should use an isolated
`DATABASE_PATH` in CI.

## Product scope

The repository contains broad ERP modules including accounting, inventory,
sales, purchasing, CRM, HR, POS, manufacturing, treasury, fixed assets,
onboarding, branding, and compliance adapters. The health/readiness endpoints,
durable persistence kernel, authentication engine, and onboarding gate are the
operational foundation. Statutory integrations and external AI services require
their own credentials and environment validation; local adapter tests do not
constitute authority certification.

Before enabling a module for production, verify its complete workflow:
authorization, validation, persistence, audit trail, restart recovery, and
reporting. Incomplete modules should remain disabled or explicitly marked as
pilot functionality rather than presented as fully certified.

## Repository hygiene

Do not commit generated SQLite files, WAL files, uploaded runtime assets,
backups, or test output. Use migrations/seed data for reproducible setup and
configure runtime storage outside the repository.
## XLSX export dependency risk

Report workbooks are generated with `xlsx` and are verified as real OOXML workbooks by
`npm run test:real-exports`. The current upstream package has two high-severity advisories
with no published fix. AM Business Platform uses the package only to generate server-side
workbooks from trusted internal report objects; it does not parse or import user-supplied
XLSX files. The export endpoint does not accept workbook content, and generated files are
written to the HTTP response as base64. Keep `npm audit --audit-level=high` in release
checks and replace `xlsx` with a maintained writer when a compatible, security-reviewed
alternative is selected.

# LOCAL HANDOFF

HANDOFF_STATUS: VERIFIED_IN_REPOSITORY

## 1. Project

AM Business Platform / AM Business OS

## 2. Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: SQLite with WAL enabled for the MVP local/on-prem deployment target
- Security: Token-based auth, RBAC, tenant/company isolation, durable persistence, audit engine
- Startup path: first-run onboarding and then operational workspace

## 3. Requirements

- Node.js 22 or newer
- npm 10 or newer
- Windows 11 / Windows 10 local machine
- Local writable folder for database and backup files

## 4. Installation

Windows CMD:
```bat
cd C:\AM-Business-Platform-main
npm ci
copy .env.example .env
```

PowerShell equivalent:
```powershell
Set-Location C:\AM-Business-Platform-main
npm ci
Copy-Item .env.example .env
```

## 5. Environment

Use the values in `.env.example` and set real local secrets only on the target machine.

Required local settings:

```text
PORT=3000
NODE_ENV=development
COMPLIANCE_ENV=LOCAL
DATABASE_PATH=./data/local/am_business_platform.db
PERSISTENT_DATA_PATH=./data/local
REQUIRE_PERSISTENT_STORAGE=false
STRICT_PERSISTENCE_ABORT=false
DEMO_MODE=false
ALLOW_DEMO_SEED_DATA=false
AUTH_TOKEN_SECRET=your-local-secret-at-least-32-chars
JWT_SECRET=your-local-secret-at-least-32-chars
```

The values above are safe local defaults. Set `AUTH_TOKEN_SECRET` to a
random value of at least 32 characters for local authenticated testing.
Production also requires a secure secret and persistent storage settings.

Optional:

```text
GEMINI_API_KEY=
ETA_CLIENT_ID=
ETA_CLIENT_SECRET=
ZATCA_CSID=
ZATCA_CSID_SECRET=
ZATCA_CERTIFICATE_PEM=
INITIAL_ADMIN_PASSWORD=
INITIAL_CASHIER_PIN=
```

## 6. Database

- Database uses SQLite for the approved MVP architecture.
- Default path: `./data/local/am_business_platform.db`
- WAL-mode and persistence are enabled by the project runtime.
- The directory is created automatically when the app starts.
- Demo seed data is disabled by default and only allowed in explicit demo mode.
- Fresh local customer mode starts without business data.

## 7. Startup

```bat
npm run dev
```

Open:

```text
http://localhost:3000
```

## 8. Login / local admin

Create the first admin through the first-run onboarding flow or the secure bootstrap process if a local seed is required.

Do not commit real credentials to Git.

## 9. First-run expected behavior

When the database is empty:

1. Fresh Installation
2. First-run wizard
3. Company setup
4. Business type
5. Currency
6. Tax
7. Admin user
8. Accounting
9. Operations
10. Review
11. Initialize
12. Completed workspace

Expected result:

- no demo transactions
- no fake invoices
- no fake products
- no fake customer records
- no default business KPIs
- onboarding appears before workspace access

## 10. Local validation commands

Run these locally on Windows after the app is installed:

```bat
npm ci
npm run lint
npm run build
npm test
npm run validate:local
npm run dev
```

If the server is already running:

```bat
npm run validate:local -- --check-server
```

With the server running, `--check-server` must receive HTTP 200 from both
health and readiness. It reports `LOCAL_HANDOFF_READY=false` and exits
non-zero when the server is down or the build is missing.

## 11. Backup and restore

Backup:

```text
copy data/local/am_business_platform.db data/local/am_business_platform_backup.db
```

Optional WAL backup:

```text
copy data/local/am_business_platform.db-wal data/local/am_business_platform_backup.db-wal
copy data/local/am_business_platform.db-shm data/local/am_business_platform_backup.db-shm
```

Restore:

1. Stop the app.
2. Replace the active SQLite file with the backup file.
3. Restart the app.
4. Verify the company, products, customers, invoices, and ledger remain consistent.

## 13. Verification recorded for this repository

The current repository has passed `npm ci`, TypeScript lint, production build,
development smoke, production-style smoke, live handoff validation, the full
`npm test` suite, P0 transaction-boundary validation, P0-06 vertical runtime,
P0-07 onboarding, product reconciliation, and invoice HTTP lifecycle checks.
Statutory authority integrations still require their real credentials.

## 14. Stop and backup

Stop a foreground server with `Ctrl+C`. The default SQLite database is
`data\local\am_business_platform.db`. With the server stopped:

```bat
copy data\local\am_business_platform.db data\local\am_business_platform_backup.db
```

Keep the database, `-wal`, and `-shm` files together for a live WAL backup.

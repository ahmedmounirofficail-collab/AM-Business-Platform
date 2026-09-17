# LOCAL HANDOFF

HANDOFF_STATUS: READY_FOR_LOCAL_VALIDATION

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

```bash
cp .env.example .env
npm install
```

## 5. Environment

Use the values in `.env.example` and set real local secrets only on the target machine.

Required local settings:

```bash
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

Optional:

```bash
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

```bash
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

```bash
npm install
npm run lint
npm run build
npm test
npm run validate:local
npm run dev
```

If the server is already running:

```bash
npm run validate:local -- --check-server
```

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

## 12. Known limitations

- This environment blocked direct npm execution because the sandbox lacks the required `slirp4netns` dependency. This is an environment-only limitation and not an application architecture failure.
- Final ERP validation must still be executed on the target Windows local machine.
- Any statutory certification claims require real credentials and authority verification outside this sandbox.

## 13. AI Studio validation limitation

NOT EXECUTED — ENVIRONMENT BLOCKED

The current AI Studio sandbox prevented npm execution and shell environment validation. The project is prepared for local validation, but the actual local runtime test and business-flow validation must be performed on a real Windows workstation.

## 14. Final status

The current repository is handoff-ready for local validation and not blocked by code-level architecture changes.

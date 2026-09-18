# AM CONSULTANT Production First-Run Closure

## Architecture

Production onboarding uses the existing SQLite persistence layer, onboarding materializer,
vertical profile registry, security engine, Chart of Accounts, General Ledger engine, and
financial reporting services. No opening-balance table or parallel ledger was introduced.

Demo data remains gated by `DEMO_MODE=true` or `ALLOW_DEMO_SEED_DATA=true` outside production.
The production closure test explicitly runs with both flags disabled.

## Implemented Flow

```text
Fresh SQLite database
→ onboarding materialization
→ hashed Administrator credentials
→ persistent setup completion
→ completion screen
→ clean Dashboard
→ Accounting / Opening Balances
→ balanced OPENING journal
→ canonical GL
→ Trial Balance and financial reports
→ server restart
→ persisted journal and balances
```

The completion screen distinguishes setup completion from opening-balance posting and daily
operations. The Dashboard exposes an opening-balance CTA when no operational records exist.

## Accounting Flow

Opening entries are submitted through `ApiClient.createJournalEntry` and the existing
`/api/v1/accounting/journals` endpoint. The endpoint validates double-entry balance, validates
the open fiscal period, creates an `OPENING` entry through `GeneralLedgerEngine`, posts it to
the canonical `glJournals` collection, updates `glAccounts`, and keeps the legacy journal API
projection synchronized for compatibility.

On clean production onboarding, the GL account and fiscal-period projections are hydrated from
the persisted onboarding accounts and fiscal periods. The commercial vertical always receives
an `Opening Balance Equity` account (`3010`) for opening-balance posting.

## Opening Balance Test

`npm run test:production-first-run-closure` executes:

- Fresh production SQLite database with all operational collections asserted empty.
- Onboarding materialization with a user-supplied administrator password and PIN.
- Password and PIN hash verification.
- Unbalanced opening attempt (`100,000` debit / `50,000` credit) rejected without a journal.
- Balanced opening entry:
  - Cash debit: `100,000`
  - Bank debit: `200,000`
  - Opening Balance Equity credit: `300,000`
- Canonical GL journal assertion: exactly one posted `OPENING` entry.
- Trial Balance assertion: debit `300,000`, credit `300,000`, difference `0`.
- Balance Sheet assertion: assets `300,000`, equity `300,000`, balanced.
- Account balances: Cash `100,000`, Bank `200,000`, Equity `300,000`.

## Persistence Test

The test stops and starts the production server against the same SQLite database, logs in again,
and verifies the same opening journal and balanced Trial Balance from persisted storage.

## Full-Cycle and Year-End Coverage

Existing regression suites cover financial-event posting, invoice-to-journal lifecycle,
inventory reconciliation, Trial Balance integrity, period controls, period close, year-end
close, exports, and commercial E2E behavior. The new closure test covers the production
first-run and opening-balance boundary that was previously missing.

## Browser Test

`npm run test:browser-acceptance` passes the existing Playwright matrix for:

- 1440x900, 1280x800
- 1024x768, 768x1024
- 390x844, 375x812
- English LTR and Arabic RTL
- Navigation, responsive layout, mobile menu, and horizontal-overflow checks

Evidence is saved under `data/browser-acceptance`.

## Regression and Security

The closure changes are checked by TypeScript lint, production build, first-run verification,
onboarding certification, commercial E2E, invoice HTTP lifecycle, product reconciliation,
transaction-boundary controls, route controls, real PDF/XLSX exports, browser acceptance, and
`npm audit --audit-level=high`.

No default production credentials are used by the login UI or Platform Context. Credentials
created during onboarding are hashed by the existing Security Engine and raw values are removed
from persisted wizard data.

## Known Issues / Remaining Blockers

No critical blocker remains for the production first-run, opening-balance, persistence, and
ledger/report flow covered by the closure test. The existing broad browser acceptance suite
continues to use its explicit test/demo configuration because it exercises the pre-existing
commercial navigation dataset; the production closure proof is intentionally isolated in the
new SQLite/server integration test.

# Final Accounting & Annual Closing Certification

## Architecture

The platform retains the existing `GeneralLedgerEngine` and its canonical `glAccounts`,
`glJournals`, fiscal-period, closing-snapshot, and audit-trail collections as the
financial source of truth. Operational modules emit events into the existing posting
services; no parallel ledger or opening-balance store was introduced.

## Policies and controls verified

- First-run production databases start without operational records and without demo
  seed flags.
- Administrator passwords and PINs are supplied during setup and stored as hashes.
- Opening balances use the existing journal API and are posted as `OPENING` entries
  into the canonical GL.
- Double-entry validation rejects unbalanced journals without persistence.
- Existing tax/posting integrity scenarios cover purchases, sales, returns, discounts,
  rounding, idempotency, atomicity, tenant isolation, and source-to-GL traceability.
- Commercial E2E covers branches, warehouses, customers, suppliers, products,
  opening stock, purchase receipt, sales, customer receipt, reports, and balances.
- Fiscal year closing creates a posted, traceable closing journal, transfers the
  result to the selected equity account, records an audit event, and persists all
  closing state across restart. The next fiscal year and its twelve open periods
  are created and persisted as part of the close workflow.
- PDF and XLSX exports are generated from report responses and parsed as real files.
- Browser acceptance covers six required viewport sizes in Arabic RTL and English LTR.

## Automatic posting matrix

The existing financial-event and posting-rule engines remain authoritative for
purchase invoices, sales invoices, tax, credit/debit notes, receipts, payments,
inventory events, and source-document traceability. The certification reuses the
existing integrity and commercial suites rather than duplicating posting logic.

## Exact certification command

```bash
npm run test:final-accounting-certification
```

The command emits human-readable results and writes the machine-readable report to
`data/final-accounting-certification.json`.

## Executed result

| Gate | Result |
|---|---|
| First Run and Opening Balances | PASS |
| Automatic Accounting Integrity | PASS |
| Commercial Operational E2E | PASS |
| Product Reconciliation | PASS |
| Fiscal Period and Year-End Closing | PASS |
| Real PDF and XLSX Exports | PASS |
| First Run Browser Acceptance | PASS |
| Browser Acceptance Matrix | PASS |
| Dependency Security Audit | PASS |
| Final Result | PASS |

The annual-closing test explicitly stopped and restarted the server, then verified
that the closed fiscal year, closing journal, and `YEAR_END_CLOSED` audit event were
still present.

## Root cause fixed in this certification

Period and year-end close routes previously changed in-memory state without explicitly
persisting every resulting fiscal-year, account, journal, snapshot, and audit record.
Those records are now persisted through the existing persistence registry.

## Known limitations and remaining gaps

- The repository still contains broader legacy/pilot terminology in internal source
  names; it is not exposed by the production first-run screen.
- The existing transaction-boundary suite reports two intentionally unavailable
  proofs requiring shared durable uniqueness and a real manufacturing transaction
  context. They remain `NOT AVAILABLE`, not false passes.
- Full external bank-feed reconciliation, payroll posting, and production provider
  credentials cannot be certified in this repository-only environment.
- The certification command validates the implemented API/report/export paths; it does
  not claim external statutory filing or bank-provider certification.

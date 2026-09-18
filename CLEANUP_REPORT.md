# Controlled Repository Cleanup Report

## Repository Cleanup Summary

| Measure | Result |
|---|---:|
| Files reviewed | 292 tracked files in `src/`, `server/`, `scripts/`, `docs/`, `public/`, and root configuration |
| Files retained | 290 |
| Files moved | 0 |
| Files deleted | 2 |
| Duplicates consolidated | 0 |
| Dependencies removed | 0 |
| Scripts removed | 1 |
| Tests retained | All npm-linked and certification scripts |
| Documentation retained | All architecture, deployment, certification, and module-contract documents |

The cleanup intentionally made only proven-safe removals. No business logic,
accounting rule, costing method, currency behavior, authorization rule,
persistence path, asset, fixture, or certification suite was removed.

## Deleted Files

### `scripts/run_pilot_certification.ts`

- **Reason:** standalone wrapper was not referenced by `package.json`, README,
  documentation, runtime startup, or any verification script.
- **Evidence:** repository-wide reference search found only the file itself and
  the imported `PilotCertificationGateSuite`; the suite remains used directly
  by `scripts/verify_all_phases.ts`.
- **Tests affected:** none; the suite remains part of `npm test`.
- **Validation:** lint, build, full tests, and certification suites passed.

### `src/utils/formatters.ts`

- **Reason:** no imports or runtime consumers existed.
- **Evidence:** repository-wide search found only its own declarations. Currency
  formatting now has the canonical implementation in
  `src/financial/financialLocalization.ts`.
- **Tests affected:** none.
- **Validation:** lint, build, financial/localization tests, and full suites passed.

## Moved Files

None. No move was justified without introducing path churn.

## Dependencies Removed

None. Every package in `package.json` has a direct build, runtime, test, or
configuration consumer.

## Duplicates Reviewed

Brand assets under `public/`, `data/branding_assets/platform/`, and generated
`dist/` are not duplicates with interchangeable ownership:

- `public/` assets are frontend build inputs.
- `data/branding_assets/platform/` assets are runtime branding assets.
- `dist/` assets are generated build output and are ignored by Git.

`src/data/mockDatabase.ts` is a compatibility export boundary for
`src/data/demoSeedData.ts` and remains required by runtime/certification imports.
It was retained.

## Classification

- **A — Required / Used:** Core services, domain engines, UI modules, runtime
  routes, configuration, and production assets.
- **B — Referenced Indirectly:** barrel exports, compatibility data boundaries,
  dynamic route/module consumers, and generated asset paths.
- **C — Test / Certification Required:** all `scripts/verify_*`,
  `scripts/seed_commercial_test.ts`, and linked hardening suites.
- **D — Operational / Build Required:** `server.ts`, Vite/esbuild config,
  `package.json`, `package-lock.json`, environment example, public assets,
  and deployment/handoff documentation.
- **E — Duplicate:** none proven.
- **F — Obsolete:** only the two deleted files above were proven obsolete.
- **G — Dead / Unused:** only the two deleted files above were proven dead.
- **H — Uncertain:** generated local databases, WAL files, `dist/`, and
  certification output are intentionally ignored runtime artifacts; they were
  not deleted or changed by this cleanup.

## Validation

Baseline and post-cleanup verification were run sequentially where SQLite
fixtures are shared:

```bash
npm run lint
npm run build
npm test
npm run test:p0-controls
npm run test:p0-boundary
npm run test:financial-localization-costing
npm run test:final-accounting-certification
npm run test:final-full-system-certification
npm run test:commercial-e2e
npm run test:product-reconciliation
npm run test:fiscal-year-closing
npm run test:real-exports
npm run test:first-run
npm run test:production-first-run-closure
npm audit --audit-level=high
```

All required checks passed after deletion. No dependency manifest changes were
made, so `npm install` was not required.

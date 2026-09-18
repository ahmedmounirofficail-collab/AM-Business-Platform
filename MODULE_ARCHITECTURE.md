# Module Contracts

The platform is organized around the Core runtime in `server.ts`, the shared
security/persistence services under `server/`, and domain engines under
`src/engine/`.

| Module | Owns | Reads / writes | Publishes | Accounting |
|---|---|---|---|---|
| Sales / POS | customers, invoices, returns, checkout | customer, item, warehouse contracts | sales, receipt, return events | consumes central posting policies |
| Inventory / Warehouses | items, quants, movements, cost layers | purchasing receipts, sales issues | stock, valuation, COGS source events | never creates a parallel ledger |
| Purchasing / Suppliers | suppliers, requisitions, POs, GRNs, landed costs | item, currency, tax, warehouse | receipt, AP, landed-cost events | central GL financial events |
| AR / AP | receivables, payables, allocations, aging | sales, purchasing, cash | settlement and reconciliation events | central GL control accounts |
| Treasury | cash, banks, transfers, reconciliation | company accounts, currencies | cash and bank events | central GL cash/bank accounts |
| Fixed Assets | asset lifecycle, depreciation, disposal | GL and company configuration | asset financial events | central GL asset/expense accounts |
| HR / Payroll | employees, runs, deductions, approvals | company, periods, users | payroll events | central GL payroll accounts |
| Commissions | plans, eligibility, accruals, approvals | sales events and employee scope | accrual and settlement events | central GL commission accounts |

## Core contract

Every module uses authenticated tenant/company scope, server-side route
authorization, fiscal-period guards, durable persistence, audit records, and the
canonical financial-event/GL path. New modules register routes and permissions
through the existing server route and authorization boundaries instead of
creating module-local identity, period, audit, or ledger implementations.

## External boundary

Bank feeds, WPS, statutory filing, and external payroll/AI providers remain
adapter contracts with explicit `EXTERNAL / NOT VERIFIED` status when provider
credentials or connectivity are unavailable.

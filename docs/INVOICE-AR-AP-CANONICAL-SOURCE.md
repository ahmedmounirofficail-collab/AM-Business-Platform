# Invoice and AR/AP Canonical Source

## Decision

The canonical customer invoice source is the AR aggregate exposed by:

```text
POST /api/v1/ar/invoices
GET  /api/v1/ar/invoices/:id
```

It persists `CustomerSalesInvoice` records in the durable `arSalesInvoices`
collection and posts through the existing `SalesInvoice` financial posting rule.
The invoice stores `journalEntryId` and `financialEventId` when posting succeeds.

Customer payments, allocations, statements, aging, and credit notes use the
same AR collections and engines:

```text
/api/v1/ar/receipts
/api/v1/ar/allocations
/api/v1/ar/statements/:customerId
/api/v1/ar/aging
/api/v1/ar/credit-notes
```

The canonical supplier invoice source is the AP aggregate:

```text
/api/v1/ap/supplier-invoices
/api/v1/ap/payment-batches
```

## Backward Compatibility

The legacy sales invoice path remains in `server.ts` for existing sales/POS
flows. It is not treated as a second AR aggregate. It currently has separate
document collections and must not be presented as an AR invoice link unless a
persisted relationship exists.

No third invoice implementation is introduced.

## Current Proof

- AR invoice posting resolves the effective fiscal period from the invoice
  date and rejects missing, closed, or locked periods.
- Invoice posting uses the existing `SalesInvoice` posting rule.
- Invoice detail returns persisted accounting, financial-event, payment,
  credit-note, and sales-order references only when present.
- Credit notes linked to an invoice are validated against its remaining
  balance and use the existing sales-return posting behavior.
- Allocation records retain the actual persisted receipt ID and number.
- Unallocated receipts do not reduce customer AR balance or statement balance.

## Remaining Gaps

- Quote → order → delivery → invoice lineage is not complete in persisted data.
- Actual HTTP integration certification for all invoice, payment, allocation,
  credit-note, and AP paths is still required.
- Concurrent duplicate protection requires a shared durable uniqueness boundary.
- Print/PDF production output is not currently implemented or certified.

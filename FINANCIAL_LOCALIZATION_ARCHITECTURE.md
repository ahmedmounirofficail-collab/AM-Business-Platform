# Financial, Localization, Currency, and Costing Architecture

## Verified internal design

Companies carry a base currency and localization configuration. The Egyptian
country profile defaults to `EGP`; Saudi profiles continue to default to `SAR`.
Currency identity is always an ISO-4217 code, not display text.

Foreign transactions preserve:

- transaction currency and amount
- exchange rate and effective date
- exchange-rate source
- base currency and base-currency amount

`src/financial/financialLocalization.ts` is the shared boundary for currency
validation, exchange-rate resolution, currency-aware rounding, conversion, and
localized money formatting.

## Costing

`src/engine/costingEngine.ts` provides deterministic, reusable costing
algorithms:

- FIFO issue valuation
- weighted-average unit cost
- landed-cost allocation by value or quantity

It only calculates inventory valuation. Accounting remains owned by the central
financial-event and GL infrastructure. Existing goods-receipt landed-cost
workflow remains the persistence and audit integration surface.

## External status

Central-bank rate feeds, statutory tax submissions, bank feeds, and WPS remain
`EXTERNAL / NOT VERIFIED` unless credentials and a reachable provider are
available. Local exchange-rate records and adapter contracts are not presented
as proof of external connectivity.

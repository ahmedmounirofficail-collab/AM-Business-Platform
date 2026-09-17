# ADR: ERP P0 Transaction Boundary

## Context

The current ERP runtime is an in-process TypeScript application backed by
durable collections. Manufacturing calls `InventoryExecutionEngine` directly
and receives an `ExecutionEngineResult`; the inventory engine mutates the
passed arrays (`items`, `quants`, and the stock ledger) before the caller
constructs a work-order result and a financial-event payload.

The financial event path is separate. `FinancialEventEngine` validates the
tenant, company, fiscal year, and fiscal period before posting, and it
rolls back account balances when a GL line cannot be applied. It then appends
the journal entry, financial event, and audit record to separate collections.
`InventoryFinancialIntegrationEngine` provides a durable-looking queue for
inventory-to-GL processing, but it is not a transaction context shared with
the manufacturing inventory mutation or work-order aggregate.

The HTTP period middleware protects configured financial mutation routes. It
does not make a domain financial event valid, and it does not coordinate
inventory, WIP, audit, queue, and GL writes.

## Decision

1. Treat the current manufacturing flow as **transactionally coordinated**, not
   atomic:

   `business operation -> inventory mutation / work-order result -> financial
   event payload -> optional queue processor -> GL`

2. A `FinancialEvent` is considered domain-valid only when tenant, company,
   source type, source id, idempotency key, actor, creation time, and an
   effective fiscal year/period are present and the period validator accepts
   the period. HTTP middleware is an additional protection, not the domain
   guarantee.

3. The four manufacturing operations are classified as follows:

| Operation | Current persisted state | Inventory | WIP | Financial event | GL | Audit | Boundary | Retry / idempotency |
|---|---|---|---|---|---|---|---|---|
| Goods Issue | Work-order copy and inventory arrays are mutated by the caller | Direct `InventoryExecutionEngine` mutation and ledger append | Work-order result increases material actual cost and WIP | Payload is returned; it is not persisted by this method | Not in the method; may be queued later | Not in the method | No shared transaction context | Inventory rollback exists for a failed multi-line issue; cross-process duplicate proof is unavailable |
| Production Confirmation | Returned work-order copy and confirmation | None | Returned WIP/cost summary increases | No financial event is emitted by `confirmOperation` | None | None | Pure in-memory result | No persistence or idempotency boundary |
| Finished Goods Receipt | Work-order copy and inventory arrays are mutated by the caller | Direct receipt mutation and ledger append | Returned WIP decreases | Payload is returned; it is not persisted by this method | Not in the method; may be queued later | Not in the method | No shared transaction context | Inventory rollback exists for movement failure; concurrent duplicate proof is unavailable |
| Work-order Settlement | Returned work-order copy is marked closed and sealed | None | Returned WIP is set to zero | Payload is returned; it is not persisted by this method | Not in the method | Hash is created, but audit persistence is external | No shared transaction context | No durable idempotency key or atomic commit |

4. Do not add another generic guard, wrapper, fake transaction, or snapshot
   layer to claim atomicity. The minimum future interface change is to pass a
   repository transaction/persistence context through manufacturing and
   `InventoryExecutionEngine`, and to persist the business aggregate,
   inventory ledger, financial event/outbox record, and audit record in the
   same database transaction. If the GL remains asynchronous, completion must
   mean “durable outbox accepted”; final accounting completion is a later
   processor state.

5. Reconciliation remains a separate proof gap. No current production-oriented
   test proves success, rollback, retry, duplicate, and concurrent duplicate
   across proposal, approval, posting, event, GL, audit, and status. A
   concurrent proof is explicitly **not available** with the current
   in-memory collection/queue model.

## Why

The existing rollback snapshots protect only selected in-memory inventory
arrays. They cannot undo a persisted GL posting, an audit write, or a queue
state transition, and they cannot provide a process-wide uniqueness lock.
Adding wrappers would make failure handling look stronger without changing
the commit boundary.

The financial event engine already rejects missing or invalid fiscal periods
when called directly. This is the domain protection that must remain
authoritative; the HTTP period guard only rejects matching closed/locked
periods on configured routes.

## Consequences

### Benefits

- The system makes a truthful distinction between HTTP protection and domain
  validation.
- Existing working inventory and financial behavior is preserved.
- Retry behavior that is actually demonstrated remains documented.
- The required migration is constrained to a repository/transaction boundary
  rather than a broad rewrite.

### Costs

- Manufacturing cannot currently claim one commit spanning inventory, WIP,
  financial event, GL, and audit.
- Asynchronous GL processing means business completion and accounting
  completion are different states.
- Concurrent duplicate protection cannot be certified from the current
  collection-based implementation.

## Remaining Risk

- A failure after inventory mutation but before durable financial-event/outbox
  persistence can leave a partial business state outside the local inventory
  snapshot.
- `FinancialEvent` fields are optional in the shared TypeScript type and some
  legacy callers do not supply an idempotency key or effective period.
- Audit callbacks can be no-ops, so an apparently successful posting is not
  proof of durable audit persistence.
- Route fixture tests prove middleware behavior on their fixture handlers, not
  every production handler. Production handler coverage remains a separate
  inventory and certification task.

## Migration Boundary

The smallest credible P0 migration is:

1. Introduce a real repository transaction context (database transaction or
   equivalent durable unit-of-work), not an interface-only wrapper.
2. Make the context available to `InventoryExecutionEngine` and the
   manufacturing aggregate without creating a second inventory store.
3. Persist a complete financial event plus unique idempotency key and accepted
   outbox record before returning a non-final business result.
4. Make the outbox processor idempotent at the GL posting boundary and expose
   `PENDING`, `PROCESSED`, and `FAILED_RETRYABLE` states.
5. Add failure-injection tests against the actual handlers after the durable
   boundary exists.

Until those steps exist, the status is:

> **P0 BLOCKED BY ARCHITECTURE** — inventory, WIP, financial event, GL, and
> audit do not share one actual transaction boundary.


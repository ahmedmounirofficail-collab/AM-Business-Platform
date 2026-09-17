import { FinancialEventEngine } from '../src/engine/financialEventEngine';
import { InventoryExecutionEngine } from '../src/engine/inventoryExecutionEngine';
import { Account, FinancialEvent, InventoryItem, JournalEntry, PostingRule, StockQuant, Warehouse } from '../src/types';
import { INITIAL_ACCOUNTS, INITIAL_POSTING_RULES } from '../src/data/mockDatabase';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function createFinancialHarness() {
  return {
    accounts: JSON.parse(JSON.stringify(INITIAL_ACCOUNTS)) as Account[],
    rules: JSON.parse(JSON.stringify(INITIAL_POSTING_RULES)) as PostingRule[],
    journalEntries: [] as JournalEntry[],
    financialEvents: [] as FinancialEvent[]
  };
}

function testFinancialPeriodDomain() {
  const harness = createFinancialHarness();
  const base = {
    tenantId: 'ten-001',
    companyId: 'comp-001',
    eventType: 'PURCHASE_INVOICE_POSTED' as const,
    sourceDocumentType: 'PurchaseInvoice',
    sourceDocumentId: 'boundary-period-1',
    sourceDocumentNumber: 'PINV-BOUNDARY-1',
    amount: 100,
    currency: 'SAR',
    triggeredBy: 'user-boundary',
    triggeredByName: 'Boundary Test'
  };
  const invoke = (fiscalYear?: number, fiscalPeriod?: number, suffix = '1') => FinancialEventEngine.processEvent(
    {
      ...base,
      sourceDocumentId: `boundary-period-${suffix}`,
      sourceDocumentNumber: `PINV-BOUNDARY-${suffix}`,
      fiscalYear,
      fiscalPeriod,
      validateFiscalPeriod: (_tenantId: string, _companyId: string, _year: number, period: number) => {
        if (period === 1) throw new Error('closed period');
      }
    },
    harness.rules,
    harness.accounts,
    harness.journalEntries,
    harness.financialEvents,
    () => 'JE-BOUNDARY',
    () => undefined
  );

  let missingRejected = false;
  try { invoke(); } catch { missingRejected = true; }
  assert(missingRejected, 'missing effective period is rejected by the domain engine');

  let invalidRejected = false;
  try { invoke(2026, 14); } catch { invalidRejected = true; }
  assert(invalidRejected, 'invalid effective period is rejected by the domain engine');

  let closedRejected = false;
  try {
    invoke(2026, 1);
  } catch {
    closedRejected = true;
  }
  assert(closedRejected, 'closed period is rejected by the domain validator');

  const result = invoke(2026, 2, '2');
  assert(result.financialEvent.fiscalYear === 2026 && result.financialEvent.periodNumber === 2, 'valid open-period data is persisted on the event');
}

function testSequentialRetry() {
  const harness = createFinancialHarness();
  const params = {
    tenantId: 'ten-001',
    companyId: 'comp-001',
    fiscalYear: 2026,
    fiscalPeriod: 2,
    eventType: 'PURCHASE_INVOICE_POSTED' as const,
    sourceDocumentType: 'PurchaseInvoice',
    sourceDocumentId: 'boundary-retry-1',
    sourceDocumentNumber: 'PINV-BOUNDARY-RETRY',
    amount: 100,
    currency: 'SAR',
    triggeredBy: 'user-boundary',
    triggeredByName: 'Boundary Test'
  };
  const publish = () => FinancialEventEngine.processEvent(
    params,
    harness.rules,
    harness.accounts,
    harness.journalEntries,
    harness.financialEvents,
    () => `JE-BOUNDARY-${harness.journalEntries.length + 1}`,
    () => undefined
  );
  const first = publish();
  const second = publish();
  assert(first.journalEntry !== null, 'first financial event posts a journal entry');
  assert(second.journalEntry?.id === first.journalEntry?.id, 'sequential retry returns the existing journal entry');
  assert(harness.journalEntries.length === 1 && harness.financialEvents.length === 1, 'sequential retry does not duplicate persisted state');
}

function testInventoryRollbackOnActualHandlerMovementFailure() {
  const item: InventoryItem = {
    id: 'item-boundary',
    tenantId: 'ten-001',
    companyId: 'comp-001',
    sku: 'COMP-BOUNDARY',
    name: 'Boundary Component',
    categoryId: 'raw',
    categoryName: 'Raw',
    uom: 'EA',
    costPrice: 10,
    stockQty: 1
  } as InventoryItem;
  const warehouse: Warehouse = {
    id: 'wh-boundary',
    tenantId: 'ten-001',
    companyId: 'comp-001',
    name: 'Boundary Warehouse'
  } as Warehouse;
  const quant: StockQuant = {
    id: 'quant-boundary',
    tenantId: 'ten-001',
    companyId: 'comp-001',
    itemSku: item.sku,
    itemName: item.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    binId: 'bin-default',
    binCode: 'BIN-DEFAULT',
    qtyOnHand: 1,
    qtyAvailable: 1,
    qtyReserved: 0,
    qtyInTransit: 0,
    qtyDamaged: 0,
    qtyReturned: 0,
    unitCost: 10,
    totalValue: 10,
    uom: 'EA',
    status: 'Available',
    updatedAt: new Date().toISOString()
  } as StockQuant;
  const context = {
    items: [item],
    warehouses: [warehouse],
    bins: [],
    quants: [quant],
    batchLots: [],
    serials: [],
    stockLedgerEntries: []
  };
  const before = JSON.stringify(context);
  let failed = false;
  try {
    InventoryExecutionEngine.executeGoodsIssue({
      tenantId: 'ten-001',
      companyId: 'comp-001',
      itemSku: item.sku,
      warehouseId: warehouse.id,
      quantity: 2,
      sourceDocumentType: 'ProductionGoodsIssue',
      sourceDocumentId: 'boundary-issue-1',
      sourceDocumentNumber: 'GI-BOUNDARY-1',
      userId: 'user-boundary',
      userName: 'Boundary Test'
    }, context);
  } catch {
    failed = true;
  }
  assert(failed, 'actual inventory movement path rejects a negative-stock issue');
  assert(JSON.stringify(context) === before, 'rejected inventory movement leaves its context unchanged');
}

testFinancialPeriodDomain();
testSequentialRetry();
testInventoryRollbackOnActualHandlerMovementFailure();
console.log('NOT AVAILABLE: concurrent duplicate proof requires a shared durable uniqueness boundary');
console.log('NOT AVAILABLE: cross-domain manufacturing failure injection requires a real transaction context');

import { ReconciliationEngine } from '../src/engine/reconciliationEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const report = ReconciliationEngine.generateReport({
  companyId: 'comp-001',
  period: '2026-09',
  accounts: [
    { code: '1020', balance: 100 },
    { code: '2010', balance: 80 },
    { code: '1030', balance: 50 },
    { code: '1040', balance: 10 },
    { code: '2020', balance: 20 }
  ],
  customers: [{ id: 'customer-1', balance: 100 }],
  vendors: [{ id: 'vendor-1', balance: 80 }],
  inventory: [{ stockQty: 6, costPrice: 10 }],
  fixedAssets: [],
  banks: [],
  invoices: [{ grandTotal: 100 }],
  purchaseInvoices: [{ grandTotal: 80 }]
});

const byModule = (module: string) => report.modules.find(line => line.module === module)!;

assert(byModule('AR').status === 'COMPLETED', 'AR reconciliation completes when subledger equals GL');
assert(byModule('AP').status === 'COMPLETED', 'AP reconciliation completes when subledger equals GL');
assert(byModule('INVENTORY').status === 'EXCEPTION', 'inventory difference remains visible');
assert(byModule('ASSETS').status === 'PENDING', 'asset reconciliation is pending without an asset source');
assert(byModule('BANK').status === 'PENDING', 'bank reconciliation is pending without a bank source');
assert(byModule('PAYROLL').status === 'PENDING', 'payroll is pending until a real payroll source exists');
assert(byModule('INVENTORY').difference === 10, 'difference is reported without auto-balancing');

console.log('PASS: reconciliation report is generated from supplied persisted data only');

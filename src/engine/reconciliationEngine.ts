export type ReconciliationModule =
  | 'AR'
  | 'AP'
  | 'INVENTORY'
  | 'ASSETS'
  | 'BANK'
  | 'TAX'
  | 'PAYROLL'
  | 'OPENING_BALANCES';

export type ReconciliationStatus = 'COMPLETED' | 'EXCEPTION' | 'PENDING';

export interface ReconciliationLine {
  module: ReconciliationModule;
  period: string;
  companyId: string;
  branchId?: string;
  opening: number;
  movements: number;
  adjustments: number;
  subledgerBalance: number;
  glBalance: number;
  difference: number;
  status: ReconciliationStatus;
  lastUpdated: string;
  source: string;
}

export interface ReconciliationReport {
  period: string;
  companyId: string;
  generatedAt: string;
  modules: ReconciliationLine[];
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function glBalance(accounts: any[], codes: string[]): number {
  return rounded(accounts
    .filter(account => codes.includes(String(account.code)))
    .reduce((total, account) => total + amount(account.balance), 0));
}

function statusFor(subledgerBalance: number, gl: number, hasSource: boolean): ReconciliationStatus {
  if (!hasSource) return 'PENDING';
  return Math.abs(subledgerBalance - gl) < 0.01 ? 'COMPLETED' : 'EXCEPTION';
}

function line(
  module: ReconciliationModule,
  period: string,
  companyId: string,
  subledgerBalance: number,
  gl: number,
  source: string,
  movements = 0,
  adjustments = 0
): ReconciliationLine {
  const normalizedSubledger = rounded(subledgerBalance);
  const normalizedGl = rounded(gl);
  return {
    module,
    period,
    companyId,
    opening: 0,
    movements: rounded(movements),
    adjustments: rounded(adjustments),
    subledgerBalance: normalizedSubledger,
    glBalance: normalizedGl,
    difference: rounded(normalizedSubledger - normalizedGl),
    status: statusFor(normalizedSubledger, normalizedGl, Boolean(source)),
    lastUpdated: new Date().toISOString(),
    source
  };
}

export class ReconciliationEngine {
  static generateReport(params: {
    companyId: string;
    period: string;
    accounts: any[];
    customers: any[];
    vendors: any[];
    inventory: any[];
    fixedAssets: any[];
    banks: any[];
    invoices: any[];
    purchaseInvoices: any[];
  }): ReconciliationReport {
    const {
      companyId,
      period,
      accounts,
      customers,
      vendors,
      inventory,
      fixedAssets,
      banks,
      invoices,
      purchaseInvoices
    } = params;

    const inventoryBalance = inventory.reduce(
      (total, item) => total + amount(item.stockQty) * amount(item.costPrice || item.unitCost),
      0
    );
    const assetBalance = fixedAssets.reduce(
      (total, asset) => total + amount(asset.netBookValue ?? asset.bookValue ?? asset.currentBookValue ?? asset.acquisitionCost),
      0
    );
    const bankBalance = banks.reduce(
      (total, bank) => total + amount(bank.currentBalance ?? bank.balance ?? bank.availableBalance),
      0
    );
    const arBalance = customers.reduce((total, customer) => total + amount(customer.balance), 0);
    const apBalance = vendors.reduce((total, vendor) => total + amount(vendor.balance), 0);
    const taxBalance = glBalance(accounts, ['1040', '2020']);
    const inventoryMovement = inventory.reduce((total, item) => total + amount(item.stockQty) * amount(item.costPrice || item.unitCost), 0);
    const hasAssets = fixedAssets.length > 0;
    const hasBanks = banks.length > 0;
    const hasPayroll = false;
    const hasOpeningBalances = false;

    return {
      period,
      companyId,
      generatedAt: new Date().toISOString(),
      modules: [
        line('AR', period, companyId, arBalance, glBalance(accounts, ['1020']), 'customers.balance + account 1020', invoices.reduce((t, invoice) => t + amount(invoice.grandTotal || invoice.totalAmount), 0)),
        line('AP', period, companyId, apBalance, glBalance(accounts, ['2010']), 'vendors.balance + account 2010', purchaseInvoices.reduce((t, invoice) => t + amount(invoice.grandTotal || invoice.totalAmount || invoice.amount), 0)),
        line('INVENTORY', period, companyId, inventoryBalance, glBalance(accounts, ['1030', '1200', '1250', '1300']), 'inventory stockQty * costPrice', inventoryMovement),
        line('ASSETS', period, companyId, assetBalance, glBalance(accounts, ['1510', '1520', '1530']), hasAssets ? 'fixed asset register' : ''),
        line('BANK', period, companyId, bankBalance, glBalance(accounts, ['1010']), hasBanks ? 'bank master balances' : ''),
        line('TAX', period, companyId, taxBalance, glBalance(accounts, ['1040', '2020']), 'input/output VAT accounts'),
        line('PAYROLL', period, companyId, 0, 0, hasPayroll ? 'payroll subledger' : ''),
        line('OPENING_BALANCES', period, companyId, 0, 0, hasOpeningBalances ? 'opening balance register' : '')
      ]
    };
  }
}

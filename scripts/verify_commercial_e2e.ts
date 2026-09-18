import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const port = 3322;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), 'data/test_commercial_e2e.db');
const testDate = '2026-09-15';
let server: ChildProcess | undefined;
let stage = 'startup';

type Json = Record<string, any> | any[];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T = Json>(route: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const text = await response.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    throw new Error(`${init.method || 'GET'} ${route} returned non-JSON: ${text.slice(0, 300)}`);
  }
  return { status: response.status, body };
}

async function post<T = Json>(route: string, token: string, payload: unknown): Promise<T> {
  const result = await request<T>(route, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  assert(result.status >= 200 && result.status < 300, `${route} failed with HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function get<T = Json>(route: string, token: string): Promise<T> {
  const result = await request<T>(route, { headers: { authorization: `Bearer ${token}` } });
  assert(result.status >= 200 && result.status < 300, `${route} failed with HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Commercial E2E server did not start');
}

async function main(): Promise<void> {
  await fs.rm(databasePath, { force: true });
  await fs.rm(`${databasePath}-wal`, { force: true });
  await fs.rm(`${databasePath}-shm`, { force: true });

  server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      NODE_ENV: 'test',
      AUTH_TOKEN_SECRET: 'commercial-e2e-test-secret',
      INITIAL_ADMIN_PASSWORD: 'Admin@2026!',
      INITIAL_CASHIER_PIN: '1234',
      ALLOW_DEMO_SEED_DATA: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer();
    const login = await request<{ token?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a.mounir369@gmail.com', password: 'Admin@2026!' })
    });
    assert(login.status === 200 && login.body.token, 'commercial E2E login failed');
    const token = login.body.token;

    stage = 'load master data';
    const branches = await get<any[]>('/api/v1/master/branches', token);
    const warehouses = await get<any[]>('/api/v1/warehouses', token);
    const categories = await get<any[]>('/api/v1/master/item-categories', token);
    const uoms = await get<any[]>('/api/v1/master/units-of-measure', token);
    assert(branches.length >= 2 && warehouses.length >= 2 && categories.length > 0 && uoms.length > 0, 'master dataset is incomplete');

    stage = 'build customers';
    let customers = await get<any[]>('/api/v1/ar/customers', token);
    while (customers.length < 20) {
      const sequence = customers.length + 1;
      await post('/api/v1/ar/customers', token, {
        code: `AM-CUST-${String(sequence).padStart(3, '0')}`,
        name: `AM Commercial Customer ${sequence}`,
        nameAr: `عميل تجاري ${sequence}`,
        currency: 'SAR',
        taxNumber: `3109847281${String(sequence).padStart(3, '0')}`,
        creditLimit: 100000,
        creditDays: 30,
        paymentTermsCode: 'NET30',
        status: 'ACTIVE'
      });
      customers = await get<any[]>('/api/v1/ar/customers', token);
    }

    stage = 'build suppliers';
    let suppliers = await get<any[]>('/api/v1/procurement/vendors', token);
    while (suppliers.length < 10) {
      const sequence = suppliers.length + 1;
      await post('/api/v1/procurement/vendors', token, {
        code: `AM-SUP-${String(sequence).padStart(3, '0')}`,
        name: `AM Commercial Supplier ${sequence}`,
        nameAr: `مورد تجاري ${sequence}`,
        companyId: 'comp-001',
        vendorCategoryId: 'vcat-001',
        currency: 'SAR',
        status: 'ACTIVE',
        category: 'General',
        creditLimit: 100000
      });
      suppliers = await get<any[]>('/api/v1/procurement/vendors', token);
    }

    stage = 'build products';
    let products = await get<any[]>('/api/v1/inventory/items', token);
    while (products.length < 30) {
      const sequence = products.length + 1;
      await post('/api/v1/inventory/items', token, {
        sku: `AM-COM-${String(sequence).padStart(3, '0')}`,
        name: `AM Commercial Product ${sequence}`,
        nameAr: `منتج تجاري ${sequence}`,
        categoryId: categories[0].id,
        categoryName: categories[0].name,
        uom: uoms[0].code || uoms[0].name || 'PCS',
        costPrice: 40,
        sellingPrice: 100,
        stockQty: 0,
        warehouseId: warehouses[0].id,
        valuationMethod: 'FIFO',
        itemType: 'Stock Item'
      });
      products = await get<any[]>('/api/v1/inventory/items', token);
    }

    const product = products.find(item => item.sku === 'AM-COM-001') || products[0];
    const customer = customers.find(item => item.code === 'AM-CUST-001') || customers[0];
    const supplier = suppliers.find(item => item.code === 'AM-SUP-001') || suppliers[0];
    assert(product && customer && supplier, 'commercial anchor records are missing');

    stage = 'create purchase order';
    const po = await post<any>('/api/v1/procurement/purchase-orders', token, {
      data: {
        tenantId: 'ten-001',
        companyId: 'comp-001',
        branchId: branches[0].id,
        vendorId: supplier.id,
        vendorName: supplier.name,
        sourceDocumentType: 'DIRECT',
        poType: 'STANDARD',
        currency: 'SAR',
        exchangeRate: 1,
        poDate: testDate,
        expectedDeliveryDate: testDate,
        paymentTermsCode: 'NET30'
      },
      items: [{
        id: 'am-e2e-po-line-001',
        itemSku: product.sku,
        itemName: product.name,
        warehouseId: warehouses[0].id,
        warehouseName: warehouses[0].name,
        orderedQty: 100,
        uom: product.uom || 'PCS',
        unitPrice: 40,
        taxRate: 0,
        totalAmount: 4000,
        status: 'OPEN'
      }]
    });

    stage = 'post opening stock';
    const opening = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 50, unitCost: 40, uom: product.uom || 'PCS', movementType: 'OPENING_STOCK',
      sourceDocumentType: 'OpeningStock', sourceDocumentId: 'AM-E2E-OPENING-001',
      sourceDocumentNumber: 'AM-E2E-OPENING-001', reference: 'AM Commercial Test Company', reason: 'Opening stock'
    });
    stage = 'post purchase receipt';
    const receipt = await post<any>('/api/v1/inventory/goods-receipt', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 100, unitCost: 40, uom: product.uom || 'PCS', sourceDocumentType: 'PurchaseReceipt',
      sourceDocumentId: po.id, sourceDocumentNumber: po.poNumber, reference: 'AM Commercial Test Company'
    });
    stage = 'post transfer out';
    const transferOut = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 10, unitCost: 40, uom: product.uom || 'PCS', movementType: 'TRANSFER_OUT',
      sourceDocumentType: 'StockTransfer', sourceDocumentId: 'AM-E2E-TRANSFER-001',
      sourceDocumentNumber: 'AM-E2E-TRANSFER-001', reference: warehouses[1].id
    });
    stage = 'post transfer in';
    const transferIn = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[1].id, branchId: branches[1].id,
      quantity: 10, unitCost: 40, uom: product.uom || 'PCS', movementType: 'TRANSFER_IN',
      sourceDocumentType: 'StockTransfer', sourceDocumentId: 'AM-E2E-TRANSFER-001',
      sourceDocumentNumber: 'AM-E2E-TRANSFER-001', reference: warehouses[0].id
    });
    stage = 'post adjustment in';
    const adjustmentIn = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 5, unitCost: 40, uom: product.uom || 'PCS', movementType: 'ADJUSTMENT_PLUS',
      sourceDocumentType: 'InventoryAdjustment', sourceDocumentId: 'AM-E2E-ADJ-001',
      sourceDocumentNumber: 'AM-E2E-ADJ-001'
    });
    stage = 'create sales invoice';
    const sale = await post<any>('/api/v1/ar/invoices', token, {
      customerId: customer.id, salesOrderRef: 'AM-E2E-SALE-001', invoiceDate: testDate,
      dueDate: '2026-10-15', currency: 'SAR',
      lines: [{ itemCode: product.sku, itemName: product.name, quantity: 20, unitPrice: 100, taxRate: 0.15 }]
    });
    stage = 'post goods issue';
    const issue = await post<any>('/api/v1/inventory/goods-issue', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 20, unitCost: 40, uom: product.uom || 'PCS', sourceDocumentType: 'SalesInvoice',
      sourceDocumentId: sale.id, sourceDocumentNumber: sale.invoiceNumber
    });
    stage = 'post adjustment out';
    const adjustmentOut = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 3, unitCost: 40, uom: product.uom || 'PCS', movementType: 'ADJUSTMENT_MINUS',
      sourceDocumentType: 'InventoryAdjustment', sourceDocumentId: 'AM-E2E-ADJ-002',
      sourceDocumentNumber: 'AM-E2E-ADJ-002'
    });
    stage = 'post purchase return';
    const returnOut = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 2, unitCost: 40, uom: product.uom || 'PCS', movementType: 'RETURN_OUT',
      sourceDocumentType: 'PurchaseReturn', sourceDocumentId: 'AM-E2E-PRETURN-001',
      sourceDocumentNumber: 'AM-E2E-PRETURN-001'
    });
    stage = 'post sales return';
    const returnIn = await post<any>('/api/v1/inventory/execution-movement', token, {
      itemSku: product.sku, warehouseId: warehouses[0].id, branchId: branches[0].id,
      quantity: 1, unitCost: 40, uom: product.uom || 'PCS', movementType: 'RETURN_IN',
      sourceDocumentType: 'SalesReturn', sourceDocumentId: 'AM-E2E-SRETURN-001',
      sourceDocumentNumber: 'AM-E2E-SRETURN-001'
    });

    stage = 'post customer receipt';
    const receiptPayment = await post<any>('/api/v1/ar/receipts', token, {
      customerId: customer.id, paymentMethod: 'BANK_TRANSFER', receiptType: 'STANDARD',
      totalAmount: sale.grandTotal, referenceNumber: 'AM-E2E-RECEIPT-001', currency: 'SAR', autoAllocate: true
    });

    stage = 'create supplier invoice';
    const supplierInvoice = await post<any>('/api/v1/ap/supplier-invoices', token, {
      tenantId: 'ten-001', companyId: 'comp-001', branchId: branches[0].id,
      invoiceNumber: 'AM-E2E-SINV-001', vendorInvoiceNumber: 'AM-E2E-SUP-001',
      vendorId: supplier.id, vendorCode: supplier.code, vendorName: supplier.name,
      poId: po.id, poNumber: po.poNumber, grnId: receipt.stockLedgerEntry?.id || receipt.id,
      grnNumber: receipt.stockLedgerEntry?.movementNumber || 'AM-E2E-GRN-001',
      invoiceDate: testDate, postingDate: testDate, dueDate: '2026-10-15',
      currency: 'SAR', exchangeRate: 1, netAmount: 4000, taxAmount: 0, grossAmount: 4000,
      discountAmount: 0, status: 'MATCHED', threeWayMatchStatus: 'MATCHED',
      items: [{ id: 'am-e2e-sinv-line-001', invoiceId: 'AM-E2E-SINV-001', poItemId: 'am-e2e-po-line-001',
        itemSku: product.sku, itemName: product.name, billedQty: 100, unitPrice: 40, taxRate: 0,
        taxAmount: 0, lineTotal: 4000, poUnitPrice: 40, receivedQty: 100 }]
    });
    stage = 'post supplier invoice';
    const postedSupplierInvoice = await post<any>(`/api/v1/ap/supplier-invoices/${supplierInvoice.id}/post`, token, {});
    stage = 'create supplier payment proposal';
    const proposal = await post<any>('/api/v1/ap/payment-proposals', token, {
      cutoffDueDate: '2026-12-31', vendorId: supplier.id
    });
    stage = 'execute supplier payment';
    await post('/api/v1/ap/payment-batches', token, { proposalId: proposal.id, paymentMethod: 'BANK_TRANSFER', bankAccountId: 'bank-001' });

    stage = 'reconcile inventory';
    const movements = await get<any[]>('/api/v1/inventory/ledger', token);
    const ownLedgerIds = [
      opening.stockLedgerEntry?.id,
      receipt.stockLedgerEntry?.id,
      transferOut.stockLedgerEntry?.id,
      transferIn.stockLedgerEntry?.id,
      adjustmentIn.stockLedgerEntry?.id,
      issue.stockLedgerEntry?.id,
      adjustmentOut.stockLedgerEntry?.id,
      returnOut.stockLedgerEntry?.id,
      returnIn.stockLedgerEntry?.id
    ].filter(Boolean);
    const ownMovements = movements.filter(item => ownLedgerIds.includes(item.id));
    const expectedQty = 50 + 100 + 10 + 5 - 20 - 10 - 3 - 2 + 1;
    const actualQty = ownMovements.reduce((total, item) => {
      const type = String(item.movementType);
      return total + (['GOODS_RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_PLUS', 'RETURN_IN', 'OPENING_STOCK'].includes(type) ? Number(item.quantity) : -Number(item.quantity));
    }, 0);
    assert(Math.abs(actualQty - expectedQty) < 0.01, `inventory quantity reconciliation failed: expected ${expectedQty}, actual ${actualQty}`);

    stage = 'load reports and audit';
    const trialBalance = await get<any>('/api/v1/gl/trial-balance?fiscalYear=2026&periodNumber=9&companyId=comp-001', token);
    const trialBalanceIntegrity = await get<any>('/api/v1/gl/trial-balance/verify?fiscalYear=2026&periodNumber=9', token);
    const incomeStatement = await get<any>(`/api/v1/reports/financial/income-statement?startDate=2026-01-01&endDate=${testDate}`, token);
    const balanceSheet = await get<any>(`/api/v1/reports/financial/balance-sheet?asOfDate=${testDate}`, token);
    assert(balanceSheet.totalAssets > 0, 'balance sheet assets are empty');
    assert(balanceSheet.currentAssets.length + balanceSheet.nonCurrentAssets.length > 0, 'balance sheet asset lines are empty');
    assert(balanceSheet.currentLiabilities.length + balanceSheet.nonCurrentLiabilities.length > 0, 'balance sheet liability lines are empty');
    assert(balanceSheet.equityLines.length > 0, 'balance sheet equity lines are empty');
    assert(balanceSheet.isBalanced && Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity) < 0.01, 'balance sheet does not balance');
    const dashboard = await get<any>(`/api/v1/reports/executive-dashboard?asOfDate=${testDate}`, token);
    const arAging = await get<any>(`/api/v1/ar/aging?asOfDate=${testDate}`, token);
    const apAging = await get<any>(`/api/v1/ap/vendor-aging?reportDate=${testDate}`, token);
    const audit = await get<any[]>('/api/v1/audit/logs', token);
    const detail = await get<any>(`/api/v1/ar/invoices/${sale.id}`, token);
    assert(trialBalanceIntegrity.isVerified === true, 'GL trial balance integrity verification failed');
    assert(balanceSheet.currentAssets?.length > 0 && balanceSheet.totalAssets > 0, 'balance sheet must expose GL asset lines');
    assert(balanceSheet.currentLiabilities?.length > 0 && balanceSheet.totalLiabilities > 0, 'balance sheet must expose GL liability lines');
    assert(balanceSheet.equityLines?.length > 0 && balanceSheet.totalEquity > 0, 'balance sheet must expose GL equity lines');
    assert(incomeStatement.grossRevenue > 0 || incomeStatement.operatingExpenses?.length > 0, `income statement must expose GL lines (revenue=${incomeStatement.grossRevenue}, expenses=${incomeStatement.operatingExpenses?.length || 0})`);
    assert(detail.invoice.id === sale.id && detail.accounting.journal?.totalDebit === detail.accounting.journal?.totalCredit, 'invoice source-to-journal drilldown failed');
    assert(Math.abs(sale.grandTotal - receiptPayment.totalAmount) < 0.01, 'customer receipt does not match invoice total');
    assert(Math.abs(sale.grandTotal - receiptPayment.allocatedAmount) < 0.01 && Number(sale.remainAmount || 0) < 0.01, 'customer allocation evidence failed');

    const evidence = {
      dataset: {
        company: 'AM Commercial Test Company',
        branches: branches.length,
        warehouses: warehouses.length,
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        categories: categories.length,
        uoms: uoms.length,
        transactions: { purchaseOrder: po.id, receipt: receipt.stockLedgerEntry?.id || receipt.id, saleInvoice: sale.id, customerReceipt: receiptPayment.id, supplierInvoice: postedSupplierInvoice.invoice.id, inventoryMovements: ownMovements.length }
      },
      reconciliation: {
        inventoryQuantity: { expected: expectedQty, actual: actualQty, difference: Number((actualQty - expectedQty).toFixed(2)) },
        invoice: { subtotal: sale.subtotal, tax: sale.taxTotal, discount: sale.discountTotal, grandTotal: sale.grandTotal, paid: receiptPayment.allocatedAmount, outstanding: sale.remainAmount },
        trialBalance: { totalDebit: trialBalanceIntegrity.totalClosingDebit, totalCredit: trialBalanceIntegrity.totalClosingCredit, integrity: trialBalanceIntegrity },
        financialReports: { incomeStatement, balanceSheet, dashboard, arAging, apAging },
        financialReconciliation: {
          assets: balanceSheet.totalAssets,
          liabilities: balanceSheet.totalLiabilities,
          equity: balanceSheet.totalEquity,
          liabilitiesAndEquity: balanceSheet.totalLiabilitiesAndEquity,
          difference: balanceSheet.balanceDifference,
          isBalanced: balanceSheet.isBalanced
        },
        auditRecordsObserved: audit.length
      }
    };
    await fs.writeFile(path.resolve(process.cwd(), 'data/am-commercial-e2e-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    console.log('PASS: commercial master dataset, purchase-to-stock-to-sale-to-payment cycle, AP payment, inventory quantity reconciliation, reports, invoice drilldown, and audit evidence');
  } finally {
    if (server?.pid) {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 5000);
        server?.once('close', () => { clearTimeout(timeout); resolve(); });
      });
    }
    await fs.rm(databasePath, { force: true });
    await fs.rm(`${databasePath}-wal`, { force: true });
    await fs.rm(`${databasePath}-shm`, { force: true });
  }
}

main().catch(error => {
  console.error(`FAIL at ${stage}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

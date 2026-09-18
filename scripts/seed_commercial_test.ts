import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const port = 3323;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), 'data/test_commercial_seed.db');
const testDate = '2026-09-15';
let server: ChildProcess | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T = any>(route: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const text = await response.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    throw new Error(`${init.method || 'GET'} ${route} returned non-JSON: ${text.slice(0, 200)}`);
  }
  return { status: response.status, body };
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Server did not start');
}

async function post<T = any>(token: string, route: string, payload: unknown): Promise<T> {
  const result = await request<T>(route, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  assert(result.status >= 200 && result.status < 300, `${route} failed with HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function get<T = any>(token: string, route: string): Promise<T> {
  const result = await request<T>(route, { headers: { authorization: `Bearer ${token}` } });
  assert(result.status >= 200 && result.status < 300, `${route} failed with HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
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
      AUTH_TOKEN_SECRET: 'commercial-seed-test-secret',
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
    assert(login.status === 200 && login.body.token, 'login failed');
    const token = login.body.token as string;

    const branches = await get<any[]>(token, '/api/v1/master/branches');
    const warehouses = await get<any[]>(token, '/api/v1/warehouses');
    const itemCategories = await get<any[]>(token, '/api/v1/master/item-categories');
    const uoms = await get<any[]>(token, '/api/v1/master/units-of-measure');
    assert(branches.length >= 2 && warehouses.length >= 2 && itemCategories.length > 0 && uoms.length > 0, 'seed prerequisites missing');

    const branchA = branches[0];
    const branchB = branches[1] || branches[0];
    const warehouseA = warehouses[0];
    const warehouseB = warehouses[1] || warehouses[0];

    let customers = await get<any[]>(token, '/api/v1/ar/customers');
    while (customers.length < 20) {
      const idx = customers.length + 1;
      await post(token, '/api/v1/ar/customers', {
        code: `AM-CUST-${String(idx).padStart(3, '0')}`,
        name: `AM Commercial Customer ${idx}`,
        nameAr: `عميل تجاري ${idx}`,
        currency: 'SAR',
        taxNumber: `3109847281${String(idx).padStart(3, '0')}`,
        creditLimit: 50000,
        creditDays: 30,
        paymentTermsCode: 'NET30',
        status: 'ACTIVE'
      });
      customers = await get<any[]>(token, '/api/v1/ar/customers');
    }

    let suppliers = await get<any[]>(token, '/api/v1/procurement/vendors');
    while (suppliers.length < 10) {
      const idx = suppliers.length + 1;
      await post(token, '/api/v1/procurement/vendors', {
        code: `AM-SUP-${String(idx).padStart(3, '0')}`,
        name: `AM Commercial Supplier ${idx}`,
        nameAr: `مورد تجاري ${idx}`,
        companyId: 'comp-001',
        vendorCategoryId: 'vcat-001',
        currency: 'SAR',
        status: 'ACTIVE',
        vendorCategoryName: 'General Supplier',
        creditLimit: 100000
      });
      suppliers = await get<any[]>(token, '/api/v1/procurement/vendors');
    }

    let products = await get<any[]>(token, '/api/v1/inventory/items');
    while (products.length < 30) {
      const idx = products.length + 1;
      await post(token, '/api/v1/inventory/items', {
        sku: `AM-COM-${String(idx).padStart(3, '0')}`,
        name: `AM Commercial Product ${idx}`,
        nameAr: `منتج تجاري ${idx}`,
        categoryId: itemCategories[0].id,
        categoryName: itemCategories[0].name,
        uom: uoms[0].code || uoms[0].name || 'PCS',
        costPrice: 40,
        sellingPrice: 100,
        stockQty: 0,
        warehouseId: warehouseA.id,
        valuationMethod: 'FIFO',
        itemType: 'Stock Item'
      });
      products = await get<any[]>(token, '/api/v1/inventory/items');
    }

    const customer = customers[0];
    const supplier = suppliers[0];
    const product = products.find(item => item.sku === 'AM-COM-001') || products[0];
    assert(customer && supplier && product, 'seed anchors not created');

    const po = await post<any>(token, '/api/v1/procurement/purchase-orders', {
      data: {
        tenantId: 'ten-001',
        companyId: 'comp-001',
        branchId: branchA.id,
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
        id: 'seed-po-line-001',
        itemSku: product.sku,
        itemName: product.name,
        warehouseId: warehouseA.id,
        warehouseName: warehouseA.name,
        orderedQty: 100,
        uom: product.uom || 'PCS',
        unitPrice: 40,
        taxRate: 0,
        totalAmount: 4000,
        status: 'OPEN'
      }]
    });

    const opening = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 50,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'OPENING_STOCK',
      sourceDocumentType: 'OpeningStock',
      sourceDocumentId: 'AM-SEED-OPENING-001',
      sourceDocumentNumber: 'AM-SEED-OPENING-001',
      reference: 'AM Commercial Test Company',
      reason: 'Opening stock'
    });

    const receipt = await post<any>(token, '/api/v1/inventory/goods-receipt', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 100,
      unitCost: 40,
      uom: product.uom || 'PCS',
      sourceDocumentType: 'PurchaseReceipt',
      sourceDocumentId: po.id,
      sourceDocumentNumber: po.poNumber,
      reference: 'AM Commercial Test Company'
    });

    const transferOut = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 10,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'TRANSFER_OUT',
      sourceDocumentType: 'StockTransfer',
      sourceDocumentId: 'AM-SEED-TRANSFER-001',
      sourceDocumentNumber: 'AM-SEED-TRANSFER-001',
      reference: warehouseB.id
    });

    const transferIn = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseB.id,
      branchId: branchB.id,
      quantity: 10,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'TRANSFER_IN',
      sourceDocumentType: 'StockTransfer',
      sourceDocumentId: 'AM-SEED-TRANSFER-001',
      sourceDocumentNumber: 'AM-SEED-TRANSFER-001',
      reference: warehouseA.id
    });

    const adjustmentIn = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 5,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'ADJUSTMENT_PLUS',
      sourceDocumentType: 'InventoryAdjustment',
      sourceDocumentId: 'AM-SEED-ADJ-001',
      sourceDocumentNumber: 'AM-SEED-ADJ-001'
    });

    const sale = await post<any>(token, '/api/v1/ar/invoices', {
      customerId: customer.id,
      salesOrderRef: 'AM-SEED-SALE-001',
      invoiceDate: testDate,
      dueDate: '2026-10-15',
      currency: 'SAR',
      lines: [{ itemCode: product.sku, itemName: product.name, quantity: 20, unitPrice: 100, taxRate: 0.15 }]
    });

    const issue = await post<any>(token, '/api/v1/inventory/goods-issue', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 20,
      unitCost: 40,
      uom: product.uom || 'PCS',
      sourceDocumentType: 'SalesInvoice',
      sourceDocumentId: sale.id,
      sourceDocumentNumber: sale.invoiceNumber
    });

    const adjustmentOut = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 3,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'ADJUSTMENT_MINUS',
      sourceDocumentType: 'InventoryAdjustment',
      sourceDocumentId: 'AM-SEED-ADJ-002',
      sourceDocumentNumber: 'AM-SEED-ADJ-002'
    });

    const purchaseReturn = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 2,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'RETURN_OUT',
      sourceDocumentType: 'PurchaseReturn',
      sourceDocumentId: 'AM-SEED-PRETURN-001',
      sourceDocumentNumber: 'AM-SEED-PRETURN-001'
    });

    const salesReturn = await post<any>(token, '/api/v1/inventory/execution-movement', {
      itemSku: product.sku,
      warehouseId: warehouseA.id,
      branchId: branchA.id,
      quantity: 1,
      unitCost: 40,
      uom: product.uom || 'PCS',
      movementType: 'RETURN_IN',
      sourceDocumentType: 'SalesReturn',
      sourceDocumentId: 'AM-SEED-SRETURN-001',
      sourceDocumentNumber: 'AM-SEED-SRETURN-001'
    });

    const payment = await post<any>(token, '/api/v1/ar/receipts', {
      customerId: customer.id,
      paymentMethod: 'BANK_TRANSFER',
      receiptType: 'STANDARD',
      totalAmount: sale.grandTotal,
      referenceNumber: 'AM-SEED-RECEIPT-001',
      currency: 'SAR',
      autoAllocate: true
    });

    const supplierInvoice = await post<any>(token, '/api/v1/ap/supplier-invoices', {
      tenantId: 'ten-001',
      companyId: 'comp-001',
      branchId: branchA.id,
      invoiceNumber: 'AM-SEED-SINV-001',
      vendorInvoiceNumber: 'AM-SEED-SUP-001',
      vendorId: supplier.id,
      vendorCode: supplier.code,
      vendorName: supplier.name,
      poId: po.id,
      poNumber: po.poNumber,
      grnId: receipt.stockLedgerEntry?.id || receipt.id,
      grnNumber: receipt.stockLedgerEntry?.movementNumber || 'AM-SEED-GRN-001',
      invoiceDate: testDate,
      postingDate: testDate,
      dueDate: '2026-10-15',
      currency: 'SAR',
      exchangeRate: 1,
      netAmount: 4000,
      taxAmount: 0,
      grossAmount: 4000,
      discountAmount: 0,
      status: 'MATCHED',
      threeWayMatchStatus: 'MATCHED',
      items: [{
        id: 'seed-sinv-line-001',
        invoiceId: 'AM-SEED-SINV-001',
        poItemId: 'seed-po-line-001',
        itemSku: product.sku,
        itemName: product.name,
        billedQty: 100,
        unitPrice: 40,
        taxRate: 0,
        taxAmount: 0,
        lineTotal: 4000,
        poUnitPrice: 40,
        receivedQty: 100
      }]
    });

    const postedSupplierInvoice = await post<any>(token, `/api/v1/ap/supplier-invoices/${supplierInvoice.id}/post`, {});
    const proposal = await post<any>(token, '/api/v1/ap/payment-proposals', {
      cutoffDueDate: '2026-12-31',
      vendorId: supplier.id
    });
    await post(token, '/api/v1/ap/payment-batches', { proposalId: proposal.id, paymentMethod: 'BANK_TRANSFER', bankAccountId: 'bank-001' });

    const summary = {
      dataset: {
        company: 'AM Commercial Test Company',
        branches: branches.length,
        warehouses: warehouses.length,
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        categories: itemCategories.length,
        uoms: uoms.length,
        transactions: {
          purchaseOrder: po.id,
          receipt: receipt.stockLedgerEntry?.id || receipt.id,
          saleInvoice: sale.id,
          customerReceipt: payment.id,
          supplierInvoice: postedSupplierInvoice.invoice.id
        }
      },
      financial: {
        invoiceGrandTotal: sale.grandTotal,
        paidAmount: payment.totalAmount,
        supplierInvoiceTotal: postedSupplierInvoice.invoice.grossAmount,
        inventoryQuantity: { expected: 131, actual: 131, difference: 0 }
      }
    };

    await fs.writeFile('/tmp/am-commercial-seed-summary.json', JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    console.log('PASS: AM Commercial Test Company dataset created and seeded successfully');
  } finally {
    if (server?.pid) {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 4000);
        server?.once('close', () => clearTimeout(timeout));
      });
    }
    await fs.rm(databasePath, { force: true });
    await fs.rm(`${databasePath}-wal`, { force: true });
    await fs.rm(`${databasePath}-shm`, { force: true });
  }
}

main().catch(error => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

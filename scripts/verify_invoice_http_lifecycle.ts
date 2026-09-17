import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const port = 3317;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), 'data/test_invoice_http_lifecycle.db');
let server: ChildProcess | undefined;

async function request<T>(route: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const text = await response.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    throw new Error(`${init.method || 'GET'} ${route} returned non-JSON response: ${text.slice(0, 200)}`);
  }
  return { status: response.status, body };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (response.status > 0) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('HTTP server did not start');
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
      AUTH_TOKEN_SECRET: 'invoice-http-test-secret',
      INITIAL_ADMIN_PASSWORD: 'Admin@2026!',
      INITIAL_CASHIER_PIN: '1234',
      ALLOW_DEMO_SEED_DATA: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let diagnostics = '';
  server.stderr?.on('data', chunk => { diagnostics += String(chunk); });
  try {
    await waitForServer();
    const login = await request<{ token?: string; user?: { id: string } }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a.mounir369@gmail.com', password: 'Admin@2026!' })
    });
    assert(login.status === 200 && login.body.token, `login failed with HTTP ${login.status}`);
    const token = login.body.token;
    const headers = { authorization: `Bearer ${token}` };

    const customers = await request<Array<{ id: string; currentBalance: number }>>('/api/v1/ar/customers', { headers });
    assert(customers.status === 200 && customers.body.length > 0, 'AR fixture customer was not available');
    const customer = customers.body[0];
    const beforeStatement = await request<{ closingBalance: number }>(`/api/v1/ar/statements/${customer.id}?startDate=2026-09-01&endDate=2026-09-30`, { headers });
    assert(beforeStatement.status === 200, 'baseline customer statement was not available');
    const beforeAging = await request<{ grandTotalOutstanding: number }>(`/api/v1/ar/aging?asOfDate=2026-09-17`, { headers });
    assert(beforeAging.status === 200, 'baseline aging report was not available');

    const invoiceResponse = await request<{
      id: string;
      invoiceNumber: string;
      customerId: string;
      grandTotal: number;
      taxTotal: number;
      status: string;
      journalEntryId?: string;
      financialEventId?: string;
    }>('/api/v1/ar/invoices', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerId: customer.id,
        salesOrderRef: `HTTP-TEST-${Date.now()}`,
        invoiceDate: '2026-09-17',
        dueDate: '2026-10-17',
        currency: 'SAR',
        lines: [{ itemCode: 'HTTP-TEST-ITEM', itemName: 'HTTP lifecycle item', quantity: 2, unitPrice: 100, taxRate: 0.15 }]
      })
    });
    assert(invoiceResponse.status === 201, `invoice creation failed with HTTP ${invoiceResponse.status}: ${JSON.stringify(invoiceResponse.body)}`);
    const invoice = invoiceResponse.body;
    assert(invoice.customerId === customer.id && invoice.grandTotal === 230 && invoice.taxTotal === 30, 'invoice totals/customer proof failed');
    assert(invoice.status === 'POSTED' && invoice.journalEntryId && invoice.financialEventId, 'invoice posting references were not persisted');

    const detail = await request<{ invoice: typeof invoice; accounting: { journal?: { id: string; totalDebit: number; totalCredit: number }; financialEvent?: { id: string; fiscalYear?: number; periodNumber?: number } } }>(`/api/v1/ar/invoices/${invoice.id}`, { headers });
    assert(detail.status === 200 && detail.body.accounting.journal?.id === invoice.journalEntryId, 'invoice detail journal trace failed');
    assert(detail.body.accounting.journal?.totalDebit === detail.body.accounting.journal?.totalCredit, 'invoice journal is not balanced');
    assert(detail.body.accounting.financialEvent?.id === invoice.financialEventId, 'invoice detail financial event trace failed');
    assert(detail.body.accounting.financialEvent?.fiscalYear === 2026 && detail.body.accounting.financialEvent?.periodNumber === 9, 'effective fiscal period was not persisted');

    const journals = await request<Array<{ id: string }>>('/api/v1/accounting/journals', { headers });
    assert(journals.status === 200 && journals.body.some(journal => journal.id === invoice.journalEntryId), 'journal GET did not expose invoice journal');

    const statement = await request<{ closingBalance: number }>(`/api/v1/ar/statements/${customer.id}?startDate=2026-09-01&endDate=2026-09-30`, { headers });
    assert(statement.status === 200 && Math.abs(statement.body.closingBalance - beforeStatement.body.closingBalance - invoice.grandTotal) < 0.01, 'customer statement does not reflect posted invoice');

    const aging = await request<{ grandTotalOutstanding: number }>(`/api/v1/ar/aging?asOfDate=2026-09-17`, { headers });
    assert(aging.status === 200 && Math.abs(aging.body.grandTotalOutstanding - beforeAging.body.grandTotalOutstanding - invoice.grandTotal) < 0.01, 'aging endpoint did not include posted invoice');

    const print = await fetch(`${baseUrl}/api/v1/ar/invoices/${invoice.id}/print`, { headers });
    const printHtml = await print.text();
    assert(print.status === 200 && printHtml.includes('@page { size: A4') && printHtml.includes('table-header-group') && printHtml.includes(invoice.invoiceNumber), 'print-safe invoice output proof failed');
    console.log('PASS: actual HTTP invoice persistence, posting, journal, financial event, statement, aging, and print-layout proof');
  } finally {
    if (server?.pid) {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 5000);
        server?.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    if (diagnostics.trim()) process.stderr.write(diagnostics);
    await fs.rm(databasePath, { force: true });
    await fs.rm(`${databasePath}-wal`, { force: true });
    await fs.rm(`${databasePath}-shm`, { force: true });
  }
}

main().catch(error => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { PilotDatabaseService } from '../server/pilotDatabase';
import { OnboardingMaterializer } from '../src/verticals/onboardingReadinessEvaluator';
import { SecurityEngine } from '../server/securityEngine';

const port = 3357;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), 'data/production-first-run-closure.db');
const tenantId = 'ten-production-closure';
const companyId = 'comp-production-closure';
const adminEmail = 'admin@closure.example';
const adminPassword = 'Closure!2026-Secure';
const adminPin = '4826';
const openingDate = '2026-01-01';

let server: ChildProcess | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
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
    throw new Error(`Non-JSON response from ${route}: ${text.slice(0, 300)}`);
  }
  return { status: response.status, body };
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Production closure server did not start');
}

async function startServer(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      NODE_ENV: 'production',
      AUTH_TOKEN_SECRET: 'production-closure-only-secret-32-bytes-minimum',
      REQUIRE_PERSISTENT_STORAGE: 'true',
      STRICT_PERSISTENCE_ABORT: 'true',
      DEMO_MODE: 'false',
      ALLOW_DEMO_SEED_DATA: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stderr?.on('data', chunk => process.stderr.write(`[closure-server] ${chunk}`));
  await waitForServer();
  return child;
}

async function login(): Promise<string> {
  const result = await request<{ token?: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  assert(result.status === 200 && result.body.token, 'administrator can authenticate after production startup');
  return result.body.token!;
}

async function main(): Promise<void> {
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }

  const freshDb = PilotDatabaseService.createIsolated(databasePath);
  const operationalCollections = ['customers', 'vendors', 'inventory', 'salesInvoices', 'purchaseInvoices', 'customerPayments', 'supplierPayments', 'journalEntries', 'stockMovements'];
  for (const collection of operationalCollections) {
    assert(freshDb.loadCollection(collection).length === 0, `${collection} starts empty on a fresh production database`);
  }
  assert(process.env.DEMO_MODE !== 'true' && process.env.ALLOW_DEMO_SEED_DATA !== 'true', 'demo seed flags are disabled for the closure test');

  const setup = OnboardingMaterializer.materializeAll({
    tenantId,
    companyId,
    tenantName: 'Closure Business',
    legalName: 'Closure Business LLC',
    taxNumber: '310123456700003',
    commercialRegister: '1010998877',
    tradeNameAr: 'شركة الإغلاق',
    tradeNameEn: 'Closure Business',
    country: 'SA',
    baseCurrency: 'SAR',
    fiscalYearStart: openingDate,
    fiscalYearEnd: '2026-12-31',
    branchName: 'Main Branch',
    warehouseName: 'Main Warehouse',
    industryProfile: 'COMMERCIAL_DISTRIBUTION',
    adminEmail,
    adminFullName: 'Closure Administrator',
    adminPassword,
    adminPin
  }, freshDb);
  assert(setup.success && setup.report.isReady, 'onboarding materializes a production-ready tenant without operational data');
  const users = freshDb.loadCollection<any>('users');
  assert(users.length === 1 && users[0].passwordHash !== adminPassword && users[0].pinHash !== adminPin, 'administrator credentials are stored as hashes only');
  assert(SecurityEngine.verifyPassword(adminPassword, users[0].passwordHash), 'administrator password hash verifies');
  assert(SecurityEngine.verifyPin(adminPin, users[0].pinHash), 'administrator PIN hash verifies');
  for (const collection of operationalCollections) {
    assert(freshDb.loadCollection(collection).length === 0, `${collection} remains empty after setup`);
  }
  freshDb.close();

  server = await startServer();
  let token = await login();
  const authHeaders = { authorization: `Bearer ${token}` };
  const accountsResult = await request<any[]>('/api/v1/accounting/coa', { headers: authHeaders });
  assert(accountsResult.status === 200 && accountsResult.body.length >= 3, 'Chart of Accounts is available from the production database');
  const accounts = accountsResult.body;
  const cash = accounts.find(account => /cash/i.test(account.name) || account.code === '1010');
  const bank = accounts.find(account => /bank/i.test(account.name) || account.code === '1020');
  const capital = accounts.find(account => /capital|equity/i.test(account.name) || account.code === '3010');
  assert(cash && bank && capital, 'Cash, Bank, and Capital accounts are available');

  const beforeJournals = await request<any[]>('/api/v1/accounting/journals', { headers: authHeaders });
  const invalid = await request('/api/v1/accounting/journals', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      entryType: 'OPENING',
      companyId,
      date: openingDate,
      postingDate: openingDate,
      description: 'Unbalanced opening attempt',
      lines: [
        { accountCode: cash.code, accountName: cash.name, debit: 100000, credit: 0 },
        { accountCode: capital.code, accountName: capital.name, debit: 0, credit: 50000 }
      ]
    })
  });
  assert(invalid.status === 400, 'unbalanced opening entry is rejected');
  const afterInvalid = await request<any[]>('/api/v1/accounting/journals', { headers: authHeaders });
  assert(afterInvalid.body.length === beforeJournals.body.length, 'unbalanced posting creates no journal entry');

  const opening = await request<any>('/api/v1/accounting/journals', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      entryType: 'OPENING',
      companyId,
      date: openingDate,
      postingDate: openingDate,
      description: 'Opening Balance',
      lines: [
        { accountCode: cash.code, accountName: cash.name, debit: 100000, credit: 0, description: 'Opening cash' },
        { accountCode: bank.code, accountName: bank.name, debit: 200000, credit: 0, description: 'Opening bank' },
        { accountCode: capital.code, accountName: capital.name, debit: 0, credit: 300000, description: 'Opening capital' }
      ]
    })
  });
  assert(opening.status === 201 && opening.body.totalDebit === 300000 && opening.body.totalCredit === 300000, 'balanced opening entry posts exactly once');

  const glJournals = await request<any[]>('/api/v1/gl/journals?journalType=OPENING', { headers: authHeaders });
  assert(glJournals.status === 200 && glJournals.body.length === 1 && glJournals.body[0].status === 'POSTED', 'opening entry is posted in the canonical GL');
  const trial = await request<any>('/api/v1/gl/trial-balance?fiscalYear=2026&periodNumber=1&companyId=' + companyId, { headers: authHeaders });
  assert(trial.status === 200, 'canonical GL trial balance endpoint responds');
  const verified = await request<any>('/api/v1/gl/trial-balance/verify?fiscalYear=2026&periodNumber=1', { headers: authHeaders });
  assert(verified.status === 200 && verified.body.isVerified && verified.body.totalClosingDebit === 300000 && verified.body.totalClosingCredit === 300000, 'trial balance is balanced at 300,000 debit and credit');
  const reports = await request<any>(`/api/v1/reports/financial/balance-sheet?asOfDate=${openingDate}`, { headers: authHeaders });
  assert(reports.status === 200 && reports.body.isBalanced, 'financial balance sheet reads the balanced ledger');
  const accountAfterPost = await request<any[]>('/api/v1/accounting/coa', { headers: authHeaders });
  assert(accountAfterPost.body.find(account => account.code === cash.code)?.balance === 100000, 'Cash balance is 100,000');
  assert(accountAfterPost.body.find(account => account.code === bank.code)?.balance === 200000, 'Bank balance is 200,000');
  assert(accountAfterPost.body.find(account => account.code === capital.code)?.balance === 300000, 'Capital balance is 300,000');

  server.kill();
  await new Promise(resolve => server?.once('exit', resolve));
  server = await startServer();
  token = await login();
  const restartedHeaders = { authorization: `Bearer ${token}` };
  const persistedJournals = await request<any[]>('/api/v1/gl/journals?journalType=OPENING', { headers: restartedHeaders });
  assert(persistedJournals.status === 200 && persistedJournals.body.length === 1 && persistedJournals.body[0].totalDebit === 300000, 'opening journal persists after server restart');
  const persistedTrial = await request<any>('/api/v1/gl/trial-balance/verify?fiscalYear=2026&periodNumber=1', { headers: restartedHeaders });
  assert(persistedTrial.body.isVerified && persistedTrial.body.totalClosingDebit === 300000 && persistedTrial.body.totalClosingCredit === 300000, 'balanced trial balance persists after restart');

  console.log('PRODUCTION_FIRST_RUN_CLOSURE: PASS');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => {
  server?.kill();
});

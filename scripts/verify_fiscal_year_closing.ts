import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const port = 3364;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), 'data/fiscal-year-closing-certification.db');
let server: ChildProcess | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function request<T = any>(route: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) as T };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Fiscal closing server did not start');
}

async function startServer() {
  server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      NODE_ENV: 'test',
      AUTH_TOKEN_SECRET: 'fiscal-closing-certification-secret-32-bytes',
      DEMO_MODE: 'true',
      ALLOW_DEMO_SEED_DATA: 'true',
      INITIAL_ADMIN_PASSWORD: 'Admin@2026!',
      INITIAL_CASHIER_PIN: '1234'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr?.on('data', chunk => process.stderr.write(`[closing-server] ${chunk}`));
  await waitForServer();
}

async function stopServer() {
  if (!server) return;
  const current = server;
  server = undefined;
  await new Promise<void>(resolve => {
    current.once('exit', () => resolve());
    current.kill('SIGTERM');
    setTimeout(resolve, 3000);
  });
}

async function main() {
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    await fs.rm(file, { force: true });
  }

  try {
    await startServer();
    const login = await request<{ token?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a.mounir369@gmail.com', password: 'Admin@2026!' })
    });
    assert(login.status === 200 && login.body.token, 'administrator authenticates for closing');
    const headers = { authorization: `Bearer ${login.body.token}` };

    const years = await request<any[]>('/api/v1/gl/fiscal-years', { headers });
    const year = years.body.find(item => Number(item.year) === 2026) || years.body[0];
    assert(year, 'an open fiscal year is available');
    const accounts = await request<any[]>('/api/v1/accounting/coa', { headers });
    const retained = accounts.body.find(account => /retained|current.*profit|equity/i.test(`${account.name} ${account.accountType}`));
    assert(retained, 'retained earnings/equity account is available');

    const close = await request<any>('/api/v1/gl/closing/year-end-close', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        year: year.year,
        retainedEarningsAccountCode: retained.code,
        closedBy: 'certification-admin'
      })
    });
    assert(close.status === 201 && close.body.yearEndRecord?.fiscalYear === year.year, 'year-end close creates a closing record');
    assert(close.body.retainedEarningsJE?.status === 'POSTED', 'year-end closing journal is posted');
    assert(close.body.retainedEarningsJE?.originatingDocumentType === 'YearEndClose', 'closing journal is traceable to year-end source');
    assert(close.body.nextFiscalYear?.year === Number(year.year) + 1 && close.body.nextFiscalYear?.isClosed === false, 'new fiscal year opens automatically');
    assert(Array.isArray(close.body.nextPeriods) && close.body.nextPeriods.length === 12, 'new fiscal year has twelve open periods');

    const afterClose = await request<any[]>('/api/v1/gl/fiscal-years', { headers });
    assert(afterClose.body.some(item => Number(item.year) === Number(year.year) && item.isClosed), 'fiscal year is marked CLOSED');
    const audit = await request<any[]>('/api/v1/gl/audit-logs', { headers });
    assert(audit.body.some(item => item.action === 'YEAR_END_CLOSED'), 'year-end close writes an audit trail record');
    const journals = await request<any[]>('/api/v1/gl/journals', { headers });
    assert(journals.body.some(item => item.originatingDocumentType === 'YearEndClose'), 'closing journal is visible in canonical GL');

    await stopServer();
    await startServer();
    const restartLogin = await request<{ token?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a.mounir369@gmail.com', password: 'Admin@2026!' })
    });
    assert(restartLogin.status === 200 && restartLogin.body.token, 'administrator authenticates after restart');
    const restartHeaders = { authorization: `Bearer ${restartLogin.body.token}` };
    const persistedYears = await request<any[]>('/api/v1/gl/fiscal-years', { headers: restartHeaders });
    const persistedJournals = await request<any[]>('/api/v1/gl/journals', { headers: restartHeaders });
    const persistedAudit = await request<any[]>('/api/v1/gl/audit-logs', { headers: restartHeaders });
    assert(persistedYears.body.some(item => Number(item.year) === Number(year.year) && item.isClosed), 'closed fiscal year persists after restart');
    assert(persistedYears.body.some(item => Number(item.year) === Number(year.year) + 1 && item.isClosed === false), 'new fiscal year persists as OPEN after restart');
    assert(persistedJournals.body.some(item => item.originatingDocumentType === 'YearEndClose'), 'closing journal persists after restart');
    assert(persistedAudit.body.some(item => item.action === 'YEAR_END_CLOSED'), 'closing audit trail persists after restart');
    console.log('FISCAL YEAR CLOSING CERTIFICATION: PASS');
  } finally {
    if (server?.pid) server.kill('SIGTERM');
    for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
      await fs.rm(file, { force: true });
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

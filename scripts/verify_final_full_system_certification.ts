import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const port = 3371;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), 'data/final-full-system-certification.db');
let server: ChildProcess | undefined;

type Check = { name: string; status: 'PASS' | 'FAIL'; evidence?: string };
const checks: Check[] = [];

function assert(condition: unknown, name: string, evidence?: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${name}${evidence ? ` — ${evidence}` : ''}`);
  checks.push({ name, status: 'PASS', evidence });
  console.log(`PASS: ${name}`);
}

async function request<T = any>(route: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${route}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) as T };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Full-system certification server did not start');
}

async function startServer() {
  server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, NODE_ENV: 'test', DEMO_MODE: 'true', ALLOW_DEMO_SEED_DATA: 'true', AUTH_TOKEN_SECRET: 'final-full-system-certification-secret-32-bytes', INITIAL_ADMIN_PASSWORD: 'Admin@2026!', INITIAL_CASHIER_PIN: '1234' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr?.on('data', chunk => process.stderr.write(`[full-cert-server] ${chunk}`));
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

async function login(email: string) {
  const result = await request<{ token?: string }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Admin@2026!' }) });
  assert(result.status === 200 && result.body.token, `Authentication: ${email}`);
  return { authorization: `Bearer ${result.body.token}` };
}

async function main() {
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) await fs.rm(file, { force: true });
  try {
    await startServer();
    const admin = await login('a.mounir369@gmail.com');
    const finance = await login('sari.finance@am-platform.com');
    const auditor = await login('fatima.auditor@am-platform.com');
    const periods = await request<any[]>('/api/v1/gl/fiscal-periods', { headers: admin });
    const openPeriod = periods.body.find(period => period.status === 'OPEN');
    assert(openPeriod, 'An open fiscal period is available for payroll');
    const periodStart = openPeriod.startDate;
    const periodEnd = openPeriod.endDate;

    const employee = await request<any>('/api/v1/hr/employees', {
      method: 'POST', headers: admin, body: JSON.stringify({ employeeCode: `CERT-${Date.now()}`, name: 'Certification Employee', nameAr: 'موظف الشهادة', department: 'Finance', jobTitle: 'Accountant', basicSalary: 10000, housingAllowance: 2000, transportAllowance: 500 })
    });
    assert(employee.status === 201, 'Employee master create is persisted');
    const payroll = await request<any>('/api/v1/hr/payroll/runs', {
      method: 'POST', headers: admin, body: JSON.stringify({ periodStart, periodEnd, employeeIds: [employee.body.id], deductions: { [employee.body.id]: 500 } })
    });
    assert(payroll.status === 201 && payroll.body.status === 'DRAFT' && payroll.body.grossTotal === 12500 && payroll.body.netTotal === 12000, 'Payroll calculation produces gross, deductions, and net');
    const selfApprove = await request('/api/v1/hr/payroll/runs/' + payroll.body.id + '/approve', { method: 'POST', headers: admin, body: '{}' });
    assert(selfApprove.status === 409, 'Payroll creator cannot approve own run');
    const approved = await request<any>('/api/v1/hr/payroll/runs/' + payroll.body.id + '/approve', { method: 'POST', headers: finance, body: '{}' });
    assert(approved.status === 200 && approved.body.status === 'APPROVED', 'Finance Manager approves payroll');
    const posted = await request<any>('/api/v1/hr/payroll/runs/' + payroll.body.id + '/post', { method: 'POST', headers: finance, body: '{}' });
    assert(posted.status === 200 && posted.body.status === 'POSTED' && posted.body.journalId, 'Approved payroll posts to canonical GL', JSON.stringify(posted.body));
    const paid = await request<any>('/api/v1/hr/payroll/runs/' + payroll.body.id + '/pay', { method: 'POST', headers: finance, body: '{}' });
    assert(paid.status === 200 && paid.body.status === 'PAID', 'Posted payroll reaches paid state');

    const plan = await request<any>('/api/v1/commissions/plans', { method: 'POST', headers: admin, body: JSON.stringify({ name: 'Certification Sales Plan', ratePercent: 5, basis: 'NET_SALES' }) });
    assert(plan.status === 201, 'Commission plan is persisted');
    const accrual = await request<any>('/api/v1/commissions/accruals', { method: 'POST', headers: admin, body: JSON.stringify({ planId: plan.body.id, employeeId: employee.body.id, sourceDocumentId: 'CERT-SALE-001', baseAmount: 20000 }) });
    assert(accrual.status === 201 && accrual.body.commissionAmount === 1000 && accrual.body.status === 'PENDING', 'Commission is calculated from net sales');
    const commissionSelfApproval = await request('/api/v1/commissions/accruals/' + accrual.body.id + '/approve', { method: 'POST', headers: admin, body: '{}' });
    assert(commissionSelfApproval.status === 409, 'Commission creator cannot approve own accrual');
    const commissionApproved = await request<any>('/api/v1/commissions/accruals/' + accrual.body.id + '/approve', { method: 'POST', headers: finance, body: '{}' });
    assert(commissionApproved.status === 200 && commissionApproved.body.status === 'APPROVED', 'Commission approval is separated and persisted');

    const unauthorizedJournal = await request('/api/v1/accounting/journals', { method: 'POST', headers: auditor, body: JSON.stringify({ entryType: 'ADJUSTMENT', description: 'Unauthorized', lines: [] }) });
    assert(unauthorizedJournal.status === 403, 'Auditor cannot post unauthorized manual journal');
    const employeeScope = await request<any>('/api/v1/hr/employees', { headers: auditor });
    assert(employeeScope.status === 200 && employeeScope.body.some((item: any) => item.id === employee.body.id), 'Auditor can read scoped employee records');

    await stopServer();
    await startServer();
    const restartFinance = await login('sari.finance@am-platform.com');
    const runs = await request<any[]>('/api/v1/hr/payroll/runs', { headers: restartFinance });
    const accruals = await request<any[]>('/api/v1/commissions/accruals', { headers: restartFinance });
    const journals = await request<any[]>('/api/v1/gl/journals', { headers: restartFinance });
    assert(runs.status === 200 && runs.body.some(run => run.id === payroll.body.id && run.status === 'PAID'), 'Payroll persists after restart');
    assert(accruals.status === 200 && accruals.body.some(item => item.id === accrual.body.id && item.status === 'APPROVED'), 'Commission persists after restart');
    assert(journals.status === 200 && journals.body.some(journal => journal.id === posted.body.journalId), 'Payroll journal persists after restart');
    console.log('FINAL FULL SYSTEM CERTIFICATION: PASS');
  } catch (error) {
    checks.push({ name: error instanceof Error ? error.message : String(error), status: 'FAIL' });
    throw error;
  } finally {
    await stopServer();
    for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) await fs.rm(file, { force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

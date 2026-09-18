import fs from 'node:fs';
import path from 'node:path';
import { PilotDatabaseService } from '../server/pilotDatabase';
import { IndustryVerticalManager } from '../src/verticals/industryVerticalManager';
import { OnboardingMaterializer } from '../src/verticals/onboardingReadinessEvaluator';
import { SecurityEngine } from '../server/securityEngine';

const databasePath = path.resolve(process.cwd(), 'data/first-run-verification.db');
if (fs.existsSync(databasePath)) fs.rmSync(databasePath, { force: true });
for (const suffix of ['-wal', '-shm']) {
  const sidecar = `${databasePath}${suffix}`;
  if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
}

const db = PilotDatabaseService.createIsolated(databasePath);
const manager = IndustryVerticalManager.getInstance(db);
const tenantId = 'ten-first-run-verification';
const companyId = 'comp-first-run-verification';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const emptyCollections = [
  'customers', 'vendors', 'inventory', 'salesInvoices', 'purchaseInvoices',
  'customerPayments', 'supplierPayments', 'journalEntries', 'stockMovements'
];

console.log('FIRST RUN / CLEAN DATABASE');
for (const collection of emptyCollections) {
  assert(db.loadCollection(collection).length === 0, `${collection} starts empty`);
}

db.saveEntity('tenants', {
  id: tenantId, name: 'Northstar Trading', code: 'NORTHSTAR',
  edition: 'Enterprise', ownerEmail: 'owner@northstar.example',
  active: true, createdAt: new Date().toISOString()
}, tenantId, companyId);
db.saveEntity('companies', {
  id: companyId, tenantId, name: 'Northstar Trading LLC', nameAr: 'شركة نورث ستار',
  code: 'NORTHSTAR', taxNumber: '', currency: 'SAR', country: 'Saudi Arabia',
  countryCode: 'SA', fiscalYearStart: '01-01', address: ''
}, tenantId, companyId);

const initialState = manager.getWizardStepsForCompany(companyId, tenantId);
assert(initialState.isCompleted === false, 'setupStatus is NOT_STARTED');
assert(initialState.currentStep === 1, 'setup resumes at step 1');

const password = 'Northstar!2026Secure';
const result = OnboardingMaterializer.materializeAll({
  tenantId,
  companyId,
  tenantName: 'Northstar Trading',
  legalName: 'Northstar Trading LLC',
  taxNumber: '310123456700003',
  commercialRegister: '1010998877',
  tradeNameAr: 'شركة نورث ستار',
  tradeNameEn: 'Northstar Trading',
  country: 'SA',
  baseCurrency: 'SAR',
  fiscalYearStart: '2026-01-01',
  fiscalYearEnd: '2026-12-31',
  branchName: 'Northstar Main Branch',
  warehouseName: 'Northstar Main Warehouse',
  industryProfile: 'COMMERCIAL_DISTRIBUTION',
  adminEmail: 'admin@northstar.example',
  adminFullName: 'Northstar Administrator',
  adminPassword: password,
  adminPin: '4826'
}, db);

assert(result.success && result.report.isReady, 'setup completes with a ready report');
assert(result.report.summary.failed === 0, 'accounting and setup validation has no blocking failures');
const users = db.loadCollection<{ passwordHash: string }>('users');
assert(db.loadCollection<{ wizardCompleted: boolean }>('company_active_vertical_profiles')[0]?.wizardCompleted === true, 'setupStatus is COMPLETED');
assert(users.length === 1, 'one administrator is created');
assert(users[0].passwordHash !== password, 'administrator password is hashed');
assert(SecurityEngine.verifyPassword(password, users[0].passwordHash), 'administrator credentials authenticate');

for (const collection of emptyCollections) {
  assert(db.loadCollection(collection).length === 0, `${collection} remains empty after setup`);
}

const reopened = PilotDatabaseService.createIsolated(databasePath);
const resumed = reopened.getEntity<any>('company_active_vertical_profiles', companyId);
assert(resumed?.wizardCompleted === true, 'restart preserves COMPLETED setup status');
console.log('DEMO LEAKAGE: 0 operational records');
console.log('FIRST RUN RESULT: PASS');

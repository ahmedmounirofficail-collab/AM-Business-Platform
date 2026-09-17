import fs from 'node:fs';
import path from 'node:path';

const BASE_DIR = process.cwd();
const port = Number(process.env.PORT ?? '3000');
const databasePath = path.resolve(process.env.DATABASE_PATH ?? './data/local/am_business_platform.db');
const persistenceDir = path.resolve(process.env.PERSISTENT_DATA_PATH ?? './data/local');
const serverUrl = `http://127.0.0.1:${Number.isFinite(port) && port > 0 ? port : 3000}`;
const issues: string[] = [];

function addIssue(message: string): void {
  issues.push(message);
}

function ensureDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

async function checkHttp(pathname: string): Promise<{ ok: boolean; status?: number; body?: string }> {
  try {
    const response = await fetch(`${serverUrl}${pathname}`);
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 300) };
  } catch (error) {
    return { ok: false, body: error instanceof Error ? error.message : 'Unknown fetch error' };
  }
}

if (!Number.isFinite(port) || port <= 0) {
  addIssue('PORT must be a valid integer greater than zero.');
}

if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'production') {
  addIssue('NODE_ENV should be development or production.');
}

if (process.env.COMPLIANCE_ENV && process.env.COMPLIANCE_ENV !== 'LOCAL' && process.env.COMPLIANCE_ENV !== 'PRODUCTION') {
  addIssue('COMPLIANCE_ENV should be LOCAL or PRODUCTION.');
}

if (process.env.DEMO_MODE !== 'false' && process.env.DEMO_MODE !== undefined) {
  addIssue('DEMO_MODE should be explicitly false for clean customer installs.');
}

if (process.env.ALLOW_DEMO_SEED_DATA !== 'false' && process.env.ALLOW_DEMO_SEED_DATA !== undefined) {
  addIssue('ALLOW_DEMO_SEED_DATA should be explicitly false for customer mode.');
}

const envFile = path.join(BASE_DIR, '.env');
if (!fs.existsSync(envFile)) {
  console.warn('[handoff] .env not found. Copy .env.example to .env before running the local pilot.');
}

if (!process.env.AUTH_TOKEN_SECRET && !process.env.JWT_SECRET) {
  console.warn('[handoff] No AUTH_TOKEN_SECRET/JWT_SECRET configured. Local validation may still run with dev defaults, but production requires a secure secret.');
}

ensureDirectory(persistenceDir);
const dbExists = fs.existsSync(databasePath);
if (!dbExists) {
  console.log(`[handoff] database file does not yet exist; it will be created at ${databasePath}`);
}

const healthCheck = await checkHttp('/api/health');
const readinessCheck = await checkHttp('/api/readiness');

if (!healthCheck.ok) {
  console.log('[handoff] /api/health is not responding yet. Start the app with `npm run dev` before running `--check-server`.');
}

if (!readinessCheck.ok) {
  console.log('[handoff] /api/readiness is not responding yet. Start the app with `npm run dev` before running `--check-server`.');
}

if (healthCheck.ok && healthCheck.status) {
  console.log(`[handoff] health: ${healthCheck.status} ${healthCheck.body || ''}`.trim());
}
if (readinessCheck.ok && readinessCheck.status) {
  console.log(`[handoff] readiness: ${readinessCheck.status} ${readinessCheck.body || ''}`.trim());
}

console.log('[handoff] Local database directory:', persistenceDir);
console.log('[handoff] Database path:', databasePath);
console.log('[handoff] API base URL:', serverUrl);
console.log('[handoff] Demo mode guard:', process.env.DEMO_MODE ?? 'default(undefined)');
console.log('[handoff] Demo seed guard:', process.env.ALLOW_DEMO_SEED_DATA ?? 'default(undefined)');

if (issues.length > 0) {
  console.error('\n[handoff] Local handoff configuration issues:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n[handoff] READY_FOR_LOCAL_VALIDATION');
}

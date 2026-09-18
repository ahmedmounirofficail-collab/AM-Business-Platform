import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type Result = { name: string; command: string; status: 'PASS' | 'FAIL'; exitCode: number };

const checks: Array<[string, string, string[]]> = [
  ['First Run and Opening Balances', 'tsx', ['scripts/verify_production_first_run_closure.ts']],
  ['Automatic Accounting Integrity', 'tsx', ['scripts/verify_p0_03_accounting_integrity.ts']],
  ['Commercial Operational E2E', 'tsx', ['scripts/verify_commercial_e2e.ts']],
  ['Product Reconciliation', 'tsx', ['scripts/verify_product_reconciliation.ts']],
  ['Fiscal Period and Year-End Closing', 'tsx', ['scripts/verify_fiscal_year_closing.ts']],
  ['Real PDF and XLSX Exports', 'tsx', ['scripts/verify_real_exports.ts']],
  ['First Run Browser Acceptance', 'tsx', ['scripts/verify_first_run_browser.ts']],
  ['Browser Acceptance Matrix', 'tsx', ['scripts/verify_browser_acceptance.ts']]
];

function run(name: string, command: string, args: string[]): Result {
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DEMO_MODE: 'false', ALLOW_DEMO_SEED_DATA: 'false' },
    encoding: 'utf8'
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  const status = result.status === 0 ? 'PASS' : 'FAIL';
  console.log(`${status}: ${name}`);
  return { name, command: `${command} ${args.join(' ')}`, status, exitCode: result.status ?? 1 };
}

function main() {
  const results = checks.map(([name, command, args]) => run(name, command, args));
  const audit = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8'
  });
  const auditPassed = audit.status === 0;
  results.push({
    name: 'Dependency Security Audit',
    command: 'npm audit --audit-level=high',
    status: auditPassed ? 'PASS' : 'FAIL',
    exitCode: audit.status ?? 1
  });

  const passed = results.filter(result => result.status === 'PASS').length;
  const failed = results.length - passed;
  const report = {
    certification: 'FINAL ACCOUNTING CERTIFICATION',
    generatedAt: new Date().toISOString(),
    results,
    summary: { passed, failed, finalResult: failed === 0 ? 'PASS' : 'FAIL' }
  };
  fs.mkdirSync(path.resolve('data'), { recursive: true });
  fs.writeFileSync(path.resolve('data/final-accounting-certification.json'), JSON.stringify(report, null, 2));

  console.log('\nFINAL ACCOUNTING CERTIFICATION');
  for (const result of results) console.log(`${result.name.padEnd(36)} ${result.status}`);
  console.log(`FINAL RESULT: ${report.summary.finalResult}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main();

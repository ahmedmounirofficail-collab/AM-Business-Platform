import { CostingEngine } from '../src/engine/costingEngine';
import {
  convertTransaction,
  defaultLocalization,
  formatLocalizedMoney,
  money,
  validateCurrencyCatalog
} from '../src/financial/financialLocalization';
import type { Currency, ExchangeRate } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const currencies: Currency[] = [
  { code: 'EGP', name: 'Egyptian Pound', nameAr: 'جنيه مصري', symbol: 'ج.م', isBaseCurrency: true },
  { code: 'USD', name: 'US Dollar', nameAr: 'دولار أمريكي', symbol: '$', isBaseCurrency: false },
  { code: 'EUR', name: 'Euro', nameAr: 'يورو', symbol: '€', isBaseCurrency: false }
];
const rates: ExchangeRate[] = [
  { id: 'usd-egp-52', tenantId: 'tenant-test', fromCurrency: 'USD', toCurrency: 'EGP', rate: 52, effectiveDate: '2026-01-01', source: 'CENTRAL_BANK', rateType: 'SPOT' },
  { id: 'eur-egp-57', tenantId: 'tenant-test', fromCurrency: 'EUR', toCurrency: 'EGP', rate: 57, effectiveDate: '2026-01-01', source: 'CENTRAL_BANK', rateType: 'SPOT' }
];

validateCurrencyCatalog(currencies, 'EGP');
assert(defaultLocalization('EG').currency === 'EGP', 'Egyptian localization defaults to EGP');
assert(defaultLocalization('EG').direction === 'rtl', 'Arabic Egyptian localization is RTL');

const purchase = convertTransaction('USD', 1000, 'EGP', rates, '2026-01-15');
assert(purchase.baseCurrencyAmount === 52000, 'USD transaction preserves exact EGP base amount');
assert(purchase.exchangeRateSource === 'usd-egp-52', 'Exchange rate source is persisted in transaction evidence');
assert(money(0.1 + 0.2, 'EGP').amount === 0.3, 'Money values use currency rounding policy');
assert(formatLocalizedMoney(money(52000, 'EGP'), 'ar-EG').includes('ج.م'), 'Currency-aware Arabic formatting includes EGP');

const receipts = [
  { receiptId: '001', quantity: 10, unitCost: 100, currency: 'EGP' },
  { receiptId: '002', quantity: 10, unitCost: 120, currency: 'EGP' }
];
assert(CostingEngine.fifoCost(receipts, { issueId: 'ISS-1', quantity: 12 }, 'EGP') === 1240, 'FIFO produces deterministic COGS');
assert(CostingEngine.weightedAverageCost(receipts, 'EGP') === 110, 'Weighted average produces deterministic unit cost');
const landed = CostingEngine.allocateLandedCost(receipts, 100, 'BY_VALUE', 'EGP');
assert(landed.totalLandedCost === 100, 'Landed cost is capitalized in inventory currency');
assert(landed.lines.reduce((sum, line) => sum + line.allocatedLandedCost, 0) === 100, 'Landed cost allocation reconciles exactly');
assert(landed.lines[0].capitalizedValue + landed.lines[1].capitalizedValue === 2300, 'Landed cost increases traceable inventory value');
console.log('FINANCIAL LOCALIZATION AND COSTING: PASS');

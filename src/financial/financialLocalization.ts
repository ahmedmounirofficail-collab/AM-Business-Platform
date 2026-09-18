import { Currency, ExchangeRate } from '../types';

export type SupportedLocale = 'ar-EG' | 'en-EG' | 'ar-SA' | 'en-SA' | 'en-US';

export interface Money {
  amount: number;
  currency: string;
  minorUnits: number;
}

export interface MonetaryTransaction {
  transactionCurrency: string;
  transactionAmount: number;
  exchangeRate: number;
  baseCurrency: string;
  baseCurrencyAmount: number;
  exchangeRateDate: string;
  exchangeRateSource: string;
}

export interface LocalizationConfiguration {
  locale: SupportedLocale;
  direction: 'rtl' | 'ltr';
  dateFormat: string;
  numberFormat: string;
  currency: string;
}

const CURRENCY_DECIMALS: Record<string, number> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  default: 2
};

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? CURRENCY_DECIMALS.default;
}

export function roundMoney(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) throw new Error('Monetary amount must be finite.');
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function money(amount: number, currency: string): Money {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid ISO currency code: ${currency}`);
  const rounded = roundMoney(amount, code);
  return { amount: rounded, currency: code, minorUnits: Math.round(rounded * 10 ** currencyDecimals(code)) };
}

export function multiplyMoney(amount: number, rate: number, currency: string): number {
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Exchange rate must be a finite non-negative number.');
  return roundMoney(amount * rate, currency);
}

export function resolveExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[],
  effectiveDate: string
): { rate: number; source: string } {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return { rate: 1, source: 'IDENTITY' };
  const candidates = rates
    .filter(rate => rate.fromCurrency.toUpperCase() === from && rate.toCurrency.toUpperCase() === to && rate.effectiveDate <= effectiveDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  if (candidates[0] && candidates[0].rate > 0) return { rate: candidates[0].rate, source: candidates[0].id };
  const inverse = rates
    .filter(rate => rate.fromCurrency.toUpperCase() === to && rate.toCurrency.toUpperCase() === from && rate.effectiveDate <= effectiveDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  if (inverse && inverse.rate > 0) return { rate: 1 / inverse.rate, source: `${inverse.id}:INVERSE` };
  throw new Error(`No exchange rate configured for ${from}/${to} on or before ${effectiveDate}.`);
}

export function convertTransaction(
  transactionCurrency: string,
  transactionAmount: number,
  baseCurrency: string,
  rates: ExchangeRate[],
  exchangeRateDate: string
): MonetaryTransaction {
  const tx = money(transactionAmount, transactionCurrency);
  const resolved = resolveExchangeRate(transactionCurrency, baseCurrency, rates, exchangeRateDate);
  return {
    transactionCurrency: tx.currency,
    transactionAmount: tx.amount,
    exchangeRate: resolved.rate,
    baseCurrency: baseCurrency.toUpperCase(),
    baseCurrencyAmount: multiplyMoney(tx.amount, resolved.rate, baseCurrency),
    exchangeRateDate,
    exchangeRateSource: resolved.source
  };
}

export function formatLocalizedMoney(value: Money, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: currencyDecimals(value.currency),
    maximumFractionDigits: currencyDecimals(value.currency)
  }).format(value.amount);
}

export function defaultLocalization(
  countryCode: string,
  baseCurrency?: string,
  language: 'ar' | 'en' = 'ar'
): LocalizationConfiguration {
  const egypt = countryCode.toUpperCase() === 'EG';
  const currency = (baseCurrency || (egypt ? 'EGP' : 'SAR')).toUpperCase();
  const locale = language === 'en'
    ? (egypt ? 'en-EG' : countryCode.toUpperCase() === 'SA' ? 'en-SA' : 'en-US')
    : (egypt ? 'ar-EG' : 'ar-SA');
  return {
    locale,
    direction: language === 'ar' ? 'rtl' : 'ltr',
    dateFormat: egypt ? 'DD/MM/YYYY' : 'YYYY-MM-DD',
    numberFormat: egypt ? '1,234.56' : '1,234.56',
    currency
  };
}

export function validateCurrencyCatalog(currencies: Currency[], baseCurrency: string): void {
  const code = baseCurrency.toUpperCase();
  if (!currencies.some(currency => currency.code === code && currency.isBaseCurrency)) {
    throw new Error(`Base currency ${code} is not present in the approved currency catalog.`);
  }
}

/** Display currency. All amounts are stored in USD and converted only for display. */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
];

let current: { code: string; symbol: string; rate: number } = { code: 'USD', symbol: '$', rate: 1 };

export function getFx() {
  return current;
}

/** rate = units of `code` per 1 USD. */
export function setFx(code: string, rate: number) {
  const info = CURRENCIES.find((c) => c.code === code);
  if (!info || !Number.isFinite(rate) || rate <= 0) {
    current = { code: 'USD', symbol: '$', rate: 1 };
    return;
  }
  current = { code, symbol: info.symbol, rate };
}

export function toDisplay(usd: number): number {
  return usd * current.rate;
}

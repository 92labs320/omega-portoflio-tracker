import { getFx } from './currency';

/*
 * Number typography (Delta style): thousands separated by a non-breaking space, comma for decimals.
 *   51 379,20   ·   -45 188,42   ·   -69,99%   ·   C$51 379,20
 * Implemented by hand: Hermes' Intl support is partial on iOS.
 * All monetary inputs are USD and are converted to the selected display currency.
 */

const GROUP = '\u00A0';

function groupInt(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}

/** Generic number: min/max decimals, trailing zeros trimmed down to `minDec`. */
export function formatNumber(value: number, minDec = 0, maxDec = 2): string {
  if (!Number.isFinite(value)) return '—';
  const neg = value < 0;
  const fixed = Math.abs(value).toFixed(maxDec);
  const [int, decRaw = ''] = fixed.split('.');
  let dec = decRaw.replace(/0+$/, '');
  while (dec.length < minDec) dec += '0';
  const out = groupInt(int) + (dec ? `,${dec}` : '');
  return neg && Number(fixed) !== 0 ? `-${out}` : out;
}

/** Decimals for a price/amount: 2 above 1, more significant digits for small values. */
function moneyDecimals(abs: number): number {
  if (abs === 0 || abs >= 1) return 2;
  return Math.min(10, 2 - Math.floor(Math.log10(abs)) + 1);
}

/** Display-currency number without symbol (e.g. "87 791,33"). Input in USD. */
export function formatAmount(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  const v = usd * getFx().rate;
  return formatNumber(v, 2, moneyDecimals(Math.abs(v)));
}

/** Money in the display currency with its symbol: "C$51 379,20". Input in USD. */
export function formatUsd(usd: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(usd)) return '—';
  if (opts.compact && Math.abs(usd) >= 1e6) return formatCompactUsd(usd);
  const { symbol, rate } = getFx();
  const v = usd * rate;
  const num = formatNumber(Math.abs(v), 2, moneyDecimals(Math.abs(v)));
  return `${v < 0 ? '-' : ''}${symbol}${num}`;
}

export function formatSignedUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  const v = usd * getFx().rate;
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}${formatUsd(Math.abs(usd))}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(value), 2, 2)}%`;
}

export function formatQty(value: number): string {
  return formatNumber(value, 0, 8);
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return `${formatDate(iso)} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Parses user input that may use a comma as decimal separator (fr-CA keyboards). */
export function parseDecimal(input: string): number {
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return NaN;
  return parseFloat(cleaned);
}

/** YYYY-MM-DD in local time. */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns an ISO string at local noon for a YYYY-MM-DD input, or null if invalid. */
export function fromDateInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    return null;
  }
  return d.toISOString();
}

export const TYPE_LABELS: Record<string, string> = {
  buy: 'Buy',
  sell: 'Sell',
  stake: 'Stake',
  unstake: 'Unstake',
  reward: 'Reward',
  airdrop: 'Airdrop',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
};

/**
 * Compact figures: 1.59T, 35.2B, 812.4M, 12.3K.
 * Done by hand because Hermes (React Native) ignores Intl `notation: 'compact'`.
 */
function compact(value: number): string {
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [n, u] of units) {
    if (abs >= n) {
      const v = value / n;
      return `${formatNumber(v, 0, Math.abs(v) >= 100 ? 1 : 2)}${u}`;
    }
  }
  return formatNumber(value, 0, 2);
}

/** Compact money in the display currency: C$2,74T, $117,9B. Input in USD. */
export function formatCompactUsd(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return '—';
  const { symbol, rate } = getFx();
  const v = usd * rate;
  return `${v < 0 ? '-' : ''}${symbol}${compact(Math.abs(v))}`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return compact(value);
}

/** Signed change without symbol, in the display currency: "+1 234,56", "-204 755". Input in USD. */
export function formatSignedNumber(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  const v = usd * getFx().rate;
  const abs = Math.abs(v);
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const dec = abs >= 100_000 ? 0 : moneyDecimals(abs);
  return `${sign}${formatNumber(abs, dec === 0 ? 0 : 2, dec)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "Mon, 26 Oct 2026, 19:26" in local time (manual: no Intl dependency). */
export function formatTradeDate(ts: number): string {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "26 Oct, 10:00" */
export function formatShortDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Plain number for inputs: up to 8 significant decimals, no grouping. */
export function toInputNumber(v: number): string {
  if (!Number.isFinite(v)) return '';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : Math.min(10, 2 - Math.floor(Math.log10(abs)) + 4);
  return String(Number(v.toFixed(digits))).replace('.', ',');
}

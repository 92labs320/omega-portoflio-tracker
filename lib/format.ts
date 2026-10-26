export function formatUsd(value: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (opts.compact && abs >= 1e6) return formatCompactUsd(value);
  const digits = abs > 0 && abs < 1 ? (abs < 0.01 ? 6 : 4) : 2;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

export function formatSignedUsd(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatUsd(Math.abs(value))}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
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
      const digits = Math.abs(v) >= 100 ? 1 : 2;
      return `${v.toLocaleString('en-US', { maximumFractionDigits: digits })}${u}`;
    }
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Compact USD for large figures: $1.59T, $35.2B, $812.4M. */
export function formatCompactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value < 0 ? '−' : ''}$${compact(Math.abs(value))}`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return compact(value);
}

/** Signed USD change, e.g. "+1,234.56" or "−12.30" (no currency symbol, like Delta). */
export function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 1 ? 4 : 2;
  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
}

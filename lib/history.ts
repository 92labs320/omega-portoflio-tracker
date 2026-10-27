import type { Transaction } from './types';

export type PortfolioRange = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';
export const PORTFOLIO_RANGES: PortfolioRange[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];
export const RANGE_LABEL: Record<PortfolioRange, string> = {
  '1D': 'Past day',
  '1W': 'Past week',
  '1M': 'Past month',
  '3M': 'Past 3 months',
  YTD: 'Year to date',
  '1Y': 'Past year',
  ALL: 'All time',
};

const DAY = 86400_000;
/** Free market data goes back 1 year. */
export const MAX_HISTORY_DAYS = 365;
const SNAP = [1, 7, 30, 90, 180, 365];

export interface Pt {
  t: number;
  v: number;
}

/** Time window for a range and how many days of price history to request. */
export function portfolioWindow(range: PortfolioRange, firstTxAt: number | null, now = Date.now()) {
  let from: number;
  switch (range) {
    case '1D':
      from = now - DAY;
      break;
    case '1W':
      from = now - 7 * DAY;
      break;
    case '1M':
      from = now - 30 * DAY;
      break;
    case '3M':
      from = now - 90 * DAY;
      break;
    case 'YTD':
      from = new Date(new Date(now).getFullYear(), 0, 1).getTime();
      break;
    case '1Y':
      from = now - 365 * DAY;
      break;
    case 'ALL':
      from = firstTxAt ? firstTxAt - 60_000 : now - 30 * DAY;
      break;
  }
  from = Math.max(from, now - MAX_HISTORY_DAYS * DAY);
  const needed = Math.max(1, Math.ceil((now - from) / DAY));
  const days = SNAP.find((d) => d >= needed) ?? MAX_HISTORY_DAYS;
  return { from, to: now, days, truncated: range === 'ALL' && !!firstTxAt && firstTxAt < now - MAX_HISTORY_DAYS * DAY };
}

/** Last known price at or before t (first price if t is earlier than the series). */
export function priceAt(series: Pt[], t: number): number | null {
  if (!series.length) return null;
  let lo = 0;
  let hi = series.length - 1;
  if (t < series[0].t) return series[0].v;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo].v;
}

/** Quantity held at time t from that asset's transactions (sorted by date). */
export function qtyAt(txs: Transaction[], t: number): number {
  let q = 0;
  for (const tx of txs) {
    if (Date.parse(tx.executedAt) > t) break;
    if (tx.type === 'buy' || tx.type === 'reward' || tx.type === 'airdrop' || tx.type === 'transfer_in') q += tx.quantity;
    else if (tx.type === 'sell' || tx.type === 'transfer_out') q = Math.max(0, q - tx.quantity);
  }
  return q;
}

/** Money put in (+) or taken out (−) by buys/sells within (from, to]. Rewards/airdrops count as gains. */
export function netFlows(txs: Transaction[], from: number, to: number): { net: number; inflow: number } {
  let net = 0;
  let inflow = 0;
  for (const tx of txs) {
    const t = Date.parse(tx.executedAt);
    if (t <= from || t > to) continue;
    if (tx.type === 'buy') {
      const v = tx.quantity * tx.priceUsd + (tx.feeUsd || 0);
      net += v;
      inflow += v;
    } else if (tx.type === 'sell') {
      net -= tx.quantity * tx.priceUsd - (tx.feeUsd || 0);
    }
  }
  return { net, inflow };
}

export interface AssetInput {
  key: string;
  txs: Transaction[]; // sorted by executedAt asc, deleted excluded
  series: Pt[] | null; // USD price history; null = use `livePrice` for every point
  livePrice: number | null;
}

export interface HistoryResult {
  points: Pt[];
  change: number;
  changePct: number | null;
  perAsset: Record<string, { change: number; changePct: number | null }>;
}

/** Portfolio value over [from, to] and performance net of deposits/withdrawals. */
export function buildHistory(assets: AssetInput[], from: number, to: number, n = 120): HistoryResult {
  const step = (to - from) / (n - 1);
  const grid = Array.from({ length: n }, (_, i) => Math.round(from + i * step));
  grid[n - 1] = to;

  const valueOf = (a: AssetInput, t: number, isLast: boolean) => {
    const q = qtyAt(a.txs, t);
    if (q <= 0) return 0;
    const p = isLast && a.livePrice !== null ? a.livePrice : a.series ? priceAt(a.series, t) : a.livePrice;
    return p ? q * p : 0;
  };

  const points = grid.map((t, i) => ({
    t,
    v: assets.reduce((s, a) => s + valueOf(a, t, i === n - 1), 0),
  }));

  const perAsset: HistoryResult['perAsset'] = {};
  let totalNet = 0;
  let totalIn = 0;
  for (const a of assets) {
    const start = valueOf(a, from, false);
    const end = valueOf(a, to, true);
    const { net, inflow } = netFlows(a.txs, from, to);
    totalNet += net;
    totalIn += inflow;
    const change = end - start - net;
    const base = start + inflow;
    perAsset[a.key] = { change, changePct: base > 0 ? (change / base) * 100 : null };
  }
  const vStart = points[0].v;
  const vEnd = points[n - 1].v;
  const change = vEnd - vStart - totalNet;
  const base = vStart + totalIn;
  return { points, change, changePct: base > 0 ? (change / base) * 100 : null, perAsset };
}

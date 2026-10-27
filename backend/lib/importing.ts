import { coingecko } from './coingecko.js';
import { getJson } from './exchanges.js';
import { FIAT, USD_LIKE } from './pricing.js';

// ---------------------------------------------------------------- coin resolution

export interface ListCoin {
  id: string;
  symbol: string;
  name: string;
}

export interface CoinMatch {
  id: string;
  symbol: string;
  name: string;
  /** high = symbol + name agree; low = picked by market cap among same-symbol coins. */
  confidence: 'high' | 'low';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Strips the disambiguation stars Delta adds to tickers ("DOT*", "ALT******"). */
export function cleanSymbol(symbol: string): string {
  return symbol.replace(/\*+$/, '').trim().toLowerCase();
}

function nameScore(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 3;
  if (x.includes(y) || y.includes(x)) return 2;
  const fx = a.toLowerCase().split(/[\s.\-]+/)[0];
  const fy = b.toLowerCase().split(/[\s.\-]+/)[0];
  return fx && fx === fy ? 1 : 0;
}

/**
 * Candidates for one asset. Returns the sure match, or the ids that need a market-cap tie-break.
 */
export function candidatesFor(
  list: ListCoin[],
  bySymbol: Map<string, ListCoin[]>,
  symbol: string,
  name: string,
): { match: ListCoin | null; confidence: 'high' | 'low'; tie: ListCoin[] } {
  const sym = cleanSymbol(symbol);
  const same = bySymbol.get(sym) ?? [];
  if (same.length) {
    let best = 0;
    for (const c of same) best = Math.max(best, nameScore(c.name, name));
    const named = best > 0 ? same.filter((c) => nameScore(c.name, name) === best) : [];
    if (named.length === 1) return { match: named[0], confidence: 'high', tie: [] };
    if (named.length > 1) return { match: null, confidence: 'high', tie: named };
    if (same.length === 1) return { match: same[0], confidence: 'low', tie: [] };
    return { match: null, confidence: 'low', tie: same };
  }
  const byName = list.filter((c) => nameScore(c.name, name) === 3);
  if (byName.length === 1) return { match: byName[0], confidence: 'low', tie: [] };
  if (byName.length > 1) return { match: null, confidence: 'low', tie: byName };
  return { match: null, confidence: 'low', tie: [] };
}

let listCache: { at: number; list: ListCoin[]; bySymbol: Map<string, ListCoin[]> } | null = null;

async function coinList() {
  if (listCache && Date.now() - listCache.at < 6 * 3600_000) return listCache;
  const list = await coingecko<ListCoin[]>('/coins/list', {});
  const bySymbol = new Map<string, ListCoin[]>();
  for (const c of list) {
    const k = c.symbol.toLowerCase();
    const arr = bySymbol.get(k);
    if (arr) arr.push(c);
    else bySymbol.set(k, [c]);
  }
  listCache = { at: Date.now(), list, bySymbol };
  return listCache;
}

/** Maps (symbol, name) pairs from a CSV to CoinGecko ids. */
export async function resolveCoins(items: { symbol: string; name: string }[]): Promise<(CoinMatch | null)[]> {
  const { list, bySymbol } = await coinList();
  const pre = items.map((it) => candidatesFor(list, bySymbol, it.symbol, it.name));

  // Market caps to break ties (one call for everything, ≤ 250 ids).
  const tieIds = Array.from(new Set(pre.flatMap((p) => p.tie.map((c) => c.id)))).slice(0, 250);
  const caps = new Map<string, number>();
  if (tieIds.length) {
    try {
      const rows = await coingecko<{ id: string; market_cap: number | null }[]>('/coins/markets', {
        vs_currency: 'usd',
        ids: tieIds.join(','),
        per_page: '250',
      });
      for (const r of rows) caps.set(r.id, r.market_cap ?? 0);
    } catch {
      // no tie-break data: leave ambiguous
    }
  }

  return pre.map((p) => {
    let pick = p.match;
    if (!pick && p.tie.length) {
      const ranked = p.tie
        .map((c) => ({ c, cap: caps.get(c.id) ?? 0 }))
        .filter((x) => x.cap > 0)
        .sort((a, b) => b.cap - a.cap);
      pick = ranked[0]?.c ?? null;
    }
    return pick ? { id: pick.id, symbol: pick.symbol, name: pick.name, confidence: p.confidence } : null;
  });
}

// ---------------------------------------------------------------- historical USD conversion

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Nearest value at or before `day` (FX has no weekends; klines may start later). */
export function lookupDay(series: Map<string, number>, ts: number, maxBackDays = 7): number | null {
  for (let i = 0; i <= maxBackDays; i++) {
    const v = series.get(isoDay(ts - i * DAY));
    if (v !== undefined) return v;
  }
  // after the range end (e.g. today before the daily close): try forward a little
  for (let i = 1; i <= 3; i++) {
    const v = series.get(isoDay(ts + i * DAY));
    if (v !== undefined) return v;
  }
  return null;
}

async function fiatSeries(currency: string, from: number, to: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const url = `https://api.frankfurter.dev/v1/${isoDay(from - 7 * DAY)}..${isoDay(to)}?base=USD&symbols=${currency}`;
  const data = (await getJson(url)) as { rates?: Record<string, Record<string, number>> } | null;
  for (const [day, r] of Object.entries(data?.rates ?? {})) {
    const perUsd = r[currency];
    if (perUsd > 0) out.set(day, 1 / perUsd); // USD per 1 unit of currency
  }
  return out;
}

async function cryptoSeries(symbol: string, from: number, to: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let start = Math.floor(from / DAY) * DAY - 3 * DAY;
  const end = to + DAY;
  for (let guard = 0; guard < 10 && start < end; guard++) {
    const rows = (await getJson(
      `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}USDT&interval=1d&startTime=${start}&limit=1000`,
    )) as unknown[][] | null;
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) out.set(isoDay(Number(r[0])), Number(r[4]));
    start = Number(rows[rows.length - 1][0]) + DAY;
    if (rows.length < 1000) break;
  }
  return out;
}

/** USD value of 1 unit of `currency` on the day of `ts`, for many rows at once. null = unknown. */
export async function convertToUsd(items: { currency: string; ts: number }[]): Promise<(number | null)[]> {
  const byCur = new Map<string, number[]>();
  for (const it of items) {
    const c = it.currency.toUpperCase();
    if (USD_LIKE.has(c)) continue;
    const arr = byCur.get(c) ?? [];
    arr.push(it.ts);
    byCur.set(c, arr);
  }
  const series = new Map<string, Map<string, number>>();
  await Promise.all(
    Array.from(byCur.entries()).map(async ([c, tss]) => {
      const from = Math.min(...tss);
      const to = Math.max(...tss);
      try {
        series.set(c, FIAT.has(c) ? await fiatSeries(c, from, to) : await cryptoSeries(c, from, to));
      } catch {
        series.set(c, new Map());
      }
    }),
  );
  return items.map((it) => {
    const c = it.currency.toUpperCase();
    if (USD_LIKE.has(c)) return 1;
    const s = series.get(c);
    return s ? lookupDay(s, it.ts) : null;
  });
}

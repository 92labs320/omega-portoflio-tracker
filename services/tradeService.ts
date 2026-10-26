import { Config } from '@/constants/Config';

export interface Ticker {
  exchangeId: string;
  exchange: string;
  base: string;
  target: string;
  targetCoinId: string | null;
  last: number | null;
  usdPerQuote: number | null;
  volumeUsd: number;
  /** True when Omega can fetch this exchange's historical candles. */
  history: boolean;
}

export interface PriceAt {
  price: number;
  quote: string;
  usdPerQuote: number;
  priceUsd: number;
  source: { kind: 'exchange' | 'global'; exchange: string | null; interval: '1m' | '1h' | '1d' | 'hourly'; at: number };
  note: string | null;
}

export const GLOBAL_EXCHANGE = 'global';

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      let msg = `Unavailable (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const tickerCache = new Map<string, { at: number; data: Ticker[] }>();

/** Exchanges and pairs where a coin trades (CoinGecko tickers, top 100 by volume). */
export async function fetchTickers(id: string): Promise<Ticker[]> {
  const hit = tickerCache.get(id);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data;
  if (!Config.apiUrl) return [];
  const data = await getJson<{ tickers: Ticker[] }>(`${Config.apiUrl}/api/tickers?id=${encodeURIComponent(id)}`);
  tickerCache.set(id, { at: Date.now(), data: data.tickers ?? [] });
  return data.tickers ?? [];
}

/** Price of 1 coin at a given minute on an exchange/pair (falls back to the global average). */
export async function fetchPriceAt(opts: {
  id: string;
  ts: number;
  exchangeId: string;
  base: string;
  target: string;
  targetCoinId: string | null;
}): Promise<PriceAt> {
  if (!Config.apiUrl) throw new Error('Historical prices require the Omega service');
  const q = new URLSearchParams({
    id: opts.id,
    ts: String(Math.floor(opts.ts / 60_000) * 60_000),
    exchange: opts.exchangeId || GLOBAL_EXCHANGE,
    base: opts.base,
    target: opts.target,
  });
  if (opts.targetCoinId) q.set('targetCoinId', opts.targetCoinId);
  return getJson<PriceAt>(`${Config.apiUrl}/api/price-at?${q.toString()}`);
}

/** Exchanges as a sorted, de-duplicated list (by name). */
export function exchangesFrom(tickers: Ticker[]): { id: string; name: string; history: boolean }[] {
  const map = new Map<string, { id: string; name: string; history: boolean }>();
  for (const t of tickers) if (!map.has(t.exchangeId)) map.set(t.exchangeId, { id: t.exchangeId, name: t.exchange, history: t.history });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const PREFERRED_QUOTES = ['USDT', 'USD', 'USDC', 'EUR', 'BTC'];

/** Pairs of one exchange, preferred quote currencies first. */
export function pairsFor(tickers: Ticker[], exchangeId: string): Ticker[] {
  return tickers
    .filter((t) => t.exchangeId === exchangeId)
    .sort((a, b) => {
      const ia = PREFERRED_QUOTES.indexOf(a.target);
      const ib = PREFERRED_QUOTES.indexOf(b.target);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return b.volumeUsd - a.volumeUsd;
    });
}

/** Common stock brokers for the platform picker. */
export const BROKERS = [
  'Wealthsimple',
  'Questrade',
  'Interactive Brokers',
  'Robinhood',
  'Fidelity',
  'Charles Schwab',
  'E*TRADE',
  'eToro',
  'Trading 212',
  'Degiro',
  'TD Direct Investing',
  'RBC Direct Investing',
  'BMO InvestorLine',
  'Desjardins Disnat',
  'National Bank Direct Brokerage',
  'Revolut',
  'Saxo',
  'Webull',
  'Moomoo',
  'Boursorama',
];

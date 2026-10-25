import { Config } from '@/constants/Config';
import type { Quote } from '@/lib/types';

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap: number;
  total_volume: number;
  last_updated?: string;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
}

async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429 || res.status === 503) throw new Error('Market data is busy. Retrying shortly.');
    if (!res.ok) throw new Error(`Market data unavailable (${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Market data request timed out');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Market data goes through the Omega API (shared CDN cache) when configured, else straight to CoinGecko. */
const viaApi = () => Config.apiUrl.length > 0;
const sortIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean))).sort();

/** Number of coins in the shared market feed (Home, Markets and portfolio prices all use it). */
export const FEED_SIZE = 250;

let feedCache: { at: number; promise: Promise<CoinMarket[]> } | null = null;

/**
 * Top 250 coins by market cap. One shared request for the whole app (deduplicated for 50 s),
 * itself cached at the edge by the Omega API so CoinGecko is called a few times per hour at most.
 */
export function fetchMarketFeed(force = false): Promise<CoinMarket[]> {
  if (!force && feedCache && Date.now() - feedCache.at < 50_000) return feedCache.promise;
  const promise = (async () => {
    if (viaApi()) return getJson<CoinMarket[]>(`${Config.apiUrl}/api/markets?per_page=${FEED_SIZE}`);
    const url = new URL(`${Config.coinGeckoBase}/coins/markets`);
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('order', 'market_cap_desc');
    url.searchParams.set('per_page', String(FEED_SIZE));
    url.searchParams.set('page', '1');
    url.searchParams.set('sparkline', 'false');
    url.searchParams.set('price_change_percentage', '24h');
    return getJson<CoinMarket[]>(url.toString());
  })();
  feedCache = { at: Date.now(), promise };
  promise.catch(() => {
    if (feedCache?.promise === promise) feedCache = null;
  });
  return promise;
}

/** Time of the most recent price in the feed (what the provider reports, not when we fetched it). */
export function feedTimestamp(coins: CoinMarket[]): string {
  let max = 0;
  for (const c of coins) {
    const t = c.last_updated ? Date.parse(c.last_updated) : NaN;
    if (Number.isFinite(t) && t > max) max = t;
  }
  return new Date(max || Date.now()).toISOString();
}

/** Live USD prices for CoinGecko ids: taken from the shared feed, extra request only for coins outside the top 250. */
export async function fetchCryptoQuotes(ids: string[]): Promise<Record<string, Quote>> {
  const unique = sortIds(ids);
  if (unique.length === 0) return {};
  const out: Record<string, Quote> = {};

  try {
    const feed = await fetchMarketFeed();
    const byId = new Map(feed.map((c) => [c.id, c]));
    for (const id of unique) {
      const c = byId.get(id);
      if (c && typeof c.current_price === 'number') {
        out[id] = { price: c.current_price, change24h: c.price_change_percentage_24h ?? null };
      }
    }
  } catch {
    // fall through to a direct lookup for everything
  }

  const missing = unique.filter((id) => !out[id]);
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100).join(',');
    if (viaApi()) {
      const data = await getJson<{ quotes: Record<string, Quote> }>(
        `${Config.apiUrl}/api/prices?ids=${encodeURIComponent(chunk)}`,
      );
      Object.assign(out, data.quotes ?? {});
      continue;
    }
    const data = await getJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      `${Config.coinGeckoBase}/simple/price?ids=${encodeURIComponent(chunk)}&vs_currencies=usd&include_24hr_change=true`,
    );
    for (const [id, v] of Object.entries(data)) {
      if (typeof v.usd === 'number') out[id] = { price: v.usd, change24h: v.usd_24h_change ?? null };
    }
  }
  return out;
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const data = viaApi()
    ? await getJson<{ coins: CoinSearchResult[] }>(`${Config.apiUrl}/api/search?q=${encodeURIComponent(q)}`)
    : await getJson<{ coins: CoinSearchResult[] }>(`${Config.coinGeckoBase}/search?query=${encodeURIComponent(q)}`);
  return (data.coins ?? []).slice(0, 20);
}

/** Stock quotes come from the Omega API (Finnhub proxy) so no API key ships in the app. */
export async function fetchStockQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).filter(Boolean);
  if (unique.length === 0 || !Config.apiUrl) return {};
  const data = await getJson<{ quotes: Record<string, Quote> }>(
    `${Config.apiUrl}/api/quotes?symbols=${encodeURIComponent(unique.join(','))}`,
  );
  return data.quotes ?? {};
}

export function stockQuotesAvailable(): boolean {
  return Config.apiUrl.length > 0;
}

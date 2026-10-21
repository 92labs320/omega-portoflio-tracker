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
    if (res.status === 429) throw new Error('Market data rate limit reached. Try again in a minute.');
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

export async function fetchTopCoins(perPage = 100, ids?: string[]): Promise<CoinMarket[]> {
  const url = new URL(`${Config.coinGeckoBase}/coins/markets`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');
  url.searchParams.set('price_change_percentage', '24h');
  if (ids && ids.length > 0) url.searchParams.set('ids', ids.join(','));
  return getJson<CoinMarket[]>(url.toString());
}

/** Live USD prices for CoinGecko ids. */
export async function fetchCryptoQuotes(ids: string[]): Promise<Record<string, Quote>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  const out: Record<string, Quote> = {};
  // CoinGecko accepts long id lists; chunk to stay well under URL limits.
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const url = `${Config.coinGeckoBase}/simple/price?ids=${encodeURIComponent(
      chunk.join(','),
    )}&vs_currencies=usd&include_24hr_change=true`;
    const data = await getJson<Record<string, { usd?: number; usd_24h_change?: number }>>(url);
    for (const [id, v] of Object.entries(data)) {
      if (typeof v.usd === 'number') {
        out[id] = { price: v.usd, change24h: v.usd_24h_change ?? null };
      }
    }
  }
  return out;
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const data = await getJson<{ coins: CoinSearchResult[] }>(
    `${Config.coinGeckoBase}/search?query=${encodeURIComponent(q)}`,
  );
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

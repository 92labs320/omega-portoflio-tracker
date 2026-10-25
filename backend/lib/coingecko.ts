import { HttpError } from './core.js';

const BASE = 'https://api.coingecko.com/api/v3';
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Validates a comma-separated list of CoinGecko ids and returns it sorted (better CDN cache hits). */
export function parseCoinIds(raw: unknown, max = 250): string[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (typeof raw !== 'string') throw new HttpError(400, 'ids must be a string');
  const ids = Array.from(new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))).sort();
  if (ids.length > max) throw new HttpError(400, `At most ${max} ids`);
  for (const id of ids) if (!ID_RE.test(id)) throw new HttpError(400, `Invalid id: ${id}`);
  return ids;
}

/** Server-side CoinGecko call. Uses a free Demo API key when COINGECKO_API_KEY is set. */
export async function coingecko<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (key) headers['x-cg-demo-api-key'] = key;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (res.status === 429) throw new HttpError(503, 'Market data is busy, try again shortly');
    if (!res.ok) throw new HttpError(502, `Market data provider error (${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, 'Market data provider unreachable');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shared CDN cache: every user gets the same response for 5 min, stale copies served while refreshing.
 * Keeps CoinGecko usage within the free Demo plan (10k calls/month) whatever the number of users.
 */
export const MARKET_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=900, stale-if-error=86400';

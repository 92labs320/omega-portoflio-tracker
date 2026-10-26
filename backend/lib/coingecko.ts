import { HttpError } from './core.js';

const BASE = 'https://api.coingecko.com/api/v3';
export const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

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

/** Validates a single CoinGecko id. */
export function parseCoinId(raw: unknown): string {
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!ID_RE.test(id)) throw new HttpError(400, 'Invalid coin id');
  return id;
}

/** Days accepted by CoinGecko /ohlc. */
export const OHLC_DAYS = [1, 7, 14, 30, 90, 180, 365];

export function parseDays(raw: unknown, type: 'line' | 'candle'): number {
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpError(400, 'days must be 1-365');
  if (type === 'candle' && !OHLC_DAYS.includes(days)) throw new HttpError(400, `days must be one of ${OHLC_DAYS.join(',')}`);
  return days;
}

/** Strips HTML from CoinGecko descriptions and keeps the first paragraphs. */
export function cleanDescription(html: unknown, max = 1200): string {
  if (typeof html !== 'string') return '';
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut).trim();
}

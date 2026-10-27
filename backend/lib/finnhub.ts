import { HttpError } from './core.js';

const BASE = 'https://finnhub.io/api/v1';

/** GET a Finnhub endpoint with the server-side key. Throws HttpError on failure. */
export async function finnhub<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new HttpError(503, 'Stock data is not configured');
  const qs = new URLSearchParams({ ...params, token: key });
  const r = await fetch(`${BASE}${path}?${qs.toString()}`, { headers: { Accept: 'application/json' } });
  if (r.status === 429) throw new HttpError(503, 'Stock data is busy, try again shortly');
  if (!r.ok) throw new HttpError(502, `Stock data unavailable (${r.status})`);
  return (await r.json()) as T;
}

export interface StockHit {
  symbol: string;
  name: string;
  type: string;
}

const KEEP_TYPES = new Set(['Common Stock', 'ETP', 'ADR', 'REIT', 'Closed-End Fund', 'Unit', 'NY Reg Shrs']);

/** Normalizes Finnhub /search results: US listings only, ranked exact-symbol first. */
export function cleanStockHits(
  q: string,
  raw: { symbol?: string; displaySymbol?: string; description?: string; type?: string }[],
): StockHit[] {
  const upper = q.trim().toUpperCase();
  const seen = new Set<string>();
  const out: StockHit[] = [];
  for (const r of raw) {
    const symbol = (r.symbol ?? '').toUpperCase();
    if (!symbol || seen.has(symbol) || !/^[A-Z0-9.\-]{1,12}$/.test(symbol)) continue;
    if (r.type && !KEEP_TYPES.has(r.type)) continue;
    seen.add(symbol);
    out.push({ symbol, name: titleCase(r.description ?? symbol), type: r.type === 'ETP' ? 'ETF' : r.type || 'Stock' });
  }
  const score = (h: StockHit) =>
    h.symbol === upper ? 0 : h.symbol.startsWith(upper) ? 1 : h.name.toUpperCase().startsWith(upper) ? 2 : 3;
  return out.sort((a, b) => score(a) - score(b) || a.symbol.length - b.symbol.length).slice(0, 20);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-&/(])([a-z])/g, (_m, pre: string, c: string) => pre + c.toUpperCase());
}

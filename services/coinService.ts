import { Config } from '@/constants/Config';

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  description: string;
  homepage: string | null;
  categories: string[];
  genesisDate: string | null;
  market: {
    price: number | null;
    marketCap: number | null;
    volume24h: number | null;
    high24h: number | null;
    low24h: number | null;
    fdv: number | null;
    ath: number | null;
    athDate: string | null;
    athChangePct: number | null;
    atl: number | null;
    atlDate: string | null;
    change24h: number | null;
    change7d: number | null;
    change30d: number | null;
    change1y: number | null;
    circulatingSupply: number | null;
    totalSupply: number | null;
    maxSupply: number | null;
    lastUpdated: string | null;
  };
}

export type ChartType = 'line' | 'candle';
export type Range = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y';
export const RANGES: Range[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'];

export interface LinePoint {
  t: number;
  v: number;
}
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}
export type ChartData = { type: 'line'; points: LinePoint[] } | { type: 'candle'; candles: Candle[] };

const OHLC_DAYS = [1, 7, 14, 30, 90, 180, 365];

function startOfYear(): number {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).getTime();
}

/** Days to request for a range, and the earliest timestamp to keep. */
export function rangeWindow(range: Range, type: ChartType): { days: number; from: number } {
  const now = Date.now();
  const fixed: Record<Exclude<Range, 'YTD'>, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
  if (range !== 'YTD') {
    const days = fixed[range];
    return { days, from: now - days * 86400_000 };
  }
  const from = startOfYear();
  const ytd = Math.max(1, Math.ceil((now - from) / 86400_000));
  const days = type === 'candle' ? OHLC_DAYS.find((d) => d >= ytd) ?? 365 : Math.min(365, ytd);
  return { days, from };
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (res.status === 429 || res.status === 503) throw new Error('Market data is busy. Try again in a moment.');
    if (!res.ok) throw new Error(`Data unavailable (${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const detailCache = new Map<string, { at: number; data: CoinDetail }>();
const chartCache = new Map<string, { at: number; data: ChartData }>();

export async function fetchCoinDetail(id: string): Promise<CoinDetail> {
  const hit = detailCache.get(id);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data;
  if (!Config.apiUrl) throw new Error('Coin details require the Omega service');
  const data = await getJson<CoinDetail>(`${Config.apiUrl}/api/coin?id=${encodeURIComponent(id)}`);
  detailCache.set(id, { at: Date.now(), data });
  return data;
}

export async function fetchChart(id: string, range: Range, type: ChartType): Promise<ChartData> {
  const { days, from } = rangeWindow(range, type);
  const key = `${id}|${type}|${days}`;
  const hit = chartCache.get(key);
  const ttl = days <= 1 ? 2 * 60_000 : 15 * 60_000;
  let data: ChartData;
  if (hit && Date.now() - hit.at < ttl) {
    data = hit.data;
  } else {
    if (!Config.apiUrl) throw new Error('Charts require the Omega service');
    const raw = await getJson<{ type: ChartType; points?: [number, number][]; candles?: number[][] }>(
      `${Config.apiUrl}/api/chart?id=${encodeURIComponent(id)}&days=${days}&type=${type}`,
    );
    data =
      type === 'line'
        ? { type: 'line', points: (raw.points ?? []).map(([t, v]) => ({ t, v })) }
        : { type: 'candle', candles: (raw.candles ?? []).map(([t, o, h, l, c]) => ({ t, o, h, l, c })) };
    chartCache.set(key, { at: Date.now(), data });
  }
  // Trim to the exact window (YTD, and OHLC ranges rounded up).
  return data.type === 'line'
    ? { type: 'line', points: data.points.filter((p) => p.t >= from) }
    : { type: 'candle', candles: data.candles.filter((c) => c.t >= from) };
}

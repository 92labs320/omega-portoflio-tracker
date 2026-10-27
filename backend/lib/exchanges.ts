/**
 * Historical prices straight from exchanges' public market-data APIs (no keys needed).
 * Each fetcher returns the candle that contains `ts`, or null when the exchange has no data
 * for that pair / time (too old, unknown symbol, blocked region...).
 */

export type Interval = '1m' | '1h' | '1d';
export const INTERVAL_MS: Record<Interval, number> = { '1m': 60_000, '1h': 3_600_000, '1d': 86_400_000 };

export interface ExCandle {
  /** Candle open time (ms). */
  t: number;
  open: number;
  close: number;
}

type Fetcher = (base: string, target: string, ts: number, interval: Interval) => Promise<ExCandle | null>;

const UA = { 'User-Agent': 'omega-portfolio/1.0 (+https://omega-portoflio-tracker-backend.vercel.app)', Accept: 'application/json' };

export async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, { headers: UA, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function floorTo(ts: number, interval: Interval): number {
  const ms = INTERVAL_MS[interval];
  return ts - (((ts % ms) + ms) % ms);
}

/** Accepts the candle only if it really covers `ts`. */
export function pick(rows: ExCandle[], ts: number, interval: Interval): ExCandle | null {
  const start = floorTo(ts, interval);
  const ms = INTERVAL_MS[interval];
  const hit = rows.find((r) => r.t <= ts && ts < r.t + ms) ?? rows.find((r) => r.t === start);
  if (!hit || !Number.isFinite(hit.open) || hit.open <= 0) return null;
  return hit;
}

const n = (v: unknown) => Number(v);

/** Binance-compatible /api/v3/klines (Binance, MEXC). */
function binanceLike(host: string, names: Record<Interval, string>): Fetcher {
  return async (base, target, ts, interval) => {
    const start = floorTo(ts, interval);
    const data = await getJson(
      `${host}/api/v3/klines?symbol=${base}${target}&interval=${names[interval]}&startTime=${start}&limit=1`,
    );
    if (!Array.isArray(data)) return null;
    return pick(
      data.map((r: unknown[]) => ({ t: n(r[0]), open: n(r[1]), close: n(r[4]) })),
      ts,
      interval,
    );
  };
}

const coinbase: Fetcher = async (base, target, ts, interval) => {
  const gran = { '1m': 60, '1h': 3600, '1d': 86400 }[interval];
  const start = floorTo(ts, interval);
  const end = start + INTERVAL_MS[interval];
  const data = await getJson(
    `https://api.exchange.coinbase.com/products/${base}-${target}/candles?granularity=${gran}&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`,
  );
  if (!Array.isArray(data)) return null;
  // [time(s), low, high, open, close, volume]
  return pick(
    data.map((r: unknown[]) => ({ t: n(r[0]) * 1000, open: n(r[3]), close: n(r[4]) })),
    ts,
    interval,
  );
};

const kraken: Fetcher = async (base, target, ts, interval) => {
  const iv = { '1m': 1, '1h': 60, '1d': 1440 }[interval];
  const b = base === 'BTC' ? 'XBT' : base;
  const t = target === 'BTC' ? 'XBT' : target;
  const start = floorTo(ts, interval);
  const data = (await getJson(
    `https://api.kraken.com/0/public/OHLC?pair=${b}${t}&interval=${iv}&since=${Math.floor(start / 1000) - 1}`,
  )) as { error?: string[]; result?: Record<string, unknown> } | null;
  if (!data?.result || (data.error && data.error.length)) return null;
  const key = Object.keys(data.result).find((k) => k !== 'last');
  const rows = key ? (data.result[key] as unknown[][]) : [];
  // Kraken only keeps the last 720 candles: if the first one starts after ts, it's too old.
  if (!rows.length || n(rows[0][0]) * 1000 > ts) return null;
  return pick(
    rows.map((r) => ({ t: n(r[0]) * 1000, open: n(r[1]), close: n(r[4]) })),
    ts,
    interval,
  );
};

const kucoin: Fetcher = async (base, target, ts, interval) => {
  const type = { '1m': '1min', '1h': '1hour', '1d': '1day' }[interval];
  const start = floorTo(ts, interval) / 1000;
  const data = (await getJson(
    `https://api.kucoin.com/api/v1/market/candles?type=${type}&symbol=${base}-${target}&startAt=${start}&endAt=${start + INTERVAL_MS[interval] / 1000}`,
  )) as { data?: unknown[][] } | null;
  if (!Array.isArray(data?.data)) return null;
  // [time(s), open, close, high, low, volume, turnover]
  return pick(
    data.data.map((r) => ({ t: n(r[0]) * 1000, open: n(r[1]), close: n(r[2]) })),
    ts,
    interval,
  );
};

const okx: Fetcher = async (base, target, ts, interval) => {
  const bar = { '1m': '1m', '1h': '1H', '1d': '1Dutc' }[interval];
  const start = floorTo(ts, interval);
  const data = (await getJson(
    `https://www.okx.com/api/v5/market/history-candles?instId=${base}-${target}&bar=${bar}&after=${start + INTERVAL_MS[interval]}&limit=1`,
  )) as { data?: unknown[][] } | null;
  if (!Array.isArray(data?.data)) return null;
  return pick(
    data.data.map((r) => ({ t: n(r[0]), open: n(r[1]), close: n(r[4]) })),
    ts,
    interval,
  );
};

const gate: Fetcher = async (base, target, ts, interval) => {
  const start = floorTo(ts, interval) / 1000;
  const data = await getJson(
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${base}_${target}&interval=${interval}&from=${start}&to=${start}`,
  );
  if (!Array.isArray(data)) return null;
  // [t(s), quote_vol, close, high, low, open, base_vol, closed]
  return pick(
    data.map((r: unknown[]) => ({ t: n(r[0]) * 1000, open: n(r[5]), close: n(r[2]) })),
    ts,
    interval,
  );
};

const bitget: Fetcher = async (base, target, ts, interval) => {
  const gran = { '1m': '1min', '1h': '1h', '1d': '1day' }[interval];
  const start = floorTo(ts, interval);
  const data = (await getJson(
    `https://api.bitget.com/api/v2/spot/market/history-candles?symbol=${base}${target}&granularity=${gran}&endTime=${start + INTERVAL_MS[interval]}&limit=1`,
  )) as { data?: unknown[][] } | null;
  if (!Array.isArray(data?.data)) return null;
  return pick(
    data.data.map((r) => ({ t: n(r[0]), open: n(r[1]), close: n(r[4]) })),
    ts,
    interval,
  );
};

/** Keyed by CoinGecko exchange identifier (as returned in /coins/{id}/tickers). */
export const EXCHANGES: Record<string, { name: string; fetch: Fetcher }> = {
  binance: { name: 'Binance', fetch: binanceLike('https://data-api.binance.vision', { '1m': '1m', '1h': '1h', '1d': '1d' }) },
  mxc: { name: 'MEXC', fetch: binanceLike('https://api.mexc.com', { '1m': '1m', '1h': '60m', '1d': '1d' }) },
  gdax: { name: 'Coinbase', fetch: coinbase },
  kraken: { name: 'Kraken', fetch: kraken },
  kucoin: { name: 'KuCoin', fetch: kucoin },
  okex: { name: 'OKX', fetch: okx },
  gate: { name: 'Gate', fetch: gate },
  bitget: { name: 'Bitget', fetch: bitget },
};

export function supportsHistory(exchangeId: string): boolean {
  return exchangeId in EXCHANGES;
}

/** Tries 1-minute candles first, then hourly, then daily (older history is often coarser). */
export async function exchangePriceAt(
  exchangeId: string,
  base: string,
  target: string,
  ts: number,
): Promise<{ price: number; at: number; interval: Interval } | null> {
  const ex = EXCHANGES[exchangeId];
  if (!ex) return null;
  for (const interval of ['1m', '1h', '1d'] as Interval[]) {
    const c = await ex.fetch(base, target, ts, interval);
    if (c) return { price: c.open, at: c.t, interval };
  }
  return null;
}

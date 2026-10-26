import { HttpError } from './core.js';
import { coingecko } from './coingecko.js';
import { EXCHANGES, exchangePriceAt, type Interval } from './exchanges.js';

export const USD_LIKE = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'USDP', 'PYUSD', 'USDE', 'USD1', 'USDS']);
export const FIAT = new Set([
  'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'HKD', 'SGD', 'KRW', 'INR', 'BRL', 'TRY', 'MXN', 'NZD',
  'SEK', 'NOK', 'DKK', 'PLN', 'ZAR', 'IDR', 'PHP', 'THB', 'VND', 'ARS', 'NGN', 'UAH', 'CZK', 'HUF', 'ILS', 'AED',
]);

const YEAR_MS = 365 * 86400_000;

/** Global (CoinGecko aggregated) price of a coin at `ts`, hourly granularity. */
export async function globalPriceAt(id: string, vs: string, ts: number): Promise<{ price: number; at: number }> {
  const now = Date.now();
  if (ts < now - YEAR_MS + 3600_000) {
    throw new HttpError(422, 'Prices older than 1 year are not available. Enter the price manually.');
  }
  const t = Math.min(ts, now);
  const from = Math.floor((t - 12 * 3600_000) / 1000);
  const to = Math.floor(Math.min(t + 12 * 3600_000, now) / 1000);
  const data = await coingecko<{ prices?: [number, number][] }>(`/coins/${id}/market_chart/range`, {
    vs_currency: vs.toLowerCase(),
    from: String(from),
    to: String(to),
  });
  const pts = (data.prices ?? []).filter((p) => Number.isFinite(p[1]) && p[1] > 0);
  if (!pts.length) throw new HttpError(404, 'No price data for that date');
  let best = pts[0];
  for (const p of pts) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
  return { price: best[1], at: best[0] };
}

export interface PriceAt {
  /** Price per coin in the quote currency. */
  price: number;
  quote: string;
  /** USD value of one unit of the quote currency at that time. */
  usdPerQuote: number;
  priceUsd: number;
  source: { kind: 'exchange' | 'global'; exchange: string | null; interval: Interval | 'hourly'; at: number };
  note: string | null;
}

/** Value of 1 unit of `target` in USD at `ts`. */
async function usdPerQuoteAt(id: string, target: string, targetCoinId: string | null, ts: number): Promise<number> {
  if (USD_LIKE.has(target)) return 1;
  if (targetCoinId) return (await globalPriceAt(targetCoinId, 'usd', ts)).price;
  if (FIAT.has(target)) {
    const [usd, fiat] = await Promise.all([globalPriceAt(id, 'usd', ts), globalPriceAt(id, target, ts)]);
    return usd.price / fiat.price;
  }
  throw new HttpError(422, `Can't convert ${target} to USD`);
}

export async function priceAt(opts: {
  id: string;
  ts: number;
  exchangeId: string | null;
  base: string | null;
  target: string;
  targetCoinId: string | null;
}): Promise<PriceAt> {
  const { id, ts, exchangeId, base, target, targetCoinId } = opts;

  // 1) Exact exchange candle when we can.
  if (exchangeId && base && EXCHANGES[exchangeId]) {
    const hit = await exchangePriceAt(exchangeId, base, target, ts).catch(() => null);
    if (hit) {
      let usdPerQuote: number;
      try {
        usdPerQuote = await usdPerQuoteAt(id, target, targetCoinId, ts);
      } catch {
        usdPerQuote = NaN;
      }
      if (!Number.isFinite(usdPerQuote)) {
        const g = await globalPriceAt(id, 'usd', ts);
        usdPerQuote = g.price / hit.price;
      }
      return {
        price: hit.price,
        quote: target,
        usdPerQuote,
        priceUsd: hit.price * usdPerQuote,
        source: { kind: 'exchange', exchange: EXCHANGES[exchangeId].name, interval: hit.interval, at: hit.at },
        note: hit.interval === '1m' ? null : `Closest ${hit.interval === '1h' ? 'hourly' : 'daily'} price on ${EXCHANGES[exchangeId].name}.`,
      };
    }
  }

  // 2) Global average (CoinGecko), converted into the pair's quote currency.
  const g = await globalPriceAt(id, 'usd', ts);
  const usdPerQuote = await usdPerQuoteAt(id, target, targetCoinId, ts).catch(() => null);
  const quote = usdPerQuote ? target : 'USD';
  const rate = usdPerQuote ?? 1;
  let note: string | null = null;
  if (exchangeId && exchangeId !== 'global') {
    note = EXCHANGES[exchangeId]
      ? `${EXCHANGES[exchangeId].name} history unavailable for this pair or date. Showing the global average.`
      : 'Exchange history isn’t available for this platform. Showing the global average.';
  }
  return {
    price: g.price / rate,
    quote,
    usdPerQuote: rate,
    priceUsd: g.price,
    source: { kind: 'global', exchange: null, interval: 'hourly', at: g.at },
    note,
  };
}

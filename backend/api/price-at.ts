import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { parseCoinId } from '../lib/coingecko.js';
import { priceAt } from '../lib/pricing.js';
import { convertToUsd } from '../lib/importing.js';

const SYMBOL_RE = /^[A-Z0-9]{1,15}$/;
const EXCHANGE_RE = /^[a-z0-9_-]{1,40}$/;

/**
 * GET /api/price-at?id=realio-network&ts=1761487200000&exchange=mxc&base=RIO&target=USDT[&targetCoinId=tether]
 * → price of 1 coin at that minute on that exchange (or the global average as a fallback).
 */
export default route(['GET', 'POST'], async (req, res) => {
  // POST { quotes: [{ currency: 'CAD', ts }] } → { usd: [number | null] } (USD per 1 unit that day; CSV import)
  if (req.method === 'POST') {
    const quotes = (req.body as { quotes?: unknown })?.quotes;
    if (!Array.isArray(quotes) || quotes.length === 0 || quotes.length > 5000) {
      throw new HttpError(400, 'quotes must be a list of 1-5000 items');
    }
    const items = quotes.map((q) => {
      const o = q as { currency?: unknown; ts?: unknown };
      const currency = typeof o.currency === 'string' ? o.currency.toUpperCase() : '';
      const ts = Number(o.ts);
      if (!SYMBOL_RE.test(currency) || !Number.isFinite(ts) || ts < 1_230_768_000_000 || ts > Date.now() + 86_400_000) {
        throw new HttpError(400, 'Each quote needs a currency and a past ts');
      }
      return { currency, ts };
    });
    res.status(200).json({ usd: await convertToUsd(items) });
    return;
  }

  const id = parseCoinId(req.query.id);
  const ts = Number(req.query.ts);
  if (!Number.isFinite(ts) || ts < 1_230_768_000_000 || ts > Date.now() + 5 * 60_000) {
    throw new HttpError(400, 'ts must be a past timestamp in ms');
  }
  const exchange = typeof req.query.exchange === 'string' && req.query.exchange ? req.query.exchange : 'global';
  if (!EXCHANGE_RE.test(exchange)) throw new HttpError(400, 'Invalid exchange');
  const base = typeof req.query.base === 'string' ? req.query.base.toUpperCase() : '';
  const target = typeof req.query.target === 'string' && req.query.target ? req.query.target.toUpperCase() : 'USD';
  if ((base && !SYMBOL_RE.test(base)) || !SYMBOL_RE.test(target)) throw new HttpError(400, 'Invalid pair');
  const targetCoinId =
    typeof req.query.targetCoinId === 'string' && req.query.targetCoinId ? parseCoinId(req.query.targetCoinId) : null;

  const result = await priceAt({
    id,
    ts: Math.floor(ts / 60_000) * 60_000,
    exchangeId: exchange === 'global' ? null : exchange,
    base: base || null,
    target,
    targetCoinId,
  });
  const recent = Date.now() - ts < 3 * 3600_000;
  res.setHeader(
    'Cache-Control',
    recent ? 'public, max-age=0, s-maxage=120' : 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
  );
  res.status(200).json(result);
});

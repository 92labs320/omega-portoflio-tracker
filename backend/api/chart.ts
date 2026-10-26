import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { coingecko, parseCoinId, parseDays } from '../lib/coingecko.js';

/**
 * GET /api/chart?id=bitcoin&days=30&type=line|candle
 * line   → { type, points: [[ms, price], ...] }
 * candle → { type, candles: [[ms, open, high, low, close], ...] }
 */
export default route(['GET'], async (req, res) => {
  const id = parseCoinId(req.query.id);
  const type = req.query.type === 'candle' ? 'candle' : req.query.type === 'line' || req.query.type === undefined ? 'line' : null;
  if (!type) throw new HttpError(400, 'type must be line or candle');
  const days = parseDays(req.query.days, type);

  let body: unknown;
  if (type === 'line') {
    const data = await coingecko<{ prices?: [number, number][] }>(`/coins/${id}/market_chart`, {
      vs_currency: 'usd',
      days: String(days),
    });
    body = { type, points: (data.prices ?? []).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) };
  } else {
    const data = await coingecko<[number, number, number, number, number][]>(`/coins/${id}/ohlc`, {
      vs_currency: 'usd',
      days: String(days),
    });
    body = { type, candles: (Array.isArray(data) ? data : []).filter((c) => c.every((v) => Number.isFinite(v))) };
  }

  const maxAge = days <= 1 ? 300 : 3600;
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}, stale-if-error=86400`,
  );
  res.status(200).json(body);
});

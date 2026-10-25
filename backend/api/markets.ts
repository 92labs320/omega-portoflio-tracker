import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { coingecko, MARKET_CACHE, parseCoinIds } from '../lib/coingecko.js';

/** GET /api/markets?per_page=100[&ids=bitcoin,ethereum] → CoinGecko /coins/markets (USD), cached at the edge. */
export default route(['GET'], async (req, res) => {
  const perPage = Number(req.query.per_page ?? 100);
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 250) throw new HttpError(400, 'per_page must be 1-250');
  const ids = parseCoinIds(req.query.ids);
  const params: Record<string, string> = {
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: String(perPage),
    page: '1',
    sparkline: 'false',
    price_change_percentage: '24h',
  };
  if (ids.length) params.ids = ids.join(',');
  const data = await coingecko<unknown[]>('/coins/markets', params);
  res.setHeader('Cache-Control', MARKET_CACHE);
  res.status(200).json(data);
});

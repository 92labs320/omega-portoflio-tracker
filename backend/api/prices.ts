import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { coingecko, MARKET_CACHE, parseCoinIds } from '../lib/coingecko.js';

/** GET /api/prices?ids=bitcoin,solana → { quotes: { bitcoin: { price, change24h } } }, cached at the edge. */
export default route(['GET'], async (req, res) => {
  const ids = parseCoinIds(req.query.ids);
  if (ids.length === 0) throw new HttpError(400, 'ids is required');
  const data = await coingecko<Record<string, { usd?: number; usd_24h_change?: number }>>('/simple/price', {
    ids: ids.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  });
  const quotes: Record<string, { price: number; change24h: number | null }> = {};
  for (const [id, v] of Object.entries(data)) {
    if (typeof v.usd === 'number') quotes[id] = { price: v.usd, change24h: v.usd_24h_change ?? null };
  }
  res.setHeader('Cache-Control', MARKET_CACHE);
  res.status(200).json({ quotes });
});

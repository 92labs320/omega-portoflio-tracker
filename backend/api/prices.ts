import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { coingecko, MARKET_CACHE, parseCoinIds } from '../lib/coingecko.js';

interface MarketRow {
  id: string;
  image?: string;
  current_price?: number | null;
  price_change_percentage_24h?: number | null;
}

/**
 * GET /api/prices?ids=bitcoin,solana → { quotes: { bitcoin: { price, change24h, image } } }, cached at the edge.
 * Uses /coins/markets so coins outside the top 250 also get their logo.
 */
export default route(['GET'], async (req, res) => {
  const ids = parseCoinIds(req.query.ids);
  if (ids.length === 0) throw new HttpError(400, 'ids is required');
  const rows = await coingecko<MarketRow[]>('/coins/markets', {
    vs_currency: 'usd',
    ids: ids.join(','),
    per_page: '250',
    price_change_percentage: '24h',
  });
  const quotes: Record<string, { price: number; change24h: number | null; image: string | null }> = {};
  for (const r of rows) {
    if (typeof r.current_price === 'number') {
      quotes[r.id] = { price: r.current_price, change24h: r.price_change_percentage_24h ?? null, image: r.image ?? null };
    }
  }
  res.setHeader('Cache-Control', MARKET_CACHE);
  res.status(200).json({ quotes });
});

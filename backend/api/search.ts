import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { coingecko } from '../lib/coingecko.js';

interface SearchCoin {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
}

/** GET /api/search?q=sol → { coins: [...] } (top 20), cached 1 h at the edge. */
export default route(['GET'], async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (q.length < 1 || q.length > 40) throw new HttpError(400, 'q must be 1-40 characters');
  const data = await coingecko<{ coins?: SearchCoin[] }>('/search', { query: q });
  const coins = (data.coins ?? []).slice(0, 20).map(({ id, symbol, name, thumb }) => ({ id, symbol, name, thumb }));
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json({ coins });
});

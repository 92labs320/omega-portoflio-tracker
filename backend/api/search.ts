import { route } from '../lib/http.js';
import { HttpError } from '../lib/core.js';
import { coingecko } from '../lib/coingecko.js';
import { cleanStockHits, finnhub } from '../lib/finnhub.js';
import { resolveCoins } from '../lib/importing.js';

interface SearchCoin {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
}

/**
 * GET /api/search?q=sol → { coins: [...] } (CoinGecko, top 20)
 * GET /api/search?q=apple&type=stock → { stocks: [{ symbol, name, type }] } (Finnhub, US listings)
 * Cached at the edge.
 */
export default route(['GET', 'POST'], async (req, res) => {
  // POST { assets: [{ symbol, name }] } → { matches: [{ id, symbol, name, confidence } | null] } (CSV import)
  if (req.method === 'POST') {
    const assets = (req.body as { assets?: unknown })?.assets;
    if (!Array.isArray(assets) || assets.length === 0 || assets.length > 300) {
      throw new HttpError(400, 'assets must be a list of 1-300 items');
    }
    const items = assets.map((a) => {
      const o = a as { symbol?: unknown; name?: unknown };
      const symbol = typeof o.symbol === 'string' ? o.symbol.slice(0, 30) : '';
      const name = typeof o.name === 'string' ? o.name.slice(0, 100) : '';
      if (!symbol && !name) throw new HttpError(400, 'Each asset needs a symbol or a name');
      return { symbol, name };
    });
    res.status(200).json({ matches: await resolveCoins(items) });
    return;
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (q.length < 1 || q.length > 40) throw new HttpError(400, 'q must be 1-40 characters');

  if (req.query.type === 'stock') {
    const data = await finnhub<{ result?: { symbol?: string; displaySymbol?: string; description?: string; type?: string }[] }>(
      '/search',
      { q, exchange: 'US' },
    );
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ stocks: cleanStockHits(q, data.result ?? []) });
    return;
  }

  const data = await coingecko<{ coins?: SearchCoin[] }>('/search', { query: q });
  const coins = (data.coins ?? []).slice(0, 20).map(({ id, symbol, name, thumb }) => ({ id, symbol, name, thumb }));
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json({ coins });
});

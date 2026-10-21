import { route } from '../lib/http.js';
import { HttpError, parseSymbols } from '../lib/core.js';

interface FinnhubQuote {
  c: number; // current
  dp: number | null; // % change vs previous close
}

/** GET /api/quotes?symbols=AAPL,MSFT → { quotes: { AAPL: { price, change24h } } } (Finnhub proxy). */
export default route(['GET'], async (req, res) => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new HttpError(503, 'Stock quotes are not configured');
  const symbols = parseSymbols(req.query.symbols);

  const quotes: Record<string, { price: number; change24h: number | null }> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      const r = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`,
      );
      if (!r.ok) return;
      const q = (await r.json()) as FinnhubQuote;
      // Finnhub returns c = 0 for unknown symbols.
      if (typeof q.c === 'number' && q.c > 0) {
        quotes[symbol] = { price: q.c, change24h: typeof q.dp === 'number' ? q.dp : null };
      }
    }),
  );

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.status(200).json({ quotes });
});

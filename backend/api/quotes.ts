import { route } from '../lib/http.js';
import { parseSymbols } from '../lib/core.js';
import { finnhub } from '../lib/finnhub.js';

interface FinnhubQuote {
  c: number; // current
  d: number | null; // change
  dp: number | null; // % change vs previous close
  h: number; // day high
  l: number; // day low
  o: number; // open
  pc: number; // previous close
  t: number; // unix seconds
}

interface FinnhubProfile {
  name?: string;
  logo?: string;
  exchange?: string;
  currency?: string;
  marketCapitalization?: number; // millions
  finnhubIndustry?: string;
  weburl?: string;
  ipo?: string;
  country?: string;
}

/**
 * GET /api/quotes?symbols=AAPL,MSFT → { quotes: { AAPL: { price, change24h, open, high, low, prevClose, time } } }
 * GET /api/quotes?symbols=AAPL&profile=1 → { profiles: { AAPL: { name, logo, exchange, ... } } } (slow-changing, cached 1 day)
 * Finnhub proxy; the key never ships in the app.
 */
export default route(['GET'], async (req, res) => {
  const symbols = parseSymbols(req.query.symbols);

  if (req.query.profile === '1') {
    const profiles: Record<string, unknown> = {};
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const p = await finnhub<FinnhubProfile>('/stock/profile2', { symbol });
          if (!p?.name) return;
          profiles[symbol] = {
            name: p.name,
            logo: p.logo || null,
            exchange: p.exchange || null,
            currency: p.currency || null,
            marketCap: typeof p.marketCapitalization === 'number' ? p.marketCapitalization * 1e6 : null,
            industry: p.finnhubIndustry || null,
            website: p.weburl || null,
            ipo: p.ipo || null,
            country: p.country || null,
          };
        } catch {
          // skip
        }
      }),
    );
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ profiles });
    return;
  }

  const quotes: Record<string, unknown> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await finnhub<FinnhubQuote>('/quote', { symbol });
        // Finnhub returns c = 0 for unknown symbols.
        if (typeof q.c === 'number' && q.c > 0) {
          quotes[symbol] = {
            price: q.c,
            change24h: typeof q.dp === 'number' ? q.dp : null,
            open: q.o || null,
            high: q.h || null,
            low: q.l || null,
            prevClose: q.pc || null,
            time: q.t ? q.t * 1000 : null,
          };
        }
      } catch {
        // skip
      }
    }),
  );

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.status(200).json({ quotes });
});

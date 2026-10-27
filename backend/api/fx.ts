import { route } from '../lib/http.js';
import { coingecko } from '../lib/coingecko.js';

/** GET /api/fx → { base: 'USD', rates: { CAD: 1.39, EUR: 0.92, ... }, updatedAt } (units of currency per 1 USD). */
export default route(['GET'], async (_req, res) => {
  const data = await coingecko<{ rates?: Record<string, { value?: number; type?: string }> }>('/exchange_rates', {});
  const r = data.rates ?? {};
  const usd = r.usd?.value;
  const rates: Record<string, number> = { USD: 1 };
  if (typeof usd === 'number' && usd > 0) {
    for (const [code, v] of Object.entries(r)) {
      if (v?.type === 'fiat' && typeof v.value === 'number' && v.value > 0) rates[code.toUpperCase()] = v.value / usd;
    }
  }
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=21600, stale-if-error=86400');
  res.status(200).json({ base: 'USD', rates, updatedAt: new Date().toISOString() });
});

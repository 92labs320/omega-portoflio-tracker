import { getDb, route } from '../lib/http.js';

/** GET /api/health → checks that Neon is reachable. */
export default route(['GET'], async (_req, res) => {
  const rows = await getDb().query<{ ok: number }>('SELECT 1 AS ok');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: rows[0]?.ok === 1,
    database: 'neon',
    stocks: Boolean(process.env.FINNHUB_API_KEY),
    coingeckoKey: Boolean(process.env.COINGECKO_API_KEY),
  });
});

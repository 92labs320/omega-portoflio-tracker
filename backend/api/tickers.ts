import { route } from '../lib/http.js';
import { coingecko, parseCoinId } from '../lib/coingecko.js';
import { supportsHistory } from '../lib/exchanges.js';

interface Ticker {
  base: string;
  target: string;
  market?: { name?: string; identifier?: string };
  last?: number;
  converted_last?: { usd?: number };
  converted_volume?: { usd?: number };
  trust_score?: string | null;
  is_anomaly?: boolean;
  is_stale?: boolean;
  target_coin_id?: string;
}

const SYMBOL_RE = /^[A-Z0-9]{1,15}$/;

/**
 * GET /api/tickers?id=bitcoin → where the coin trades:
 * { tickers: [{ exchangeId, exchange, base, target, targetCoinId, last, usdPerQuote, volumeUsd, history }] }
 */
export default route(['GET'], async (req, res) => {
  const id = parseCoinId(req.query.id);
  const data = await coingecko<{ tickers?: Ticker[] }>(`/coins/${id}/tickers`, {
    include_exchange_logo: 'false',
    depth: 'false',
    order: 'volume_desc',
    page: '1',
  });
  const seen = new Set<string>();
  const tickers = [];
  for (const t of data.tickers ?? []) {
    const exchangeId = t.market?.identifier ?? '';
    const base = (t.base ?? '').toUpperCase();
    const target = (t.target ?? '').toUpperCase();
    if (!exchangeId || !SYMBOL_RE.test(base) || !SYMBOL_RE.test(target)) continue; // skip DEX contract pairs
    if (t.is_anomaly || t.is_stale) continue;
    const key = `${exchangeId}|${base}|${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const last = typeof t.last === 'number' && t.last > 0 ? t.last : null;
    const usdLast = typeof t.converted_last?.usd === 'number' ? t.converted_last.usd : null;
    tickers.push({
      exchangeId,
      exchange: t.market?.name ?? exchangeId,
      base,
      target,
      targetCoinId: t.target_coin_id ?? null,
      last,
      usdPerQuote: last && usdLast ? usdLast / last : null,
      volumeUsd: t.converted_volume?.usd ?? 0,
      history: supportsHistory(exchangeId),
    });
  }
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800, stale-if-error=86400');
  res.status(200).json({ tickers });
});

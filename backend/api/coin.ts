import { route } from '../lib/http.js';
import { cleanDescription, coingecko, parseCoinId } from '../lib/coingecko.js';

type Usd = { usd?: number } | undefined;
interface CoinResponse {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  image?: { large?: string; small?: string };
  description?: { en?: string };
  links?: { homepage?: string[] };
  categories?: string[];
  genesis_date?: string | null;
  market_data?: {
    current_price?: Usd;
    market_cap?: Usd;
    total_volume?: Usd;
    high_24h?: Usd;
    low_24h?: Usd;
    fully_diluted_valuation?: Usd;
    ath?: Usd;
    ath_date?: { usd?: string };
    ath_change_percentage?: Usd;
    atl?: Usd;
    atl_date?: { usd?: string };
    price_change_percentage_24h?: number | null;
    price_change_percentage_7d?: number | null;
    price_change_percentage_30d?: number | null;
    price_change_percentage_1y?: number | null;
    circulating_supply?: number | null;
    total_supply?: number | null;
    max_supply?: number | null;
    last_updated?: string;
  };
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** GET /api/coin?id=bitcoin → trimmed coin profile + market data, cached 10 min at the edge. */
export default route(['GET'], async (req, res) => {
  const id = parseCoinId(req.query.id);
  const c = await coingecko<CoinResponse>(`/coins/${id}`, {
    localization: 'false',
    tickers: 'false',
    market_data: 'true',
    community_data: 'false',
    developer_data: 'false',
    sparkline: 'false',
  });
  const m = c.market_data ?? {};
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400');
  res.status(200).json({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    image: c.image?.large ?? c.image?.small ?? null,
    rank: c.market_cap_rank ?? null,
    description: cleanDescription(c.description?.en),
    homepage: (c.links?.homepage ?? []).find((u) => typeof u === 'string' && u.startsWith('http')) ?? null,
    categories: (c.categories ?? []).filter(Boolean).slice(0, 4),
    genesisDate: c.genesis_date ?? null,
    market: {
      price: n(m.current_price?.usd),
      marketCap: n(m.market_cap?.usd),
      volume24h: n(m.total_volume?.usd),
      high24h: n(m.high_24h?.usd),
      low24h: n(m.low_24h?.usd),
      fdv: n(m.fully_diluted_valuation?.usd),
      ath: n(m.ath?.usd),
      athDate: m.ath_date?.usd ?? null,
      athChangePct: n(m.ath_change_percentage?.usd),
      atl: n(m.atl?.usd),
      atlDate: m.atl_date?.usd ?? null,
      change24h: n(m.price_change_percentage_24h),
      change7d: n(m.price_change_percentage_7d),
      change30d: n(m.price_change_percentage_30d),
      change1y: n(m.price_change_percentage_1y),
      circulatingSupply: n(m.circulating_supply),
      totalSupply: n(m.total_supply),
      maxSupply: n(m.max_supply),
      lastUpdated: m.last_updated ?? null,
    },
  });
});

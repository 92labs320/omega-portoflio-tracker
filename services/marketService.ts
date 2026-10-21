import { Config } from '@/constants/Config';

export interface CoinMarket {
  id:                    string;
  symbol:                string;
  name:                  string;
  image:                 string;
  current_price:         number;
  price_change_percentage_24h: number;
  market_cap:            number;
  total_volume:          number;
}

export async function fetchTopCoins(
  currency = 'usd',
  perPage = 50,
  page = 1,
): Promise<CoinMarket[]> {
  const url = new URL(`${Config.coinGeckoBase}/coins/markets`);
  url.searchParams.set('vs_currency', currency);
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('sparkline', 'false');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  return res.json() as Promise<CoinMarket[]>;
}

export async function fetchCoinPrice(id: string, currency = 'usd'): Promise<number> {
  const url = `${Config.coinGeckoBase}/simple/price?ids=${id}&vs_currencies=${currency}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = (await res.json()) as Record<string, Record<string, number>>;
  return data[id]?.[currency] ?? 0;
}



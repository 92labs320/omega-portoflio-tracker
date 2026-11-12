import { Config } from '@/constants/Config';
import { getKv, setKv } from '@/lib/db';
import { getJson } from '@/services/marketService';

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number | null;
  change24h: number | null;
}

export interface NewsItem {
  id: number;
  headline: string;
  image: string | null;
  source: string;
  url: string;
  time: number;
}

/** Fetch with a device snapshot: returns cached data on failure (offline). */
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  let snap: { at: number; data: T } | null = null;
  try {
    const raw = await getKv(key);
    snap = raw ? JSON.parse(raw) : null;
  } catch {
    snap = null;
  }
  if (snap && Date.now() - snap.at < ttlMs) return snap.data;
  try {
    const data = await load();
    setKv(key, JSON.stringify({ at: Date.now(), data })).catch(() => {});
    return data;
  } catch (e) {
    if (snap) return snap.data;
    throw e;
  }
}

export function fetchTrendingCoins(): Promise<TrendingCoin[]> {
  return cached('cache.trending.v1', 10 * 60_000, async () => {
    const d = await getJson<{ coins: TrendingCoin[] }>(`${Config.apiUrl}/api/search?trending=1`);
    return d.coins ?? [];
  });
}

export function fetchNews(category: 'crypto' | 'general'): Promise<NewsItem[]> {
  return cached(`cache.news.${category}.v1`, 10 * 60_000, async () => {
    const d = await getJson<{ news: NewsItem[] }>(`${Config.apiUrl}/api/quotes?news=${category}`);
    return d.news ?? [];
  });
}

/** "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(t: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - t) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

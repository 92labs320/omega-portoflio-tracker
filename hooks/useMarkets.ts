import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { fetchTopCoins, type CoinMarket } from '@/services/marketService';

const REFRESH_MS = 60_000;

/**
 * Live CoinGecko market data. Never returns placeholder prices:
 * on failure the last successful data is kept and `error` is set.
 */
export function useMarkets(opts: { perPage?: number; ids?: string[] } = {}) {
  const { perPage = 100, ids } = opts;
  const idsKey = ids?.join(',') ?? '';
  const [coins, setCoins] = useState<CoinMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const data = await fetchTopCoins(perPage, idsKey ? idsKey.split(',') : undefined);
      setCoins(data);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Market data unavailable');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [perPage, idsKey]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  return { coins, loading, error, updatedAt, refresh: load };
}

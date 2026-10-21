import { useState, useEffect, useCallback } from 'react';
import { fetchTopCoins, type CoinMarket } from '@/services/marketService';

export function useMarkets(currency = 'usd') {
  const [coins, setCoins]       = useState<CoinMarket[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopCoins(currency);
      setCoins(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => { load(); }, [load]);

  return { coins, loading, error, refresh: load };
}

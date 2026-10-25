import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getKv, setKv } from '@/lib/db';
import { fetchTopCoins, type CoinMarket } from '@/services/marketService';

const REFRESH_MS = 60_000;
/** Don't refetch when switching tabs if data is fresher than this. */
const STALE_MS = 30_000;
const RETRY_MS = 20_000;

interface Snapshot {
  coins: CoinMarket[];
  updatedAt: string;
}

/** Shared across screens so Home and Markets don't refetch the same thing. */
const memory = new Map<string, Snapshot>();

/**
 * Live CoinGecko market data (through the Omega API cache). Never returns placeholder prices:
 * the last real snapshot is kept on the device and shown with its timestamp when offline.
 */
export function useMarkets(opts: { perPage?: number; ids?: string[] } = {}) {
  const { perPage = 100, ids } = opts;
  const idsKey = ids ? Array.from(new Set(ids)).sort().join(',') : '';
  const cacheKey = `cache.markets.${perPage}.${idsKey}`;

  const [coins, setCoins] = useState<CoinMarket[]>(() => memory.get(cacheKey)?.coins ?? []);
  const [updatedAt, setUpdatedAt] = useState<string | null>(() => memory.get(cacheKey)?.updatedAt ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback(
    (snap: Snapshot) => {
      memory.set(cacheKey, snap);
      setCoins(snap.coins);
      setUpdatedAt(snap.updatedAt);
    },
    [cacheKey],
  );

  // Restore the last real snapshot from the device on first mount.
  useEffect(() => {
    if (memory.has(cacheKey)) return;
    getKv(cacheKey)
      .then((raw) => {
        if (!raw || memory.has(cacheKey)) return;
        const snap = JSON.parse(raw) as Snapshot;
        if (Array.isArray(snap.coins) && snap.coins.length) apply(snap);
      })
      .catch(() => {});
  }, [cacheKey, apply]);

  const load = useCallback(
    async (force = false) => {
      const cached = memory.get(cacheKey);
      if (!force && cached && Date.now() - new Date(cached.updatedAt).getTime() < STALE_MS) {
        setLoading(false);
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      try {
        const data = await fetchTopCoins(perPage, idsKey ? idsKey.split(',') : undefined);
        const snap = { coins: data, updatedAt: new Date().toISOString() };
        apply(snap);
        setError(null);
        setKv(cacheKey, JSON.stringify(snap)).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Market data unavailable');
        retryTimer.current = setTimeout(() => load(true), RETRY_MS);
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [perPage, idsKey, cacheKey, apply],
  );

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(true), REFRESH_MS);
      return () => {
        clearInterval(timer);
        if (retryTimer.current) clearTimeout(retryTimer.current);
      };
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { coins, loading, error, updatedAt, refresh };
}

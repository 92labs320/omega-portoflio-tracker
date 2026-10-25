import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getKv, setKv } from '@/lib/db';
import { feedTimestamp, fetchMarketFeed, type CoinMarket } from '@/services/marketService';

const REFRESH_MS = 60_000;
/** Don't refetch when switching tabs if data was fetched less than this ago. */
const STALE_MS = 30_000;
const RETRY_MS = 20_000;
const CACHE_KEY = 'cache.market_feed.v1';

interface Snapshot {
  coins: CoinMarket[];
  /** Provider timestamp of the newest price. */
  updatedAt: string;
  fetchedAt: number;
}

/** Shared by every screen so Home and Markets never fetch twice. */
let memory: Snapshot | null = null;
const listeners = new Set<(s: Snapshot) => void>();

function publish(snap: Snapshot) {
  memory = snap;
  listeners.forEach((l) => l(snap));
}

/**
 * Live market data (top 250 by market cap) through the Omega API cache. Never returns placeholder
 * prices: the last real snapshot is kept on the device and shown with its timestamp when offline.
 */
export function useMarkets() {
  const [snap, setSnap] = useState<Snapshot | null>(memory);
  const [loading, setLoading] = useState(!memory);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listeners.add(setSnap);
    if (!memory) {
      getKv(CACHE_KEY)
        .then((raw) => {
          if (!raw || memory) return;
          const saved = JSON.parse(raw) as Snapshot;
          if (Array.isArray(saved.coins) && saved.coins.length) publish({ ...saved, fetchedAt: 0 });
        })
        .catch(() => {});
    }
    return () => {
      listeners.delete(setSnap);
    };
  }, []);

  const load = useCallback(async (force = false) => {
    if (!force && memory && Date.now() - memory.fetchedAt < STALE_MS) {
      setLoading(false);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    try {
      const coins = await fetchMarketFeed(force);
      const next = { coins, updatedAt: feedTimestamp(coins), fetchedAt: Date.now() };
      publish(next);
      setError(null);
      setKv(CACHE_KEY, JSON.stringify(next)).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Market data unavailable');
      retryTimer.current = setTimeout(() => load(true), RETRY_MS);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

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
  return {
    coins: snap?.coins ?? [],
    updatedAt: snap?.updatedAt ?? null,
    loading,
    error,
    refresh,
  };
}

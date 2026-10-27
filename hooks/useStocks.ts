import { useCallback, useEffect, useRef, useState } from 'react';

import { getKv, setKv } from '@/lib/db';
import {
  fetchStockProfiles,
  fetchStockQuotes,
  type StockProfile,
  type StockQuote,
} from '@/services/marketService';

const SNAP_KEY = 'cache.stock_quotes.v1';
const REFRESH_MS = 60_000;

/**
 * Live quotes + profiles (name, logo) for a list of tickers. Keeps a local snapshot so the
 * list shows instantly, and refreshes every minute while `active`.
 */
export function useStocks(symbols: string[], active: boolean) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [profiles, setProfiles] = useState<Record<string, StockProfile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const key = symbols.join(',');
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    getKv(SNAP_KEY)
      .then((raw) => {
        if (!raw) return;
        const snap = JSON.parse(raw) as { at: number; quotes: Record<string, StockQuote> };
        setQuotes((q) => (Object.keys(q).length ? q : snap.quotes));
        setUpdatedAt((u) => u ?? snap.at);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    const list = keyRef.current.split(',').filter(Boolean);
    if (!list.length) return;
    setLoading(true);
    try {
      const q = await fetchStockQuotes(list);
      setQuotes((prev) => ({ ...prev, ...q }));
      setError(Object.keys(q).length ? null : 'Stock prices unavailable');
      const at = Date.now();
      setUpdatedAt(at);
      setKv(SNAP_KEY, JSON.stringify({ at, quotes: q })).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stock prices unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    fetchStockProfiles(key.split(','))
      .then((p) => setProfiles((prev) => ({ ...prev, ...p })))
      .catch(() => {});
  }, [key]);

  useEffect(() => {
    if (!active || !key) return;
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [active, key, refresh]);

  return { quotes, profiles, loading, error, updatedAt, refresh };
}

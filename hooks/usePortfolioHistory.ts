import { useEffect, useMemo, useState } from 'react';

import { buildHistory, portfolioWindow, type HistoryResult, type PortfolioRange, type Pt } from '@/lib/history';
import { quoteKey } from '@/lib/portfolio';
import type { AssetCategory, Quote, Transaction } from '@/lib/types';
import { fetchLineDays } from '@/services/coinService';

/** Runs `tasks` with at most `limit` in flight. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      out[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return out;
}

export interface PortfolioHistory extends HistoryResult {
  loading: boolean;
  /** Some assets have no price history (stocks, or a failed request): valued at today's price. */
  partial: boolean;
  truncated: boolean;
}

/**
 * Portfolio value over time for a range, built from the user's transactions and each crypto
 * asset's USD price history. Stocks are valued at their latest price (no free history).
 */
export function usePortfolioHistory(
  transactions: Transaction[],
  quotes: Record<string, Quote>,
  range: PortfolioRange,
  filter: 'all' | AssetCategory,
): PortfolioHistory | null {
  const relevant = useMemo(
    () =>
      transactions
        .filter((t) => !t.deleted && (filter === 'all' || t.category === filter))
        .slice()
        .sort((a, b) => a.executedAt.localeCompare(b.executedAt)),
    [transactions, filter],
  );

  const groups = useMemo(() => {
    const m = new Map<string, { category: AssetCategory; assetId: string; txs: Transaction[] }>();
    for (const t of relevant) {
      const k = quoteKey(t.category, t.assetId);
      const g = m.get(k) ?? { category: t.category, assetId: t.assetId, txs: [] };
      g.txs.push(t);
      m.set(k, g);
    }
    return m;
  }, [relevant]);

  const firstTxAt = relevant.length ? Date.parse(relevant[0].executedAt) : null;
  const assetKey = Array.from(groups.keys()).sort().join('|');
  const txVersion = relevant.map((t) => `${t.id}:${t.updatedAt}`).join(',');

  const [series, setSeries] = useState<Record<string, Pt[] | null>>({});
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const win = useMemo(() => portfolioWindow(range, firstTxAt, now), [range, firstTxAt, now]);

  useEffect(() => {
    let alive = true;
    const cryptos = Array.from(groups.entries()).filter(([, g]) => g.category === 'crypto');
    if (!cryptos.length) {
      setSeries({});
      return;
    }
    setLoading(true);
    pool(
      cryptos.map(([k, g]) => async () => {
        try {
          return [k, await fetchLineDays(g.assetId, win.days)] as const;
        } catch {
          return [k, null] as const;
        }
      }),
      5,
    ).then((res) => {
      if (!alive) return;
      setSeries(Object.fromEntries(res));
      setNow(Date.now());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey, win.days]);

  return useMemo(() => {
    if (!groups.size) return null;
    const assets = Array.from(groups.entries()).map(([k, g]) => ({
      key: k,
      txs: g.txs,
      series: g.category === 'crypto' ? series[k] ?? null : null,
      livePrice: quotes[k]?.price ?? null,
    }));
    const r = buildHistory(assets, win.from, Math.max(win.to, Date.now() - 1000));
    const partial = assets.some((a) => !a.series);
    return { ...r, loading, partial, truncated: win.truncated };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, series, quotes, win, loading, txVersion]);
}

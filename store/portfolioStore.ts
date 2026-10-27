import { create } from 'zustand';

import * as db from '@/lib/db';
import { computeHoldings, quoteKey } from '@/lib/portfolio';
import { isSyncEnabled, syncNow } from '@/lib/sync';
import type { Holding, Quote, Transaction, TransactionInput } from '@/lib/types';
import { fetchCryptoQuotes, fetchStockQuotes } from '@/services/marketService';

interface PortfolioState {
  ready: boolean;
  transactions: Transaction[];
  holdings: Holding[];
  /** Keyed by quoteKey(category, assetId). */
  quotes: Record<string, Quote>;
  quotesUpdatedAt: string | null;
  quotesError: string | null;
  quotesLoading: boolean;
  syncError: string | null;

  load: () => Promise<void>;
  refreshQuotes: () => Promise<void>;
  add: (input: TransactionInput) => Promise<void>;
  addMany: (inputs: TransactionInput[]) => Promise<number>;
  update: (id: string, input: TransactionInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  reset: () => void;
}

const QUOTES_KEY = 'cache.quotes';

function derive(transactions: Transaction[]) {
  return { transactions, holdings: computeHoldings(transactions) };
}

export const usePortfolioStore = create<PortfolioState>((set, get) => {
  /** Fire-and-forget backup after a local change; never blocks the UI. */
  const backgroundSync = () => {
    isSyncEnabled()
      .then((on) => (on ? get().sync() : undefined))
      .catch(() => {});
  };

  return {
    ready: false,
    transactions: [],
    holdings: [],
    quotes: {},
    quotesUpdatedAt: null,
    quotesError: null,
    quotesLoading: false,
    syncError: null,

    load: async () => {
      const txs = await db.listTransactions();
      set({ ...derive(txs), ready: true });
      // Restore the last real quotes so values show instantly (and offline) with their timestamp.
      if (Object.keys(get().quotes).length === 0) {
        const raw = await db.getKv(QUOTES_KEY).catch(() => null);
        if (raw) {
          try {
            const snap = JSON.parse(raw) as { quotes: Record<string, Quote>; updatedAt: string };
            if (Object.keys(get().quotes).length === 0) {
              set({ quotes: snap.quotes ?? {}, quotesUpdatedAt: snap.updatedAt ?? null });
            }
          } catch {
            // ignore a corrupt cache
          }
        }
      }
    },

    refreshQuotes: async () => {
      const open = get().holdings.filter((h) => h.quantity > 0);
      if (open.length === 0) {
        set({ quotesError: null });
        return;
      }
      set({ quotesLoading: true });
      const cryptoIds = open.filter((h) => h.category === 'crypto').map((h) => h.assetId);
      const stockIds = open.filter((h) => h.category === 'stock').map((h) => h.assetId);
      const errors: string[] = [];
      const next: Record<string, Quote> = { ...get().quotes };

      const [crypto, stocks] = await Promise.allSettled([
        fetchCryptoQuotes(cryptoIds),
        fetchStockQuotes(stockIds),
      ]);
      if (crypto.status === 'fulfilled') {
        for (const [id, q] of Object.entries(crypto.value)) next[quoteKey('crypto', id)] = q;
      } else if (cryptoIds.length) {
        errors.push(crypto.reason instanceof Error ? crypto.reason.message : 'Crypto prices unavailable');
      }
      if (stocks.status === 'fulfilled') {
        for (const [id, q] of Object.entries(stocks.value)) next[quoteKey('stock', id)] = q;
      } else if (stockIds.length) {
        errors.push('Stock prices unavailable');
      }
      // Listings without a live feed (e.g. Toronto .TO on the free plan): value at the last trade price
      // so the position still counts in the total. change24h = null marks it as not live.
      for (const id of stockIds) {
        const k = quoteKey('stock', id);
        if (next[k] && !next[k].stale) continue;
        const last = get()
          .transactions.filter((t) => !t.deleted && t.category === 'stock' && t.assetId === id && t.priceUsd > 0)
          .sort((a, b) => b.executedAt.localeCompare(a.executedAt))[0];
        if (last) next[k] = { price: last.priceUsd, change24h: null, stale: true };
      }

      const updatedAt = errors.length === 0 ? new Date().toISOString() : get().quotesUpdatedAt;
      set({
        quotes: next,
        quotesLoading: false,
        quotesError: errors.length ? errors.join(' · ') : null,
        quotesUpdatedAt: updatedAt,
      });
      if (errors.length === 0) {
        db.setKv(QUOTES_KEY, JSON.stringify({ quotes: next, updatedAt })).catch(() => {});
      }
    },

    add: async (input) => {
      await db.createTransaction(input);
      await get().load();
      backgroundSync();
      get().refreshQuotes().catch(() => {});
    },

    addMany: async (inputs) => {
      const n = await db.createTransactions(inputs);
      await get().load();
      backgroundSync();
      get().refreshQuotes().catch(() => {});
      return n;
    },

    update: async (id, input) => {
      await db.updateTransaction(id, input);
      await get().load();
      backgroundSync();
    },

    remove: async (id) => {
      await db.deleteTransaction(id);
      await get().load();
      backgroundSync();
    },

    sync: async () => {
      try {
        const { pulled } = await syncNow();
        set({ syncError: null });
        if (pulled > 0) await get().load();
      } catch (e) {
        set({ syncError: e instanceof Error ? e.message : 'Sync failed' });
        throw e;
      }
    },

    reset: () =>
      set({
        transactions: [],
        holdings: [],
        quotes: {},
        quotesUpdatedAt: null,
        quotesError: null,
        syncError: null,
      }),
  };
});

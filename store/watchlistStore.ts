import { create } from 'zustand';

import { getKv, setKv } from '@/lib/db';

const KEY = 'watchlist.v1';

/** Followed crypto assets (CoinGecko ids), stored on the device. */
interface WatchlistState {
  ids: string[];
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  ids: [],
  loaded: false,
  load: async () => {
    try {
      const raw = await getKv(KEY);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      set({ ids: Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  toggle: (id) => {
    const cur = get().ids;
    const ids = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    set({ ids });
    setKv(KEY, JSON.stringify(ids)).catch(() => {});
  },
  has: (id) => get().ids.includes(id),
}));

import { create } from 'zustand';

import { getKv, setKv } from '@/lib/db';
import type { PortfolioRange } from '@/lib/history';

export interface Prefs {
  /** Mask balances on Home and Portfolio. */
  hideBalances: boolean;
  showPortfolioChart: boolean;
  /** Hide positions worth less than 1 USD. */
  hideSmallHoldings: boolean;
  defaultRange: PortfolioRange;
  /** Require Face ID / passcode to open the app. */
  appLock: boolean;
}

const DEFAULTS: Prefs = {
  hideBalances: false,
  showPortfolioChart: true,
  hideSmallHoldings: false,
  defaultRange: 'ALL',
  appLock: false,
};

const KEY = 'prefs.v1';

interface PrefsState extends Prefs {
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    try {
      const raw = await getKv(KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
      // Home used its own key for the eye toggle before prefs existed.
      const legacyHide = await getKv('home.hide_amounts');
      set({ ...DEFAULTS, ...(legacyHide === '1' ? { hideBalances: true } : null), ...saved, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  set: (key, value) => {
    set({ [key]: value } as Partial<PrefsState>);
    const s = get();
    const out: Prefs = {
      hideBalances: s.hideBalances,
      showPortfolioChart: s.showPortfolioChart,
      hideSmallHoldings: s.hideSmallHoldings,
      defaultRange: s.defaultRange,
      appLock: s.appLock,
    };
    setKv(KEY, JSON.stringify(out)).catch(() => {});
  },
}));

export const MASK = '••••••';

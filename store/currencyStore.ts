import { create } from 'zustand';

import { Config } from '@/constants/Config';
import { setFx } from '@/lib/currency';
import { getKv, setKv } from '@/lib/db';

const CODE_KEY = 'display.currency';
const RATES_KEY = 'fx.rates.v1';

interface CurrencyState {
  code: string;
  rates: Record<string, number>;
  load: () => Promise<void>;
  setCode: (code: string) => void;
}

async function fetchRates(): Promise<Record<string, number> | null> {
  if (!Config.apiUrl) return null;
  try {
    const res = await fetch(`${Config.apiUrl}/api/fx`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates ?? null;
  } catch {
    return null;
  }
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  code: 'USD',
  rates: { USD: 1 },

  load: async () => {
    const code = (await getKv(CODE_KEY).catch(() => null)) || 'USD';
    let rates: Record<string, number> = { USD: 1 };
    try {
      const raw = await getKv(RATES_KEY);
      if (raw) rates = { ...rates, ...(JSON.parse(raw) as Record<string, number>) };
    } catch {
      // ignore
    }
    setFx(code, rates[code] ?? (code === 'USD' ? 1 : NaN));
    set({ code: rates[code] ? code : 'USD', rates });

    const fresh = await fetchRates();
    if (fresh) {
      setKv(RATES_KEY, JSON.stringify(fresh)).catch(() => {});
      const c = get().code === 'USD' && code !== 'USD' ? code : get().code;
      setFx(c, fresh[c] ?? 1);
      set({ rates: { USD: 1, ...fresh }, code: fresh[c] ? c : 'USD' });
    }
  },

  setCode: (code) => {
    const rate = get().rates[code];
    if (!rate) return;
    setFx(code, rate);
    set({ code });
    setKv(CODE_KEY, code).catch(() => {});
  },
}));

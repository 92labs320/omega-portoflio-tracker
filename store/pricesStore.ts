import { create } from 'zustand';

export interface PriceData {
  [key: string]: number; // symbol -> price
}

interface PricesStore {
  prices: PriceData;
  setPrices: (prices: PriceData) => void;
  updatePrice: (symbol: string, price: number) => void;
  getPrice: (symbol: string) => number;
}

export const usePricesStore = create<PricesStore>((set, get) => ({
  prices: {},
  
  setPrices: (prices) => set({ prices }),
  
  updatePrice: (symbol, price) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: price },
    })),
  
  getPrice: (symbol) => {
    const state = get();
    return state.prices[symbol] || 0;
  },
}));



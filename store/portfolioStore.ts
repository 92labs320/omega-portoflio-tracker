import { create } from 'zustand';

export interface Transaction {
  id:        string;
  assetId:   string;
  symbol:    string;
  name:      string;
  type:      'buy' | 'sell' | 'stake' | 'unstake' | 'reward' | 'airdrop';
  quantity:  number;
  priceUsd:  number;
  date:      string; // ISO
}

export interface Holding {
  assetId:      string;
  symbol:       string;
  name:         string;
  quantity:     number;
  avgCostUsd:   number;
  currentPrice: number;
}

interface PortfolioState {
  transactions: Transaction[];
  holdings:     Holding[];
  totalValue:   number;
  totalCost:    number;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  setCurrentPrices: (prices: Record<string, number>) => void;
}

function recomputeHoldings(txs: Transaction[]): Holding[] {
  const map = new Map<string, { qty: number; cost: number; symbol: string; name: string }>();
  for (const tx of txs) {
    const entry = map.get(tx.assetId) ?? { qty: 0, cost: 0, symbol: tx.symbol, name: tx.name };
    if (tx.type === 'buy' || tx.type === 'reward' || tx.type === 'airdrop') {
      entry.cost += tx.quantity * tx.priceUsd;
      entry.qty  += tx.quantity;
    } else if (tx.type === 'sell') {
      entry.qty -= tx.quantity;
    }
    map.set(tx.assetId, entry);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.qty > 0)
    .map(([id, v]) => ({
      assetId:      id,
      symbol:       v.symbol,
      name:         v.name,
      quantity:     v.qty,
      avgCostUsd:   v.qty > 0 ? v.cost / v.qty : 0,
      currentPrice: 0,
    }));
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  transactions: [],
  holdings:     [],
  totalValue:   0,
  totalCost:    0,

  addTransaction: (tx) =>
    set((state) => {
      const newTxs = [...state.transactions, { ...tx, id: Date.now().toString() }];
      const holdings = recomputeHoldings(newTxs);
      return { transactions: newTxs, holdings };
    }),

  setCurrentPrices: (prices) =>
    set((state) => {
      const holdings = state.holdings.map((h) => ({
        ...h,
        currentPrice: prices[h.assetId] ?? h.currentPrice,
      }));
      const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);
      const totalCost  = holdings.reduce((sum, h) => sum + h.quantity * h.avgCostUsd, 0);
      return { holdings, totalValue, totalCost };
    }),
}));



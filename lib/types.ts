export type AssetCategory = 'crypto' | 'stock';

export type TransactionType =
  | 'buy'
  | 'sell'
  | 'stake'
  | 'unstake'
  | 'reward'
  | 'airdrop';

export const TRANSACTION_TYPES: TransactionType[] = [
  'buy',
  'sell',
  'stake',
  'unstake',
  'reward',
  'airdrop',
];

/** A transaction as stored on the device (and mirrored in Neon). */
export interface Transaction {
  id: string;
  /** CoinGecko id for crypto (e.g. "bitcoin"), ticker for stocks (e.g. "AAPL"). */
  assetId: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  type: TransactionType;
  quantity: number;
  /** Price per unit in USD at execution time. */
  priceUsd: number;
  /** Fee in USD, added to the cost basis of buys and deducted from sale proceeds. */
  feeUsd: number;
  exchange: string;
  notes: string;
  /** ISO date-time of the trade. */
  executedAt: string;
  /** ISO date-time of the last local modification (last-write-wins sync). */
  updatedAt: string;
  deleted: boolean;
}

export type TransactionInput = Omit<
  Transaction,
  'id' | 'updatedAt' | 'deleted'
>;

export interface Holding {
  assetId: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  quantity: number;
  /** Remaining cost basis of the open position (USD). */
  costBasis: number;
  avgCost: number;
  /** Realized P&L from sells (USD). */
  realizedPnl: number;
}

export interface Quote {
  price: number;
  change24h: number | null;
}

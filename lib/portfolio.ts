import type { Holding, Quote, Transaction } from './types';

const DUST = 1e-10;

/**
 * Builds open positions from the transaction history using the average-cost method.
 * - buy / reward / airdrop: add quantity, add (quantity × price + fee) to cost basis
 * - sell: remove quantity (capped at what is held), release average cost, book realized P&L
 * - stake / unstake: the asset stays owned, quantity unchanged; a fee is booked as a realized loss
 */
export function computeHoldings(transactions: Transaction[]): Holding[] {
  const sorted = transactions
    .filter((t) => !t.deleted)
    .slice()
    .sort((a, b) =>
      a.executedAt === b.executedAt
        ? a.updatedAt.localeCompare(b.updatedAt)
        : a.executedAt.localeCompare(b.executedAt),
    );

  const map = new Map<string, Holding>();

  for (const tx of sorted) {
    const key = `${tx.category}:${tx.assetId}`;
    const h =
      map.get(key) ??
      ({
        assetId: tx.assetId,
        symbol: tx.symbol,
        name: tx.name,
        category: tx.category,
        quantity: 0,
        costBasis: 0,
        avgCost: 0,
        realizedPnl: 0,
      } satisfies Holding);

    const fee = tx.feeUsd || 0;

    switch (tx.type) {
      case 'buy':
      case 'reward':
      case 'airdrop':
        h.quantity += tx.quantity;
        h.costBasis += tx.quantity * tx.priceUsd + fee;
        break;
      case 'sell': {
        const sold = Math.min(tx.quantity, Math.max(h.quantity, 0));
        const avg = h.quantity > DUST ? h.costBasis / h.quantity : 0;
        const released = avg * sold;
        h.realizedPnl += sold * tx.priceUsd - fee - released;
        h.quantity -= sold;
        h.costBasis -= released;
        break;
      }
      case 'stake':
      case 'unstake':
        h.realizedPnl -= fee;
        break;
    }

    if (h.quantity < DUST) {
      h.quantity = 0;
      h.costBasis = 0;
    }
    h.avgCost = h.quantity > 0 ? h.costBasis / h.quantity : 0;
    map.set(key, h);
  }

  return Array.from(map.values());
}

export function quoteKey(category: string, assetId: string): string {
  return `${category}:${assetId}`;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  /** Holdings that have no live price yet (excluded from totalValue/totalCost). */
  unpricedCount: number;
}

export function summarize(
  holdings: Holding[],
  quotes: Record<string, Quote>,
): PortfolioSummary {
  let totalValue = 0;
  let totalCost = 0;
  let realizedPnl = 0;
  let unpricedCount = 0;

  for (const h of holdings) {
    realizedPnl += h.realizedPnl;
    if (h.quantity <= 0) continue;
    const q = quotes[quoteKey(h.category, h.assetId)];
    if (!q) {
      unpricedCount += 1;
      continue;
    }
    totalValue += h.quantity * q.price;
    totalCost += h.costBasis;
  }

  const unrealizedPnl = totalValue - totalCost;
  return {
    totalValue,
    totalCost,
    unrealizedPnl,
    unrealizedPnlPct: totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0,
    realizedPnl,
    unpricedCount,
  };
}

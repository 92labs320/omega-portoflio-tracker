import { usePortfolioStore } from '@/store/portfolioStore';
import { fetchCoinPrice } from '@/services/marketService';
import { useEffect } from 'react';

export function usePortfolio() {
  const { holdings, totalValue, totalCost, setCurrentPrices } = usePortfolioStore();

  useEffect(() => {
    if (holdings.length === 0) return;
    const ids = holdings.map((h) => h.assetId).join(',');
    fetchCoinPrice(ids).then((price) => {
      // For multi-asset, use fetchTopCoins instead; this is a simple single-coin example
    }).catch(() => {});
  }, [holdings.length]);

  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return { holdings, totalValue, totalCost, totalPnl, totalPnlPct, setCurrentPrices };
}

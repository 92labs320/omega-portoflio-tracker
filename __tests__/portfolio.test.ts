import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeHoldings, summarize } from '../lib/portfolio';
import type { Transaction } from '../lib/types';

let n = 0;
function tx(p: Partial<Transaction>): Transaction {
  n += 1;
  return {
    id: String(n),
    assetId: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'crypto',
    type: 'buy',
    quantity: 1,
    priceUsd: 100,
    feeUsd: 0,
    exchange: '',
    notes: '',
    executedAt: `2026-01-${String(n).padStart(2, '0')}T12:00:00.000Z`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    exchangeId: '',
    pair: '',
    quoteCurrency: 'USD',
    priceQuote: null,
    feeQuote: null,
    ...p,
  };
}

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('average cost with fees, partial sell, realized P&L', () => {
  n = 0;
  const h = computeHoldings([
    tx({ quantity: 2, priceUsd: 100, feeUsd: 10 }), // cost 210
    tx({ quantity: 2, priceUsd: 200 }), // cost 610, qty 4, avg 152.5
    tx({ type: 'sell', quantity: 1, priceUsd: 300, feeUsd: 5 }), // realized 300-5-152.5 = 142.5
  ]);
  assert.equal(h.length, 1);
  close(h[0].quantity, 3);
  close(h[0].costBasis, 457.5);
  close(h[0].avgCost, 152.5);
  close(h[0].realizedPnl, 142.5);

  const s = summarize(h, { 'crypto:bitcoin': { price: 200, change24h: 1 } });
  close(s.totalValue, 600);
  close(s.unrealizedPnl, 142.5);
  close(s.unrealizedPnlPct, (142.5 / 457.5) * 100);
});

test('transactions are applied in date order regardless of input order', () => {
  n = 0;
  const buy = tx({ quantity: 1, priceUsd: 100 });
  const sell = tx({ type: 'sell', quantity: 1, priceUsd: 150 });
  const h = computeHoldings([sell, buy]);
  close(h[0].quantity, 0);
  close(h[0].realizedPnl, 50);
});

test('overselling is capped, deleted rows ignored, stake does not change quantity', () => {
  n = 0;
  const h = computeHoldings([
    tx({ quantity: 1, priceUsd: 100 }),
    tx({ type: 'stake', quantity: 1, priceUsd: 0, feeUsd: 2 }),
    tx({ type: 'sell', quantity: 5, priceUsd: 120 }),
    tx({ quantity: 10, priceUsd: 1, deleted: true }),
  ]);
  close(h[0].quantity, 0);
  close(h[0].costBasis, 0);
  close(h[0].realizedPnl, 20 - 2);
});

test('rewards add quantity at declared value; unpriced holdings are excluded from totals', () => {
  n = 0;
  const h = computeHoldings([
    tx({ type: 'reward', quantity: 0.5, priceUsd: 0 }),
    tx({ assetId: 'AAPL', symbol: 'AAPL', category: 'stock', quantity: 10, priceUsd: 150 }),
  ]);
  const btc = h.find((x) => x.assetId === 'bitcoin')!;
  close(btc.quantity, 0.5);
  close(btc.costBasis, 0);
  const s = summarize(h, { 'crypto:bitcoin': { price: 100, change24h: null } });
  close(s.totalValue, 50);
  close(s.totalCost, 0);
  assert.equal(s.unpricedCount, 1);
});

test('same asset id in different categories stays separate', () => {
  n = 0;
  const h = computeHoldings([
    tx({ assetId: 'X', category: 'crypto' }),
    tx({ assetId: 'X', category: 'stock' }),
  ]);
  assert.equal(h.length, 2);
});

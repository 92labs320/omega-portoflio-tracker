import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildHistory, priceAt, qtyAt } from '../lib/history';
import type { Transaction } from '../lib/types';

const T0 = Date.UTC(2026, 0, 1);
const H = 3600_000;

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(),
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
    executedAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    deleted: false,
    exchangeId: '',
    pair: '',
    quoteCurrency: 'USD',
    priceQuote: null,
    feeQuote: null,
    ...p,
  };
}

test('priceAt and qtyAt', () => {
  const s = [
    { t: T0, v: 100 },
    { t: T0 + H, v: 110 },
    { t: T0 + 2 * H, v: 120 },
  ];
  assert.equal(priceAt(s, T0 - 1), 100);
  assert.equal(priceAt(s, T0 + 90 * 60_000), 110);
  assert.equal(priceAt(s, T0 + 5 * H), 120);
  const txs = [tx({}), tx({ type: 'sell', quantity: 0.4, executedAt: new Date(T0 + H).toISOString() })];
  assert.equal(qtyAt(txs, T0 - 1), 0);
  assert.equal(qtyAt(txs, T0 + 30 * 60_000), 1);
  assert.equal(qtyAt(txs, T0 + 2 * H), 0.6);
});

test('performance excludes deposits made during the period', () => {
  // Price goes 100 -> 200. Hold 1 from start, buy 1 more at 150 mid-way.
  const series = [
    { t: T0, v: 100 },
    { t: T0 + H, v: 150 },
    { t: T0 + 2 * H, v: 200 },
  ];
  const txs = [
    tx({ executedAt: new Date(T0 - H).toISOString() }),
    tx({ priceUsd: 150, executedAt: new Date(T0 + H).toISOString() }),
  ];
  const r = buildHistory([{ key: 'crypto:bitcoin', txs, series, livePrice: 200 }], T0, T0 + 2 * H, 3);
  assert.equal(r.points[0].v, 100);
  assert.equal(r.points[2].v, 400);
  // gain = 400 - 100 - 150 deposited = 150
  assert.equal(r.change, 150);
  assert.equal(Math.round((r.changePct ?? 0) * 100) / 100, 60);
  assert.equal(r.perAsset['crypto:bitcoin'].change, 150);
});

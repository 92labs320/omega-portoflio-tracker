import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanStockHits } from '../lib/finnhub.js';

test('cleanStockHits keeps US equities/ETFs, ranks exact symbol first, title-cases names', () => {
  const hits = cleanStockHits('aapl', [
    { symbol: 'AAPL.SW', description: 'APPLE INC', type: 'Common Stock' },
    { symbol: 'APLE', description: 'APPLE HOSPITALITY REIT INC', type: 'Common Stock' },
    { symbol: 'AAPL', description: 'APPLE INC', type: 'Common Stock' },
    { symbol: 'AAPL', description: 'APPLE INC', type: 'Common Stock' },
    { symbol: 'AAPL240119C', description: 'option', type: 'Option' },
    { symbol: 'AAPU', description: 'DIREXION DAILY AAPL BULL 2X', type: 'ETP' },
  ]);
  assert.equal(hits[0].symbol, 'AAPL');
  assert.equal(hits[0].name, 'Apple Inc');
  assert.equal(hits.filter((h) => h.symbol === 'AAPL').length, 1);
  assert.ok(!hits.some((h) => h.symbol.startsWith('AAPL24')));
  assert.equal(hits.find((h) => h.symbol === 'AAPU')?.type, 'ETF');
});

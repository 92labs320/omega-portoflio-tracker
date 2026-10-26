import { test } from 'node:test';
import assert from 'node:assert/strict';

import { floorTo, pick } from '../lib/exchanges.js';

test('floorTo and pick select the candle that contains ts', () => {
  const ts = Date.UTC(2026, 9, 20, 10, 0, 37);
  assert.equal(floorTo(ts, '1m'), Date.UTC(2026, 9, 20, 10, 0, 0));
  assert.equal(floorTo(ts, '1h'), Date.UTC(2026, 9, 20, 10, 0, 0));
  assert.equal(floorTo(ts, '1d'), Date.UTC(2026, 9, 20));
  const m = Date.UTC(2026, 9, 20, 10, 0, 0);
  const rows = [
    { t: m - 60_000, open: 1, close: 1 },
    { t: m, open: 2, close: 2.1 },
    { t: m + 60_000, open: 3, close: 3 },
  ];
  assert.equal(pick(rows, ts, '1m')?.open, 2);
  assert.equal(pick([{ t: m + 120_000, open: 9, close: 9 }], ts, '1m'), null);
  assert.equal(pick([{ t: m, open: 0, close: 0 }], ts, '1m'), null);
});

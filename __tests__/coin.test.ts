import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rangeWindow } from '../services/coinService';

test('chart ranges map to CoinGecko days', () => {
  assert.equal(rangeWindow('1D', 'line').days, 1);
  assert.equal(rangeWindow('1W', 'candle').days, 7);
  assert.equal(rangeWindow('1Y', 'line').days, 365);
  const ytdLine = rangeWindow('YTD', 'line');
  const ytdCandle = rangeWindow('YTD', 'candle');
  assert.ok(ytdLine.days >= 1 && ytdLine.days <= 365);
  assert.ok([1, 7, 14, 30, 90, 180, 365].includes(ytdCandle.days));
  assert.ok(ytdCandle.days >= ytdLine.days);
  assert.equal(new Date(ytdLine.from).getMonth(), 0);
  assert.equal(new Date(ytdLine.from).getDate(), 1);
});

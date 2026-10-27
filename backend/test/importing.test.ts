import { test } from 'node:test';
import assert from 'node:assert/strict';

import { candidatesFor, cleanSymbol, lookupDay, type ListCoin } from '../lib/importing.js';

const list: ListCoin[] = [
  { id: 'polkadot', symbol: 'dot', name: 'Polkadot' },
  { id: 'dot-finance', symbol: 'dot', name: 'Dot Finance' },
  { id: 'reef', symbol: 'reef', name: 'Reef' },
  { id: 'realio-network', symbol: 'rio', name: 'Realio' },
  { id: 'rio-defi', symbol: 'rio', name: 'RioDeFi' },
  { id: 'neon', symbol: 'neon', name: 'Neon EVM' },
  { id: 'neon-2', symbol: 'neon', name: 'Neon Token' },
];
const bySymbol = new Map<string, ListCoin[]>();
for (const c of list) bySymbol.set(c.symbol, [...(bySymbol.get(c.symbol) ?? []), c]);

test('cleanSymbol strips Delta disambiguation stars', () => {
  assert.equal(cleanSymbol('ALT******'), 'alt');
  assert.equal(cleanSymbol('DOT*'), 'dot');
});

test('candidatesFor matches symbol + name, falls back to tie-break lists', () => {
  assert.equal(candidatesFor(list, bySymbol, 'DOT*', 'Polkadot').match?.id, 'polkadot');
  assert.equal(candidatesFor(list, bySymbol, 'REEF', 'Reef.Finance').match?.id, 'reef');
  assert.equal(candidatesFor(list, bySymbol, 'RIO', 'Realio Network').match?.id, 'realio-network');
  const neon = candidatesFor(list, bySymbol, 'NEON*', 'Neon');
  assert.equal(neon.match, null);
  assert.equal(neon.tie.length, 2);
  assert.equal(candidatesFor(list, bySymbol, 'ZZZ', 'Nothing').match, null);
});

test('lookupDay uses the previous available day (weekends)', () => {
  const s = new Map([['2018-07-06', 0.76]]); // Friday
  assert.equal(lookupDay(s, Date.UTC(2018, 6, 8, 12)), 0.76); // Sunday
  assert.equal(lookupDay(s, Date.UTC(2018, 7, 8)), null);
});

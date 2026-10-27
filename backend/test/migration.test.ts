import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

import { ownerFromAuthHeader, sync, type Db } from '../lib/core.js';

test('ensureSchema upgrades an old type CHECK so transfer_in/out sync', async () => {
  const pg = new PGlite();
  // Simulate a database created before v3: inline (auto-named) CHECK without transfer types.
  const old = (await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')).replace(
    /CONSTRAINT transactions_type_check CHECK \(type IN \([^)]*\)\)/,
    "CHECK (type IN ('buy', 'sell', 'stake', 'unstake', 'reward', 'airdrop'))",
  );
  assert.notEqual(old.indexOf("'airdrop'))"), -1);
  await pg.exec(old);
  const db: Db = { query: async (text, params) => (await pg.query(text, params as unknown[])).rows as never[] };
  const owner = ownerFromAuthHeader(`Bearer ${randomBytes(32).toString('hex')}`);
  const base = {
    assetId: 'polkadot', symbol: 'DOT', name: 'Polkadot', category: 'crypto', quantity: 8, priceUsd: 0, feeUsd: 0,
    exchange: '', notes: '', executedAt: '2021-09-07T02:54:13.000Z', updatedAt: '2026-10-27T00:00:00.000Z', deleted: false,
  };
  const r = await sync(db, owner, {
    cursor: null,
    changes: [
      { ...base, id: randomUUID(), type: 'transfer_out' },
      { ...base, id: randomUUID(), type: 'transfer_in' },
    ],
  });
  assert.equal(r.rows.length, 2);
});

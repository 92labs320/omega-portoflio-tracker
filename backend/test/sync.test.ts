import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

import { deleteAll, HttpError, ownerFromAuthHeader, parseSymbols, sync, type Db } from '../lib/core.js';

let db: Db;

before(async () => {
  const pg = new PGlite();
  await pg.exec(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db = { query: async (text, params) => (await pg.query(text, params as unknown[])).rows as never[] };
});

const secret = () => randomBytes(32).toString('hex');
const owner = (s: string) => ownerFromAuthHeader(`Bearer ${s}`);

function change(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    assetId: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'crypto',
    type: 'buy',
    quantity: 0.5,
    priceUsd: 60000,
    feeUsd: 1.5,
    exchange: 'Kraken',
    notes: '',
    executedAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z',
    deleted: false,
    ...over,
  };
}

test('auth header must carry a 256-bit hex key', () => {
  assert.throws(() => ownerFromAuthHeader(undefined), HttpError);
  assert.throws(() => ownerFromAuthHeader('Bearer abc'), HttpError);
  const s = secret();
  assert.equal(owner(s), owner(s.toUpperCase()));
  assert.notEqual(owner(s), s);
});

test('push, pull with cursor, last-write-wins, isolation and delete', async () => {
  const a = owner(secret());
  const b = owner(secret());
  const c1 = change();
  const c2 = change({ assetId: 'AAPL', symbol: 'AAPL', name: 'Apple', category: 'stock', quantity: 10, priceUsd: 190 });

  const r1 = await sync(db, a, { cursor: null, changes: [c1, c2] });
  assert.equal(r1.rows.length, 2);
  assert.equal(r1.hasMore, false);
  assert.equal(r1.rows.find((r) => r.id === c1.id)?.quantity, 0.5);

  // Nothing new since cursor
  const r2 = await sync(db, a, { cursor: r1.cursor, changes: [] });
  assert.equal(r2.rows.length, 0);
  assert.equal(r2.cursor, r1.cursor);

  // Newer edit wins
  const edited = { ...c1, quantity: 0.75, updatedAt: '2026-03-02T12:00:00.000Z' };
  const r3 = await sync(db, a, { cursor: r1.cursor, changes: [edited] });
  assert.equal(r3.rows.length, 1);
  assert.equal(r3.rows[0].quantity, 0.75);

  // Older edit is ignored (and not re-sent)
  const stale = { ...c1, quantity: 99, updatedAt: '2026-03-01T13:00:00.000Z' };
  const r4 = await sync(db, a, { cursor: r3.cursor, changes: [stale] });
  assert.equal(r4.rows.length, 0);

  // Tombstone propagates
  const del = { ...c1, deleted: true, updatedAt: '2026-03-03T12:00:00.000Z' };
  const r5 = await sync(db, a, { cursor: r4.cursor, changes: [del] });
  assert.equal(r5.rows[0].deleted, true);

  // Another device sees nothing of A, even with the same transaction id
  const rb = await sync(db, b, { cursor: null, changes: [{ ...c2 }] });
  assert.equal(rb.rows.length, 1);
  assert.equal(rb.rows[0].id, c2.id);

  // Fresh install of A (cursor null) restores everything
  const restore = await sync(db, a, { cursor: null, changes: [] });
  assert.equal(restore.rows.length, 2);

  assert.equal(await deleteAll(db, a), 2);
  assert.equal((await sync(db, a, { cursor: null, changes: [] })).rows.length, 0);
  assert.equal((await sync(db, b, { cursor: null, changes: [] })).rows.length, 1);
});

test('rejects invalid payloads', async () => {
  const a = owner(secret());
  const bad = [
    { cursor: 'abc', changes: [] },
    { changes: 'x' },
    { changes: [change({ id: 'not-a-uuid' })] },
    { changes: [change({ category: 'forex' })] },
    { changes: [change({ quantity: -1 })] },
    { changes: [change({ priceUsd: Number.NaN })] },
    { changes: [change({ executedAt: 'yesterday' })] },
    { changes: [change({ updatedAt: '2099-01-01T00:00:00Z' })] },
    { changes: [change({ notes: 'x'.repeat(501) })] },
    { changes: Array.from({ length: 501 }, () => change()) },
  ];
  for (const body of bad) {
    await assert.rejects(sync(db, a, body), HttpError, JSON.stringify(body).slice(0, 80));
  }
});

test('pagination returns hasMore and resumes from cursor', async () => {
  const a = owner(secret());
  for (let i = 0; i < 3; i++) {
    await sync(db, a, { changes: Array.from({ length: 400 }, () => change()) });
  }
  const p1 = await sync(db, a, { cursor: null, changes: [] });
  assert.equal(p1.rows.length, 1000);
  assert.equal(p1.hasMore, true);
  const p2 = await sync(db, a, { cursor: p1.cursor, changes: [] });
  assert.equal(p2.rows.length, 200);
  assert.equal(p2.hasMore, false);
});

test('symbol parsing', () => {
  assert.deepEqual(parseSymbols('aapl, msft,AAPL'), ['AAPL', 'MSFT']);
  assert.deepEqual(parseSymbols('SHOP.TO'), ['SHOP.TO']);
  assert.throws(() => parseSymbols(''), HttpError);
  assert.throws(() => parseSymbols('AAPL;DROP'), HttpError);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDatabaseUrl } from '../lib/http.js';

const url = 'postgresql://neondb_owner:pw@ep-x-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

test('normalizes pasted DATABASE_URL variants', () => {
  assert.equal(normalizeDatabaseUrl(url), url);
  assert.equal(normalizeDatabaseUrl(`"${url}"`), url);
  assert.equal(normalizeDatabaseUrl(`  ${url}\n`), url);
  assert.equal(normalizeDatabaseUrl(`DATABASE_URL=${url}`), url);
  assert.equal(normalizeDatabaseUrl(`psql '${url}'`), url);
  assert.equal(normalizeDatabaseUrl('COLLE_ICI'), null);
  assert.equal(normalizeDatabaseUrl(undefined), null);
});

import { parseCoinIds } from '../lib/coingecko.js';
import { HttpError } from '../lib/core.js';

test('coin ids are validated, deduped and sorted', () => {
  assert.deepEqual(parseCoinIds('solana, bitcoin,Bitcoin'), ['bitcoin', 'solana']);
  assert.deepEqual(parseCoinIds('avalanche-2'), ['avalanche-2']);
  assert.deepEqual(parseCoinIds(undefined), []);
  assert.throws(() => parseCoinIds('bit coin'), HttpError);
  assert.throws(() => parseCoinIds('../x'), HttpError);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fromDateInput, parseDecimal, toDateInput } from '../lib/format';

test('parseDecimal accepts comma decimals and rejects junk', () => {
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal(' 0.25 '), 0.25);
  assert.equal(parseDecimal('.5'), 0.5);
  assert.ok(Number.isNaN(parseDecimal('abc')));
  assert.ok(Number.isNaN(parseDecimal('1.2.3')));
  assert.ok(Number.isNaN(parseDecimal('')));
});

test('date input round-trip and validation', () => {
  const iso = fromDateInput('2026-02-28');
  assert.ok(iso);
  assert.equal(toDateInput(iso!), '2026-02-28');
  assert.equal(fromDateInput('2026-02-30'), null);
  assert.equal(fromDateInput('28/02/2026'), null);
});

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

import { formatCompactNumber, formatCompactUsd } from '../lib/format';

test('compact formatting does not rely on Intl compact notation', () => {
  assert.equal(formatCompactUsd(2_742_475_833_190), '$2,74T');
  assert.equal(formatCompactUsd(117_924_356_577), '$117,9B');
  assert.equal(formatCompactUsd(812_400_000), '$812,4M');
  assert.equal(formatCompactUsd(950), '$950');
  assert.equal(formatCompactNumber(19_950_000), '19,95M');
  assert.equal(formatCompactUsd(null), '—');
});

import { setFx } from '../lib/currency';
import { formatNumber, formatPct, formatQty, formatSignedNumber, formatUsd } from '../lib/format';

test('Delta typography: space thousands, comma decimals, display currency', () => {
  const S = '\u00A0';
  setFx('USD', 1);
  assert.equal(formatNumber(87791.333, 2, 2), `87${S}791,33`);
  assert.equal(formatUsd(51379.2), `$51${S}379,20`);
  assert.equal(formatUsd(0.0458), '$0,0458');
  assert.equal(formatPct(-69.9876), '-69,99%');
  assert.equal(formatSignedNumber(-204755.4), `-204${S}755`);
  assert.equal(formatSignedNumber(-45188.42), `-45${S}188,42`);
  assert.equal(formatQty(4460), `4${S}460`);
  setFx('CAD', 1.4);
  assert.equal(formatUsd(100), 'C$140,00');
  setFx('USD', 1);
});

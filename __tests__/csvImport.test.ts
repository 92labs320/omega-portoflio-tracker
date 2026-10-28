import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeHoldings } from '../lib/portfolio';
import { parseCsv, parseImport, splitAsset, txFingerprint } from '../lib/csvImport';
import type { Transaction } from '../lib/types';

const HEADER =
  '"Date","Way","Base amount","Base currency (name)","Base type","Quote amount","Quote currency","Exchange","Sent/Received from","Sent to","Fee amount","Fee currency (name)","Broker","Notes","Sync Base Holding","Leverage Metadata"';

const SAMPLE = [
  HEADER,
  '"2018-07-26T15:23:50.000Z","BUY",9400,"VET (VeChain)","CRYPTO",0.02961,"BTC","Binance",,,,,,,false,',
  '"2021-01-02T02:16:36.000Z","DEPOSIT",13,"ADA (Cardano)","CRYPTO",,,,"DIVIDENDS","MY_WALLET",,,,,false,',
  '"2021-03-07T16:37:38.000Z","DEPOSIT",334,"REEF (Reef.Finance)","CRYPTO",,,,"AIRDROP","MY_WALLET",,,,,false,',
  '"2021-09-07T02:54:13.000Z","WITHDRAW",8,"DOT* (Polkadot)","CRYPTO",,,,"MY_WALLET","OTHER_WALLET",,,,,false,',
  '"2020-12-08T01:16:56.000Z","TRANSFER",5.62297,"ADA (Cardano)","CRYPTO",,,,"MY_WALLET","MY_WALLET",,,,,false,',
  '"2021-02-19T23:41:53.000Z","WITHDRAW",795.59,"USD (United States dollar)","FIAT",,,"DGA","MY_WALLET","OTHER",,,,"SYNC-BASE-HOLDINGS_BUY_REEF/USD",false,',
  '"2025-08-14T10:00:00.000Z","BUY",4184,"ETHX-B.TO (CI Galaxy Ethereum ETF)","FUND",93888.96,"CAD","Toronto Stock Exchange",,,,,,"note, with ""quotes""",false,',
].join('\r\n');

test('parseCsv handles quotes, escaped quotes and CRLF', () => {
  const rows = parseCsv('﻿a,"b, c","d ""e"""\r\n1,,3\n');
  assert.deepEqual(rows, [
    ['a', 'b, c', 'd "e"'],
    ['1', '', '3'],
  ]);
});

test('splitAsset separates ticker and name', () => {
  assert.deepEqual(splitAsset('DOT* (Polkadot)'), { symbol: 'DOT*', name: 'Polkadot' });
  assert.deepEqual(splitAsset('ETHX-B.TO (CI Galaxy Ethereum ETF)'), { symbol: 'ETHX-B.TO', name: 'CI Galaxy Ethereum ETF' });
});

test('parseImport maps Delta rows to transaction drafts', () => {
  const p = parseImport(SAMPLE);
  assert.equal(p.format, 'delta');
  assert.deepEqual(
    p.drafts.map((d) => d.type),
    ['buy', 'reward', 'airdrop', 'transfer_out', 'buy'],
  );
  assert.equal(p.skipped.length, 2); // own-wallet transfer + fiat
  const vet = p.drafts[0];
  assert.equal(vet.symbol, 'VET');
  assert.equal(vet.quoteAmount, 0.02961); // total, not unit price
  assert.equal(vet.quoteCurrency, 'BTC');
  assert.equal(vet.exchangeId, 'binance');
  const dot = p.drafts[3];
  assert.equal(dot.symbol, 'DOT');
  assert.equal(dot.rawSymbol, 'DOT*');
  const etf = p.drafts[4];
  assert.equal(etf.category, 'stock');
  assert.equal(etf.symbol, 'ETHX-B.TO');
  assert.match(etf.notes, /note, with "quotes"/);
});

test('parseImport rejects unknown formats', () => {
  assert.throws(() => parseImport('a,b,c\n1,2,3'), /Omega CSV format/);
});

test('transfer_out removes quantity at average cost without P&L', () => {
  const base = {
    assetId: 'polkadot', symbol: 'DOT', name: 'Polkadot', category: 'crypto' as const, feeUsd: 0, exchange: '', notes: '',
    updatedAt: '2026-01-01T00:00:00.000Z', deleted: false, exchangeId: '', pair: '', quoteCurrency: 'USD',
    priceQuote: null, feeQuote: null,
  };
  const txs: Transaction[] = [
    { ...base, id: '1', type: 'buy', quantity: 10, priceUsd: 5, executedAt: '2021-01-01T00:00:00.000Z' },
    { ...base, id: '2', type: 'transfer_out', quantity: 4, priceUsd: 0, executedAt: '2021-02-01T00:00:00.000Z' },
  ];
  const [h] = computeHoldings(txs);
  assert.equal(h.quantity, 6);
  assert.equal(h.costBasis, 30);
  assert.equal(h.realizedPnl, 0);
});

test('txFingerprint is stable across date formats', () => {
  const a = txFingerprint({ category: 'crypto', assetId: 'x', type: 'buy', quantity: 1.5, executedAt: '2021-01-01T00:00:00Z' });
  const b = txFingerprint({ category: 'crypto', assetId: 'x', type: 'buy', quantity: 1.5, executedAt: '2021-01-01T00:00:00.000Z' });
  assert.equal(a, b);
});

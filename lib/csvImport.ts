import type { AssetCategory, TransactionType } from './types';

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes (""), CRLF/LF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

export type ImportFormat = 'delta';

/** One CSV line turned into a transaction draft (prices still in the original currency). */
export interface DraftTx {
  line: number;
  executedAt: string;
  type: TransactionType;
  category: AssetCategory;
  /** Key grouping rows of the same asset (resolution happens once per asset). */
  assetKey: string;
  /** Ticker as written in the file, e.g. "DOT*" (Delta adds stars to tell same-ticker coins apart). */
  rawSymbol: string;
  symbol: string;
  name: string;
  quantity: number;
  /** Total paid/received in quoteCurrency (BUY/SELL), else 0. */
  quoteAmount: number;
  quoteCurrency: string;
  feeAmount: number;
  feeCurrency: string;
  exchange: string;
  exchangeId: string;
  notes: string;
}

export interface SkippedRow {
  line: number;
  reason: string;
}

export interface ParsedImport {
  format: ImportFormat;
  drafts: DraftTx[];
  skipped: SkippedRow[];
}

const DELTA_HEADERS = ['Date', 'Way', 'Base amount', 'Base currency (name)', 'Base type'];

export const EXCHANGE_IDS: Record<string, string> = {
  binance: 'binance',
  mexc: 'mxc',
  kucoin: 'kucoin',
  kraken: 'kraken',
  coinbase: 'gdax',
  'coinbase pro': 'gdax',
  bitget: 'bitget',
  okx: 'okex',
  gate: 'gate',
  'gate.io': 'gate',
};

/** "DOT* (Polkadot)" → { symbol: 'DOT*', name: 'Polkadot' } */
export function splitAsset(raw: string): { symbol: string; name: string } {
  const m = /^(.+?)\s*\((.*)\)\s*$/.exec(raw.trim());
  if (!m) return { symbol: raw.trim(), name: raw.trim() };
  return { symbol: m[1].trim(), name: m[2].trim() };
}

const num = (s: string | undefined) => {
  if (!s || !s.trim()) return NaN;
  return Number(s.trim().replace(/\s/g, ''));
};

export function detectFormat(header: string[]): ImportFormat | null {
  const h = header.map((x) => x.trim());
  return DELTA_HEADERS.every((k) => h.includes(k)) ? 'delta' : null;
}

/** Parses a Delta ("Main Portfolio") CSV export. */
export function parseImport(text: string): ParsedImport {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The file is empty.');
  const format = detectFormat(rows[0]);
  if (!format) {
    throw new Error('Unrecognized CSV format. Export your portfolio from Delta (Settings → Export) and try again.');
  }
  const col = new Map(rows[0].map((h, i) => [h.trim(), i]));
  const get = (r: string[], k: string) => r[col.get(k) ?? -1]?.trim() ?? '';

  const drafts: DraftTx[] = [];
  const skipped: SkippedRow[] = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const date = Date.parse(get(r, 'Date'));
    const way = get(r, 'Way').toUpperCase();
    const qty = num(get(r, 'Base amount'));
    const baseType = get(r, 'Base type').toUpperCase();
    const { symbol: rawSymbol, name } = splitAsset(get(r, 'Base currency (name)'));
    const from = get(r, 'Sent/Received from').toUpperCase();
    const to = get(r, 'Sent to').toUpperCase();

    if (!Number.isFinite(date)) return skipped.push({ line, reason: 'Invalid date' });
    if (!Number.isFinite(qty) || qty <= 0) return skipped.push({ line, reason: 'Invalid amount' });
    if (!rawSymbol) return skipped.push({ line, reason: 'Missing asset' });
    if (baseType === 'FIAT') return skipped.push({ line, reason: `Cash movement (${rawSymbol})` });
    if (get(r, 'Leverage Metadata')) return skipped.push({ line, reason: 'Leveraged position' });

    let type: TransactionType;
    if (way === 'BUY') type = 'buy';
    else if (way === 'SELL') type = 'sell';
    else if (way === 'DEPOSIT') type = from === 'DIVIDENDS' ? 'reward' : from === 'AIRDROP' ? 'airdrop' : 'transfer_in';
    else if (way === 'WITHDRAW') type = 'transfer_out';
    else if (way === 'TRANSFER') {
      if (from === to) return skipped.push({ line, reason: 'Transfer between your own wallets' });
      type = 'transfer_out';
    } else return skipped.push({ line, reason: `Unsupported type "${way}"` });

    const quoteAmount = num(get(r, 'Quote amount'));
    const quoteCurrency = get(r, 'Quote currency').toUpperCase();
    if ((type === 'buy' || type === 'sell') && (!Number.isFinite(quoteAmount) || quoteAmount < 0 || !quoteCurrency)) {
      return skipped.push({ line, reason: 'Trade without a price' });
    }

    const category: AssetCategory = baseType === 'CRYPTO' ? 'crypto' : 'stock';
    const symbol = category === 'crypto' ? rawSymbol.replace(/\*+$/, '').toUpperCase() : rawSymbol.toUpperCase();
    const exchange = get(r, 'Exchange');
    const feeAmount = num(get(r, 'Fee amount'));
    const feeCurrency = splitAsset(get(r, 'Fee currency (name)')).symbol.replace(/\*+$/, '').toUpperCase();
    const label =
      way === 'DEPOSIT' && type === 'transfer_in'
        ? 'Deposit'
        : way === 'WITHDRAW'
          ? 'Withdrawal'
          : '';

    drafts.push({
      line,
      executedAt: new Date(date).toISOString(),
      type,
      category,
      assetKey: `${category}|${rawSymbol}|${name}`,
      rawSymbol,
      symbol,
      name,
      quantity: qty,
      quoteAmount: type === 'buy' || type === 'sell' ? quoteAmount : 0,
      quoteCurrency: type === 'buy' || type === 'sell' ? quoteCurrency : 'USD',
      feeAmount: Number.isFinite(feeAmount) && feeAmount > 0 ? feeAmount : 0,
      feeCurrency: feeCurrency || quoteCurrency || 'USD',
      exchange,
      exchangeId: EXCHANGE_IDS[exchange.toLowerCase()] ?? '',
      notes: [get(r, 'Notes'), label, 'Imported from Delta'].filter(Boolean).join(' · ').slice(0, 500),
    });
  });

  return { format, drafts, skipped };
}

/** Fingerprint used to skip rows already imported (re-importing the same file is safe). */
export function txFingerprint(t: {
  category: string;
  assetId: string;
  type: string;
  quantity: number;
  executedAt: string;
}): string {
  return `${t.category}|${t.assetId}|${t.type}|${Number(t.quantity).toPrecision(10)}|${new Date(t.executedAt).toISOString()}`;
}

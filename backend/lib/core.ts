import { createHash } from 'node:crypto';

/** Minimal query interface so the logic runs on Neon in prod and on PGlite in tests. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SECRET_RE = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set(['crypto', 'stock']);
const TYPES = new Set(['buy', 'sell', 'stake', 'unstake', 'reward', 'airdrop', 'transfer_in', 'transfer_out']);

export const MAX_CHANGES = 500;
export const PAGE_SIZE = 1000;

/** Returns SHA-256(device secret). The raw secret is never stored. */
export function ownerFromAuthHeader(header: string | undefined | null): string {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  const secret = m?.[1]?.toLowerCase();
  if (!secret || !SECRET_RE.test(secret)) throw new HttpError(401, 'Missing or invalid device key');
  return createHash('sha256').update(secret).digest('hex');
}

export interface ClientTransaction {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'stock';
  type: string;
  quantity: number;
  priceUsd: number;
  feeUsd: number;
  exchange: string;
  notes: string;
  executedAt: string;
  updatedAt: string;
  deleted: boolean;
  /** Where/how it was traded (added in v2, optional for older clients). */
  exchangeId: string;
  pair: string;
  quoteCurrency: string;
  priceQuote: number | null;
  feeQuote: number | null;
}

/** Idempotent column additions for v2 (trading pair & quote currency). */
export const SCHEMA_V2 = [
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_id TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pair TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS quote_currency TEXT NOT NULL DEFAULT 'USD'",
  'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS price_quote DOUBLE PRECISION',
  'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_quote DOUBLE PRECISION',
];

/** v3: transfer_in / transfer_out transaction types (CSV imports of wallet moves). */
export const SCHEMA_V3 = [
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'transactions_type_check' AND pg_get_constraintdef(oid) LIKE '%transfer_out%'
    ) THEN
      ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
      ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
        CHECK (type IN ('buy', 'sell', 'stake', 'unstake', 'reward', 'airdrop', 'transfer_in', 'transfer_out'));
    END IF;
  END $$`,
];

let schemaReady: Promise<void> | null = null;
/** Runs the v2 column additions once per server instance (cheap no-op once applied). */
export function ensureSchema(db: Db): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of [...SCHEMA_V2, ...SCHEMA_V3]) await db.query(stmt);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

function optNum(v: unknown, field: string): number | null {
  if (v === undefined || v === null) return null;
  return num(v, field);
}

function str(v: unknown, field: string, max: number, required = true): string {
  if (v === undefined || v === null) {
    if (required) throw new HttpError(400, `${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be a string`);
  const s = v.trim();
  if (required && s.length === 0) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} is too long`);
  return s;
}

function num(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e15) {
    throw new HttpError(400, `${field} must be a non-negative number`);
  }
  return v;
}

function isoDate(v: unknown, field: string): string {
  const s = str(v, field, 40);
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new HttpError(400, `${field} must be an ISO date`);
  // Reject absurd clocks (more than 2 days in the future) so last-write-wins cannot be gamed.
  if (field === 'updatedAt' && t > Date.now() + 2 * 86400_000) throw new HttpError(400, 'updatedAt is in the future');
  return new Date(t).toISOString();
}

export function validateChange(raw: unknown): ClientTransaction {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Invalid change');
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 'id', 36);
  if (!UUID_RE.test(id)) throw new HttpError(400, 'id must be a UUID');
  const category = str(r.category, 'category', 10);
  if (!CATEGORIES.has(category)) throw new HttpError(400, 'Invalid category');
  const type = str(r.type, 'type', 20);
  if (!TYPES.has(type)) throw new HttpError(400, 'Invalid type');
  return {
    id: id.toLowerCase(),
    assetId: str(r.assetId, 'assetId', 120),
    symbol: str(r.symbol, 'symbol', 30),
    name: str(r.name, 'name', 120),
    category: category as 'crypto' | 'stock',
    type,
    quantity: num(r.quantity, 'quantity'),
    priceUsd: num(r.priceUsd, 'priceUsd'),
    feeUsd: r.feeUsd === undefined ? 0 : num(r.feeUsd, 'feeUsd'),
    exchange: str(r.exchange, 'exchange', 60, false),
    notes: str(r.notes, 'notes', 500, false),
    executedAt: isoDate(r.executedAt, 'executedAt'),
    updatedAt: isoDate(r.updatedAt, 'updatedAt'),
    deleted: r.deleted === true,
    exchangeId: str(r.exchangeId, 'exchangeId', 60, false),
    pair: str(r.pair, 'pair', 40, false),
    quoteCurrency: str(r.quoteCurrency, 'quoteCurrency', 15, false) || 'USD',
    priceQuote: optNum(r.priceQuote, 'priceQuote'),
    feeQuote: optNum(r.feeQuote, 'feeQuote'),
  };
}

interface Row {
  id: string;
  asset_id: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'stock';
  type: string;
  quantity: number;
  price_usd: number;
  fee_usd: number;
  exchange: string;
  notes: string;
  executed_at: string | Date;
  updated_at: string | Date;
  deleted: boolean;
  server_seq: string | number;
  exchange_id: string | null;
  pair: string | null;
  quote_currency: string | null;
  price_quote: number | null;
  fee_quote: number | null;
}

const toIso = (v: string | Date) => (v instanceof Date ? v : new Date(v)).toISOString();

function fromRow(r: Row): ClientTransaction {
  return {
    id: r.id,
    assetId: r.asset_id,
    symbol: r.symbol,
    name: r.name,
    category: r.category,
    type: r.type,
    quantity: Number(r.quantity),
    priceUsd: Number(r.price_usd),
    feeUsd: Number(r.fee_usd),
    exchange: r.exchange,
    notes: r.notes,
    executedAt: toIso(r.executed_at),
    updatedAt: toIso(r.updated_at),
    deleted: r.deleted,
    exchangeId: r.exchange_id ?? '',
    pair: r.pair ?? '',
    quoteCurrency: r.quote_currency ?? 'USD',
    priceQuote: r.price_quote === null || r.price_quote === undefined ? null : Number(r.price_quote),
    feeQuote: r.fee_quote === null || r.fee_quote === undefined ? null : Number(r.fee_quote),
  };
}

export interface SyncResult {
  cursor: string;
  hasMore: boolean;
  rows: ClientTransaction[];
}

/**
 * Upserts the client's changes (last-write-wins on updated_at) and returns every row
 * changed on the server after `cursor`.
 */
export async function sync(db: Db, owner: string, body: unknown): Promise<SyncResult> {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid body');
  const b = body as { cursor?: unknown; changes?: unknown };

  let cursor = 0;
  if (b.cursor !== undefined && b.cursor !== null) {
    if (typeof b.cursor !== 'string' || !/^\d{1,18}$/.test(b.cursor)) throw new HttpError(400, 'Invalid cursor');
    cursor = Number(b.cursor);
  }
  const rawChanges = b.changes ?? [];
  if (!Array.isArray(rawChanges)) throw new HttpError(400, 'changes must be an array');
  if (rawChanges.length > MAX_CHANGES) throw new HttpError(413, `At most ${MAX_CHANGES} changes per request`);
  const changes = rawChanges.map(validateChange);
  await ensureSchema(db);

  if (changes.length > 0) {
    const payload = changes.map((c) => ({
      id: c.id,
      asset_id: c.assetId,
      symbol: c.symbol,
      name: c.name,
      category: c.category,
      type: c.type,
      quantity: c.quantity,
      price_usd: c.priceUsd,
      fee_usd: c.feeUsd,
      exchange: c.exchange,
      notes: c.notes,
      executed_at: c.executedAt,
      updated_at: c.updatedAt,
      deleted: c.deleted,
      exchange_id: c.exchangeId,
      pair: c.pair,
      quote_currency: c.quoteCurrency,
      price_quote: c.priceQuote,
      fee_quote: c.feeQuote,
    }));
    await db.query(
      `INSERT INTO transactions
         (owner_hash, id, asset_id, symbol, name, category, type, quantity, price_usd, fee_usd,
          exchange, notes, executed_at, updated_at, deleted,
          exchange_id, pair, quote_currency, price_quote, fee_quote)
       SELECT $1, r.id, r.asset_id, r.symbol, r.name, r.category, r.type, r.quantity, r.price_usd,
              r.fee_usd, r.exchange, r.notes, r.executed_at, r.updated_at, r.deleted,
              r.exchange_id, r.pair, r.quote_currency, r.price_quote, r.fee_quote
       FROM jsonb_to_recordset($2::jsonb) AS r(
         id uuid, asset_id text, symbol text, name text, category text, type text,
         quantity double precision, price_usd double precision, fee_usd double precision,
         exchange text, notes text, executed_at timestamptz, updated_at timestamptz, deleted boolean,
         exchange_id text, pair text, quote_currency text, price_quote double precision,
         fee_quote double precision)
       ON CONFLICT (owner_hash, id) DO UPDATE SET
         asset_id = EXCLUDED.asset_id, symbol = EXCLUDED.symbol, name = EXCLUDED.name,
         category = EXCLUDED.category, type = EXCLUDED.type, quantity = EXCLUDED.quantity,
         price_usd = EXCLUDED.price_usd, fee_usd = EXCLUDED.fee_usd, exchange = EXCLUDED.exchange,
         notes = EXCLUDED.notes, executed_at = EXCLUDED.executed_at, updated_at = EXCLUDED.updated_at,
         deleted = EXCLUDED.deleted, exchange_id = EXCLUDED.exchange_id, pair = EXCLUDED.pair,
         quote_currency = EXCLUDED.quote_currency, price_quote = EXCLUDED.price_quote,
         fee_quote = EXCLUDED.fee_quote, server_seq = nextval('tx_seq'), received_at = now()
       WHERE transactions.updated_at < EXCLUDED.updated_at`,
      [owner, JSON.stringify(payload)],
    );
  }

  const rows = await db.query<Row>(
    `SELECT id, asset_id, symbol, name, category, type, quantity, price_usd, fee_usd, exchange, notes,
            executed_at, updated_at, deleted, server_seq,
            exchange_id, pair, quote_currency, price_quote, fee_quote
       FROM transactions
      WHERE owner_hash = $1 AND server_seq > $2
      ORDER BY server_seq ASC
      LIMIT ${PAGE_SIZE + 1}`,
    [owner, cursor],
  );
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = page.length ? String(page[page.length - 1].server_seq) : String(cursor);
  return { cursor: nextCursor, hasMore, rows: page.map(fromRow) };
}

export async function deleteAll(db: Db, owner: string): Promise<number> {
  const rows = await db.query<{ n: number }>(
    'WITH d AS (DELETE FROM transactions WHERE owner_hash = $1 RETURNING 1) SELECT count(*)::int AS n FROM d',
    [owner],
  );
  return rows[0]?.n ?? 0;
}

export function parseSymbols(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) throw new HttpError(400, 'symbols is required');
  const list = Array.from(new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)));
  if (list.length > 25) throw new HttpError(400, 'At most 25 symbols');
  for (const s of list) {
    if (!/^[A-Z0-9.\-]{1,12}$/.test(s)) throw new HttpError(400, `Invalid symbol: ${s}`);
  }
  return list;
}

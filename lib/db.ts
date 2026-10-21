import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import type {
  AssetCategory,
  Transaction,
  TransactionInput,
  TransactionType,
} from './types';

/**
 * Local database: the single source of truth on the device.
 * The app works fully offline; Neon is only a backup/sync target (see lib/sync.ts).
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_VERSION = 1;

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id           TEXT PRIMARY KEY NOT NULL,
        asset_id     TEXT NOT NULL,
        symbol       TEXT NOT NULL,
        name         TEXT NOT NULL,
        category     TEXT NOT NULL,
        type         TEXT NOT NULL,
        quantity     REAL NOT NULL,
        price_usd    REAL NOT NULL,
        fee_usd      REAL NOT NULL DEFAULT 0,
        exchange     TEXT NOT NULL DEFAULT '',
        notes        TEXT NOT NULL DEFAULT '',
        executed_at  TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted      INTEGER NOT NULL DEFAULT 0,
        dirty        INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_tx_asset ON transactions (category, asset_id);
      CREATE INDEX IF NOT EXISTS idx_tx_dirty ON transactions (dirty);
      CREATE TABLE IF NOT EXISTS kv (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  if (current < SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('omega.db');
      await migrate(db);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

interface TxRow {
  id: string;
  asset_id: string;
  symbol: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  price_usd: number;
  fee_usd: number;
  exchange: string;
  notes: string;
  executed_at: string;
  updated_at: string;
  deleted: number;
  dirty: number;
}

function fromRow(r: TxRow): Transaction {
  return {
    id: r.id,
    assetId: r.asset_id,
    symbol: r.symbol,
    name: r.name,
    category: r.category as AssetCategory,
    type: r.type as TransactionType,
    quantity: r.quantity,
    priceUsd: r.price_usd,
    feeUsd: r.fee_usd,
    exchange: r.exchange,
    notes: r.notes,
    executedAt: r.executed_at,
    updatedAt: r.updated_at,
    deleted: r.deleted === 1,
  };
}

async function upsert(tx: Transaction, dirty: boolean) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO transactions
      (id, asset_id, symbol, name, category, type, quantity, price_usd, fee_usd,
       exchange, notes, executed_at, updated_at, deleted, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       asset_id = excluded.asset_id, symbol = excluded.symbol, name = excluded.name,
       category = excluded.category, type = excluded.type, quantity = excluded.quantity,
       price_usd = excluded.price_usd, fee_usd = excluded.fee_usd,
       exchange = excluded.exchange, notes = excluded.notes,
       executed_at = excluded.executed_at, updated_at = excluded.updated_at,
       deleted = excluded.deleted, dirty = excluded.dirty`,
    [
      tx.id,
      tx.assetId,
      tx.symbol,
      tx.name,
      tx.category,
      tx.type,
      tx.quantity,
      tx.priceUsd,
      tx.feeUsd,
      tx.exchange,
      tx.notes,
      tx.executedAt,
      tx.updatedAt,
      tx.deleted ? 1 : 0,
      dirty ? 1 : 0,
    ],
  );
}

export async function listTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TxRow>(
    'SELECT * FROM transactions WHERE deleted = 0 ORDER BY executed_at DESC, updated_at DESC',
  );
  return rows.map(fromRow);
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const tx: Transaction = {
    ...input,
    id: Crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
  await upsert(tx, true);
  return tx;
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  const tx: Transaction = {
    ...input,
    id,
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
  await upsert(tx, true);
  return tx;
}

/** Soft delete (tombstone) so the deletion can be synced to the cloud. */
export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE transactions SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), id],
  );
}

export async function getDirtyTransactions(limit = 500): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TxRow>(
    'SELECT * FROM transactions WHERE dirty = 1 ORDER BY updated_at ASC LIMIT ?',
    [limit],
  );
  return rows.map(fromRow);
}

/** Marks rows as synced, unless they were modified again during the request. */
export async function markClean(items: { id: string; updatedAt: string }[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const it of items) {
      await db.runAsync(
        'UPDATE transactions SET dirty = 0 WHERE id = ? AND updated_at = ?',
        [it.id, it.updatedAt],
      );
    }
  });
}

/** Applies rows coming from the server (last-write-wins on updated_at). */
export async function applyRemote(rows: Transaction[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = await getDb();
  let applied = 0;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; dirty: number }>(
        'SELECT updated_at, dirty FROM transactions WHERE id = ?',
        [r.id],
      );
      if (local && local.updated_at >= r.updatedAt) continue;
      await upsert(r, false);
      applied += 1;
    }
  });
  return applied;
}

/** Removes every local transaction and sync state. */
export async function wipeLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync("DELETE FROM transactions; DELETE FROM kv WHERE key LIKE 'sync.%';");
}

export async function getKv(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setKv(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function removeKv(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM kv WHERE key = ?', [key]);
}

/** Flags every row (including tombstones) for upload, e.g. when cloud backup is turned on. */
export async function markAllDirty(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE transactions SET dirty = 1');
}

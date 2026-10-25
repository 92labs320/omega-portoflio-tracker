import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

import { HttpError, type Db } from './core.js';

let db: Db | null = null;

/**
 * Accepts the value however it was pasted in Vercel: with surrounding quotes,
 * as `DATABASE_URL=...`, or as the `psql '...'` snippet from the Neon console.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = /(postgres(?:ql)?:\/\/[^\s'"]+)/.exec(raw.trim());
  return m ? m[1] : null;
}

export function getDb(): Db {
  if (db) return db;
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!url) throw new HttpError(503, 'DATABASE_URL is missing or is not a postgresql:// URL');
  const sql = neon(url);
  db = {
    query: async <T>(text: string, params?: unknown[]) =>
      (await sql.query(text, params ?? [])) as unknown as T[],
  };
  return db;
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

/** Wraps a handler: method check, JSON errors, no caching of private data. */
export function route(methods: string[], handler: Handler): Handler {
  return async (req, res) => {
    if (!req.method || !methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      await handler(req, res);
    } catch (e) {
      if (e instanceof HttpError) {
        res.status(e.status).json({ error: e.message });
        return;
      }
      console.error('[omega-api]', req.method, req.url, e);
      res.status(500).json({ error: 'Internal error', code: errorCode(e) });
    }
  };
}

/** Non-sensitive hint for debugging (never includes the connection string). */
function errorCode(e: unknown): string {
  if (!e || typeof e !== 'object') return 'unknown';
  const err = e as { code?: unknown; name?: unknown; message?: unknown };
  if (typeof err.code === 'string' && err.code) return err.code;
  const msg = typeof err.message === 'string' ? err.message : '';
  if (/password authentication failed/i.test(msg)) return 'auth_failed';
  if (/does not exist/i.test(msg)) return 'not_found';
  if (/not a valid URL/i.test(msg)) return 'invalid_url';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(msg)) return 'network';
  return typeof err.name === 'string' ? err.name : 'unknown';
}

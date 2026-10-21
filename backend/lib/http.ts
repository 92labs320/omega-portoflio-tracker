import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

import { HttpError, type Db } from './core.js';

let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new HttpError(503, 'Database is not configured');
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
      console.error(e);
      res.status(500).json({ error: 'Internal error' });
    }
  };
}

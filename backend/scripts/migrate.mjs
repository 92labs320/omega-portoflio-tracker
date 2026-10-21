// Applies db/schema.sql to the Neon database in DATABASE_URL.
// Usage (PowerShell):  $env:DATABASE_URL="postgresql://..."; npm run migrate
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const sql = neon(url);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter(Boolean);
for (const stmt of statements) {
  await sql.query(stmt);
}
const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM transactions');
console.log(`Schema applied. transactions table ready (${count} rows).`);

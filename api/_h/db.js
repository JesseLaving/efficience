/* Shared Postgres access + session helpers.

   The database is a standard Postgres (Nile), so we use node-postgres (`pg`)
   with the standard POSTGRES_URL connection string — NOT @vercel/postgres,
   which speaks Neon's HTTP protocol that Nile does not implement.

   Sessions are stateless signed cookies: base64url(JSON) + "." + HMAC-SHA256.
   Signing with GOOGLE_OAUTH_CLIENT_SECRET (already in the server env) prevents
   a client from forging another user's id to read their space data. */
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

let pool = null;
function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.NILEDB_POSTGRES_URL || process.env.NILEDB_URL;
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

let schemaReady = null;
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const p = getPool();
      await p.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id SERIAL PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255),
          name VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`);
      await p.query(`
        CREATE TABLE IF NOT EXISTS app_spaces (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`);
      await p.query(`
        CREATE TABLE IF NOT EXISTS app_space_data (
          space_id INTEGER PRIMARY KEY REFERENCES app_spaces(id) ON DELETE CASCADE,
          data JSONB NOT NULL DEFAULT '{}',
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`);
      await p.query(`
        CREATE TABLE IF NOT EXISTS app_ai_usage (
          user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          day DATE NOT NULL DEFAULT CURRENT_DATE,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, day)
        )`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

export async function query(text, params) {
  await ensureSchema();
  return getPool().query(text, params);
}

/* Atomically increments today's AI call count for a user and reports whether
   they're still under the daily quota. Fails OPEN (quota "ok") on any DB
   error — a Postgres hiccup should never block legitimate AI usage. */
export async function checkAiQuota(userId, limit = parseInt(process.env.AI_DAILY_QUOTA || '', 10) || 60) {
  try {
    const { rows } = await query(
      `INSERT INTO app_ai_usage (user_id, day, count) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET count = app_ai_usage.count + 1
       RETURNING count`,
      [userId]
    );
    const count = rows[0]?.count ?? 1;
    return { ok: count <= limit, count, limit };
  } catch {
    return { ok: true, count: 0, limit };
  }
}

/* Run schema creation without the ensureSchema guard re-entry (used by query). */
export async function queryRaw(text, params) {
  return getPool().query(text, params);
}

// ---- session signing ----
function secret() {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.CRON_SECRET || 'efficience-dev-secret';
}
function sign(payloadB64) {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('hex');
}
export function makeSession(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function readSession(cookieHeader) {
  if (!cookieHeader) return null;
  const c = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('session='));
  if (!c) return null;
  const token = c.slice('session='.length);
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
}

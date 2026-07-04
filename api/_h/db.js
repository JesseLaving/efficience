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
      await p.query(`
        CREATE TABLE IF NOT EXISTS app_email_usage (
          user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          day DATE NOT NULL DEFAULT CURRENT_DATE,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, day)
        )`);
      // Un e-mail désabonné l'est pour un espace donné (une entreprise) —
      // pas pour tout le compte Google de l'utilisateur, qui peut gérer
      // plusieurs espaces/clients avec des bases de contacts distinctes.
      await p.query(`
        CREATE TABLE IF NOT EXISTS app_email_unsubscribes (
          space_id INTEGER NOT NULL REFERENCES app_spaces(id) ON DELETE CASCADE,
          email VARCHAR(320) NOT NULL,
          unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (space_id, email)
        )`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

export async function query(text, params) {
  await ensureSchema();
  return getPool().query(text, params);
}

/* Atomically increments today's usage count for a user in the given table
   and reports whether they're still under the daily quota. Fails OPEN
   (quota "ok") on any DB error — a Postgres hiccup should never block
   legitimate use. `table` is never user input (always a literal from the
   call site below), so string-building the query is safe here. */
async function incrementDailyUsage(table, userId, limit) {
  try {
    const { rows } = await query(
      `INSERT INTO ${table} (user_id, day, count) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET count = ${table}.count + 1
       RETURNING count`,
      [userId]
    );
    const count = rows[0]?.count ?? 1;
    return { ok: count <= limit, count, limit };
  } catch {
    return { ok: true, count: 0, limit };
  }
}

export async function checkAiQuota(userId, limit = parseInt(process.env.AI_DAILY_QUOTA || '', 10) || 60) {
  return incrementDailyUsage('app_ai_usage', userId, limit);
}

/* Campaign sending shares the same daily-cap protection as AI usage: it
   guards Jesse's Resend account/reputation from runaway or abusive use,
   not real customer volume — the default is deliberately generous.
   Unlike the single-unit AI quota, a campaign's `recipientCount` can be in
   the hundreds, so this checks BEFORE committing rather than incrementing
   then checking — a campaign that would blow the cap gets rejected without
   burning quota it never actually used (a small check-then-write race is
   an acceptable trade-off for a single-operator tool, not a payments path). */
export async function checkEmailQuota(userId, recipientCount, limit = parseInt(process.env.EMAIL_DAILY_QUOTA || '', 10) || 500) {
  try {
    const { rows: cur } = await query(`SELECT count FROM app_email_usage WHERE user_id = $1 AND day = CURRENT_DATE`, [userId]);
    const before = cur[0]?.count || 0;
    if (before + recipientCount > limit) return { ok: false, count: before, limit };
    const { rows } = await query(
      `INSERT INTO app_email_usage (user_id, day, count) VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (user_id, day) DO UPDATE SET count = app_email_usage.count + $2
       RETURNING count`,
      [userId, recipientCount]
    );
    return { ok: true, count: rows[0]?.count ?? recipientCount, limit };
  } catch {
    return { ok: true, count: 0, limit };
  }
}

/* ---- unsubscribe list (per space — see app_email_unsubscribes above) ---- */
export async function isUnsubscribed(spaceId, email) {
  try {
    const { rows } = await query(
      `SELECT 1 FROM app_email_unsubscribes WHERE space_id = $1 AND email = $2`,
      [spaceId, (email || '').toLowerCase()]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
/* One round-trip for a whole campaign's recipient list instead of one query
   per contact. Fails OPEN (empty set) on error — same rationale as the
   quota helpers: a DB hiccup should degrade, not silently block sending
   (the per-recipient check in filterUnsubscribed still runs at send time). */
export async function getUnsubscribedSet(spaceId, emails) {
  try {
    const lower = [...new Set(emails.map((e) => (e || '').toLowerCase()).filter(Boolean))];
    if (!lower.length) return new Set();
    const { rows } = await query(
      `SELECT email FROM app_email_unsubscribes WHERE space_id = $1 AND email = ANY($2)`,
      [spaceId, lower]
    );
    return new Set(rows.map((r) => r.email));
  } catch {
    return new Set();
  }
}
export async function addUnsubscribe(spaceId, email) {
  await query(
    `INSERT INTO app_email_unsubscribes (space_id, email) VALUES ($1, $2)
     ON CONFLICT (space_id, email) DO NOTHING`,
    [spaceId, (email || '').toLowerCase()]
  );
}

/* ---- unsubscribe link signing (HMAC, same secret as sessions) ----
   No login required to unsubscribe — the recipient isn't an Efficience
   user — so the link itself must be unguessable and tamper-proof instead. */
export function makeUnsubToken(spaceId, email) {
  return sign(`${spaceId}:${(email || '').toLowerCase()}`);
}
export function verifyUnsubToken(spaceId, email, token) {
  if (!token) return false;
  const expected = makeUnsubToken(spaceId, email);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
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

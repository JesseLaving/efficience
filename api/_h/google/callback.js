/* Google OAuth — step 2: exchange the code for tokens (server-side, with the
   client secret) and bounce back to the app with the access + refresh tokens in
   the URL hash (fragments are not sent to servers). Tokens live in the user's
   browser only — no shared server store.

   Four flows share this callback (redirect URI computed per-request from
   the Host header, so it matches whichever domain the app is served on —
   each such domain must be registered in Google Cloud Console):
   - Business Profile connect (default): bounce tokens to the URL hash.
   - Identity login (state.kind === 'auth'): upsert the user, set a signed
     session cookie, and redirect to the app.
   - Contacts import (state.kind === 'contacts'): bounce the access token as
     gc_token (one-shot, no refresh — the client fetches People API once).
   - YouTube connect (state.kind === 'youtube'): bounce tokens as
     yt_token/yt_refresh (persistent, like Business Profile). */
import { query, makeSession } from '../db.js';

/* L'URI de redirection doit correspondre au domaine réellement visité (l'app
   est accessible sur plusieurs domaines : efficience.vercel.app et
   app.efficienceconsulting.com) — sinon le cookie de session atterrit sur le
   mauvais domaine. Chaque domaine utilisé doit être enregistré comme URI de
   redirection autorisée dans Google Cloud Console. */
function redirectUri(req) { return `https://${req.headers.host}/api/google/callback`; }

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}
function bounce(res, ret, params) {
  const hash = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const sep = ret.includes('#') ? '&' : '#';
  res.statusCode = 302;
  res.setHeader('Location', `${ret}${sep}${hash}`);
  res.end();
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

async function authCallback(res, ret, code, redirect_uri) {
  try {
    const body = new URLSearchParams({
      code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri, grant_type: 'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.error || !d.access_token) return redirect(res, `${ret}#auth_error=${encodeURIComponent(d.error_description || d.error || 'token')}`);

    const ir = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${d.access_token}` } });
    const info = await ir.json();
    if (!info.id) return redirect(res, `${ret}#auth_error=userinfo`);

    const up = await query(
      `INSERT INTO app_users (google_id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
       RETURNING id, email, name`,
      [info.id, info.email || null, info.name || null]
    );
    const user = up.rows[0];

    const token = makeSession({ userId: user.id, email: user.email, name: user.name });
    res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    return redirect(res, ret);
  } catch (e) {
    return redirect(res, `${ret}#auth_error=${encodeURIComponent(String(e && e.message || e))}`);
  }
}

async function contactsCallback(res, ret, code, redirect_uri) {
  try {
    const body = new URLSearchParams({
      code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri, grant_type: 'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.error || !d.access_token) return bounce(res, ret, { gc_error: d.error_description || d.error || 'token' });
    return bounce(res, ret, { gc_token: d.access_token });
  } catch (e) {
    return bounce(res, ret, { gc_error: String(e && e.message || e) });
  }
}

async function youtubeCallback(res, ret, code, redirect_uri) {
  try {
    const body = new URLSearchParams({
      code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri, grant_type: 'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.error || !d.access_token) return bounce(res, ret, { yt_error: d.error_description || d.error || 'token' });
    const out = { yt_token: d.access_token };
    if (d.refresh_token) out.yt_refresh = d.refresh_token;
    return bounce(res, ret, out);
  } catch (e) {
    return bounce(res, ret, { yt_error: String(e && e.message || e) });
  }
}

export default async function handler(req, res) {
  const redirect_uri = redirectUri(req);
  let ret = `https://${req.headers.host}/`;
  let kind = null;
  try { const s = JSON.parse(Buffer.from(getParam(req, 'state') || '', 'base64url').toString()); if (s.ret) ret = s.ret; if (s.kind) kind = s.kind; } catch { /* ignore */ }

  const error = getParam(req, 'error');
  const code = getParam(req, 'code');
  if (error || !code) {
    if (kind === 'contacts') return bounce(res, ret, { gc_error: error || 'Autorisation annulée' });
    if (kind === 'youtube') return bounce(res, ret, { yt_error: error || 'Autorisation annulée' });
    return bounce(res, ret, { google_error: error || 'Autorisation annulée' });
  }

  if (kind === 'auth') return authCallback(res, ret, code, redirect_uri);
  if (kind === 'contacts') return contactsCallback(res, ret, code, redirect_uri);
  if (kind === 'youtube') return youtubeCallback(res, ret, code, redirect_uri);

  try {
    const body = new URLSearchParams({
      code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri, grant_type: 'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.error) return bounce(res, ret, { google_error: d.error_description || d.error });
    const out = { google_token: d.access_token };
    if (d.refresh_token) out.google_refresh = d.refresh_token;
    return bounce(res, ret, out);
  } catch (e) {
    return bounce(res, ret, { google_error: String(e && e.message || e) });
  }
}

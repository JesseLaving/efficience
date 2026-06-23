/* Google OAuth — step 2: exchange the code for tokens (server-side, with the
   client secret) and bounce back to the app with the access + refresh tokens in
   the URL hash (fragments are not sent to servers). Tokens live in the user's
   browser only — no shared server store. */
const REDIRECT = 'https://efficience.vercel.app/api/google/callback';

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

export default async function handler(req, res) {
  let ret = 'https://efficience.vercel.app/';
  try { const s = JSON.parse(Buffer.from(getParam(req, 'state') || '', 'base64url').toString()); if (s.ret) ret = s.ret; } catch { /* ignore */ }

  const error = getParam(req, 'error');
  const code = getParam(req, 'code');
  if (error || !code) return bounce(res, ret, { google_error: error || 'Autorisation annulée' });

  try {
    const body = new URLSearchParams({
      code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: REDIRECT, grant_type: 'authorization_code',
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

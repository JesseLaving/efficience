/* TikTok OAuth — step 2: exchange the code for tokens (server-side, with the
   client secret) and bounce back to the app with the access + refresh tokens
   in the URL hash (fragments are not sent to servers). Tokens live in the
   user's browser only — no shared server store. */

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
  const redirect_uri = `https://${req.headers.host}/api/tiktok/callback`;
  let ret = `https://${req.headers.host}/`;
  try { const s = JSON.parse(Buffer.from(getParam(req, 'state') || '', 'base64url').toString()); if (s.ret) ret = s.ret; } catch { /* ignore */ }

  const error = getParam(req, 'error');
  const code = getParam(req, 'code');
  if (error || !code) return bounce(res, ret, { tt_error: getParam(req, 'error_description') || error || 'Autorisation annulée' });

  try {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code, grant_type: 'authorization_code', redirect_uri,
    });
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body,
    });
    const d = await r.json();
    if (d.error) return bounce(res, ret, { tt_error: d.error_description || d.error });
    if (!d.access_token) return bounce(res, ret, { tt_error: 'Réponse TikTok invalide (pas de token).' });
    const out = { tt_token: d.access_token, tt_openid: d.open_id || '' };
    if (d.refresh_token) out.tt_refresh = d.refresh_token;
    return bounce(res, ret, out);
  } catch (e) {
    return bounce(res, ret, { tt_error: String(e && e.message || e) });
  }
}

/* LinkedIn OAuth — step 2: exchange the code for an access token (server-side,
   with the client secret) and bounce back to the app with the token in the URL
   hash. Token lives in the user's browser only — no shared server store. */
const REDIRECT = 'https://efficience.vercel.app/api/linkedin/callback';

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

  const error = getParam(req, 'error_description') || getParam(req, 'error');
  const code = getParam(req, 'code');
  if (error || !code) return bounce(res, ret, { li_error: error || 'Autorisation annulée' });

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
      client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    });
    const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.error) return bounce(res, ret, { li_error: d.error_description || d.error });
    return bounce(res, ret, { li_token: d.access_token });
  } catch (e) {
    return bounce(res, ret, { li_error: String(e && e.message || e) });
  }
}

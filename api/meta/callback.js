/* Meta OAuth — step 2: exchange the code for a long-lived token (server-side,
   using the App Secret) and bounce back to the app with the token in the URL
   hash (fragments are not sent to servers). The token lives in the user's
   browser only — there is no shared server-side store, so no other visitor
   can read this account. */
const REDIRECT = 'https://efficience.vercel.app/api/meta/callback';

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
  if (error || !code) return bounce(res, ret, { meta_error: error || 'Autorisation annulée' });

  const appId = process.env.META_APP_ID, secret = process.env.META_APP_SECRET;
  try {
    const r1 = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${secret}&code=${encodeURIComponent(code)}`);
    const d1 = await r1.json();
    if (d1.error) return bounce(res, ret, { meta_error: d1.error.message });
    // upgrade to a long-lived token (~60 days)
    const r2 = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${secret}&fb_exchange_token=${d1.access_token}`);
    const d2 = await r2.json();
    return bounce(res, ret, { meta_token: d2.access_token || d1.access_token });
  } catch (e) {
    return bounce(res, ret, { meta_error: String(e && e.message || e) });
  }
}

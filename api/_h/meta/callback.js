/* Meta OAuth — step 2: exchange the code for a long-lived token (server-side,
   using the App Secret) and bounce back to the app with the token in the URL
   hash (fragments are not sent to servers). The token lives in the user's
   browser only — there is no shared server-side store, so no other visitor
   can read this account. */
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
  const redirect = `https://${req.headers.host}/api/meta/callback`;
  let ret = `https://${req.headers.host}/`;
  try { const s = JSON.parse(Buffer.from(getParam(req, 'state') || '', 'base64url').toString()); if (s.ret) ret = s.ret; } catch { /* ignore */ }

  const error = getParam(req, 'error_description') || getParam(req, 'error');
  const code = getParam(req, 'code');
  if (error || !code) return bounce(res, ret, { meta_error: error || 'Autorisation annulée' });

  const appId = process.env.META_APP_ID, secret = process.env.META_APP_SECRET;
  try {
    const r1 = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&client_secret=${secret}&code=${encodeURIComponent(code)}`);
    const d1 = await r1.json();
    if (d1.error) return bounce(res, ret, { meta_error: d1.error.message });
    // upgrade to a long-lived token (~60 days)
    const r2 = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${secret}&fb_exchange_token=${d1.access_token}`);
    const d2 = await r2.json();
    /* La durée de vie remonte avec le jeton : Meta ne délivre pas de jeton de
       rafraîchissement, donc c'est la seule façon pour l'app de savoir quand
       demander une reconnexion — avant qu'une publication programmée n'échoue. */
    const long = d2.access_token ? d2 : d1;
    const out = { meta_token: long.access_token || d1.access_token };
    if (long.expires_in) out.meta_expires = String(long.expires_in);
    return bounce(res, ret, out);
  } catch (e) {
    return bounce(res, ret, { meta_error: String(e && e.message || e) });
  }
}

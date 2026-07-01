/* TikTok OAuth — step 1: redirect to TikTok's consent screen.
   Scopes: profile + stats (Connexion card), video.list (video grid),
   video.publish (Direct Post) and video.upload (draft to inbox, fallback if
   Direct Post isn't approved for this app yet). */
const SCOPE = 'user.info.basic,user.info.profile,user.info.stats,video.list,video.publish,video.upload';

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default function handler(req, res) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) { res.statusCode = 500; res.end('TIKTOK_CLIENT_KEY manquant'); return; }
  // Doit matcher le domaine réellement visité — chaque domaine utilisé doit
  // être enregistré dans TikTok for Developers (Redirect URI).
  const redirect = `https://${req.headers.host}/api/tiktok/callback`;
  const ret = getParam(req, 'return') || `https://${req.headers.host}/`;
  const state = Buffer.from(JSON.stringify({ ret })).toString('base64url');
  const url = 'https://www.tiktok.com/v2/auth/authorize/'
    + `?client_key=${encodeURIComponent(clientKey)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}`
    + '&response_type=code'
    + `&scope=${encodeURIComponent(SCOPE)}`
    + `&state=${state}`;
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

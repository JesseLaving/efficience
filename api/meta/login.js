/* Meta OAuth — step 1: redirect the user to Facebook's consent dialog.
   The App Secret is never used here (public client_id only). The `return`
   param (the app URL to come back to) is carried through `state`. */
const REDIRECT = 'https://efficience.vercel.app/api/meta/callback';
// Scopes are env-driven so Instagram permissions can be switched on (once the
// app has them enabled) without a code change — set META_SCOPES on Vercel.
// Default = the permissions valid on a fresh app: read the user's Facebook Pages.
const SCOPES = process.env.META_SCOPES || [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
].join(',');

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default function handler(req, res) {
  const appId = process.env.META_APP_ID;
  if (!appId) { res.statusCode = 500; res.end('META_APP_ID manquant'); return; }
  const ret = getParam(req, 'return') || 'https://efficience.vercel.app';
  const state = Buffer.from(JSON.stringify({ ret })).toString('base64url');
  const url = `https://www.facebook.com/v21.0/dialog/oauth`
    + `?client_id=${encodeURIComponent(appId)}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT)}`
    + `&state=${state}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent(SCOPES)}`;
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

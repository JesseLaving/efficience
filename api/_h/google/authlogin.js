/* Identity login via Google (separate from the Business Profile connect flow).
   Requests openid/profile/email and reuses the ALREADY-REGISTERED redirect URI
   (/api/google/callback) so no Google Cloud Console change is needed. The
   callback branches on state.kind === 'auth'. */
const SCOPE = 'openid profile email';

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) { res.statusCode = 500; res.end('GOOGLE_OAUTH_CLIENT_ID manquant'); return; }
  // Doit matcher le domaine réellement visité — sinon le cookie de session
  // posé par le callback atterrit sur le mauvais domaine.
  const redirect = `https://${req.headers.host}/api/google/callback`;
  const ret = getParam(req, 'return') || `https://${req.headers.host}/`;
  const state = Buffer.from(JSON.stringify({ kind: 'auth', ret })).toString('base64url');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth'
    + `?client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}`
    + '&response_type=code'
    + `&scope=${encodeURIComponent(SCOPE)}`
    + '&include_granted_scopes=true'
    + `&state=${state}`;
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

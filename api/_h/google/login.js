/* Google OAuth — step 1: redirect to Google's consent screen for the
   Business Profile (business.manage) scope. Offline access so we also get a
   refresh token. The app URL to return to is carried in `state`. */
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) { res.statusCode = 500; res.end('GOOGLE_OAUTH_CLIENT_ID manquant'); return; }
  // Doit matcher le domaine réellement visité — sinon le callback (cookie de
  // session / bounce de token) atterrit sur le mauvais domaine.
  const redirect = `https://${req.headers.host}/api/google/callback`;
  const ret = getParam(req, 'return') || `https://${req.headers.host}/`;
  const state = Buffer.from(JSON.stringify({ ret })).toString('base64url');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth'
    + `?client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}`
    + '&response_type=code'
    + `&scope=${encodeURIComponent(SCOPE)}`
    + '&access_type=offline&include_granted_scopes=true&prompt=consent'
    + `&state=${state}`;
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

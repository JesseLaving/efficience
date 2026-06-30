/* LinkedIn OAuth — step 1: redirect to the consent screen.
   Scopes: OpenID (identity) + w_member_social (post to the member's profile).
   Note: LinkedIn UGC Posts API v2 does not support native image uploads.
   Images must be added manually or via web link previews. */
const REDIRECT = 'https://efficience.vercel.app/api/linkedin/callback';
const SCOPE = 'openid profile email w_member_social';

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default function handler(req, res) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) { res.statusCode = 500; res.end('LINKEDIN_CLIENT_ID manquant'); return; }
  const ret = getParam(req, 'return') || 'https://efficience.vercel.app/';
  const state = Buffer.from(JSON.stringify({ ret })).toString('base64url');
  const url = 'https://www.linkedin.com/oauth/v2/authorization'
    + '?response_type=code'
    + `&client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT)}`
    + `&scope=${encodeURIComponent(SCOPE)}`
    + `&state=${state}`;
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

/* Google OAuth — refresh an expired access token using the refresh token.
   No CORS wildcard here: this returns a live access token and is only ever
   called same-origin from the app itself (src/lib/google.ts uses a relative
   API path), so there's no legitimate cross-origin caller to support. */
function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  const refresh = getParam(req, 'refresh');
  if (!refresh) return json(res, 400, { error: 'Paramètre "refresh" requis.' });
  try {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refresh, grant_type: 'refresh_token',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const d = await r.json();
    if (d.error) return json(res, 400, { error: d.error_description || d.error });
    return json(res, 200, { token: d.access_token });
  } catch (e) {
    return json(res, 500, { error: String(e && e.message || e) });
  }
}

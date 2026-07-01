/* TikTok OAuth — refresh an expired access token using the refresh token. */
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
      client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token', refresh_token: refresh,
    });
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const d = await r.json();
    if (d.error) return json(res, 400, { error: d.error_description || d.error });
    return json(res, 200, { token: d.access_token, refresh: d.refresh_token || refresh });
  } catch (e) {
    return json(res, 500, { error: String(e && e.message || e) });
  }
}

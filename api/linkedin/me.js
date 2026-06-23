/* LinkedIn — return the connected member's identity (OpenID userinfo). */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const token = getParam(req, 'token');
  if (!token) return json(res, 400, { error: 'Paramètre "token" requis.' });
  try {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.error || d.serviceErrorCode) return json(res, 400, { error: d.error_description || d.message || 'Erreur LinkedIn' });
    return json(res, 200, { sub: d.sub || null, name: d.name || null, picture: d.picture || null, email: d.email || null });
  } catch (e) {
    return json(res, 500, { error: String(e && e.message || e) });
  }
}

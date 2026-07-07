/* LinkedIn — list the Company Pages the connected member administers.
   Requires r_organization_admin (Community Management API — only present on
   the token once LINKEDIN_ORG_SCOPES=1 was set at login time and LinkedIn
   approved the product). Degrades to an empty, honestly-labeled list rather
   than a hard error when the scope isn't on the token, since a member with
   no admin'd pages is a normal, expected case too. */
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
    const url = 'https://api.linkedin.com/v2/organizationAcls'
      + '?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED'
      + '&projection=(elements*(organization~(id,localizedName,vanityName,logoV2)))';
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      // 403 here almost always means the token predates LINKEDIN_ORG_SCOPES=1
      // (no r_organization_admin granted yet) — not a real error for the caller.
      return json(res, 200, { available: false, reason: d.message || `LinkedIn HTTP ${r.status}`, organizations: [] });
    }
    const organizations = (d.elements || [])
      .map((el) => el['organization~'])
      .filter(Boolean)
      .map((o) => ({ id: String(o.id), name: o.localizedName || null, vanityName: o.vanityName || null }));
    return json(res, 200, { available: true, organizations });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e), organizations: [] });
  }
}

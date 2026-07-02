/* Google Business — list the user's accounts + locations (fiches).
   Uses the Business Profile APIs, which require Google to approve API access
   for the project; until then these calls return PERMISSION_DENIED and we
   report `available:false` with the reason (no invented data). */
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
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  try {
    const ar = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', auth);
    const ad = await ar.json();
    if (ad.error) return json(res, 200, { available: false, reason: ad.error.message, authError: ar.status === 401, accounts: [] });

    const locations = [];
    for (const acc of (ad.accounts || [])) {
      const lr = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,storefrontAddress,websiteUri,metadata&pageSize=100`, auth);
      const ld = await lr.json();
      if (ld.error) { if (!locations.length) return json(res, 200, { available: false, reason: ld.error.message, accounts: [] }); continue; }
      for (const loc of (ld.locations || [])) {
        locations.push({
          account: acc.name,                          // accounts/{id}
          location: loc.name,                         // locations/{id}
          path: `${acc.name}/${loc.name}`,            // accounts/{id}/locations/{id} (v4 parent)
          title: loc.title || null,
          address: loc.storefrontAddress ? [(loc.storefrontAddress.addressLines || []).join(' '), loc.storefrontAddress.locality].filter(Boolean).join(', ') : null,
          website: loc.websiteUri || null,
        });
      }
    }
    return json(res, 200, { available: true, accounts: locations });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture Google Business', detail: String(e && e.message || e) });
  }
}

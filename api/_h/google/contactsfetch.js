/* Google People API — lecture des contacts de l'utilisateur (contacts.readonly).
   Pagine jusqu'à ~5000 contacts et renvoie une forme simplifiée ; aucune
   donnée n'est inventée si un champ est absent (name/email/phone/address). */
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

const FIELDS = 'names,emailAddresses,phoneNumbers,addresses';
const MAX_PAGES = 20; // ~5000 contacts à 250/page

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const token = getParam(req, 'token');
  if (!token) return json(res, 400, { error: 'Paramètre "token" requis.' });
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const contacts = [];
  let pageToken = '';
  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const url = `https://people.googleapis.com/v1/people/me/connections?personFields=${FIELDS}&pageSize=250`
        + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const r = await fetch(url, auth);
      const d = await r.json();
      if (d.error) return json(res, 200, { available: false, reason: d.error.message, contacts: [] });
      for (const p of (d.connections || [])) {
        const n = (p.names || [])[0];
        const e = (p.emailAddresses || [])[0];
        const ph = (p.phoneNumbers || [])[0];
        const a = (p.addresses || [])[0];
        if (!n && !e) continue;
        contacts.push({
          first: n?.givenName || '', last: n?.familyName || '', name: n?.displayName || '',
          email: e?.value || '', phone: ph?.value || null, city: a?.city || null,
        });
      }
      if (!d.nextPageToken) break;
      pageToken = d.nextPageToken;
    }
    return json(res, 200, { available: true, contacts });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture Google Contacts', detail: String(e && e.message || e) });
  }
}

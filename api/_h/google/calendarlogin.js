/* Google OAuth — connexion Google Agenda (création d'un agenda dédié +
   synchronisation des publications programmées). Offline access pour un
   refresh token persistant, comme Business Profile et YouTube. Le scope
   "calendar" (accès complet) est nécessaire pour créer un nouvel agenda —
   pas seulement pour y ajouter des événements. */
const SCOPE = 'https://www.googleapis.com/auth/calendar';

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) { res.statusCode = 500; res.end('GOOGLE_OAUTH_CLIENT_ID manquant'); return; }
  const redirect = `https://${req.headers.host}/api/google/callback`;
  const ret = getParam(req, 'return') || `https://${req.headers.host}/`;
  const state = Buffer.from(JSON.stringify({ kind: 'calendar', ret })).toString('base64url');
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

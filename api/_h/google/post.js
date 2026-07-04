/* Google Business — publish a local post (actualité) with optional photo to a
   chosen location. Uses the legacy My Business API v4 localPosts endpoint
   (still the route for local posts). Gated behind Business Profile API access:
   returns the API error verbatim if access isn't granted yet. POST body:
   { token, path, summary, actionType?, url?, photoUrl? } */
import { requireSession } from '../requireSession.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  if (!requireSession(req, res, json)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, path, summary, actionType, url, photoUrl } = body || {};
  if (!token || !path || !summary) return json(res, 400, { error: 'token, path et summary requis.' });

  const localPost = { languageCode: 'fr', summary, topicType: 'STANDARD' };
  if (url) localPost.callToAction = { actionType: actionType || 'LEARN_MORE', url };
  if (photoUrl) localPost.media = [{ mediaFormat: 'PHOTO', sourceUrl: photoUrl }];

  try {
    const r = await fetch(`https://mybusiness.googleapis.com/v4/${path}/localPosts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(localPost),
    });
    // L'API peut répondre du HTML (401/404, accès non activé) — parse défensif
    // pour dégrader proprement en { ok:false, reason } plutôt que de planter.
    const raw = await r.text();
    let d = {};
    try { d = raw ? JSON.parse(raw) : {}; }
    catch { return json(res, 200, { ok: false, reason: `Réponse inattendue de l’API Google (HTTP ${r.status}). L’accès à la Business Profile API n’est probablement pas encore activé.` }); }
    if (d.error) return json(res, 200, { ok: false, reason: d.error.message });
    if (!r.ok) return json(res, 200, { ok: false, reason: `Publication refusée par Google (HTTP ${r.status}).` });
    return json(res, 200, { ok: true, post: { name: d.name || null, state: d.state || null, searchUrl: d.searchUrl || null } });
  } catch (e) {
    return json(res, 500, { error: 'Échec publication Google', detail: String(e && e.message || e) });
  }
}

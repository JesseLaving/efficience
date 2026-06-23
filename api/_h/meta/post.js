/* Meta — publish a post to a Facebook Page and/or linked Instagram account.
   Requires pages_manage_posts (FB) and instagram_content_publish (IG) which need
   Meta App Review. Until approved, these calls return a permission error that we
   surface verbatim (no invented data). POST body:
   { token, targets: ['facebook'|'instagram'], message, photoUrl? } */
import crypto from 'node:crypto';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, targets = [], message, photoUrl } = body || {};
  if (!token || !message || !message.trim()) return json(res, 400, { error: 'token et message requis.' });
  if (!targets.length) return json(res, 400, { error: 'Choisissez au moins un réseau cible.' });

  const secret = process.env.META_APP_SECRET || '';
  const proof = secret ? crypto.createHmac('sha256', secret).update(token).digest('hex') : '';
  const g = async (path, fields) => {
    const url = `https://graph.facebook.com/v21.0/${path}?access_token=${encodeURIComponent(token)}`
      + (proof ? `&appsecret_proof=${proof}` : '')
      + (fields ? `&fields=${encodeURIComponent(fields)}` : '');
    const r = await fetch(url);
    return r.json();
  };

  const results = [];

  // --- Fetch pages (with IG linked account) ---
  const pagesRes = await g('me/accounts', 'id,name,access_token,instagram_business_account');
  if (pagesRes.error) return json(res, 200, { ok: false, reason: pagesRes.error.message });

  for (const p of (pagesRes.data || [])) {
    const ptoken = p.access_token || token;
    const pproof = secret ? crypto.createHmac('sha256', secret).update(ptoken).digest('hex') : '';
    const pg = async (path, body2) => {
      const url = `https://graph.facebook.com/v21.0/${path}?access_token=${encodeURIComponent(ptoken)}`
        + (pproof ? `&appsecret_proof=${pproof}` : '');
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body2) });
      return r.json();
    };

    // --- Facebook page post ---
    if (targets.includes('facebook')) {
      const fbBody = { message: message.trim() };
      if (photoUrl) fbBody.url = photoUrl;
      const endpoint = photoUrl ? `${p.id}/photos` : `${p.id}/feed`;
      const r = await pg(endpoint, fbBody);
      results.push({ network: 'facebook', page: p.name, ok: !r.error, id: r.id || null, reason: r.error ? r.error.message : null });
    }

    // --- Instagram post (via linked IG Business account) ---
    if (targets.includes('instagram') && p.instagram_business_account && p.instagram_business_account.id) {
      const igId = p.instagram_business_account.id;
      let containerId;
      if (photoUrl) {
        // 2-step: create container, then publish
        const c = await pg(`${igId}/media`, { image_url: photoUrl, caption: message.trim() });
        if (c.error) { results.push({ network: 'instagram', ok: false, reason: c.error.message }); continue; }
        containerId = c.id;
      } else {
        // text-only — use a 1×1 transparent pixel as placeholder image to allow caption
        const c = await pg(`${igId}/media`, { image_url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png', caption: message.trim() });
        if (c.error) { results.push({ network: 'instagram', ok: false, reason: c.error.message }); continue; }
        containerId = c.id;
      }
      const pub = await pg(`${igId}/media_publish`, { creation_id: containerId });
      results.push({ network: 'instagram', ok: !pub.error, id: pub.id || null, reason: pub.error ? pub.error.message : null });
    }
  }

  if (!results.length) return json(res, 200, { ok: false, reason: 'Aucune page ou compte Instagram trouvé pour ce jeton.' });
  const anyOk = results.some((r) => r.ok);
  return json(res, 200, { ok: anyOk, results });
}

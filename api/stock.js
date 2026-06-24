/* Serverless — recherche de photos d'illustration (Pexels).
   Renvoie de vraies photos illustrant le sujet, avec des URLs PUBLIQUES
   directement utilisables pour publier sur Instagram/Facebook/Google.
   Clé côté serveur uniquement (PEXELS_API_KEY). Aucune donnée inventée :
   si la clé manque, on le dit clairement. */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const key = process.env.PEXELS_API_KEY || '';
  if (!key) return json(res, 200, { available: false, reason: 'Clé Pexels non configurée (PEXELS_API_KEY).', photos: [] });

  const q = (getParam(req, 'q') || '').trim();
  if (!q) return json(res, 400, { error: 'Paramètre "q" requis.' });
  const orientation = getParam(req, 'orientation') || 'square'; // square | portrait | landscape
  const perPage = Math.min(24, Math.max(1, parseInt(getParam(req, 'n') || '12', 10) || 12));

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const api = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}`
      + `&orientation=${encodeURIComponent(orientation)}&locale=fr-FR`;
    const r = await fetch(api, { headers: { Authorization: key }, signal: ctrl.signal });
    const raw = await r.text();
    let d = {};
    try { d = raw ? JSON.parse(raw) : {}; } catch { return json(res, 200, { available: false, reason: `Réponse inattendue de Pexels (HTTP ${r.status}).`, photos: [] }); }
    if (!r.ok || d.error) return json(res, 200, { available: false, reason: d.error || `Pexels HTTP ${r.status}`, photos: [] });
    const photos = (d.photos || []).map((p) => ({
      id: p.id,
      thumb: p.src && (p.src.medium || p.src.small),
      // URL publique pour l'affichage ET la publication via API.
      url: p.src && (p.src.large || p.src.large2x || p.src.original),
      portrait: p.src && p.src.portrait,
      landscape: p.src && p.src.landscape,
      width: p.width, height: p.height,
      avgColor: p.avg_color || null,
      photographer: p.photographer || null,
      photographerUrl: p.photographer_url || null,
      alt: p.alt || '',
      link: p.url || null,
    }));
    return json(res, 200, { available: true, query: q, total: d.total_results || photos.length, photos });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e), photos: [] });
  } finally { clearTimeout(t); }
}

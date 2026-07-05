/* Hébergement d'image — reçoit une image (data-URL base64), l'envoie sur
   Vercel Blob et renvoie une URL PUBLIQUE (publiable via API Instagram/Google).
   Dégrade proprement si le store Blob n'est pas configuré. */
import { put } from '@vercel/blob';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(res, 200, { ok: false, reason: 'Hébergement d’images non configuré (Vercel Blob manquant).' });

  const body = await readBody(req);
  const data = body && body.data;
  const m = typeof data === 'string' && /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(data);
  if (!m) return json(res, 400, { ok: false, reason: 'Champ "data" (data-URL image base64) requis.' });

  try {
    const contentType = m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return json(res, 413, { ok: false, reason: 'Image trop lourde (> 8 Mo).' });
    const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').replace('jpeg', 'jpg');
    const blob = await put(`visuels/efficience-${Date.now()}.${ext}`, buf, { access: 'public', contentType, addRandomSuffix: true });
    return json(res, 200, { ok: true, url: blob.url });
  } catch (e) {
    return json(res, 200, { ok: false, reason: String(e && e.message || e) });
  }
}

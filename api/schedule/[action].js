/* Programmation serveur — arme/liste/retire des publications auto.
   Stocke dans Vercel KV : le post (sched:{id}) + les tokens du réseau (tok:{net})
   pour que le cron puisse publier sans le navigateur.
   Actions: /api/schedule/add | /api/schedule/list | /api/schedule/remove
   Dégrade proprement si KV n'est pas configuré. */
import { kvConfigured, kvSet, kvDel, kvKeys, kvGetJson } from '../_h/kv.js';
import { requireSession } from '../_h/spaces/_util.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}
const getAction = (req) => {
  if (req.query && req.query.action) return req.query.action;
  try { return (new URL(req.url, 'http://x').pathname.split('/').pop() || '').split('?')[0]; } catch { return ''; }
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  cors(res);
  // Ces posts programmés déclenchent une publication réelle (cron/publish.js)
  // avec les tokens réseau stockés — jamais accessible sans session valide.
  if (!requireSession(req, res)) return;
  if (!kvConfigured()) return json(res, 200, { ok: false, reason: 'Programmation serveur non configurée (Vercel KV manquant).' });
  const action = getAction(req);

  try {
    if (action === 'list') {
      const keys = (await kvKeys('sched:*')) || [];
      const posts = [];
      for (const k of keys) { const p = await kvGetJson(k); if (p) posts.push(p); }
      posts.sort((a, b) => (a.whenMs || 0) - (b.whenMs || 0));
      return json(res, 200, { ok: true, posts });
    }

    const body = await readBody(req);

    if (action === 'add') {
      const post = body.post || {};
      const tokens = body.tokens || {};
      if (!post.id || !post.whenMs || !post.text || !Array.isArray(post.networks) || !post.networks.length) {
        return json(res, 400, { ok: false, reason: 'Post invalide (id, whenMs, text, networks requis).' });
      }
      // Stocke / rafraîchit les tokens nécessaires (les réseaux non fournis sont ignorés).
      if (tokens.meta) await kvSet('tok:meta', { token: tokens.meta });
      if (tokens.linkedin) await kvSet('tok:linkedin', { token: tokens.linkedin });
      if (tokens.google && tokens.google.token) await kvSet('tok:google', { token: tokens.google.token, refresh: tokens.google.refresh || null, paths: tokens.google.paths || [] });
      const stored = {
        id: post.id, whenMs: post.whenMs, dateTime: post.dateTime || null,
        text: post.text, networks: post.networks, photoUrl: post.photoUrl || null,
        pillar: post.pillar || null, status: 'scheduled', lastResult: null, createdAt: Date.now(),
      };
      await kvSet(`sched:${post.id}`, stored);
      return json(res, 200, { ok: true, id: post.id });
    }

    if (action === 'remove') {
      const id = body.id || (req.query && req.query.id);
      if (!id) return json(res, 400, { ok: false, reason: 'id requis.' });
      await kvDel(`sched:${id}`);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { ok: false, reason: 'Action inconnue.' });
  } catch (e) {
    return json(res, 200, { ok: false, reason: String(e && e.message || e) });
  }
}

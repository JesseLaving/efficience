/* Programmation serveur — arme/liste/retire des publications auto.
   Stocke dans Vercel KV : le post (sched:{spaceId}:{id}) + les tokens du
   réseau (tok:{spaceId}:{net}) pour que le cron puisse publier sans le
   navigateur. Chaque clé est scopée par espace — un espace ne peut jamais
   voir/modifier la programmation d'un autre.
   Actions: /api/schedule/add | /api/schedule/list | /api/schedule/remove
   Dégrade proprement si KV n'est pas configuré. */
import { kvConfigured, kvSet, kvDel, kvKeys, kvGetJson } from '../_h/kv.js';
import { query } from '../_h/db.js';
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
function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}
const getAction = (req) => {
  if (req.query && req.query.action) return req.query.action;
  try { return (new URL(req.url, 'http://x').pathname.split('/').pop() || '').split('?')[0]; } catch { return ''; }
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  cors(res);
  // Ces posts programmés déclenchent une publication réelle (cron/publish.js)
  // avec les tokens réseau stockés — jamais accessible sans session valide,
  // et jamais en dehors de l'espace auquel ils appartiennent.
  const session = requireSession(req, res);
  if (!session) return;
  if (!kvConfigured()) return json(res, 200, { ok: false, reason: 'Programmation serveur non configurée (Vercel KV manquant).' });

  const action = getAction(req);
  // La requête ne se lit qu'une fois (le flux ne peut pas être relu) : pas de
  // corps pour "list" (GET), sinon on lit le body une seule fois pour tout.
  const body = action === 'list' ? {} : await readBody(req);
  const spaceId = parseInt(getParam(req, 'spaceId') || body.spaceId || '', 10);
  if (!spaceId) return json(res, 400, { ok: false, reason: 'spaceId requis.' });

  try {
    const owns = await query(`SELECT id FROM app_spaces WHERE id = $1 AND user_id = $2`, [spaceId, session.userId]);
    if (!owns.rows.length) return json(res, 403, { ok: false, reason: 'Espace introuvable.' });

    if (action === 'list') {
      const keys = (await kvKeys(`sched:${spaceId}:*`)) || [];
      const posts = [];
      for (const k of keys) { const p = await kvGetJson(k); if (p) posts.push(p); }
      posts.sort((a, b) => (a.whenMs || 0) - (b.whenMs || 0));
      return json(res, 200, { ok: true, posts });
    }

    if (action === 'add') {
      const post = body.post || {};
      const tokens = body.tokens || {};
      if (!post.id || !post.whenMs || !post.text || !Array.isArray(post.networks) || !post.networks.length) {
        return json(res, 400, { ok: false, reason: 'Post invalide (id, whenMs, text, networks requis).' });
      }
      // Stocke / rafraîchit les tokens nécessaires (les réseaux non fournis sont ignorés).
      if (tokens.meta) await kvSet(`tok:${spaceId}:meta`, { token: tokens.meta });
      if (tokens.linkedin) await kvSet(`tok:${spaceId}:linkedin`, { token: tokens.linkedin });
      if (tokens.google && tokens.google.token) await kvSet(`tok:${spaceId}:google`, { token: tokens.google.token, refresh: tokens.google.refresh || null, paths: tokens.google.paths || [] });
      const stored = {
        id: post.id, whenMs: post.whenMs, dateTime: post.dateTime || null,
        text: post.text, networks: post.networks, photoUrl: post.photoUrl || null,
        pillar: post.pillar || null, status: 'scheduled', lastResult: null, createdAt: Date.now(),
      };
      await kvSet(`sched:${spaceId}:${post.id}`, stored);
      return json(res, 200, { ok: true, id: post.id });
    }

    if (action === 'remove') {
      const id = body.id || (req.query && req.query.id);
      if (!id) return json(res, 400, { ok: false, reason: 'id requis.' });
      await kvDel(`sched:${spaceId}:${id}`);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { ok: false, reason: 'Action inconnue.' });
  } catch (e) {
    return json(res, 200, { ok: false, reason: String(e && e.message || e) });
  }
}

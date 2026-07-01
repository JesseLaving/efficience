/* Cron de publication — à pinguer par un cron externe (ex: cron-job.org) toutes
   les ~10 min : /api/cron/publish?key=CRON_SECRET
   Lit les posts dus dans Vercel KV et publie via les endpoints existants
   (Meta / LinkedIn / Google), avec les tokens stockés. Protégé par un secret. */
import { kvConfigured, kvSet, kvKeys, kvGetJson } from '../_h/kv.js';

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
const getParam = (req, name) => {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
};
// Alias public stable — PAS VERCEL_URL (URL de déploiement immuable, souvent
// protégée → la self-requête y échouerait en renvoyant du HTML).
const BASE = process.env.PUBLISH_BASE || 'https://efficience.vercel.app';

async function postJson(path, body) {
  try {
    const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const txt = await r.text();
    let d = {};
    try { d = txt ? JSON.parse(txt) : {}; } catch { return { ok: false, reason: `HTTP ${r.status} (réponse non-JSON de ${path})` }; }
    if (!r.ok && !d.reason && !d.error) d.reason = `HTTP ${r.status}`;
    return d || {};
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}

async function publishOne(post) {
  const errs = [];
  let okCount = 0;
  const nets = post.networks || [];
  const metaTargets = nets.filter((n) => n === 'instagram' || n === 'facebook');

  if (metaTargets.length) {
    const tok = await kvGetJson('tok:meta');
    if (tok && tok.token) {
      const r = await postJson('/api/meta/post', { token: tok.token, targets: metaTargets, message: post.text, photoUrl: post.photoUrl || undefined });
      for (const res of (r.results || [])) { if (res.ok) okCount++; else errs.push(`${res.network}: ${res.reason || 'échec'}`); }
      if (!r.results) errs.push(`meta: ${r.reason || 'pas de réponse'}`);
    } else errs.push('meta: token absent');
  }

  if (nets.includes('linkedin')) {
    const tok = await kvGetJson('tok:linkedin');
    if (tok && tok.token) {
      const r = await postJson('/api/linkedin/post', { token: tok.token, text: post.text });
      if (r.ok) okCount++; else errs.push(`linkedin: ${r.reason || r.error || 'échec'}`);
    } else errs.push('linkedin: token absent');
  }

  if (nets.includes('google')) {
    const tok = await kvGetJson('tok:google');
    if (tok && tok.token) {
      let gToken = tok.token;
      if (tok.refresh) {
        try { const rr = await fetch(`${BASE}/api/google/refresh?refresh=${encodeURIComponent(tok.refresh)}`); const dd = await rr.json().catch(() => ({})); if (dd.token) { gToken = dd.token; await kvSet('tok:google', { ...tok, token: gToken }); } } catch { /* garde l'ancien */ }
      }
      const paths = (tok.paths && tok.paths.length) ? tok.paths : [];
      if (!paths.length) errs.push('google: aucune fiche');
      for (const path of paths) {
        const r = await postJson('/api/google/post', { token: gToken, path, summary: post.text, photoUrl: post.photoUrl || undefined });
        if (r.ok) okCount++; else errs.push(`google: ${r.reason || r.error || 'échec'}`);
      }
    } else errs.push('google: token absent');
  }

  return { status: errs.length && !okCount ? 'failed' : (errs.length ? 'failed' : 'published'), lastResult: errs.length ? errs.join(' · ') : `Publié sur ${okCount} cible(s).` };
}

export default async function handler(req, res) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const provided = (getParam(req, 'key') || '').trim();
  if (!secret || provided !== secret) return json(res, 401, { ok: false, reason: 'Clé cron invalide.' });
  if (!kvConfigured()) return json(res, 200, { ok: false, reason: 'KV non configuré.' });

  const now = Date.now();
  let processed = 0, published = 0, failed = 0;
  try {
    const keys = (await kvKeys('sched:*')) || [];
    for (const k of keys) {
      const post = await kvGetJson(k);
      if (!post || post.status !== 'scheduled') continue;
      if ((post.whenMs || 0) > now) continue; // pas encore l'heure
      processed++;
      const out = await publishOne(post);
      const updated = { ...post, status: out.status, lastResult: out.lastResult, publishedAt: now };
      await kvSet(k, updated);
      if (out.status === 'published') published++; else failed++;
    }
    return json(res, 200, { ok: true, processed, published, failed, at: now });
  } catch (e) {
    return json(res, 200, { ok: false, reason: String(e && e.message || e), processed, published, failed });
  }
}

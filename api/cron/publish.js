/* Cron de publication — à pinguer par un cron externe (ex: cron-job.org) toutes
   les ~10 min : /api/cron/publish?key=CRON_SECRET
   Lit les posts dus dans Vercel KV et publie via les endpoints existants
   (Meta / LinkedIn / Google), avec les tokens stockés. Protégé par un secret. */
import { kvConfigured, kvSet, kvKeys, kvGetJson } from '../_h/kv.js';
import { sendCampaign } from '../_h/email/_send.js';

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

/* Les endpoints de publication exigent une session utilisateur ; le cron n'en
   a pas. Il se signe avec son propre secret en en-tête — reconnu par
   api/_h/requireSession.js (jamais en URL pour ne pas fuiter dans les logs). */
const cronHeaders = () => {
  const h = { 'Content-Type': 'application/json' };
  const secret = (process.env.CRON_SECRET || '').trim();
  if (secret) h['x-cron-key'] = secret;
  return h;
};

async function postJson(path, body) {
  try {
    const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: cronHeaders(), body: JSON.stringify(body) });
    const txt = await r.text();
    let d = {};
    try { d = txt ? JSON.parse(txt) : {}; } catch { return { ok: false, reason: `HTTP ${r.status} (réponse non-JSON de ${path})` }; }
    if (!r.ok && !d.reason && !d.error) d.reason = `HTTP ${r.status}`;
    return d || {};
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}

/* Un jeton dont l'échéance est dépassée ne sert à rien : le dire explicitement
   évite de renvoyer l'erreur brute du réseau social, que personne ne relie à
   une reconnexion à faire. */
const expired = (tok) => !!(tok && tok.expiresAt && Number(tok.expiresAt) <= Date.now());

async function publishOne(spaceId, post) {
  const errs = [];
  /* Réseaux réellement en échec, pour que l'utilisateur puisse relancer ceux-là
     SEULEMENT : republier la liste entière doublonnerait sur ceux qui sont déjà
     passés. Le message lisible (errs) ne se prête pas à être réanalysé. */
  const failed = [];
  let okCount = 0;
  const nets = post.networks || [];
  const metaTargets = nets.filter((n) => n === 'instagram' || n === 'facebook');

  if (metaTargets.length) {
    const tok = await kvGetJson(`tok:${spaceId}:meta`);
    if (expired(tok)) { errs.push('meta: accès expiré — reconnectez Instagram / Facebook'); failed.push(...metaTargets); }
    else if (tok && tok.token) {
      const r = await postJson('/api/meta/post', { token: tok.token, targets: metaTargets, message: post.text, photoUrl: post.photoUrl || undefined });
      for (const res of (r.results || [])) { if (res.ok) okCount++; else { errs.push(`${res.network}: ${res.reason || 'échec'}`); failed.push(res.network); } }
      if (!r.results) { errs.push(`meta: ${r.reason || 'pas de réponse'}`); failed.push(...metaTargets); }
    } else { errs.push('meta: token absent'); failed.push(...metaTargets); }
  }

  if (nets.includes('linkedin')) {
    const tok = await kvGetJson(`tok:${spaceId}:linkedin`);
    if (expired(tok)) { errs.push('linkedin: accès expiré — reconnectez LinkedIn'); failed.push('linkedin'); }
    else if (tok && tok.token) {
      const r = await postJson('/api/linkedin/post', { token: tok.token, text: post.text });
      if (r.ok) okCount++; else { errs.push(`linkedin: ${r.reason || r.error || 'échec'}`); failed.push('linkedin'); }
    } else { errs.push('linkedin: token absent'); failed.push('linkedin'); }
  }

  if (nets.includes('google')) {
    const tok = await kvGetJson(`tok:${spaceId}:google`);
    if (tok && tok.token) {
      let gToken = tok.token;
      if (tok.refresh) {
        // POST + corps JSON : le refresh token ne doit jamais transiter en URL.
        try { const dd = await postJson('/api/google/refresh', { refresh: tok.refresh }); if (dd.token) { gToken = dd.token; await kvSet(`tok:${spaceId}:google`, { ...tok, token: gToken }); } } catch { /* garde l'ancien */ }
      }
      const paths = (tok.paths && tok.paths.length) ? tok.paths : [];
      if (!paths.length) { errs.push('google: aucune fiche'); failed.push('google'); }
      for (const path of paths) {
        const r = await postJson('/api/google/post', { token: gToken, path, summary: post.text, photoUrl: post.photoUrl || undefined });
        if (r.ok) okCount++; else { errs.push(`google: ${r.reason || r.error || 'échec'}`); failed.push('google'); }
      }
    } else { errs.push('google: token absent'); failed.push('google'); }
  }

  /* Trois issues distinctes — un succès partiel n'est PAS un échec total :
     le marquer « failed » pousserait l'utilisateur à republier à la main,
     donc à doublonner sur les réseaux qui avaient déjà réussi. */
  const status = okCount ? (errs.length ? 'partial' : 'published') : 'failed';
  const lastResult = errs.length
    ? (okCount ? `Publié sur ${okCount} cible(s) · Échecs : ${errs.join(' · ')}` : errs.join(' · '))
    : `Publié sur ${okCount} cible(s).`;
  return { status, lastResult, failedNetworks: [...new Set(failed)] };
}

/* Campagnes e-mail programmées. Appel direct de la fonction d'envoi plutôt
   qu'une requête HTTP vers /api/email/send : cette route exige une session
   utilisateur, que le cron n'a pas. Le propriétaire est celui enregistré à la
   programmation, et l'appartenance de l'espace est revérifiée à l'envoi. */
async function sendDueCampaigns(host, now) {
  const out = { processed: 0, sent: 0, failed: 0 };
  const keys = (await kvKeys('mail:*')) || [];
  for (const k of keys) {
    const rec = await kvGetJson(k);
    if (!rec || rec.status !== 'scheduled') continue;
    if ((rec.whenMs || 0) > now) continue; // pas encore l'heure
    out.processed++;
    /* Marqué « en cours » AVANT l'envoi : si la fonction est interrompue en
       plein vol, le passage suivant ne réexpédiera pas la campagne à toute la
       liste. Un envoi manqué se rattrape ; un envoi en double, non. */
    await kvSet(k, { ...rec, status: 'sending', startedAt: now });
    const r = await sendCampaign({
      host,
      spaceId: rec.spaceId,
      userId: rec.userId,
      campaignId: rec.id,
      ...rec.payload,
      contacts: rec.contacts,
    });
    const status = r.ok ? 'sent' : 'failed';
    if (r.ok) out.sent++; else out.failed++;
    await kvSet(k, {
      ...rec,
      status,
      sentAt: Date.now(),
      // La liste d'adresses n'a plus lieu d'être conservée une fois l'envoi
      // fait : le relevé suffit à rendre compte.
      contacts: [],
      result: { ok: r.ok, sent: r.sent || 0, failed: r.failed || 0, total: r.total || 0, reason: r.reason || null },
    });
  }
  return out;
}

export default async function handler(req, res) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const provided = (getParam(req, 'key') || '').trim();
  if (!secret || provided !== secret) return json(res, 401, { ok: false, reason: 'Clé cron invalide.' });
  if (!kvConfigured()) return json(res, 200, { ok: false, reason: 'KV non configuré.' });

  const now = Date.now();
  let processed = 0, published = 0, partial = 0, failed = 0;
  try {
    const keys = (await kvKeys('sched:*')) || [];
    for (const k of keys) {
      // Format de clé : sched:{spaceId}:{postId} — les clés d'un ancien
      // schéma sans espace (sched:{postId}) sont ignorées (spaceId absent).
      const spaceId = (k.split(':')[1] || '').trim();
      if (!spaceId) continue;
      const post = await kvGetJson(k);
      if (!post || post.status !== 'scheduled') continue;
      if ((post.whenMs || 0) > now) continue; // pas encore l'heure
      processed++;
      const out = await publishOne(spaceId, post);
      const updated = { ...post, status: out.status, lastResult: out.lastResult, failedNetworks: out.failedNetworks, publishedAt: now };
      await kvSet(k, updated);
      if (out.status === 'published') published++;
      else if (out.status === 'partial') partial++;
      else failed++;
    }
    const mail = await sendDueCampaigns(req.headers.host, now);
    return json(res, 200, { ok: true, processed, published, partial, failed, mail, at: now });
  } catch (e) {
    return json(res, 200, { ok: false, reason: String(e && e.message || e), processed, published, partial, failed });
  }
}

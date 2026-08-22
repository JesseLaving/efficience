/* Programmation des campagnes e-mail.

   Jusqu'ici, « programmer » n'enregistrait qu'une intention : la campagne
   attendait un envoi manuel, alors que les réseaux sociaux, eux, partaient
   tout seuls. La file vit dans le même magasin que les publications
   programmées (Vercel KV), et c'est le même cron qui l'écoule.

   Le destinataire est FIGÉ à la programmation : la base de contacts vit dans
   le navigateur, le serveur ne peut donc pas la relire à l'heure dite. Un
   contact ajouté après coup ne recevra pas cette campagne — l'interface le
   dit, plutôt que de laisser croire à une liste vivante.

     mail:{spaceId}:{campaignId} = {
       id, spaceId, userId, whenMs, status, payload, contacts, result
     }

   `userId` est relevé de la session au moment de la programmation : le cron
   n'a pas de session, et c'est cette valeur — écrite par le serveur, jamais
   par le client — qui lui permet de vérifier l'appartenance de l'espace au
   moment d'envoyer. */
import { query } from '../db.js';
import { requireSession } from '../requireSession.js';
import { cors, json, readBody } from './_shared.js';
import { kvConfigured, kvSet, kvDel, kvKeys, kvGetJson } from '../kv.js';

export const mailKey = (spaceId, id) => `mail:${spaceId}:${id}`;

/* Un identifiant de campagne sert à bâtir une clé de stockage : on le
   restreint au même alphabet que les tags Resend, ce qui écarte du même coup
   les caractères qui pourraient élargir un motif de recherche de clés. */
const safeId = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

async function ownsSpace(spaceId, userId) {
  const owns = await query(`SELECT id FROM app_spaces WHERE id = $1 AND user_id = $2`, [spaceId, userId]);
  return owns.rows.length > 0;
}

/** POST /api/email/schedule — met une campagne en file d'envoi. */
export async function schedule(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });
  if (!kvConfigured()) return json(res, 200, { ok: false, reason: 'Programmation indisponible : magasin de file non configuré côté serveur.' });

  const session = requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }));
  if (!session || session.cron) return session ? json(res, 403, { ok: false, reason: 'Session utilisateur requise.' }) : undefined;

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const spaceId = Number(body?.spaceId);
  const id = safeId(body?.campaignId);
  const whenMs = Number(body?.whenMs);
  const payload = body?.payload;
  const contacts = body?.contacts;

  if (!spaceId || !id) return json(res, 400, { ok: false, reason: 'spaceId et campaignId sont requis.' });
  if (!Number.isFinite(whenMs)) return json(res, 400, { ok: false, reason: 'Date d’envoi invalide.' });
  /* Une date déjà passée partirait au tout prochain passage du cron, sans que
     personne ne l'ait voulu : mieux vaut la refuser que de surprendre. */
  if (whenMs <= Date.now()) return json(res, 400, { ok: false, reason: 'La date d’envoi doit être dans le futur.' });
  if (!payload?.subject || !Array.isArray(payload?.bodyParagraphs) || !payload.bodyParagraphs.length) {
    return json(res, 400, { ok: false, reason: 'Contenu de campagne incomplet.' });
  }
  if (!Array.isArray(contacts) || !contacts.length) return json(res, 400, { ok: false, reason: 'Aucun destinataire.' });

  try {
    if (!(await ownsSpace(spaceId, session.userId))) return json(res, 403, { ok: false, reason: 'Espace introuvable.' });
    await kvSet(mailKey(spaceId, id), {
      id, spaceId, userId: session.userId, whenMs, status: 'scheduled',
      payload, contacts, createdAt: Date.now(), result: null,
    });
    return json(res, 200, { ok: true, id, whenMs });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String((e && e.message) || e) });
  }
}

/** POST /api/email/unschedule — retire une campagne de la file. */
export async function unschedule(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });
  if (!kvConfigured()) return json(res, 200, { ok: true });

  const session = requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }));
  if (!session || session.cron) return session ? json(res, 403, { ok: false, reason: 'Session utilisateur requise.' }) : undefined;

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const spaceId = Number(body?.spaceId);
  const id = safeId(body?.id);
  if (!spaceId || !id) return json(res, 400, { ok: false, reason: 'spaceId et id sont requis.' });

  try {
    if (!(await ownsSpace(spaceId, session.userId))) return json(res, 403, { ok: false, reason: 'Espace introuvable.' });
    await kvDel(mailKey(spaceId, id));
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String((e && e.message) || e) });
  }
}

/** GET /api/email/scheduled?spaceId= — état de la file, pour que l'écran
 *  Campagnes reflète ce que le cron a réellement envoyé. */
export async function scheduled(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (!kvConfigured()) return json(res, 200, { ok: true, campaigns: [] });

  const session = requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }));
  if (!session || session.cron) return session ? json(res, 403, { ok: false, reason: 'Session utilisateur requise.' }) : undefined;

  let spaceId = req.query && req.query.spaceId;
  if (spaceId == null) { try { spaceId = new URL(req.url, 'http://x').searchParams.get('spaceId'); } catch { /* ignore */ } }
  spaceId = Number(spaceId);
  if (!spaceId) return json(res, 400, { ok: false, reason: 'spaceId requis.' });

  try {
    if (!(await ownsSpace(spaceId, session.userId))) return json(res, 403, { ok: false, reason: 'Espace introuvable.' });
    const keys = await kvKeys(`mail:${spaceId}:*`);
    const out = [];
    for (const k of keys || []) {
      const rec = await kvGetJson(k);
      if (!rec) continue;
      // Ni le contenu ni la liste d'adresses ne servent à l'affichage : on ne
      // renvoie que l'état, pour ne pas ressortir la base de contacts.
      out.push({
        id: rec.id, whenMs: rec.whenMs, status: rec.status,
        // Le cron passe toutes les ~10 min : l'envoi a rarement lieu à la
        // minute prévue, et c'est l'heure réelle qui doit être rapportée.
        sentAt: rec.sentAt || null,
        result: rec.result || null,
      });
    }
    return json(res, 200, { ok: true, campaigns: out });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String((e && e.message) || e) });
  }
}

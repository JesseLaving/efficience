/* Webhook Resend — reçoit les événements d'e-mail (ouverture, clic, échec…)
   et les enregistre pour alimenter les statistiques de campagne.

   Endpoint PUBLIC : aucune session ne le protège, puisque c'est Resend qui
   appelle. L'authenticité repose donc entièrement sur la signature Svix, sans
   laquelle n'importe qui pourrait injecter de fausses statistiques par un
   simple POST. Toute requête non signée est rejetée en 401 — y compris si le
   secret n'est pas configuré, car accepter « faute de mieux » reviendrait à
   laisser l'endpoint ouvert.

   Vérification (spécification Svix) :
     contenu signé = `${svix-id}.${svix-timestamp}.${corps brut}`
     clé           = base64 décodé de la partie après `whsec_`
     signature     = HMAC-SHA256, encodée en base64
     en-tête       = signatures versionnées séparées par des espaces (`v1,xxx`)
   La comparaison est à temps constant, et l'horodatage doit tomber dans une
   fenêtre de 5 minutes pour empêcher le rejeu d'une capture. */
import crypto from 'node:crypto';
import { recordEmailEvent } from '../db.js';

const TOLERANCE_S = 5 * 60;

/* Corps BRUT indispensable : la signature porte sur les octets exacts, donc
   un JSON re-sérialisé (espaces, ordre des clés) ne correspondrait plus. */
function readRaw(req) {
  return new Promise((resolve) => {
    if (typeof req.body === 'string') return resolve(req.body);
    // Vercel peut avoir déjà parsé le corps ; on le récupère alors via le
    // champ brut conservé par le runtime quand il est disponible.
    if (req.rawBody) return resolve(req.rawBody.toString('utf8'));
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // timingSafeEqual exige des longueurs égales : on compare d'abord la
  // longueur (non secrète), puis les octets à temps constant.
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verify(raw, headers, secret) {
  const id = headers['svix-id'];
  const ts = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !ts || !sigHeader) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10));
  if (!Number.isFinite(age) || age > TOLERANCE_S) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key)
    .update(`${id}.${ts}.${raw}`)
    .digest('base64');

  // L'en-tête peut porter plusieurs signatures (rotation de secret) : il
  // suffit que l'une corresponde.
  return String(sigHeader).split(' ').some((part) => {
    const [version, value] = part.split(',');
    return version === 'v1' && value && timingSafeEqual(value, expected);
  });
}

/* Types Resend retenus, ramenés à un vocabulaire stable côté app. Les autres
   (email.sent, email.delivered…) sont acquittés mais non stockés : ils
   n'apportent rien de plus que le compteur d'envoi déjà connu. */
const EVENTS = {
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'POST requis' }));
    return;
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const raw = await readRaw(req);

  if (!secret || !verify(raw, req.headers, secret)) {
    // Volontairement muet sur la cause : ne pas indiquer à un appelant non
    // authentifié si le secret manque ou si sa signature est fausse.
    console.error('[email/webhook] signature refusée', { configured: !!secret });
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Signature invalide' }));
    return;
  }

  let payload;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  const type = payload && payload.type;
  const data = (payload && payload.data) || {};
  const event = EVENTS[type];

  // 200 même pour un type ignoré : renvoyer une erreur pousserait Resend à
  // réessayer indéfiniment un événement qu'on ne veut simplement pas stocker.
  if (!event) { res.statusCode = 200; res.end(JSON.stringify({ ok: true, ignored: type || null })); return; }

  /* Rattachement : les tags posés à l'envoi portent l'espace et la campagne.
     Resend renvoie `tags` soit en objet, soit en tableau {name,value} selon
     les versions — on accepte les deux plutôt que de parier. */
  const tags = data.tags || {};
  const tagValue = (name) => {
    if (Array.isArray(tags)) { const t = tags.find((x) => x && x.name === name); return t && t.value; }
    return tags[name];
  };
  const spaceId = parseInt(tagValue('space_id') || '', 10);
  const campaignId = tagValue('campaign_id');
  const to = Array.isArray(data.to) ? data.to[0] : data.to;

  if (!spaceId || !campaignId || !to) {
    // E-mail envoyé hors campagne (ou antérieur au marquage) : rien à imputer.
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, unattributed: true }));
    return;
  }

  try {
    await recordEmailEvent(spaceId, campaignId, to, event);
  } catch (e) {
    // 500 → Resend réessaiera ; l'insertion est idempotente, donc sans risque.
    console.error('[email/webhook] enregistrement impossible', { spaceId, campaignId, event, reason: String(e && e.message || e) });
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
}

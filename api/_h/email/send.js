/* Envoi immédiat d'une campagne, déclenché depuis l'application.
   POST { spaceId, business:{name,email,addressLine}, subject, preheader,
          headline, bodyParagraphs:string[], cta?, ctaUrl?,
          contacts:[{id,email,first,name}] }

   La logique d'envoi vit dans _send.js, partagée avec le cron qui expédie les
   campagnes programmées. Ici on ne fait que l'authentification : c'est la
   session qui désigne le compte, jamais le corps de la requête.

   Renvoie { ok:false, reason } en 200 quand Resend n'est pas configuré, comme
   tous les autres points d'accès adossés à un fournisseur — jamais une erreur
   dure que le client aurait à traiter à part. */
import { requireSession } from '../requireSession.js';
import { cors, json, readBody } from './_shared.js';
import { sendCampaign } from './_send.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);

  const session = requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }));
  if (!session) return;

  const { status, ...out } = await sendCampaign({
    host: req.headers.host,
    userId: session.userId,
    spaceId: body?.spaceId,
    business: body?.business,
    subject: body?.subject,
    preheader: body?.preheader,
    headline: body?.headline,
    bodyParagraphs: body?.bodyParagraphs,
    cta: body?.cta,
    ctaUrl: body?.ctaUrl,
    contacts: body?.contacts,
    campaignId: body?.campaignId,
  });
  return json(res, status || 200, out);
}

/* Envoi effectif d'une campagne — logique partagée par la route interactive
   (api/_h/email/send.js, sous session utilisateur) et par le cron
   (api/cron/publish.js, pour les campagnes programmées).

   Le cron n'a pas de session : il fournit le `userId` du propriétaire, relevé
   au moment de la programmation sous une session authentifiée et conservé
   côté serveur. La vérification d'appartenance de l'espace reste faite ici,
   dans les deux cas — c'est elle qui garantit qu'un envoi ne peut pas viser
   l'espace d'un autre compte. */
import { query, checkEmailQuota } from '../db.js';
import {
  resendSendBatch, chunk, EMAIL_BATCH_SIZE,
  personalize, unsubscribeUrl, buildEmailHtml, buildEmailText, filterUnsubscribed,
} from './_shared.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Neutralise ce qui pourrait injecter des en-têtes supplémentaires dans le
// message brut (injection CRLF) via un nom d'expéditeur ou un Reply-To.
const sanitizeHeaderValue = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/**
 * @returns { ok, sent, failed, total, results, reason, status }
 *   `status` est le code HTTP que la route interactive doit renvoyer.
 */
export async function sendCampaign({
  host, spaceId, userId, business, subject, preheader, headline,
  bodyParagraphs, cta, ctaUrl, contacts, campaignId,
}) {
  if (!spaceId || !business?.name || !subject || !headline || !Array.isArray(bodyParagraphs) || !bodyParagraphs.length) {
    return { ok: false, status: 400, reason: 'spaceId, business, subject, headline et bodyParagraphs sont requis.' };
  }
  if (!Array.isArray(contacts) || !contacts.length) {
    return { ok: false, status: 400, reason: 'Aucun destinataire.' };
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM_DOMAIN) {
    return { ok: false, status: 200, reason: 'Envoi e-mail non configuré (RESEND_API_KEY / EMAIL_FROM_DOMAIN manquants côté serveur).' };
  }

  try {
    const owns = await query(`SELECT id FROM app_spaces WHERE id = $1 AND user_id = $2`, [spaceId, userId]);
    if (!owns.rows.length) return { ok: false, status: 403, reason: 'Espace introuvable.' };

    // Seules les adresses réelles, bien formées et non désinscrites — jamais
    // un filtrage côté client seul (voir filterUnsubscribed).
    const withValidEmail = contacts.filter((c) => c && c.email && EMAIL_RE.test(c.email));
    const recipients = await filterUnsubscribed(spaceId, withValidEmail);
    if (!recipients.length) {
      console.error('[email/send] no valid recipients', { spaceId, total: contacts.length, withValidEmail: withValidEmail.length });
      return { ok: false, status: 200, reason: 'Aucun destinataire valide (adresses manquantes, invalides ou désinscrites).' };
    }

    const quota = await checkEmailQuota(userId, recipients.length);
    if (!quota.ok) {
      console.error('[email/send] quota exceeded', { userId, requested: recipients.length, limit: quota.limit });
      return { ok: false, status: 200, reason: `Quota d'envoi quotidien atteint (${quota.limit} e-mails/jour). Réessayez demain.` };
    }

    /* Resend n'accepte que [A-Za-z0-9_-] dans une valeur de tag : on filtre au
       lieu de faire confiance au client, sinon un identifiant exotique ferait
       échouer tout l'envoi et pas seulement le suivi. */
    const safeCampaignId = String(campaignId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    const bizName = sanitizeHeaderValue(business.name);
    const from = `${bizName} via Efficience <campagnes@${process.env.EMAIL_FROM_DOMAIN}>`;
    const replyTo = business.email && EMAIL_RE.test(business.email) ? business.email : undefined;

    const results = [];
    for (const group of chunk(recipients, EMAIL_BATCH_SIZE)) {
      const emails = group.map((c) => {
        const unsubUrl = unsubscribeUrl(host, spaceId, c.email, safeCampaignId);
        const paras = bodyParagraphs.map((p) => personalize(p, c));
        return {
          from, to: [c.email], reply_to: replyTo,
          subject: personalize(subject, c),
          html: buildEmailHtml({ host, business, subject, preheader, headline: personalize(headline, c), bodyParagraphs: paras, cta, ctaUrl, unsubUrl }),
          text: buildEmailText({ business, headline: personalize(headline, c), bodyParagraphs: paras, cta, ctaUrl, unsubUrl }),
          headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          /* Marquage : c'est par ces tags que le webhook rattache une ouverture
             ou un clic à sa campagne. Sans eux, l'événement arrive orphelin et
             n'est comptabilisé nulle part. */
          ...(safeCampaignId ? { tags: [
            { name: 'space_id', value: String(spaceId) },
            { name: 'campaign_id', value: safeCampaignId },
          ] } : {}),
        };
      });
      try {
        // Les lots partent en séquence (et non en Promise.all) pour respecter
        // la limite de débit de Resend.
        const d = await resendSendBatch(emails);
        const ids = (d && d.data) || [];
        group.forEach((c, i) => results.push({ email: c.email, ok: true, id: ids[i]?.id }));
      } catch (e) {
        const reason = String((e && e.message) || e);
        console.error('[email/send] Resend batch failed', { spaceId, from, groupSize: group.length, reason });
        group.forEach((c) => results.push({ email: c.email, ok: false, reason }));
      }
    }

    const sent = results.filter((r) => r.ok).length;
    if (sent === 0) console.error('[email/send] all recipients failed', { spaceId, from, results });
    return { ok: sent > 0, status: 200, sent, failed: results.length - sent, total: results.length, results };
  } catch (e) {
    console.error('[email/send] unhandled error', { spaceId, reason: String(e && e.message || e) });
    return { ok: false, status: 500, reason: String((e && e.message) || e) };
  }
}

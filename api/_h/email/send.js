/* Sends a real campaign e-mail via Resend to a list of real contacts.
   POST { spaceId, business:{name,email,addressLine}, subject, preheader,
          headline, bodyParagraphs:string[], cta?, ctaUrl?,
          contacts:[{id,email,first,name}] }
   Degrades to { ok:false, reason } (200) when Resend isn't configured yet,
   consistent with every other provider-backed endpoint in this app —
   never a hard error the client has to special-case. */
import { query, checkEmailQuota } from '../db.js';
import { requireSession } from '../requireSession.js';
import {
  cors, json, readBody, resendSendBatch, chunk, EMAIL_BATCH_SIZE,
  personalize, unsubscribeUrl, buildEmailHtml, buildEmailText, filterUnsubscribed,
} from './_shared.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Strips characters that could smuggle extra headers into a raw SMTP
// message (CRLF injection) if they ended up in a From/Reply-To display name.
const sanitizeHeaderValue = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { spaceId, business, subject, preheader, headline, bodyParagraphs, cta, ctaUrl, contacts } = body || {};
  if (!spaceId || !business?.name || !subject || !headline || !Array.isArray(bodyParagraphs) || !bodyParagraphs.length) {
    return json(res, 400, { ok: false, reason: 'spaceId, business, subject, headline et bodyParagraphs sont requis.' });
  }
  if (!Array.isArray(contacts) || !contacts.length) return json(res, 400, { ok: false, reason: 'Aucun destinataire.' });

  const session = requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }));
  if (!session) return;

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM_DOMAIN) {
    return json(res, 200, { ok: false, reason: 'Envoi e-mail non configuré (RESEND_API_KEY / EMAIL_FROM_DOMAIN manquants côté serveur).' });
  }

  try {
    const owns = await query(`SELECT id FROM app_spaces WHERE id = $1 AND user_id = $2`, [spaceId, session.userId]);
    if (!owns.rows.length) return json(res, 403, { ok: false, reason: 'Espace introuvable.' });

    // Only real, well-formed, not-already-unsubscribed addresses — never a
    // best-effort client-side filter alone (see filterUnsubscribed).
    const withValidEmail = contacts.filter((c) => c && c.email && EMAIL_RE.test(c.email));
    const recipients = await filterUnsubscribed(spaceId, withValidEmail);
    if (!recipients.length) {
      console.error('[email/send] no valid recipients', { spaceId, total: contacts.length, withValidEmail: withValidEmail.length });
      return json(res, 200, { ok: false, reason: 'Aucun destinataire valide (adresses manquantes, invalides ou désinscrites).' });
    }

    const quota = await checkEmailQuota(session.userId, recipients.length);
    if (!quota.ok) {
      console.error('[email/send] quota exceeded', { userId: session.userId, requested: recipients.length, limit: quota.limit });
      return json(res, 200, { ok: false, reason: `Quota d'envoi quotidien atteint (${quota.limit} e-mails/jour). Réessayez demain.` });
    }

    const bizName = sanitizeHeaderValue(business.name);
    const from = `${bizName} via Efficience <campagnes@${process.env.EMAIL_FROM_DOMAIN}>`;
    const replyTo = business.email && EMAIL_RE.test(business.email) ? business.email : undefined;
    const host = req.headers.host;

    const results = [];
    for (const group of chunk(recipients, EMAIL_BATCH_SIZE)) {
      const emails = group.map((c) => {
        const unsubUrl = unsubscribeUrl(host, spaceId, c.email);
        const paras = bodyParagraphs.map((p) => personalize(p, c));
        return {
          from, to: [c.email], reply_to: replyTo,
          subject: personalize(subject, c),
          html: buildEmailHtml({ host, business, subject, preheader, headline: personalize(headline, c), bodyParagraphs: paras, cta, ctaUrl, unsubUrl }),
          text: buildEmailText({ business, headline: personalize(headline, c), bodyParagraphs: paras, cta, ctaUrl, unsubUrl }),
          headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        };
      });
      try {
        // Chunks go sequentially (not Promise.all) to respect Resend's rate limit.
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
    return json(res, 200, { ok: sent > 0, sent, failed: results.length - sent, total: results.length, results });
  } catch (e) {
    console.error('[email/send] unhandled error', { spaceId, reason: String(e && e.message || e) });
    return json(res, 500, { ok: false, reason: String(e && e.message || e) });
  }
}

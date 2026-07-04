/* Shared helpers for the campaign-sending endpoints (send.js, unsubscribe.js).
   Provider: Resend — simple HTTP API, first-class custom-domain support
   (SPF/DKIM it signs for you once the domain is verified), and a real
   batch-send endpoint that keeps a whole campaign inside one Vercel function
   call instead of one round-trip per recipient.

   Anti-spam design, not just "sends an email":
   - From a verified sending domain (EMAIL_FROM_DOMAIN) with the business
     name in the display name and Reply-To set to the business's own
     address — recipients see who's really writing, replies reach the
     right inbox, and the domain in "from" matches what's authenticated.
   - List-Unsubscribe + List-Unsubscribe-Post headers (RFC 8058 one-click) —
     Gmail/Yahoo have required this for bulk senders since Feb 2024;
     without it, messages are far more likely to land in spam regardless
     of content.
   - Real multipart (html + text) — text-only inboxes and spam filters that
     penalize HTML-only mail both get a proper alternative.
   - A visible unsubscribe link + physical business address in the footer —
     required by CAN-SPAM/RGPD, not just good practice. */
import { getUnsubscribedSet, makeUnsubToken } from '../db.js';

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
export function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
}

const RETRY_STATUS = new Set([429, 500, 502, 503]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_BATCH = 100; // Resend's batch-send limit per call.

/* POST a batch of already-built emails to Resend, with retry on transient
   errors. Each item: { from, to, replyTo, subject, html, text, headers }. */
export async function resendSendBatch(emails, { retries = 2 } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY non configurée');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let httpStatus = 0;
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(emails),
      });
      httpStatus = r.status;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error((d && d.message) || `Resend HTTP ${r.status}`), { status: r.status });
      return d;
    } catch (e) {
      lastErr = e;
      const retriable = RETRY_STATUS.has(e.status || httpStatus);
      if (retriable && attempt < retries) { await sleep(400 * 3 ** attempt); continue; }
      throw lastErr;
    }
  }
  throw lastErr;
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
export const EMAIL_BATCH_SIZE = MAX_BATCH;

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* {prenom} is the only placeholder the AI/template layer emits (see
   Campagnes.tsx) — replaced per recipient right before sending. */
export function personalize(text, contact) {
  const first = (contact && (contact.first || contact.name)) || 'client';
  return String(text || '').replaceAll('{prenom}', first);
}

export function unsubscribeUrl(host, spaceId, email) {
  const token = makeUnsubToken(spaceId, email);
  return `https://${host}/api/email/unsubscribe?s=${spaceId}&e=${encodeURIComponent(email)}&t=${token}`;
}

/* Self-contained HTML e-mail — table layout + inline styles throughout
   (many clients, Outlook especially, strip <style> blocks or mis-render
   flex/grid), so nothing critical depends on a stylesheet surviving. */
export function buildEmailHtml({ host, business, subject, preheader, headline, bodyParagraphs, cta, ctaUrl, unsubUrl }) {
  const logo = `https://${host}/assets/logo-white.png`;
  const paras = bodyParagraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#292b25;">${p}</p>`).join('');
  const addr = [business.name, business.addressLine].filter(Boolean).join(' · ');
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f2;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f2;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#3c5233;padding:24px 32px;"><img src="${logo}" alt="${escapeHtml(business.name)}" height="28" style="display:block;border:0;"></td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#14150f;">${escapeHtml(headline)}</h1>
${paras}
${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td style="border-radius:6px;background:#5b7550;"><a href="${escapeHtml(ctaUrl || '#')}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(cta)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e0e3d9;font-size:12px;line-height:1.6;color:#71755f;">
${escapeHtml(addr)}<br>
Vous recevez cet e-mail car vous êtes client·e de ${escapeHtml(business.name)}.
<a href="${unsubUrl}" style="color:#5b7550;">Se désinscrire</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function buildEmailText({ business, headline, bodyParagraphs, cta, ctaUrl, unsubUrl }) {
  const addr = [business.name, business.addressLine].filter(Boolean).join(' · ');
  const lines = [headline, '', ...bodyParagraphs.map((p) => p.replace(/<[^>]+>/g, '')), ''];
  if (cta) lines.push(`${cta} : ${ctaUrl || ''}`, '');
  lines.push('—', addr, `Vous recevez cet e-mail car vous êtes client·e de ${business.name}.`, `Se désinscrire : ${unsubUrl}`);
  return lines.join('\n');
}

/* Server-side final filter — never trust the client-supplied recipient list
   blindly for suppression, even though it already screens on local
   `consent`. This is the one source of truth that can't go stale between
   a contact unsubscribing and the next time the sender's browser syncs. */
export async function filterUnsubscribed(spaceId, contacts) {
  const withEmail = contacts.filter((c) => c.email);
  const unsub = await getUnsubscribedSet(spaceId, withEmail.map((c) => c.email));
  return withEmail.filter((c) => !unsub.has(c.email.toLowerCase()));
}

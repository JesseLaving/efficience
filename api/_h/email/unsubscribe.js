/* Public unsubscribe endpoint — no Efficience login involved, the recipient
   isn't an Efficience user. Authenticity comes from the signed token in the
   link (see makeUnsubToken/verifyUnsubToken in db.js), not from a session.
   GET  → human clicks the footer link: record the unsubscribe, show a plain
          confirmation page.
   POST → mail client's one-click unsubscribe (RFC 8058, triggered by the
          List-Unsubscribe-Post header) — same effect, silent 200, no body
          content needed since no human ever sees this response. */
import { verifyUnsubToken, addUnsubscribe } from '../db.js';

function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

function page(title, message) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f2;margin:0;padding:60px 20px;text-align:center;color:#292b25;">
<div style="max-width:420px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
<h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
<p style="font-size:14px;color:#5c6152;line-height:1.6;margin:0;">${message}</p>
</div></body></html>`;
}

export default async function handler(req, res) {
  const spaceId = parseInt(getParam(req, 's') || '', 10);
  const email = getParam(req, 'e') || '';
  const token = getParam(req, 't') || '';

  const html = (status, title, message) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(page(title, message));
  };

  if (!spaceId || !email || !verifyUnsubToken(spaceId, email, token)) {
    if (req.method === 'POST') { res.statusCode = 200; res.end(); return; }
    return html(400, 'Lien invalide', 'Ce lien de désinscription n’est pas valide ou a expiré.');
  }

  try {
    await addUnsubscribe(spaceId, email);
  } catch {
    if (req.method === 'POST') { res.statusCode = 200; res.end(); return; }
    return html(500, 'Erreur', 'Une erreur est survenue. Réessayez plus tard.');
  }

  if (req.method === 'POST') { res.statusCode = 200; res.end(); return; }
  return html(200, 'Vous êtes désinscrit·e', `L’adresse ${email} ne recevra plus d’e-mails de cette entreprise.`);
}

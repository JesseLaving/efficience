/* Single Vercel function routing all /api/email/* actions. */
import send from '../_h/email/send.js';
import unsubscribe from '../_h/email/unsubscribe.js';

const MAP = { send, unsubscribe };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `email action inconnue: ${action}` })); return; }
  return h(req, res);
}

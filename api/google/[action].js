/* Single Vercel function routing all /api/google/* actions. */
import login from '../_h/google/login.js';
import callback from '../_h/google/callback.js';
import refresh from '../_h/google/refresh.js';
import accounts from '../_h/google/accounts.js';
import post from '../_h/google/post.js';

const MAP = { login, callback, refresh, accounts, post };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `google action inconnue: ${action}` })); return; }
  return h(req, res);
}

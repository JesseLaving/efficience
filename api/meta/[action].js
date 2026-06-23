/* Single Vercel function routing all /api/meta/* actions (keeps the function
   count under the Hobby 12-function limit). Handlers live in api/_h/ which
   Vercel ignores as routes. */
import login from '../_h/meta/login.js';
import callback from '../_h/meta/callback.js';
import accounts from '../_h/meta/accounts.js';
import stats from '../_h/meta/stats.js';

const MAP = { login, callback, accounts, stats };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `meta action inconnue: ${action}` })); return; }
  return h(req, res);
}

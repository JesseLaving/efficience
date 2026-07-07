/* Single Vercel function routing all /api/linkedin/* actions. */
import login from '../_h/linkedin/login.js';
import callback from '../_h/linkedin/callback.js';
import me from '../_h/linkedin/me.js';
import post from '../_h/linkedin/post.js';
import organizations from '../_h/linkedin/organizations.js';

const MAP = { login, callback, me, post, organizations };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `linkedin action inconnue: ${action}` })); return; }
  return h(req, res);
}

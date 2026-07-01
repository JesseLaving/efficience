/* Single Vercel function routing all /api/tiktok/* actions. */
import login from '../_h/tiktok/login.js';
import callback from '../_h/tiktok/callback.js';
import userinfo from '../_h/tiktok/userinfo.js';
import creatorinfo from '../_h/tiktok/creatorinfo.js';
import videoinit from '../_h/tiktok/videoinit.js';
import refresh from '../_h/tiktok/refresh.js';

const MAP = { login, callback, userinfo, creatorinfo, videoinit, refresh };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `tiktok action inconnue: ${action}` })); return; }
  return h(req, res);
}

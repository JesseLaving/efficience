/* Single Vercel function routing all /api/spaces/* actions. */
import list from '../_h/spaces/list.js';
import create from '../_h/spaces/create.js';
import rename from '../_h/spaces/rename.js';
import del from '../_h/spaces/delete.js';
import data from '../_h/spaces/data.js';
import me from '../_h/spaces/me.js';
import logout from '../_h/spaces/logout.js';

const MAP = { list, create, rename, delete: del, data, me, logout };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `spaces action inconnue: ${action}` })); return; }
  return h(req, res);
}

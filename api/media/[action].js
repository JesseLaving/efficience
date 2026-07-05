/* Single Vercel function routing all /api/media/* actions — regroupe trois
   endpoints jusqu'ici indépendants (preview, stock, upload) pour rester sous
   la limite de 12 fonctions serverless du plan Hobby Vercel (voir les autres
   routeurs [action].js du dossier api/ pour le même motif). */
import preview from '../_h/media/preview.js';
import stock from '../_h/media/stock.js';
import upload from '../_h/media/upload.js';

const MAP = { preview, stock, upload };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `media action inconnue: ${action}` })); return; }
  return h(req, res);
}

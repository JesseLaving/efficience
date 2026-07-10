/* Single Vercel function routing all /api/ai/* actions. */
import generate from '../_h/ai/generate.js';
import image from '../_h/ai/image.js';
import imagefree from '../_h/ai/imagefree.js';
import plan from '../_h/ai/plan.js';

const MAP = { generate, image, imagefree, plan };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `ai action inconnue: ${action}` })); return; }
  return h(req, res);
}

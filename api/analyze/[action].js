/* Single Vercel function routing /api/analyze/company, /api/analyze/site and
   /api/analyze/competitors — small, standalone GET analysis endpoints
   (SIRENE company lookup, website/PageSpeed analysis, real competitors via
   the same SIRENE-backed API) merged here to free a function slot under the
   Vercel Hobby plan's 12-function cap. */
import company from '../_h/analyze/company.js';
import site from '../_h/analyze/site.js';
import competitors from '../_h/analyze/competitors.js';

const MAP = { company, site, competitors };

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `analyze action inconnue: ${action}` })); return; }
  return h(req, res);
}

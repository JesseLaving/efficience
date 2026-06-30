/* Shared helpers for the spaces endpoints. */
import { readSession } from '../db.js';

export function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export function readBody(req) {
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
}

export function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export function requireSession(req, res) {
  const session = readSession(req.headers.cookie);
  if (!session || !session.userId) { json(res, 401, { error: 'Non authentifié' }); return null; }
  return session;
}

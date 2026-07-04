/* Google Calendar — crée un nouvel agenda dédié au planning éditorial
   (calendars.insert). Un agenda séparé plutôt qu'écrire dans l'agenda
   principal de l'utilisateur : facile à masquer/supprimer sans toucher à
   son agenda personnel. POST { token, name }. */
import { requireSession } from '../requireSession.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, name } = body || {};
  if (!token || !name || !name.trim()) return json(res, 400, { ok: false, reason: 'token et name requis.' });
  if (!requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }))) return;

  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: name.trim(), timeZone: 'Europe/Paris' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) return json(res, 200, { ok: false, reason: (d.error && d.error.message) || `HTTP ${r.status}` });
    return json(res, 200, { ok: true, calendarId: d.id, summary: d.summary });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String(e && e.message || e) });
  }
}

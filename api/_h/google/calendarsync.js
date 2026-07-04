/* Google Calendar — pousse les publications programmées (planning éditorial)
   vers l'agenda dédié, un événement par publication. Insère un nouvel
   événement si la publication n'a jamais été synchronisée (pas de
   googleEventId), sinon met à jour l'événement existant (patch) — la
   synchronisation est donc idempotente : la relancer ne duplique rien.
   POST { token, calendarId, events: [{ id, dateTime, text, networks, googleEventId? }] } */
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

const MAX_EVENTS = 60;
const DURATION_MIN = 30;

function eventBody(item) {
  const start = `${item.dateTime}:00`;
  const startDate = new Date(start);
  const end = new Date(startDate.getTime() + DURATION_MIN * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  const endIso = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;
  const nets = (item.networks || []).join(', ') || 'aucun réseau sélectionné';
  return {
    summary: (item.text || '').trim().slice(0, 100) || 'Publication programmée',
    description: `${item.text || ''}\n\nRéseaux : ${nets}`,
    start: { dateTime: start, timeZone: 'Europe/Paris' },
    end: { dateTime: endIso, timeZone: 'Europe/Paris' },
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, calendarId, events } = body || {};
  if (!token || !calendarId) return json(res, 400, { ok: false, reason: 'token et calendarId requis.' });
  if (!Array.isArray(events) || !events.length) return json(res, 400, { ok: false, reason: 'events requis.' });
  if (events.length > MAX_EVENTS) return json(res, 400, { ok: false, reason: `${MAX_EVENTS} publications maximum par synchronisation.` });
  if (!requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }))) return;

  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const results = [];
  for (const item of events) {
    try {
      const payload = eventBody(item);
      const url = item.googleEventId ? `${base}/${encodeURIComponent(item.googleEventId)}` : base;
      const r = await fetch(url, {
        method: item.googleEventId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { results.push({ id: item.id, ok: false, reason: (d.error && d.error.message) || `HTTP ${r.status}` }); continue; }
      results.push({ id: item.id, ok: true, googleEventId: d.id });
    } catch (e) {
      results.push({ id: item.id, ok: false, reason: String(e && e.message || e) });
    }
  }
  return json(res, 200, { ok: results.some((r) => r.ok), results });
}

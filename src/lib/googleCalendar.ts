import { API_BASE } from './api';

/* ---------- Google Agenda — connexion persistante (comme YouTube / Business Profile) ---------- */

const TLS = 'eff_gcal_token', RLS = 'eff_gcal_refresh', CLS = 'eff_gcal_calendar_id', NLS = 'eff_gcal_calendar_name';
export const getStoredGcalToken = () => localStorage.getItem(TLS);
export const getStoredGcalRefresh = () => localStorage.getItem(RLS);
export const setStoredGcal = (t: string, r?: string) => { localStorage.setItem(TLS, t); if (r) localStorage.setItem(RLS, r); };
export const clearStoredGcal = () => {
  localStorage.removeItem(TLS); localStorage.removeItem(RLS); localStorage.removeItem(CLS); localStorage.removeItem(NLS);
};
export const getStoredGcalCalendarId = () => localStorage.getItem(CLS);
export const getStoredGcalCalendarName = () => localStorage.getItem(NLS);
export const setStoredGcalCalendar = (id: string, name: string) => { localStorage.setItem(CLS, id); localStorage.setItem(NLS, name); };

export function gcalLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/google/calendarlogin?return=${encodeURIComponent(ret)}`;
}

/* ---------- Création de l'agenda dédié ---------- */

export interface GcalCreateResult { ok: boolean; calendarId?: string; summary?: string; reason?: string; }

export async function createEditorialCalendar(token: string, name: string): Promise<GcalCreateResult> {
  const r = await fetch(`${API_BASE}/google/calendarcreate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name }),
  });
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur.' }));
}

/* ---------- Synchronisation des publications programmées ---------- */

export interface GcalSyncItem { id: string; dateTime: string; text: string; networks: string[]; googleEventId?: string | null; }
export interface GcalSyncResultItem { id: string; ok: boolean; googleEventId?: string; reason?: string; }
export interface GcalSyncResponse { ok: boolean; results?: GcalSyncResultItem[]; reason?: string; }

export async function syncPostsToCalendar(token: string, calendarId: string, events: GcalSyncItem[]): Promise<GcalSyncResponse> {
  const r = await fetch(`${API_BASE}/google/calendarsync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, calendarId, events }),
  });
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur.' }));
}

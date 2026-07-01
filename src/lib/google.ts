import { API_BASE } from './api';
import type { Contact } from './contacts';

const TLS = 'eff_google_token', RLS = 'eff_google_refresh';
export const getStoredGoogleToken = () => localStorage.getItem(TLS);
export const getStoredGoogleRefresh = () => localStorage.getItem(RLS);
export const setStoredGoogle = (t: string, r?: string) => { localStorage.setItem(TLS, t); if (r) localStorage.setItem(RLS, r); };
export const clearStoredGoogle = () => { localStorage.removeItem(TLS); localStorage.removeItem(RLS); };

export function googleLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/google/login?return=${encodeURIComponent(ret)}`;
}

export interface GoogleLocation {
  account: string; location: string; path: string;
  title: string | null; address: string | null; website: string | null;
}
export interface GoogleAccountsResponse { available: boolean; reason?: string | null; accounts: GoogleLocation[]; }

export async function fetchGoogleAccounts(token: string): Promise<GoogleAccountsResponse> {
  const r = await fetch(`${API_BASE}/google/accounts?token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || `HTTP ${r.status}`);
  return d as GoogleAccountsResponse;
}

export async function refreshGoogle(refresh: string): Promise<string> {
  const r = await fetch(`${API_BASE}/google/refresh?refresh=${encodeURIComponent(refresh)}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'refresh');
  return d.token as string;
}

export interface PublishPayload {
  token: string; path: string; summary: string;
  actionType?: string; url?: string; photoUrl?: string;
}
export interface PublishResult { ok?: boolean; reason?: string; post?: { name: string | null; state: string | null; searchUrl: string | null }; error?: string; }

export async function publishGooglePost(payload: PublishPayload): Promise<PublishResult> {
  const r = await fetch(`${API_BASE}/google/post`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return r.json();
}

/* ---------- Google Contacts (import, lecture seule, one-shot) ---------- */

export function googleContactsLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/google/contactslogin?return=${encodeURIComponent(ret)}`;
}

/* Lit le token/erreur de retour OAuth (hash `gc_token`/`gc_error`) sans
   toucher aux autres paramètres de hash (gérés séparément par
   ConnectionsContext). À appeler une fois au montage de l'écran Contacts. */
export function consumeGoogleContactsHash(): { token: string | null; error: string | null } {
  if (!location.hash) return { token: null, error: null };
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get('gc_token');
  const error = h.get('gc_error');
  if (token || error) {
    h.delete('gc_token'); h.delete('gc_error');
    const rest = h.toString();
    history.replaceState(null, '', location.pathname + location.search + (rest ? '#' + rest : ''));
  }
  return { token, error };
}

export interface RawGoogleContact { first: string; last: string; name: string; email: string; phone: string | null; city: string | null; }
export interface GoogleContactsResponse { available: boolean; reason?: string | null; contacts: RawGoogleContact[]; }

export async function fetchGoogleContacts(token: string): Promise<GoogleContactsResponse> {
  const r = await fetch(`${API_BASE}/google/contactsfetch?token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || `HTTP ${r.status}`);
  return d as GoogleContactsResponse;
}

let gcCounter = 0;
export function mapGoogleContacts(raw: RawGoogleContact[]): Contact[] {
  return raw.map((p) => {
    gcCounter++;
    const name = (p.first + ' ' + p.last).trim() || p.name || p.email;
    return {
      id: `gc_${gcCounter}_${(p.email || name).toLowerCase()}`,
      first: p.first || name.split(' ')[0] || '',
      last: p.last || name.split(' ').slice(1).join(' '),
      name, email: (p.email || '').toLowerCase(),
      phone: p.phone || undefined, city: p.city || undefined,
      consent: null, tags: [], source: 'google' as const,
    };
  });
}

/* ---------- YouTube (connexion persistante, stats de chaîne) ---------- */

const YTLS = 'eff_yt_token', YRLS = 'eff_yt_refresh';
export const getStoredYoutubeToken = () => localStorage.getItem(YTLS);
export const getStoredYoutubeRefresh = () => localStorage.getItem(YRLS);
export const setStoredYoutube = (t: string, r?: string) => { localStorage.setItem(YTLS, t); if (r) localStorage.setItem(YRLS, r); };
export const clearStoredYoutube = () => { localStorage.removeItem(YTLS); localStorage.removeItem(YRLS); };

export function youtubeLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/google/youtubelogin?return=${encodeURIComponent(ret)}`;
}

export interface YoutubeChannel {
  id: string; title: string | null; thumbnail: string | null;
  subscribers: number | null; views: number | null; videos: number | null;
}
export interface YoutubeChannelResponse { available: boolean; reason?: string | null; channel: YoutubeChannel | null; }

export async function fetchYoutubeChannel(token: string): Promise<YoutubeChannelResponse> {
  const r = await fetch(`${API_BASE}/google/youtubechannel?token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || `HTTP ${r.status}`);
  return d as YoutubeChannelResponse;
}

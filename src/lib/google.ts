import { API_BASE } from './api';

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

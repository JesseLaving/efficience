import { API_BASE } from './api';

export interface MetaAccount {
  network: 'instagram' | 'facebook';
  id: string;
  name: string | null;
  followers: number | null;
  handle?: string | null;
  mediaCount?: number | null;
  picture?: string | null;
  biography?: string | null;
  url?: string | null;
}
export interface MetaAccountsResponse { user: string | null; accounts: MetaAccount[]; }

const LS = 'eff_meta_token';
export const getStoredMetaToken = () => localStorage.getItem(LS);
export const setStoredMetaToken = (t: string) => localStorage.setItem(LS, t);
export const clearStoredMetaToken = () => localStorage.removeItem(LS);

/** Start the Meta OAuth flow (full-page redirect). Comes back to this exact
 *  app URL with the token (or error) in the URL hash. */
export function metaLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/meta/login?return=${encodeURIComponent(ret)}`;
}

/** Read meta_token / meta_error from the URL hash after the OAuth bounce,
 *  store the token, and clean the URL. Returns what it found. */
export function captureMetaHash(): { token?: string; error?: string } {
  if (!location.hash) return {};
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get('meta_token') || undefined;
  const error = h.get('meta_error') || undefined;
  if (token || error) {
    if (token) setStoredMetaToken(token);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return { token, error };
}

export async function fetchMetaAccounts(token: string): Promise<MetaAccountsResponse> {
  const r = await fetch(`${API_BASE}/meta/accounts?token=${encodeURIComponent(token)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as MetaAccountsResponse;
}

export interface MetaPost {
  id: string; network: 'instagram' | 'facebook'; type: string;
  caption: string; date: string | null; permalink: string | null; image: string | null;
  likes: number | null; comments: number | null; shares: number | null;
}
export interface MetaStatAccount {
  network: 'instagram' | 'facebook'; name: string | null; followers: number | null; mediaCount: number | null;
  summary: { posts: number; likes: number; comments: number; shares: number; avgEngagement: number; engagementRate: number | null };
  posts: MetaPost[];
}
export interface MetaStatsResponse { accounts: MetaStatAccount[]; }

export async function fetchMetaStats(token: string): Promise<MetaStatsResponse> {
  const r = await fetch(`${API_BASE}/meta/stats?token=${encodeURIComponent(token)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as MetaStatsResponse;
}

import { API_BASE } from './api';

const TLS = 'eff_li_token';
export const getStoredLiToken = () => localStorage.getItem(TLS);
export const setStoredLiToken = (t: string) => localStorage.setItem(TLS, t);
export const clearStoredLiToken = () => localStorage.removeItem(TLS);

export function linkedinLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/linkedin/login?return=${encodeURIComponent(ret)}`;
}

export interface LinkedInMe { sub: string | null; name: string | null; picture: string | null; email: string | null; }

export async function fetchLinkedInMe(token: string): Promise<LinkedInMe> {
  const r = await fetch(`${API_BASE}/linkedin/me?token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d as LinkedInMe;
}

export interface LinkedInOrg { id: string; name: string | null; vanityName: string | null; }
export interface LinkedInOrgsResponse { available: boolean; reason?: string; organizations: LinkedInOrg[]; }

/** Company Pages the connected member administers — empty (not an error) if
 *  the account has none, or if LinkedIn hasn't approved organization scopes
 *  yet (see LINKEDIN_ORG_SCOPES in api/_h/linkedin/login.js). */
export async function fetchLinkedInOrganizations(token: string): Promise<LinkedInOrgsResponse> {
  const r = await fetch(`${API_BASE}/linkedin/organizations?token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { available: false, reason: d.error || `HTTP ${r.status}`, organizations: [] };
  return d as LinkedInOrgsResponse;
}

export interface LiPostResult { ok?: boolean; reason?: string; id?: string | null; url?: string | null; error?: string; }

export async function publishLinkedInPost(token: string, text: string, photoUrl?: string | null, organizationId?: string | null): Promise<LiPostResult> {
  const r = await fetch(`${API_BASE}/linkedin/post`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, text, photoUrl: photoUrl || undefined, organizationId: organizationId || undefined }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok && !d.error && !d.reason) return { error: `HTTP ${r.status}` };
  return d as LiPostResult;
}

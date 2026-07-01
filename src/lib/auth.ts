/* Authentication and space management (client side). */

export interface AuthUser {
  userId: number;
  email?: string;
  name?: string;
}

export interface Space {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export function loginWithGoogle() {
  const ret = window.location.origin + window.location.pathname;
  window.location.href = `/api/google/authlogin?return=${encodeURIComponent(ret)}`;
}

export async function logout() {
  try { await fetch('/api/spaces/logout', { method: 'POST' }); } catch { /* ignore */ }
  // Sans ça, les données du compte (contacts, calendrier, tokens réseaux)
  // restent en clair dans le navigateur pour la prochaine personne qui se
  // connecte sur cet appareil — un vrai risque sur un poste partagé.
  try { localStorage.clear(); } catch { /* ignore */ }
  window.location.href = '/';
}

/** Returns the signed-in user, or null if not authenticated. Authoritative
 *  (server verifies the signed cookie) — don't trust the cookie client-side. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const r = await fetch('/api/spaces/me');
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function getSpaces(): Promise<Space[]> {
  const r = await fetch('/api/spaces/list');
  if (!r.ok) throw new Error('Failed to fetch spaces');
  const { spaces } = await r.json();
  return spaces;
}

export async function createSpace(name: string): Promise<Space> {
  const r = await fetch('/api/spaces/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error('Failed to create space');
  return r.json();
}

export async function getSpaceData(spaceId: number): Promise<Record<string, unknown>> {
  const r = await fetch(`/api/spaces/data?spaceId=${spaceId}`);
  if (!r.ok) throw new Error('Failed to fetch space data');
  return r.json();
}

export async function saveSpaceData(spaceId: number, data: Record<string, unknown>): Promise<void> {
  const r = await fetch(`/api/spaces/data?spaceId=${spaceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error('Failed to save space data');
}

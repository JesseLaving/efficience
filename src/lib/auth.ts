/* Authentication and space management. */

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Space {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function loginWithGoogle() {
  window.location.href = '/api/auth/google/login';
}

export async function logout() {
  document.cookie = 'session=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
  window.location.href = '/';
}

export async function getSpaces(): Promise<Space[]> {
  const r = await fetch('/api/spaces');
  if (!r.ok) throw new Error('Failed to fetch spaces');
  const { spaces } = await r.json();
  return spaces;
}

export async function createSpace(name: string): Promise<Space> {
  const r = await fetch('/api/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error('Failed to create space');
  return r.json();
}

export async function getSpaceData(spaceId: number): Promise<Record<string, any>> {
  const r = await fetch(`/api/spaces/data?spaceId=${spaceId}`);
  if (!r.ok) throw new Error('Failed to fetch space data');
  return r.json();
}

export async function saveSpaceData(spaceId: number, data: Record<string, any>): Promise<void> {
  const r = await fetch(`/api/spaces/data?spaceId=${spaceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error('Failed to save space data');
}

export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('session=');
}

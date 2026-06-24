import { API_BASE } from './api';

export interface ArmTokens {
  meta?: string | null;
  linkedin?: string | null;
  google?: { token: string; refresh?: string | null; paths: string[] } | null;
}
export interface ArmPost {
  id: string; whenMs: number; dateTime?: string;
  text: string; networks: string[]; photoUrl?: string | null; pillar?: string | null;
}
export interface ArmResult { ok: boolean; reason?: string; id?: string }

/* Arme un post pour l'auto-publication serveur (stocke post + tokens en KV). */
export async function armAutoPublish(post: ArmPost, tokens: ArmTokens): Promise<ArmResult> {
  const r = await fetch(`${API_BASE}/schedule/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post, tokens }),
  });
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur de programmation.' }));
}

export async function disarmAutoPublish(id: string): Promise<{ ok: boolean; reason?: string }> {
  const r = await fetch(`${API_BASE}/schedule/remove`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
  });
  return r.json().catch(() => ({ ok: false }));
}

export interface ServerPost { id: string; whenMs: number; status: string; lastResult?: string | null; }
export async function listServerScheduled(): Promise<{ ok: boolean; posts?: ServerPost[]; reason?: string }> {
  const r = await fetch(`${API_BASE}/schedule/list`);
  return r.json().catch(() => ({ ok: false, posts: [] }));
}

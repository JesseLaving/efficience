import { API_BASE } from './api';

/* Même clé que AuthWrapper.ACTIVE_KEY — l'espace actif est déjà connu du
   navigateur, pas besoin de le faire remonter depuis les écrans appelants. */
const ACTIVE_SPACE_KEY = 'eff_active_space';
const activeSpaceId = (): number | null => {
  const v = localStorage.getItem(ACTIVE_SPACE_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

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

/* Arme un post pour l'auto-publication serveur (stocke post + tokens en KV,
   scopés à l'espace actif — jamais visible depuis un autre espace/compte). */
export async function armAutoPublish(post: ArmPost, tokens: ArmTokens): Promise<ArmResult> {
  const spaceId = activeSpaceId();
  if (!spaceId) return { ok: false, reason: 'Aucun espace actif.' };
  const r = await fetch(`${API_BASE}/schedule/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spaceId, post, tokens }),
  });
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur de programmation.' }));
}

export async function disarmAutoPublish(id: string): Promise<{ ok: boolean; reason?: string }> {
  const spaceId = activeSpaceId();
  if (!spaceId) return { ok: false, reason: 'Aucun espace actif.' };
  const r = await fetch(`${API_BASE}/schedule/remove`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spaceId, id }),
  });
  return r.json().catch(() => ({ ok: false }));
}

export interface ServerPost { id: string; whenMs: number; status: string; lastResult?: string | null; }
export async function listServerScheduled(): Promise<{ ok: boolean; posts?: ServerPost[]; reason?: string }> {
  const spaceId = activeSpaceId();
  if (!spaceId) return { ok: false, posts: [] };
  const r = await fetch(`${API_BASE}/schedule/list?spaceId=${spaceId}`);
  return r.json().catch(() => ({ ok: false, posts: [] }));
}

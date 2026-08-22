import { API_BASE } from "./api";

/* Même clé que AuthWrapper.ACTIVE_KEY — l'espace actif est déjà connu du
   navigateur, pas besoin de le faire remonter depuis les écrans appelants. */
const ACTIVE_SPACE_KEY = "eff_active_space";
const activeSpaceId = (): number | null => {
  const v = localStorage.getItem(ACTIVE_SPACE_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

export interface ArmTokens {
  meta?: string | null;
  linkedin?: string | null;
  google?: { token: string; refresh?: string | null; paths: string[] } | null;
  /* Échéances (ms depuis epoch) des jetons sans renouvellement automatique :
     le cron peut ainsi distinguer « jeton expiré, reconnectez » d'une panne
     du réseau social, au lieu de renvoyer une erreur d'API illisible. */
  expiry?: { meta?: number | null; linkedin?: number | null };
}
export interface ArmPost {
  id: string;
  whenMs: number;
  dateTime?: string;
  text: string;
  networks: string[];
  photoUrl?: string | null;
  pillar?: string | null;
}
export interface ArmResult {
  ok: boolean;
  reason?: string;
  id?: string;
}

/* Arme un post pour l'auto-publication serveur (stocke post + tokens en KV,
   scopés à l'espace actif — jamais visible depuis un autre espace/compte). */
export async function armAutoPublish(post: ArmPost, tokens: ArmTokens): Promise<ArmResult> {
  const spaceId = activeSpaceId();
  if (!spaceId) return { ok: false, reason: "Aucun espace actif." };
  const r = await fetch(`${API_BASE}/schedule/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spaceId, post, tokens }),
  });
  const d = await r.json().catch(() => null);
  // Un statut HTTP d'erreur sans champ ok explicite (page 500, session expirée…)
  // doit compter comme un échec — pas comme un armement réussi.
  if (!r.ok) return { ok: false, reason: (d && (d.reason || d.error)) || `HTTP ${r.status}` };
  return d ?? { ok: false, reason: "Réponse invalide du serveur de programmation." };
}

export async function disarmAutoPublish(id: string): Promise<{ ok: boolean; reason?: string }> {
  const spaceId = activeSpaceId();
  if (!spaceId) return { ok: false, reason: "Aucun espace actif." };
  const r = await fetch(`${API_BASE}/schedule/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spaceId, id }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) return { ok: false, reason: (d && (d.reason || d.error)) || `HTTP ${r.status}` };
  return d ?? { ok: false };
}

export interface ServerPost {
  id: string;
  whenMs: number;
  status: string;
  lastResult?: string | null;
  /** Réseaux réellement en échec — permet de ne relancer que ceux-là. */
  failedNetworks?: string[] | null;
}
export async function listServerScheduled(): Promise<{
  ok: boolean;
  posts?: ServerPost[];
  reason?: string;
}> {
  const spaceId = activeSpaceId();
  if (!spaceId) return { ok: false, posts: [] };
  const r = await fetch(`${API_BASE}/schedule/list?spaceId=${spaceId}`);
  const d = await r.json().catch(() => null);
  if (!r.ok) return { ok: false, posts: [], reason: (d && (d.reason || d.error)) || `HTTP ${r.status}` };
  return d ?? { ok: false, posts: [] };
}

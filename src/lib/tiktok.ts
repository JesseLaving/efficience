import { API_BASE } from './api';

const TLS = 'eff_tt_token', RLS = 'eff_tt_refresh', OLS = 'eff_tt_openid';
export const getStoredTiktokToken = () => localStorage.getItem(TLS);
export const getStoredTiktokRefresh = () => localStorage.getItem(RLS);
export const setStoredTiktok = (t: string, r?: string, openId?: string) => {
  localStorage.setItem(TLS, t);
  if (r) localStorage.setItem(RLS, r);
  if (openId) localStorage.setItem(OLS, openId);
};
export const clearStoredTiktok = () => { localStorage.removeItem(TLS); localStorage.removeItem(RLS); localStorage.removeItem(OLS); };

export function tiktokLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/tiktok/login?return=${encodeURIComponent(ret)}`;
}

export async function refreshTiktok(refresh: string): Promise<{ token: string; refresh: string } | null> {
  const r = await fetch(`${API_BASE}/tiktok/refresh?refresh=${encodeURIComponent(refresh)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) return null;
  return { token: d.token, refresh: d.refresh };
}

export interface TiktokProfile {
  openId: string; name: string | null; avatar: string | null;
  followers: number | null; likes: number | null; videos: number | null;
}
export interface TiktokUserInfoResponse { available: boolean; reason?: string | null; profile: TiktokProfile | null; }

export async function fetchTiktokUserInfo(token: string): Promise<TiktokUserInfoResponse> {
  const r = await fetch(`${API_BASE}/tiktok/userinfo?token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || `HTTP ${r.status}`);
  return d as TiktokUserInfoResponse;
}

export interface TiktokCreatorInfo {
  nickname: string | null; avatar: string | null; privacyOptions: string[];
  maxDurationSec: number | null; commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean;
}
export interface TiktokCreatorInfoResponse { ok: boolean; reason?: string; creator?: TiktokCreatorInfo; }

export async function fetchTiktokCreatorInfo(token: string): Promise<TiktokCreatorInfoResponse> {
  const r = await fetch(`${API_BASE}/tiktok/creatorinfo?token=${encodeURIComponent(token)}`);
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur.' }));
}

/* ---------- Publication vidéo (Direct Post, upload résumable) ----------
   Étape 1 : notre serveur initie la session auprès de TikTok (petit JSON,
   tient dans une fonction Vercel) et renvoie l'URL d'upload.
   Étape 2 : le navigateur envoie les octets de la vidéo DIRECTEMENT à cette
   URL — jamais via notre backend (mêmes contraintes que YouTube). */

export interface TiktokPostMeta {
  title: string; privacyLevel: string;
  disableComment?: boolean; disableDuet?: boolean; disableStitch?: boolean;
}
export interface TiktokInitResult { ok: boolean; uploadUrl?: string; publishId?: string; reason?: string; }

export async function initTiktokPost(token: string, meta: TiktokPostMeta, file: File): Promise<TiktokInitResult> {
  const r = await fetch(`${API_BASE}/tiktok/videoinit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...meta, fileSize: file.size }),
  });
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur.' }));
}

export interface TiktokUploadResult { ok: boolean; reason?: string; }

/* XMLHttpRequest (pas fetch) pour suivre la progression de l'envoi. TikTok
   exige l'en-tête Content-Range même pour un envoi en un seul morceau. */
export function uploadTiktokVideo(uploadUrl: string, file: File, onProgress?: (pct: number) => void): Promise<TiktokUploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else {
        let reason = `HTTP ${xhr.status}`;
        try { const d = JSON.parse(xhr.responseText); reason = d.error?.message || reason; } catch { /* ignore */ }
        resolve({ ok: false, reason });
      }
    };
    xhr.onerror = () => resolve({ ok: false, reason: 'Échec réseau pendant l’envoi.' });
    xhr.send(file);
  });
}

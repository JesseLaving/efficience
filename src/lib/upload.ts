import { API_BASE } from './api';

export interface UploadResult { ok: boolean; url?: string; reason?: string }

/* Envoie une image (data-URL) sur Vercel Blob → URL publique. */
export async function uploadImage(dataUrl: string): Promise<UploadResult> {
  const r = await fetch(`${API_BASE}/upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: dataUrl }),
  });
  return r.json().catch(() => ({ ok: false, reason: 'Réponse invalide du serveur d’hébergement.' }));
}

/* URL proxy (CORS *) d'une photo Pexels — pour la compositer sur un canvas. */
export const proxiedPhoto = (url: string) => `${API_BASE}/stock?proxy=${encodeURIComponent(url)}`;

function loadImg(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load'));
    img.src = src;
  });
}

/* Compose une photo (via proxy) + le logo de marque (data-URL) → JPEG data-URL,
   recadré au ratio cible, avec un léger dégradé bas pour la lisibilité du logo. */
export async function brandPhoto(opts: {
  photoUrl: string; ratio: string; logoData?: string | null; brandName?: string; accent?: string;
  /** true quand l'URL est déjà servie en CORS (ex. image IA) → pas de proxy Pexels. */
  direct?: boolean;
}): Promise<string> {
  const { photoUrl, ratio, logoData, brandName, accent, direct } = opts;
  const [rw, rh] = (ratio || '1:1').split(':').map(Number);
  const W = 1080;
  const H = rw && rh ? Math.round((W * rh) / rw) : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  const photo = await loadImg(direct ? photoUrl : proxiedPhoto(photoUrl), true);
  // cover-fit
  const s = Math.max(W / photo.width, H / photo.height);
  const dw = photo.width * s, dh = photo.height * s;
  ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // dégradé bas pour lisibilité
  const grad = ctx.createLinearGradient(0, H * 0.62, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, Math.round(H * 0.62), W, Math.round(H * 0.38));

  const pad = Math.round(W * 0.05);
  if (logoData) {
    try {
      const logo = await loadImg(logoData, false);
      const lw = Math.min(W * 0.3, 340);
      const lh = lw * (logo.height / logo.width || 0.4);
      ctx.drawImage(logo, pad, H - lh - pad, lw, lh);
    } catch { /* pas de logo intégrable → on continue sans */ }
  } else if (brandName) {
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(W * 0.045)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(brandName.toUpperCase(), pad, H - pad);
  }
  // petit accent de marque (barre)
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(pad, H - pad + 8, Math.round(W * 0.12), 6); }

  return canvas.toDataURL('image/jpeg', 0.9);
}

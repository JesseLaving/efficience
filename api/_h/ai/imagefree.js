/* Génération d'image gratuite — Cloudflare Workers AI, modèle FLUX.2 [klein] 4B.
   REST *synchrone* renvoyant du base64, exactement comme le chemin Gemini :
   aucune refonte en job + polling (ce qu'aurait imposé Higgsfield).

   Choix du modèle, d'après la grille de neurones publiée (palier gratuit =
   10 000 neurones/jour) :
     flux-2-klein-4b   26,05 n / tuile 512² de sortie  → ~96 images 1024²/jour
     flux-1-schnell     4,80 n / tuile + 9,60 n / pas  → ~170/jour, mais FLUX 1
     flux-2-klein-9b   1363 n / MP                     → ~7/jour   (trop cher)
     lucid-origin       636 n / tuile                  → ~4/jour   (trop cher)
   klein-4b est le point d'équilibre : génération FLUX 2, volume confortable,
   et surtout il accepte width/height — contrairement à schnell, dont la sortie
   carrée obligeait à recadrer les 4:5 et 9:16.

   Sans CF_ACCOUNT_ID / CF_API_TOKEN → { available:false } : le client retombe
   alors sur Pollinations. Tant que les variables ne sont pas posées, le
   comportement de l'app est strictement inchangé. */
import { cors, json, readBody, requireAiQuota } from './_shared.js';

const MODEL = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-4b';
const STEPS = Math.max(1, Number(process.env.CF_IMAGE_STEPS) || 25);
/* Le prompt est plafonné à 2048 caractères côté Cloudflare. */
const MAX_PROMPT = 2048;

/* Dimensions par ratio. Base 1024 sur le petit côté : au-delà, le coût grimpe
   par tuile 512² sans gain visible sur un visuel de réseau social.
   Multiples de 64, comme attendu par les modèles de diffusion. */
const DIMS = {
  '1:1': [1024, 1024],
  '4:5': [896, 1152],
  '9:16': [768, 1344],
  '16:9': [1344, 768],
  '1.91:1': [1344, 704], // format lien Facebook/LinkedIn, au plus proche
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });

  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!account || !token) return json(res, 200, { available: false, reason: 'Cloudflare Workers AI non configuré.' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const prompt = (body.prompt || '').toString().trim().slice(0, MAX_PROMPT);
  const ratio = (body.ratio || '1:1').toString();
  if (!prompt) return json(res, 400, { error: 'prompt requis' });
  // Même garde-fou que le chemin Gemini : la génération consomme notre quota.
  if (!(await requireAiQuota(req, res))) return;

  const [width, height] = DIMS[ratio] || DIMS['1:1'];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, steps: STEPS, width, height }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    // Cloudflare répond 401/400 sur erreur (vérifié), mais l'enveloppe client/v4
    // porte aussi un `success:false` : on couvre les deux plutôt que de parier.
    if (!r.ok || (d && d.success === false)) {
      const msg = (d && d.errors && d.errors[0] && d.errors[0].message) || `Cloudflare HTTP ${r.status}`;
      return json(res, 200, { available: false, reason: msg });
    }
    // L'API client/v4 enveloppe la réponse dans `result`; on accepte les deux
    // formes pour ne pas dépendre de ce détail.
    const b64 = (d && d.result && d.result.image) || (d && d.image);
    if (!b64) return json(res, 200, { available: false, reason: 'Aucune image renvoyée par Cloudflare.' });
    return json(res, 200, { available: true, provider: 'cloudflare', model: MODEL, dataUrl: `data:image/jpeg;base64,${b64}` });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    return json(res, 200, { available: false, reason: aborted ? 'Délai dépassé côté Cloudflare.' : String((e && e.message) || e) });
  } finally {
    clearTimeout(timer);
  }
}

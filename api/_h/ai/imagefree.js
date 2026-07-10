/* Génération d'image gratuite — Cloudflare Workers AI, modèle FLUX.1-schnell.
   Palier gratuit permanent (10 000 neurones/jour ; FLUX consomme 4,8 neurones
   par tuile 512×512), et surtout REST *synchrone* : renvoie un JPEG en base64,
   exactement comme le chemin Gemini. Aucune refonte en job + polling.

   Sans CF_ACCOUNT_ID / CF_API_TOKEN → { available:false } : le client retombe
   alors sur Pollinations. Tant que les variables ne sont pas posées, le
   comportement de l'app est donc strictement inchangé.

   Limite connue : le schéma du modèle n'accepte que prompt / steps / seed.
   Pas de width ni height → sortie carrée, le ratio est recadré côté app.
   C'est le seul point où Pollinations reste supérieur (il prend des dimensions). */
import { cors, json, readBody, requireAiQuota } from './_shared.js';

const MODEL = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
/* schnell est conçu pour un faible nombre de pas ; l'API plafonne à 8. */
const STEPS = Math.min(8, Math.max(1, Number(process.env.CF_IMAGE_STEPS) || 4));
/* Le prompt est plafonné à 2048 caractères côté Cloudflare. */
const MAX_PROMPT = 2048;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });

  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!account || !token) return json(res, 200, { available: false, reason: 'Cloudflare Workers AI non configuré.' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const prompt = (body.prompt || '').toString().trim().slice(0, MAX_PROMPT);
  if (!prompt) return json(res, 400, { error: 'prompt requis' });
  // Même garde-fou que le chemin Gemini : la génération consomme notre quota.
  if (!(await requireAiQuota(req, res))) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, steps: STEPS }),
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

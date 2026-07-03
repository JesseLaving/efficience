/* Shared helpers for the Gemini-backed AI endpoints (generate.js, image.js,
   plan.js). Keeps the retry/safety/parsing logic in one place instead of
   duplicated across each action. */
import { readSession, checkAiQuota } from '../db.js';

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
export function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
}

/* BLOCK_ONLY_HIGH plutôt que le seuil par défaut : évite les faux positifs
   fréquents sur du contenu marketing légitime (santé, beauté, offres
   "agressives"...) tout en bloquant toujours le contenu réellement nocif. */
export const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

const RETRY_STATUS = new Set([429, 500, 502, 503]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* POST generateContent, with retry on transient errors (rate limit / model
   overloaded) — up to `retries` extra attempts with exponential backoff.
   Throws with a message suitable to surface to the user via { reason }. */
export async function geminiGenerate(model, payload, { retries = 2 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY non configurée');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let httpStatus = 0;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      httpStatus = r.status;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error((d && d.error && d.error.message) || `Gemini HTTP ${r.status}`), { status: r.status });
      return d;
    } catch (e) {
      lastErr = e;
      const retriable = RETRY_STATUS.has(e.status || httpStatus);
      if (retriable && attempt < retries) { await sleep(400 * 3 ** attempt); continue; }
      throw lastErr;
    }
  }
  throw lastErr;
}

/* Extrait le texte d'une réponse generateContent, avec un message d'erreur
   utile (blocage de sécurité / réponse tronquée) plutôt qu'un "vide" muet. */
export function extractText(data) {
  const cand = data && data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (text) return text;
  const block = data && data.promptFeedback && data.promptFeedback.blockReason;
  const finish = cand && cand.finishReason;
  if (block) throw new Error(`Contenu bloqué par Gemini (${block})`);
  if (finish && finish !== 'STOP') throw new Error(`Réponse Gemini incomplète (${finish})`);
  throw new Error('Réponse Gemini vide');
}

/* Extrait la première image inline (base64) d'une réponse generateContent. */
export function extractImage(data) {
  const cand = data && data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const img = parts.find((p) => p.inlineData && p.inlineData.data);
  if (img) return { mime: img.inlineData.mimeType || 'image/png', data: img.inlineData.data };
  const block = data && data.promptFeedback && data.promptFeedback.blockReason;
  throw new Error(block ? `Image bloquée par Gemini (${block})` : 'Aucune image renvoyée par Gemini');
}

/* Vérifie l'authentification + le quota IA quotidien avant tout appel Gemini
   coûteux. Renvoie { userId } si l'appel peut continuer, ou écrit directement
   une réponse { available:false, reason } (200, cohérent avec la dégradation
   déjà en place pour Gemini indisponible) et renvoie null sinon. */
export async function requireAiQuota(req, res) {
  const session = readSession(req.headers.cookie);
  if (!session || !session.userId) {
    json(res, 200, { available: false, reason: 'Connectez-vous pour utiliser l’IA.' });
    return null;
  }
  const quota = await checkAiQuota(session.userId);
  if (!quota.ok) {
    json(res, 200, { available: false, reason: `Quota IA quotidien atteint (${quota.limit} générations/jour). Réessayez demain.` });
    return null;
  }
  return { userId: session.userId };
}

/* Parse un tableau JSON de chaînes depuis une réponse texte — tolère un
   habillage (texte autour du JSON, fences ```). */
export function parseJsonArray(text) {
  try {
    const v = JSON.parse(text);
    if (Array.isArray(v)) return v;
  } catch { /* essai suivant */ }
  const m = text.match(/\[[\s\S]*\]/);
  if (m) { try { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v; } catch { /* ignore */ } }
  return null;
}

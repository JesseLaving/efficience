/* Génération d'image par IA — Gemini natif. POST { prompt, ratio }.
   Dégrade proprement à { available:false, reason } quand la clé manque ou que
   l'appel échoue : le client retombe alors sur Pollinations (gratuit, sans
   clé), comme le texte retombe sur le moteur de templates.

   Modèles essayés dans l'ordre, le premier disponible gagne. gemini-2.5-flash-image
   ("Nano Banana") est désormais legacy chez Google et rend nettement moins bien que
   la génération 3 ; on la garde en dernier recours pour ne jamais casser la
   génération si un ID n'est pas ouvert sur la clé du projet.
   Surchargeable par GEMINI_IMAGE_MODEL (liste séparée par des virgules). */
import { cors, json, readBody, geminiGenerate, extractImage, SAFETY_SETTINGS, requireAiQuota } from './_shared.js';

const IMAGE_MODELS = (process.env.GEMINI_IMAGE_MODEL
  || 'gemini-3-pro-image,gemini-3.1-flash-image,gemini-2.5-flash-image')
  .split(',').map((s) => s.trim()).filter(Boolean);

/* Résolution demandée. gemini-3-pro-image l'honore réellement (jusqu'à 4K) ;
   gemini-3.1-flash-image l'ignore et rend ~1K quoi qu'on demande. 2K suffit
   largement pour un visuel de réseau social et coûte moins cher que 4K. */
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE || '2K';

/* Ratios réellement acceptés par imageConfig.aspectRatio. Attention : le
   1.91:1 utilisé côté app (lien Facebook/LinkedIn) n'en fait PAS partie —
   on le mappe sur le 16:9, le plus proche (1.78 vs 1.91). */
const ASPECT = {
  '1:1': '1:1',
  '4:5': '4:5',
  '9:16': '9:16',
  '16:9': '16:9',
  '1.91:1': '16:9',
};

/* Repli sur le modèle suivant quand CE modèle-là n'est pas utilisable : soit il
   n'existe pas / n'est pas ouvert sur la clé (404), soit il refuse un champ que
   seule la génération 3 comprend (400 « unknown name: imageConfig »…).
   Une erreur de sécurité ou de quota, elle, doit remonter telle quelle :
   réessayer avec un autre modèle ne l'arrangerait pas. */
function modelUnavailable(e) {
  const msg = String((e && e.message) || e);
  if (e && e.status === 404) return true;
  if (/not found|not supported|does not exist|unknown model|no longer available/i.test(msg)) return true;
  // Champ inconnu / valeur invalide sur la config d'image → modèle inadapté.
  return (e && e.status === 400) && /unknown name|invalid|imageConfig|responseModalities|aspectRatio|imageSize/i.test(msg);
}

/* Les modèles Gemini 3 acceptent imageConfig (vrai contrôle du cadrage).
   Le legacy 2.5 ne le connaît pas : on lui garde l'indication en langage
   naturel, sinon l'API rejette le champ inconnu. */
const RATIO_HINT = {
  '1:1': 'format carré (1:1)',
  '4:5': 'format portrait (4:5)',
  '1.91:1': 'format paysage large (1.91:1)',
  '9:16': 'format vertical plein écran (9:16)',
  '16:9': 'format paysage (16:9)',
};

/* Récupère un visuel déjà publié (URL publique) et l'encode en base64 pour le
   transmettre à Gemini comme référence visuelle — dégrade silencieusement
   (poursuit sans référence) si l'image est introuvable, trop lourde ou que
   l'hôte ne répond pas, plutôt que de faire échouer toute la génération pour
   un problème sur une image annexe. */
async function fetchReferenceImage(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(u.toString(), { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (!r.ok) return null;
    const mimeType = r.headers.get('content-type') || 'image/jpeg';
    if (!mimeType.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    return { mimeType, data: buf.toString('base64') };
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  if (!process.env.GEMINI_API_KEY) return json(res, 200, { available: false, reason: 'GEMINI_API_KEY non configurée.' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const prompt = (body.prompt || '').toString().trim().slice(0, 800);
  const ratio = (body.ratio || '1:1').toString();
  const referenceImageUrl = (body.referenceImageUrl || '').toString().trim();
  if (!prompt) return json(res, 400, { error: 'prompt requis' });
  if (!(await requireAiQuota(req, res))) return;

  const hint = RATIO_HINT[ratio] || `format ${ratio}`;
  const reference = referenceImageUrl ? await fetchReferenceImage(referenceImageUrl) : null;
  const styleNote = reference
    ? " Inspire-toi du style visuel (lumière, palette de couleurs, ambiance, composition) de l'image de référence fournie pour garder une identité visuelle cohérente avec les publications déjà publiées — reproduis uniquement le style, jamais le sujet de cette référence."
    : '';
  const quality = 'Haute qualité, photoréaliste ou illustration soignée selon le sujet, sans texte, sans watermark, sans logo.';

  let lastErr = null;
  for (const model of IMAGE_MODELS) {
    const modern = model.startsWith('gemini-3');
    // Sur Gemini 3 le cadrage passe par imageConfig : inutile (et moins fiable)
    // de le redemander en toutes lettres dans le prompt.
    const fullPrompt = modern
      ? `${prompt}\n\n${quality}${styleNote}`
      : `${prompt}\n\nImage en ${hint}, ${quality.charAt(0).toLowerCase()}${quality.slice(1)}${styleNote}`;

    const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
    if (modern) generationConfig.imageConfig = { aspectRatio: ASPECT[ratio] || '1:1', imageSize: IMAGE_SIZE };

    const parts = [];
    if (reference) parts.push({ inlineData: reference });
    parts.push({ text: fullPrompt });

    try {
      const d = await geminiGenerate(model, {
        contents: [{ role: 'user', parts }],
        generationConfig,
        safetySettings: SAFETY_SETTINGS,
      });
      const img = extractImage(d);
      return json(res, 200, { available: true, provider: 'gemini', model, dataUrl: `data:${img.mime};base64,${img.data}` });
    } catch (e) {
      lastErr = e;
      if (modelUnavailable(e)) continue; // modèle pas ouvert sur cette clé → suivant
      return json(res, 200, { available: false, reason: String((e && e.message) || e) });
    }
  }
  return json(res, 200, { available: false, reason: `Aucun modèle image Gemini disponible (${String((lastErr && lastErr.message) || 'inconnu')})` });
}

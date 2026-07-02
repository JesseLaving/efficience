/* Génération d'image par IA — Gemini natif (gemini-2.5-flash-image, alias
   "Nano Banana"). POST { prompt, ratio }.
   Dégrade proprement à { available:false, reason } quand la clé manque ou que
   l'appel échoue : le client retombe alors sur Pollinations (gratuit, sans
   clé), comme le texte retombe sur le moteur de templates. */
import { cors, json, readBody, geminiGenerate, extractImage, SAFETY_SETTINGS } from './_shared.js';

const RATIO_HINT = {
  '1:1': 'format carré (1:1)',
  '4:5': 'format portrait (4:5)',
  '1.91:1': 'format paysage large (1.91:1)',
  '9:16': 'format vertical plein écran (9:16)',
  '16:9': 'format paysage (16:9)',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  if (!process.env.GEMINI_API_KEY) return json(res, 200, { available: false, reason: 'GEMINI_API_KEY non configurée.' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const prompt = (body.prompt || '').toString().trim().slice(0, 800);
  const ratio = (body.ratio || '1:1').toString();
  if (!prompt) return json(res, 400, { error: 'prompt requis' });

  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const hint = RATIO_HINT[ratio] || `format ${ratio}`;
  const fullPrompt = `${prompt}\n\nImage en ${hint}, haute qualité, photoréaliste ou illustration soignée selon le sujet, sans texte, sans watermark, sans logo.`;

  try {
    const d = await geminiGenerate(model, {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
      safetySettings: SAFETY_SETTINGS,
    });
    const img = extractImage(d);
    return json(res, 200, { available: true, provider: 'gemini', dataUrl: `data:${img.mime};base64,${img.data}` });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e) });
  }
}

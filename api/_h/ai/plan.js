/* Sujets de publication personnalisés par IA pour le planning éditorial.
   POST { context: {name, sector, city}, slots: [{pillar, format, network}, ...] }
   Le client calcule déjà les DATES et l'équilibre par pilier (logique locale,
   déterministe — pas de calcul de date par le LLM). Gemini ne fournit que le
   SUJET de chaque publication, un par slot, dans l'ordre. Dégrade à
   { available:false, reason } : le client retombe alors sur la banque
   d'idées locale (src/lib/editorial.ts), jamais d'écran vide. */
import { cors, json, readBody, geminiGenerate, extractText, parseJsonArray, SAFETY_SETTINGS, requireAiQuota } from './_shared.js';

const MAX_SLOTS = 40;

const GOAL_LABELS = {
  notoriete: 'notoriété & visibilité', leads: 'génération de leads',
  ventes: 'ventes directes', fidelisation: 'fidélisation clients',
};

function systemPrompt(ctx) {
  const who = [
    ctx?.name && `Entreprise : ${ctx.name}.`,
    ctx?.sector && `Secteur : ${ctx.sector}.`,
    ctx?.city && `Zone : ${ctx.city}.`,
    ctx?.audience && `Cible : ${ctx.audience}.`,
    ctx?.products && `Produits/services phares : ${ctx.products}.`,
    ctx?.goal && GOAL_LABELS[ctx.goal] && `Objectif prioritaire de la communication : ${GOAL_LABELS[ctx.goal]}.`,
  ].filter(Boolean).join(' ');
  const styleRef = Array.isArray(ctx?.recentPosts) && ctx.recentPosts.length
    ? '\nPublications déjà publiées par cette entreprise, à titre de référence de ton et de sujets déjà traités (ne recopie jamais le texte, propose des angles nouveaux dans le même registre) :\n'
      + ctx.recentPosts.slice(0, 5).map((p) => `- « ${String(p).slice(0, 220)} »`).join('\n')
    : '';
  return [
    "Tu es un stratège de contenu pour une PME française.",
    who && `Contexte : ${who}`,
    "Pour chaque publication demandée, propose un SUJET/ANGLE concret et spécifique à cette entreprise (une phrase, pas le texte complet du post), adapté au pilier éditorial, au format et au réseau indiqués.",
    "RÈGLE ABSOLUE : n'invente JAMAIS de chiffres, statistiques, pourcentages, témoignages, récompenses ou faits précis sur l'entreprise. Reste qualitatif et générique sur les faits, spécifique sur l'angle.",
    styleRef,
  ].filter(Boolean).join('\n');
}

function userPrompt(slots) {
  const lines = slots.map((s, i) => `${i + 1}. Pilier : ${s.pillar} · Format : ${s.format} · Réseau : ${s.network}`).join('\n');
  return `Voici ${slots.length} publications à concevoir :\n\n${lines}\n\n`
    + `Réponds UNIQUEMENT avec un tableau JSON de ${slots.length} chaînes de caractères (un sujet par ligne, dans le même ordre, sans numérotation dans le texte), sans aucun autre texte autour.`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  if (!process.env.GEMINI_API_KEY) return json(res, 200, { available: false, reason: 'GEMINI_API_KEY non configurée.' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const ctx = body.context || {};
  const slots = Array.isArray(body.slots) ? body.slots : [];
  if (!slots.length) return json(res, 400, { error: 'slots requis' });
  if (slots.length > MAX_SLOTS) return json(res, 400, { error: `${MAX_SLOTS} publications maximum par génération IA.` });
  if (!(await requireAiQuota(req, res))) return;

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const d = await geminiGenerate(model, {
      systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(slots) }] }],
      generationConfig: { maxOutputTokens: Math.max(1024, 80 * slots.length), temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } },
      safetySettings: SAFETY_SETTINGS,
    });
    const text = extractText(d);
    const ideas = parseJsonArray(text);
    if (!ideas || !ideas.length) throw new Error('Réponse Gemini illisible (format inattendu).');
    // Complète si Gemini renvoie moins d'idées que demandé (troncature) —
    // jamais moins d'items que de slots côté client.
    while (ideas.length < slots.length) ideas.push('');
    return json(res, 200, { available: true, provider: 'gemini', ideas: ideas.slice(0, slots.length).map((s) => String(s || '').trim()) });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e) });
  }
}

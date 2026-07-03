/* AI copywriting — provider-agnostic, free-tier friendly.
   POST { kind: 'post'|'caption'|'email'|'improve'|'hashtags', brief, context }
   Picks the first provider whose key is set, in this order:
     1. Google Gemini   (GEMINI_API_KEY)   — free tier, recommended
     2. Groq            (GROQ_API_KEY)     — free tier, very fast (Llama 3.3)
     3. OpenRouter      (OPENROUTER_API_KEY)
     4. Anthropic       (ANTHROPIC_API_KEY) — paid
   Degrades to { available:false, reason } when no key is set, so the client
   falls back to the built-in template engine. Hard rule (Jesse): never invent
   figures, stats, testimonials or specific facts — stay qualitative. */
import { cors, json, readBody, geminiGenerate, extractText, SAFETY_SETTINGS } from './_shared.js';

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
    ctx?.competitors && `Concurrents connus : ${ctx.competitors} — peut inspirer la différenciation, jamais de dénigrement direct.`,
  ].filter(Boolean).join(' ');
  // Échantillon de publications réelles déjà publiées (Meta/TikTok) — sert de
  // référence de style, jamais de source à recopier mot pour mot.
  const styleRef = Array.isArray(ctx?.recentPosts) && ctx.recentPosts.length
    ? '\nPublications déjà publiées par cette entreprise, à titre de référence de ton et de style (ne recopie jamais le texte, inspire-toi seulement du registre) :\n'
      + ctx.recentPosts.slice(0, 5).map((p) => `- « ${String(p).slice(0, 220)} »`).join('\n')
    : '';
  return [
    "Tu es un rédacteur expert en marketing et communication pour une PME française.",
    "Tu écris en français, dans un ton professionnel, clair et engageant, sans jargon inutile.",
    who && `Contexte : ${who}`,
    "RÈGLE ABSOLUE : n'invente JAMAIS de chiffres, statistiques, pourcentages, témoignages, récompenses ou faits précis. Reste qualitatif. Si une preuve chiffrée serait utile, formule-la comme un espace à compléter (ex. « [chiffre clé] »).",
    "Écris du contenu prêt à publier, naturel, sans méta-commentaire.",
    styleRef,
  ].filter(Boolean).join('\n');
}

function userPrompt(kind, brief, ctx) {
  const net = ctx?.network ? ` pour ${ctx.network}` : '';
  const tone = ctx?.tone ? ` Ton souhaité : ${ctx.tone}.` : '';
  const pillar = ctx?.pillar ? ` Angle éditorial : ${ctx.pillar}.` : '';
  const audience = ctx?.audience ? ` Cible visée : ${ctx.audience}.` : '';
  // Marge de sécurité : demander la limite exacte pousse souvent le modèle à
  // la frôler ; viser ~90 % laisse de la place pour hashtags/emoji ajoutés
  // après coup sans dépasser la vraie limite de la plateforme.
  const cap = ctx?.maxLength && ctx.maxLength > 0
    ? ` Longueur maximale stricte : ${Math.max(20, Math.round(ctx.maxLength * 0.9))} caractères — ne dépasse jamais cette limite.`
    : '';
  if (kind === 'email') {
    return `Rédige un e-mail marketing sur le sujet suivant : « ${brief} ».${tone}${audience}\n`
      + `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format : `
      + `{"subject": "...", "preheader": "...", "body": "...", "cta": "..."}. `
      + `Le "body" peut contenir des sauts de ligne (\\n) entre paragraphes. Reste concis (120-180 mots).`;
  }
  if (kind === 'improve') {
    return `Améliore et réécris ce texte de publication${net} pour le rendre plus percutant et engageant, en gardant l'intention.${tone}${pillar}${audience}${cap}\n\nTexte :\n« ${brief} »\n\nRéponds uniquement avec le texte amélioré, prêt à publier (avec hashtags pertinents si adapté au réseau).`;
  }
  if (kind === 'hashtags') {
    return `Propose 3 à 6 hashtags pertinents${net} pour cette publication, à partir du texte suivant :\n« ${brief} »\n\nRéponds UNIQUEMENT avec les hashtags séparés par un espace (ex : #motclé1 #motclé2), sans numérotation, sans autre texte.`;
  }
  return `Rédige 2 versions DIFFÉRENTES (angle d'accroche ou structure différents, pas de simples reformulations) d'une publication${net} sur le sujet : « ${brief} ».${tone}${pillar}${audience}\n`
    + `Chaque version doit capter l'attention dès la première ligne, développer l'intérêt et finir par un appel à l'action clair. `
    + `Ajoute 3 à 6 hashtags pertinents en fin de chaque version si le réseau s'y prête.${cap || ' Longueur adaptée au réseau.'}\n`
    + `Réponds UNIQUEMENT avec un tableau JSON valide de 2 chaînes de caractères, sans texte autour : ["version 1...", "version 2..."].`;
}

// ---- providers: each returns the generated text or throws ----
async function callGemini(system, user, maxTokens) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const d = await geminiGenerate(model, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    // Gemini 2.5 "thinking" consumes the output budget → disable it for copy,
    // and keep a generous ceiling so the answer is never truncated.
    generationConfig: { maxOutputTokens: Math.max(maxTokens, 1024), temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } },
    safetySettings: SAFETY_SETTINGS,
  });
  return extractText(d);
}

async function callOpenAICompat(url, key, model, system, user, maxTokens, extraHeaders) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: 0.8,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && d.error && (d.error.message || d.error)) || `HTTP ${r.status}`);
  const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
  if (!text) throw new Error('Réponse IA vide');
  return text;
}

function pickProvider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

async function generateText(provider, system, user, maxTokens) {
  if (provider === 'gemini') return callGemini(system, user, maxTokens);
  if (provider === 'groq') {
    return callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY,
      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', system, user, maxTokens);
  }
  if (provider === 'openrouter') {
    return callOpenAICompat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', system, user, maxTokens);
  }
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d && d.error && d.error.message) || `HTTP ${r.status}`);
    const text = (d.content || []).map((b) => b.text || '').join('').trim();
    if (!text) throw new Error('Réponse vide');
    return text;
  }
  throw new Error('Aucun fournisseur');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });

  const provider = pickProvider();
  if (!provider) return json(res, 200, { available: false, reason: 'Aucune clé IA configurée (GEMINI_API_KEY gratuit recommandé)' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const kind = body.kind || 'post';
  const brief = (body.brief || '').toString().trim();
  const ctx = body.context || {};
  if (!brief) return json(res, 400, { error: 'brief requis' });

  try {
    const maxTokens = kind === 'email' ? 700 : kind === 'post' ? 1100 : 600;
    const text = await generateText(provider, systemPrompt(ctx), userPrompt(kind, brief, ctx), maxTokens);

    if (kind === 'email') {
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
      }
      if (parsed && (parsed.subject || parsed.body)) {
        return json(res, 200, { available: true, provider, email: {
          subject: parsed.subject || '', preheader: parsed.preheader || '', body: parsed.body || '', cta: parsed.cta || '',
        } });
      }
      return json(res, 200, { available: true, provider, email: { subject: '', preheader: '', body: text, cta: '' } });
    }

    if (kind === 'post') {
      // Le modèle répond en principe un tableau JSON de 2 versions — mais un
      // repli sur texte brut est indispensable : ni le JSON ni le nombre de
      // versions ne sont garantis (troncature, modèle qui ignore la consigne).
      let variants = null;
      try { variants = JSON.parse(text); } catch {
        const m = text.match(/\[[\s\S]*\]/);
        if (m) { try { variants = JSON.parse(m[0]); } catch { /* ignore */ } }
      }
      if (Array.isArray(variants) && variants.length) {
        variants = variants.map((v) => String(v || '').trim()).filter(Boolean);
      } else {
        variants = [text];
      }
      return json(res, 200, { available: true, provider, text: variants[0], variants });
    }

    return json(res, 200, { available: true, provider, text });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e) });
  }
}

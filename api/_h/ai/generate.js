/* AI copywriting — provider-agnostic, free-tier friendly.
   POST { kind: 'post'|'caption'|'email'|'improve', brief, context }
   Picks the first provider whose key is set, in this order:
     1. Google Gemini   (GEMINI_API_KEY)   — free tier, recommended
     2. Groq            (GROQ_API_KEY)     — free tier, very fast (Llama 3.3)
     3. OpenRouter      (OPENROUTER_API_KEY)
     4. Anthropic       (ANTHROPIC_API_KEY) — paid
   Degrades to { available:false, reason } when no key is set, so the client
   falls back to the built-in template engine. Hard rule (Jesse): never invent
   figures, stats, testimonials or specific facts — stay qualitative. */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
}

function systemPrompt(ctx) {
  const who = [
    ctx?.name && `Entreprise : ${ctx.name}.`,
    ctx?.sector && `Secteur : ${ctx.sector}.`,
    ctx?.city && `Zone : ${ctx.city}.`,
    ctx?.audience && `Cible : ${ctx.audience}.`,
  ].filter(Boolean).join(' ');
  return [
    "Tu es un rédacteur expert en marketing et communication pour une PME française.",
    "Tu écris en français, dans un ton professionnel, clair et engageant, sans jargon inutile.",
    who && `Contexte : ${who}`,
    "RÈGLE ABSOLUE : n'invente JAMAIS de chiffres, statistiques, pourcentages, témoignages, récompenses ou faits précis. Reste qualitatif. Si une preuve chiffrée serait utile, formule-la comme un espace à compléter (ex. « [chiffre clé] »).",
    "Écris du contenu prêt à publier, naturel, sans méta-commentaire.",
  ].filter(Boolean).join('\n');
}

function userPrompt(kind, brief, ctx) {
  const net = ctx?.network ? ` pour ${ctx.network}` : '';
  const tone = ctx?.tone ? ` Ton souhaité : ${ctx.tone}.` : '';
  const pillar = ctx?.pillar ? ` Angle éditorial : ${ctx.pillar}.` : '';
  if (kind === 'email') {
    return `Rédige un e-mail marketing sur le sujet suivant : « ${brief} ».${tone}\n`
      + `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format : `
      + `{"subject": "...", "preheader": "...", "body": "...", "cta": "..."}. `
      + `Le "body" peut contenir des sauts de ligne (\\n) entre paragraphes. Reste concis (120-180 mots).`;
  }
  if (kind === 'improve') {
    return `Améliore et réécris ce texte de publication${net} pour le rendre plus percutant et engageant, en gardant l'intention.${tone}${pillar}\n\nTexte :\n« ${brief} »\n\nRéponds uniquement avec le texte amélioré, prêt à publier (avec hashtags pertinents si adapté au réseau).`;
  }
  return `Rédige une publication${net} sur le sujet : « ${brief} ».${tone}${pillar}\n`
    + `Structure-la pour capter l'attention dès la première ligne, développer l'intérêt et finir par un appel à l'action clair. `
    + `Ajoute 3 à 6 hashtags pertinents en fin si le réseau s'y prête. Longueur adaptée au réseau. Réponds uniquement avec le texte prêt à publier.`;
}

// ---- providers: each returns the generated text or throws ----
async function callGemini(system, user, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && d.error && d.error.message) || `Gemini HTTP ${r.status}`);
  const text = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || [])
    .map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Réponse Gemini vide');
  return text;
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
    const text = await generateText(provider, systemPrompt(ctx), userPrompt(kind, brief, ctx), kind === 'email' ? 700 : 600);

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

    return json(res, 200, { available: true, provider, text });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e) });
  }
}

/* AI copywriting via the Anthropic Messages API.
   POST { kind: 'post'|'caption'|'email'|'improve', brief, context }
   - context: { name, sector, city, network, pillar, tone, audience }
   Degrades to { available:false, reason } when ANTHROPIC_API_KEY is absent, so
   the client falls back to the built-in template engine. Hard rule (Jesse):
   never invent figures, stats, testimonials or specific facts — stay qualitative. */
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

const MODEL = process.env.AI_MODEL || 'claude-sonnet-4-6';

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
    "RÈGLE ABSOLUE : n'invente JAMAIS de chiffres, statistiques, pourcentages, témoignages, récompenses ou faits précis. Reste qualitatif. Si une preuve chiffrée serait utile, formule-la comme un espace à compléter par l'utilisateur (ex. « [chiffre clé] »).",
    "Écris du contenu prêt à publier, naturel, sans méta-commentaire.",
  ].filter(Boolean).join('\n');
}

function userPrompt(kind, brief, ctx) {
  const net = ctx?.network ? ` pour ${ctx.network}` : '';
  const tone = ctx?.tone ? ` Ton souhaité : ${ctx.tone}.` : '';
  const pillar = ctx?.pillar ? ` Angle éditorial : ${ctx.pillar}.` : '';
  if (kind === 'email') {
    return `Rédige un e-mail marketing${net ? '' : ''} sur le sujet suivant : « ${brief} ».${tone}\n`
      + `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format : `
      + `{"subject": "...", "preheader": "...", "body": "...", "cta": "..."}. `
      + `Le "body" peut contenir des sauts de ligne (\\n) entre paragraphes. Reste concis (120-180 mots).`;
  }
  if (kind === 'improve') {
    return `Améliore et réécris ce texte de publication${net} pour le rendre plus percutant et engageant, en gardant l'intention.${tone}${pillar}\n\nTexte :\n« ${brief} »\n\nRéponds uniquement avec le texte amélioré, prêt à publier (avec hashtags pertinents si adapté au réseau).`;
  }
  // post / caption
  return `Rédige une publication${net} sur le sujet : « ${brief} ».${tone}${pillar}\n`
    + `Structure-la pour capter l'attention dès la première ligne, développer l'intérêt et finir par un appel à l'action clair. `
    + `Ajoute 3 à 6 hashtags pertinents en fin si le réseau s'y prête. Longueur adaptée au réseau. Réponds uniquement avec le texte prêt à publier.`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(res, 200, { available: false, reason: 'Clé IA non configurée (ANTHROPIC_API_KEY)' });

  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const kind = body.kind || 'post';
  const brief = (body.brief || '').toString().trim();
  const ctx = body.context || {};
  if (!brief) return json(res, 400, { error: 'brief requis' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: kind === 'email' ? 700 : 600,
        system: systemPrompt(ctx),
        messages: [{ role: 'user', content: userPrompt(kind, brief, ctx) }],
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json(res, 200, { available: false, reason: (d && d.error && d.error.message) || `HTTP ${r.status}` });
    const text = (d.content || []).map((b) => b.text || '').join('').trim();
    if (!text) return json(res, 200, { available: false, reason: 'Réponse IA vide' });

    if (kind === 'email') {
      // Parse the JSON object the model was asked to return (defensive).
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
      }
      if (parsed && (parsed.subject || parsed.body)) {
        return json(res, 200, { available: true, email: {
          subject: parsed.subject || '', preheader: parsed.preheader || '', body: parsed.body || '', cta: parsed.cta || '',
        } });
      }
      return json(res, 200, { available: true, email: { subject: '', preheader: '', body: text, cta: '' } });
    }

    return json(res, 200, { available: true, text });
  } catch (e) {
    return json(res, 200, { available: false, reason: String(e && e.message || e) });
  }
}

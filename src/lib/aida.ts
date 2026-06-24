import type { PlanItem } from './editorial';

/* ============================================================
   Rédacteur AIDA — transforme un SUJET du planning éditorial en
   brouillon de publication structuré : Attention · Intérêt · Désir
   (avantage pour l'audience) · Action (CTA).
   Ce sont des propositions de copywriting à personnaliser, jamais
   de données chiffrées inventées (aucun chiffre/témoignage fabriqué).
   ============================================================ */

interface AidaCtx { sector: string; name: string; city: string; }

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const stripDot = (s: string) => s.replace(/[.…\s]+$/, '');

/* Accroche (Attention) — reprend le sujet et le rend percutant. */
const ATTENTION: Record<string, string[]> = {
  expertise: ['💡 {idea}', '🎯 Parlons clair : {ideaLower}', '👉 Ce que peu d’acteurs vous diront : {ideaLower}'],
  preuve: ['📈 {idea}', '✅ La preuve par l’exemple : {ideaLower}', '🙌 {idea}'],
  pratique: ['🛠️ {idea}', '⚡ À appliquer dès aujourd’hui : {ideaLower}', '📌 {idea}'],
  coulisses: ['👀 {idea}', '🎬 Dans les coulisses : {ideaLower}', '🤝 {idea}'],
  actualite: ['📰 {idea}', '🔎 À retenir : {ideaLower}', '🚀 {idea}'],
  engagement: ['🗣️ {idea}', '🤔 {idea}', '💬 On a une question pour vous : {ideaLower}'],
  offre: ['✨ {idea}', '🎁 {idea}', '📣 {idea}'],
};

/* Intérêt — pourquoi ça compte (développe le sujet). */
const INTEREST: Record<string, string[]> = {
  expertise: ['Dans {secteur}, ce détail change vraiment la donne — et pourtant on l’oublie souvent.', 'C’est le genre de point qui sépare ceux qui avancent de ceux qui stagnent.'],
  preuve: ['Les résultats parlent d’eux-mêmes quand la méthode est la bonne.', 'Derrière chaque réussite, il y a une approche concrète, pas de la chance.'],
  pratique: ['Pas besoin d’outil compliqué : juste la bonne méthode, au bon moment.', 'Une habitude simple qui fait une vraie différence sur la durée.'],
  coulisses: ['Chez {marque}, on aime montrer l’envers du décor — c’est là que tout se joue.', 'Connaître les personnes derrière le service, ça change la relation.'],
  actualite: ['Le secteur bouge vite : mieux vaut comprendre maintenant que subir plus tard.', 'Ce qui change aujourd’hui aura un impact concret sur vos résultats demain.'],
  engagement: ['Votre retour nous aide à créer des contenus vraiment utiles.', 'On préfère construire avec vous plutôt que pour vous.'],
  offre: ['On a pensé cette proposition pour répondre à un besoin concret.', 'Le bon accompagnement, au bon moment, fait toute la différence.'],
};

/* Désir — l'avantage explicite pour l'audience. */
const BENEFIT: Record<string, string[]> = {
  expertise: ['une décision plus claire, sans perdre de temps ni d’argent.', 'une longueur d’avance, en évitant les erreurs coûteuses.'],
  preuve: ['la certitude que ça fonctionne vraiment, preuves à l’appui.', 'la confiance de savoir où vous mettez les pieds.'],
  pratique: ['une astuce applicable dès aujourd’hui, concrète et gratuite.', 'un résultat visible rapidement, sans complexité.'],
  coulisses: ['une relation de confiance avec une équipe que vous connaissez.', 'la tranquillité de travailler avec des personnes, pas juste une marque.'],
  actualite: ['une longueur d’avance sur ce qui change dans votre secteur.', 'des décisions éclairées avant tout le monde.'],
  engagement: ['un contenu qui répond vraiment à VOS questions.', 'la satisfaction d’être écouté et pris en compte.'],
  offre: ['un accompagnement concret, adapté précisément à votre besoin.', 'un gain de temps et de sérénité dès maintenant.'],
};

/* Action — le CTA. */
const CTA: Record<string, string[]> = {
  expertise: ['💬 Une question sur le sujet ? Posez-la en commentaire.', '🔖 Enregistrez ce post et partagez-le à qui en a besoin.'],
  preuve: ['📩 Envie d’un résultat similaire ? Écrivez-nous en message privé.', '👉 Parlons de votre projet : contactez-nous dès aujourd’hui.'],
  pratique: ['🔖 Enregistrez ce post pour le retrouver au bon moment.', '💬 Dites-nous en commentaire si vous allez l’essayer.'],
  coulisses: ['👋 Venez nous rencontrer — on vous répond avec plaisir.', '❤️ Suivez-nous pour découvrir les coulisses chaque semaine.'],
  actualite: ['🔔 Abonnez-vous pour ne rien manquer.', '💬 Et vous, comment anticipez-vous ce changement ?'],
  engagement: ['👇 Dites-nous ce que vous en pensez en commentaire.', '🗳️ Répondez en story / en commentaire, on lit tout !'],
  offre: ['📅 Réservez votre échange découverte (lien en bio).', '📲 Contactez-nous dès maintenant pour en profiter.'],
};

const STOP = new Set(['et', 'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'aux', 'au', 'en', 'pour', 'avec', 'sur', 'par', 'votre', 'vos', 'à']);

function hashtags(ctx: AidaCtx): string {
  const head = ctx.sector.split(/[—\-–,(]/)[0];
  const words = head.split(/[^A-Za-zÀ-ÿ]+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  const tags: string[] = [];
  for (const w of words.slice(0, 3)) { const t = '#' + w.charAt(0).toUpperCase() + w.slice(1); if (!tags.includes(t)) tags.push(t); }
  const brand = '#' + (ctx.name || '').replace(/[^A-Za-zÀ-ÿ0-9]+/g, '');
  if (brand.length > 1 && !tags.includes(brand)) tags.push(brand);
  if (ctx.city) { const c = '#' + ctx.city.replace(/[^A-Za-zÀ-ÿ0-9]+/g, ''); if (!tags.includes(c)) tags.push(c); }
  return tags.join(' ');
}

/* Index déterministe (même sujet → même brouillon) pour varier sans aléatoire. */
function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length]; }
function seedOf(s: string): number { let n = 0; for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 100000; return n; }

export function buildAidaPost(item: PlanItem, ctx: AidaCtx): string {
  const k = item.pillarKey;
  const seed = seedOf(item.idea + k);
  const idea = stripDot(item.idea);
  const attn = pick(ATTENTION[k] || ATTENTION.expertise, seed).replace(/\{idea\}/g, idea).replace(/\{ideaLower\}/g, lower(idea));
  const interest = pick(INTEREST[k] || INTEREST.expertise, seed)
    .replace(/\{secteur\}/g, lower(ctx.sector.split(/[—\-–,(]/)[0].trim()))
    .replace(/\{marque\}/g, ctx.name);
  const benefit = pick(BENEFIT[k] || BENEFIT.expertise, seed);
  const cta = pick(CTA[k] || CTA.expertise, seed);
  const tags = hashtags(ctx);

  return [
    attn,
    '',
    interest,
    '',
    `✅ Ce que vous y gagnez : ${benefit}`,
    '',
    cta,
    '',
    tags,
  ].join('\n').trim();
}

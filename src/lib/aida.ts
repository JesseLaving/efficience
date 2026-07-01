import type { PlanItem } from './editorial';
import { profileFor } from './editorial';

/* ============================================================
   Rédacteur AIDA — transforme un SUJET du planning éditorial en
   brouillon de publication structuré : Attention · Intérêt · Désir
   (avantage pour l'audience) · Action (CTA).
   Propositions de copywriting à personnaliser, jamais de données
   chiffrées inventées (aucun chiffre/témoignage fabriqué).
   ============================================================ */

interface AidaCtx { sector: string; name: string; city: string; }

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const stripDot = (s: string) => s.replace(/[.…\s]+$/, '');

/* Accroche (Attention) — reprend le sujet et le rend percutant. */
const ATTENTION: Record<string, string[]> = {
  expertise: [
    '💡 {idea}',
    '🎯 Parlons clair : {ideaLower}',
    '👉 Ce que peu d'acteurs vous diront : {ideaLower}',
    '🧠 {idea}',
    '🎙️ Sur le terrain : {ideaLower}',
    '📐 La méthode derrière : {ideaLower}',
  ],
  preuve: [
    '📈 {idea}',
    '✅ La preuve par l'exemple : {ideaLower}',
    '🙌 {idea}',
    '🔥 Résultat concret : {ideaLower}',
    '📸 En image : {ideaLower}',
    '💯 Concret : {ideaLower}',
  ],
  pratique: [
    '🛠️ {idea}',
    '⚡ À appliquer dès aujourd'hui : {ideaLower}',
    '📌 {idea}',
    '✍️ Notez ça : {ideaLower}',
    '🎯 Simple, efficace, actionnable : {ideaLower}',
    '⚙️ Le bon outil pour ça : {ideaLower}',
  ],
  coulisses: [
    '👀 {idea}',
    '🎬 Dans les coulisses : {ideaLower}',
    '🤝 {idea}',
    '☕ {idea}',
    '🔑 La réalité du terrain : {ideaLower}',
    '🌟 Ce moment qu'on ne montre jamais : {ideaLower}',
  ],
  actualite: [
    '📰 {idea}',
    '🔎 À retenir : {ideaLower}',
    '🚀 {idea}',
    '⏳ {idea}',
    '📊 Ce que ça change vraiment : {ideaLower}',
    '💡 Pour anticiper : {ideaLower}',
  ],
  engagement: [
    '🗣️ {idea}',
    '🤔 {idea}',
    '💬 On a une question pour vous : {ideaLower}',
    '👇 {idea}',
    '👂 Dites-nous : {ideaLower}',
    '🎤 À votre tour : {ideaLower}',
  ],
  offre: [
    '✨ {idea}',
    '🎁 {idea}',
    '📣 {idea}',
    '🙌 {idea}',
    '🚀 Disponible maintenant : {ideaLower}',
    '🎯 Fait pour vous : {ideaLower}',
  ],
};

/* Intérêt — pourquoi ça compte (développe le sujet). */
const INTEREST: Record<string, string[]> = {
  expertise: [
    'Dans {secteur}, ce détail change vraiment la donne — et pourtant on l'oublie souvent.',
    'C'est le genre de point qui sépare ceux qui avancent de ceux qui stagnent.',
    'On nous pose souvent la question : voici une réponse claire, sans jargon.',
    'C'est souvent cette nuance qui change le résultat final.',
    'On préfère vous le dire maintenant plutôt que vous le découvrir après.',
  ],
  preuve: [
    'Les résultats parlent d'eux-mêmes quand la méthode est la bonne.',
    'Derrière chaque réussite, il y a une approche concrète, pas de la chance.',
    'Ce n'est pas de la théorie : c'est du vécu, sur le terrain.',
    'Ce résultat n'est pas du hasard : il y a une méthode reproductible derrière.',
    'On ne cite pas ça pour se valoriser — mais pour vous montrer ce qui est possible.',
  ],
  pratique: [
    'Pas besoin d'outil compliqué : juste la bonne méthode, au bon moment.',
    'Une habitude simple qui fait une vraie différence sur la durée.',
    'Le genre d'astuce qu'on aurait aimé connaître plus tôt.',
    'C'est le genre de chose qu'on met en place une fois et dont on profite longtemps.',
    'Pas besoin de formation : c'est utilisable dès maintenant.',
  ],
  coulisses: [
    'Chez {marque}, on aime montrer l'envers du décor — c'est là que tout se joue.',
    'Connaître les personnes derrière le service, ça change la relation.',
    'On vous ouvre les portes : voilà comment ça se passe vraiment.',
    'Ce qui se passe en coulisses explique souvent la qualité de ce qu'on livre.',
    'On croit au travail bien fait — et ça commence avant le début de la prestation.',
  ],
  actualite: [
    'Le secteur bouge vite : mieux vaut comprendre maintenant que subir plus tard.',
    'Ce qui change aujourd'hui aura un impact concret sur vos résultats demain.',
    'On a décrypté l'info pour vous, sans bla-bla.',
    'Mieux vaut comprendre maintenant que s'adapter dans la précipitation.',
    'L'information change vite : on préfère vous la donner dans le bon contexte.',
  ],
  engagement: [
    'Votre retour nous aide à créer des contenus vraiment utiles.',
    'On préfère construire avec vous plutôt que pour vous.',
    'Votre avis compte plus que vous ne le pensez.',
    'On ne crée pas de contenu dans le vide — vos retours nous guident vraiment.',
    'La meilleure façon d'être utile ? Écouter avant de parler.',
  ],
  offre: [
    'On a pensé cette proposition pour répondre à un besoin concret.',
    'Le bon accompagnement, au bon moment, fait toute la différence.',
    'Simple, clair, et fait pour vous faire avancer.',
    'Ce n'est pas une offre de plus — c'est une réponse à un besoin précis.',
    'On a réfléchi à la meilleure façon de vous accompagner, pas juste à la plus rentable.',
  ],
};

/* Amplificateur de désir — ajoute une 2e phrase d'envie (parfois). */
const AMPLIFY = ['Et le mieux ? C'est plus simple que ça en a l'air.', 'Imaginez le temps gagné une fois que c'est en place.', 'Beaucoup s'en privent encore — pas vous.', ''];

/* Désir — l'avantage explicite pour l'audience, par pilier puis par profil. */
const BENEFIT: Record<string, string[]> = {
  expertise: [
    'une décision plus claire, sans perdre de temps ni d'argent.',
    'une longueur d'avance, en évitant les erreurs coûteuses.',
    'un point de vue clair qui vous aide à prendre la bonne décision.',
    'une grille de lecture pour comprendre les enjeux avant d'agir.',
  ],
  preuve: [
    'la certitude que ça fonctionne vraiment, preuves à l'appui.',
    'la confiance de savoir où vous mettez les pieds.',
    'l'assurance que vous partez sur de bonnes bases.',
    'un retour d'expérience concret, pas de la théorie.',
  ],
  pratique: [
    'une astuce applicable dès aujourd'hui, concrète et gratuite.',
    'un résultat visible rapidement, sans complexité.',
    'du temps récupéré chaque semaine sur les tâches récurrentes.',
    'une méthode simple qui dure, pas un raccourci qui s'use.',
  ],
  coulisses: [
    'une relation de confiance avec une équipe que vous connaissez.',
    'la tranquillité de travailler avec des personnes, pas juste une marque.',
    'la conviction de choisir les bonnes personnes.',
    'une relation transparente, sans zone d'ombre.',
  ],
  actualite: [
    'une longueur d'avance sur ce qui change dans votre secteur.',
    'des décisions éclairées avant tout le monde.',
    'la capacité à agir vite quand une opportunité se présente.',
    'la sérénité de savoir que vous n'êtes pas dépassé par les événements.',
  ],
  engagement: [
    'un contenu qui répond vraiment à VOS questions.',
    'la satisfaction d'être écouté et pris en compte.',
    'un service qui colle à vos attentes réelles.',
    'la sensation d'être compris avant même d'avoir tout expliqué.',
  ],
  offre: [
    'un accompagnement concret, adapté précisément à votre besoin.',
    'un gain de temps et de sérénité dès maintenant.',
    'la certitude de ne pas payer pour ce dont vous n'avez pas besoin.',
    'un accompagnement ajusté à votre rythme et à votre budget.',
  ],
};

const BENEFIT_PROFILE: Record<string, Partial<Record<string, string[]>>> = {
  formation: {
    offre: ['une montée en compétences directement applicable, finançable.'],
    expertise: ['des décisions commerciales plus sûres, dès la semaine prochaine.'],
  },
  restauration: {
    offre: ['une table qui vous attend et un vrai moment de plaisir.'],
    coulisses: ['l'envie de pousser la porte, comme à la maison.'],
  },
  sante: {
    offre: ['un suivi attentif et un rendez-vous facile à prendre.'],
    expertise: ['les bons réflexes pour prendre soin de vous sereinement.'],
  },
  beaute: {
    offre: ['un moment pour vous, et un résultat qui se voit.'],
    pratique: ['une beauté simple à entretenir au quotidien.'],
  },
  immobilier: {
    offre: ['un projet immobilier mené sans stress, au bon prix.'],
    expertise: ['les clés pour vendre ou acheter au bon moment.'],
  },
  artisanat: {
    offre: ['un travail soigné, un devis clair, zéro mauvaise surprise.'],
    preuve: ['la garantie d'un savoir-faire qui dure.'],
  },
  commerce: {
    offre: ['la bonne trouvaille, près de chez vous.'],
    pratique: ['le bon choix, sans vous tromper.'],
  },
  btob: {
    offre: ['un ROI mesurable et un déploiement sans friction.'],
    expertise: ['un avantage concurrentiel concret pour vos équipes.'],
  },
  agence: {
    expertise: ['une communication cohérente qui renforce votre crédibilité durablement.', 'des outils de communication efficaces et durables.'],
    offre: ['une image soignée qui reflète vraiment votre valeur.', 'un partenaire créatif qui comprend votre business.'],
  },
  tech: {
    expertise: ['une compréhension claire des enjeux pour faire les bons choix technologiques.', 'un avantage concurrentiel durable grâce aux bons outils.'],
    offre: ['un gain d'efficacité opérationnelle mesurable.', 'une solution qui s'adapte à votre croissance.'],
  },
  liberal: {
    expertise: ['la tranquillité d'esprit de savoir que vous êtes bien conseillé.', 'des décisions éclairées dans un domaine qui demande de l'expertise.'],
    offre: ['un accompagnement personnalisé, sans jargon superflu.', 'la certitude que votre dossier est entre de bonnes mains.'],
  },
};

/* Action — le CTA, par pilier puis par profil. */
const CTA: Record<string, string[]> = {
  expertise: [
    '💬 Une question sur le sujet ? Posez-la en commentaire.',
    '🔖 Enregistrez ce post et partagez-le à qui en a besoin.',
    '💡 Partagez ce post à quelqu'un qui en a besoin.',
    '📝 Notez-le et appliquez-le dès cette semaine.',
  ],
  preuve: [
    '📩 Envie d'un résultat similaire ? Écrivez-nous en message privé.',
    '👉 Parlons de votre projet : contactez-nous dès aujourd'hui.',
    '🔖 Enregistrez ce post pour y revenir.',
    '💬 Une question sur ce résultat ? Posez-la en commentaire.',
  ],
  pratique: [
    '🔖 Enregistrez ce post pour le retrouver au bon moment.',
    '💬 Dites-nous en commentaire si vous allez l'essayer.',
    '🔁 Partagez à un collègue qui gagnerait du temps avec ça.',
    '📩 Envoyez-nous un message : on vous aide à mettre ça en place.',
  ],
  coulisses: [
    '👋 Venez nous rencontrer — on vous répond avec plaisir.',
    '❤️ Suivez-nous pour découvrir les coulisses chaque semaine.',
    '📸 Partagez votre propre coulisse en commentaire !',
    '📩 Contactez-nous pour en savoir plus.',
  ],
  actualite: [
    '🔔 Abonnez-vous pour ne rien manquer.',
    '💬 Et vous, comment anticipez-vous ce changement ?',
    '💬 Et vous, comment vous adaptez-vous à ce changement ?',
    '📌 Enregistrez pour retrouver l'info au bon moment.',
  ],
  engagement: [
    '👇 Dites-nous ce que vous en pensez en commentaire.',
    '🗳️ Répondez en story / en commentaire, on lit tout !',
    '🔔 Abonnez-vous pour ne manquer aucune question de la semaine.',
    '🤝 Taguez un collègue qui aurait son mot à dire !',
  ],
  offre: [
    '📅 Réservez votre échange découverte (lien en bio).',
    '📲 Contactez-nous dès maintenant pour en profiter.',
    '💬 Des questions avant de vous décider ? On vous répond.',
    '⏳ Disponibilité limitée — profitez-en maintenant.',
  ],
};

const CTA_PROFILE: Record<string, Partial<Record<string, string[]>>> = {
  formation: {
    offre: ['📅 Réservez votre diagnostic offert — lien en bio.', '🎓 Places limitées : inscrivez-vous dès aujourd'hui.'],
  },
  restauration: {
    offre: ['📅 Réservez votre table dès maintenant.', '📍 On vous attend à {ville} !'],
  },
  sante: {
    offre: ['📅 Prenez rendez-vous en ligne en quelques clics.'],
  },
  beaute: {
    offre: ['📅 Réservez votre soin — lien en bio.'],
  },
  immobilier: {
    offre: ['📲 Estimation gratuite : contactez-nous.', '🔑 Visite sur demande — écrivez-nous.'],
  },
  artisanat: {
    offre: ['📲 Demandez votre devis gratuit dès aujourd'hui.'],
  },
  commerce: {
    offre: ['🛍️ Passez en boutique ou commandez en ligne.'],
  },
  btob: {
    offre: ['📅 Réservez une démo de 20 min.', '📩 Recevez l'étude de cas en MP.'],
  },
  agence: {
    offre: ['📅 Réservons un appel découverte — on vous fera une proposition.', '📸 Demandez votre audit communication gratuit.'],
  },
  tech: {
    offre: ['📅 Réservez votre démo de 20 minutes.', '🚀 Commencez votre essai gratuit dès maintenant.'],
  },
  liberal: {
    offre: ['📅 Prenez rendez-vous pour une première consultation.', '📩 Envoyez-nous votre situation : on vous répond sous 48h.'],
  },
};

const STOP = new Set(['et', 'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'aux', 'au', 'en', 'pour', 'avec', 'sur', 'par', 'votre', 'vos', 'à']);

function pickBank(base: Record<string, string[]>, prof: Record<string, Partial<Record<string, string[]>>>, profile: string, k: string): string[] {
  const o = prof[profile]; const pv = o && o[k];
  return (pv && pv.length ? pv : base[k]) || base.expertise || [];
}

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
  const profile = profileFor(ctx.sector);
  const seed = seedOf(item.idea + k);
  const idea = stripDot(item.idea);
  const sectorShort = lower(ctx.sector.split(/[—\-–,(]/)[0].trim());

  const attn = pick(ATTENTION[k] || ATTENTION.expertise, seed).replace(/\{idea\}/g, idea).replace(/\{ideaLower\}/g, lower(idea));
  let interest = pick(INTEREST[k] || INTEREST.expertise, seed).replace(/\{secteur\}/g, sectorShort).replace(/\{marque\}/g, ctx.name);
  const amp = pick(AMPLIFY, seed + 3);
  if (amp) interest += ' ' + amp;
  const benefit = pick(pickBank(BENEFIT, BENEFIT_PROFILE, profile, k), seed);
  const cta = pick(pickBank(CTA, CTA_PROFILE, profile, k), seed).replace(/\{ville\}/g, ctx.city || 'chez nous');
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

/* ============================================================
   Générateur de planning éditorial.
   Produit des PROPOSITIONS de contenu (le cœur métier de l'app),
   pas des données chiffrées inventées : les dates sont réelles
   (calculées à partir d'aujourd'hui) et chaque idée est un point
   de départ à personnaliser selon le secteur de l'entreprise.
   ============================================================ */

export interface Pillar { key: string; label: string; format: string; network: string; }

/* Les 7 piliers d'une ligne éditoriale équilibrée. */
export const PILLARS: Pillar[] = [
  { key: 'expertise',  label: 'Expertise & conseil',     format: 'Carrousel',     network: 'linkedin' },
  { key: 'preuve',     label: 'Preuve & résultats',      format: 'Post',          network: 'instagram' },
  { key: 'pratique',   label: 'Astuce pratique',         format: 'Carrousel',     network: 'instagram' },
  { key: 'coulisses',  label: 'Coulisses & humain',      format: 'Reel / Story',  network: 'instagram' },
  { key: 'actualite',  label: 'Actualité du secteur',    format: 'Post',          network: 'linkedin' },
  { key: 'engagement', label: 'Question & échange',      format: 'Story',         network: 'facebook' },
  { key: 'offre',      label: 'Offre & service',         format: 'Post',          network: 'google' },
];

export interface DurationOption { key: string; label: string; weeks: number; }
export const DURATIONS: DurationOption[] = [
  { key: '1w', label: '1 semaine', weeks: 1 },
  { key: '1m', label: '1 mois',    weeks: 4 },
  { key: '3m', label: '3 mois',    weeks: 13 },
  { key: '6m', label: '6 mois',    weeks: 26 },
  { key: '1y', label: '1 an',      weeks: 52 },
];

export const SECTOR_PRESETS = [
  'Conseil & formation',
  'Commerce & boutique',
  'Restauration',
  'Santé & bien-être',
  'Beauté & esthétique',
  'Immobilier',
  'Artisanat & BTP',
  'Services B2B',
  'Agence de communication',
  'Tech & SaaS',
  'Profession libérale',
];

/* ---------- banques d'idées ---------- */
const DEFAULT_IDEAS: Record<string, string[]> = {
  expertise: [
    'Expliquez une notion clé de votre métier ({secteur}) que vos clients comprennent souvent mal.',
    '3 erreurs fréquentes dans {secteur} — et comment les éviter.',
    'Votre point de vue d’expert sur une idée reçue de votre secteur.',
    'Le mini-guide : par où commencer quand on fait appel à {secteur}.',
    'Ce que vous faites différemment de la concurrence, et pourquoi ça compte.',
    'La question qu’on vous pose le plus souvent — votre réponse claire et directe.',
  ],
  preuve: [
    'Partagez un résultat concret obtenu pour un client (avant / après).',
    'Témoignage client : reprenez une phrase forte d’un retour reçu.',
    'Étude de cas courte : le problème, votre solution, le résultat.',
    'Un chiffre dont vous êtes fier ce mois-ci, expliqué simplement.',
    'Avant / après en images : ce que vous avez transformé récemment.',
    'La question d’un client qui vous a poussé à améliorer votre approche.',
  ],
  pratique: [
    'Une astuce actionnable que vos clients peuvent appliquer dès aujourd’hui.',
    'Checklist : les étapes pour réussir une tâche clé de votre domaine.',
    'Le « à faire / à éviter » de votre métier, en carrousel.',
    'Répondez à la question qu’on vous pose le plus souvent.',
    'Un raccourci ou une méthode qui vous fait gagner du temps chaque semaine.',
    'L’outil ou la ressource indispensable dans votre quotidien professionnel.',
  ],
  coulisses: [
    'Montrez les coulisses d’une journée type à {ville}.',
    'Présentez un membre de l’équipe ou votre parcours en 60 secondes.',
    'Le « making-of » d’un projet ou d’une prestation récente.',
    'Votre espace de travail et les outils de votre quotidien.',
    'Le moment de la semaine que vous préférez dans votre métier — et pourquoi.',
    'Une anecdote de terrain : ce que peu de gens savent de votre quotidien.',
  ],
  actualite: [
    'Votre réaction à une actualité ou une tendance de votre secteur.',
    'Une nouveauté, une réglementation ou une bonne pratique à connaître.',
    'Ce qui change cette saison dans {secteur}.',
    'Partagez un article inspirant et donnez votre avis dessus.',
    'Une tendance émergente dans {secteur} — et comment elle impactera vos clients.',
    'Ce que l’actualité économique signifie concrètement pour votre clientèle.',
  ],
  engagement: [
    'Posez une question à votre communauté (sondage en story).',
    '« Cette semaine je… » — invitez vos abonnés à compléter.',
    'Ceci ou cela ? Un petit duel pour faire réagir.',
    'Demandez quel sujet ils aimeraient que vous traitiez ensuite.',
    'Partagez votre avis sur une pratique courante : êtes-vous pour ou contre ?',
    'Invitez votre communauté à partager leur plus grande difficulté du moment.',
  ],
  offre: [
    'Présentez une offre ou un service phare avec un appel à l’action clair.',
    'Rappelez comment vous contacter / prendre rendez-vous à {ville}.',
    'Mettez en avant une nouveauté ou une disponibilité.',
    'Offre spéciale ou créneau limité — incitez à passer à l’action.',
    'Expliquez votre processus d’accompagnement étape par étape.',
    'Répondez à l’objection principale de vos prospects — et débloquez-la.',
  ],
};

/* Overrides par profil de secteur (les piliers non listés retombent sur DEFAULT). */
const PROFILE_IDEAS: Record<string, Partial<Record<string, string[]>>> = {
  formation: {
    expertise: [
      'Décryptez un concept de stratégie commerciale en 3 slides.',
      'Les 3 leviers que la plupart des dirigeants négligent en marketing.',
      'Votre méthode pour structurer une offre qui se vend.',
      'Mythe vs réalité sur la formation professionnelle.',
      'Comment savoir si une formation vous conviendra vraiment ? Les bons critères.',
    ],
    preuve: [
      'Résultat d’un accompagnement : l’objectif fixé et ce que le client a obtenu.',
      'Verbatim d’un stagiaire à la fin d’une formation.',
      'Étude de cas : situation de départ → plan d’action → résultat mesurable.',
    ],
    pratique: [
      'Checklist : préparer un entretien commercial qui convertit.',
      'Modèle prêt à l’emploi : trame d’email ou script d’appel.',
      '5 minutes pour améliorer votre pitch dès demain.',
      'Reproduisez cette méthode en 4 étapes pour structurer votre prospection.',
    ],
    actualite: [
      'Évolution du marché : ce que les dirigeants doivent anticiper.',
      'Financement de la formation : ce qui change cette année.',
    ],
    offre: [
      'Présentez une formation à venir (finançable, Qualiopi).',
      'Proposez un diagnostic ou un premier RDV découverte gratuit.',
      'Places limitées sur votre prochain atelier à {ville}.',
    ],
  },
  restauration: {
    preuve: ['Le plat signature en photo + l’histoire derrière.', 'Un avis client 5 étoiles mis en valeur.', 'Le meilleur retour de la semaine — en image.'],
    pratique: ['L’accord met / boisson de la semaine.', 'Comment on choisit nos produits (qualité, local).', 'La recette simplifiée d’un de vos incontournables.'],
    coulisses: ['La cuisine en plein service.', 'Présentez le chef ou un membre de l’équipe.', 'La préparation d’un plat en accéléré.', 'L’arrivage du matin : vos produits frais du jour.'],
    offre: ['Le menu / la carte du moment.', 'Réservez votre table à {ville} ce week-end.', 'Offre déjeuner ou happy hour.', 'Menu spécial pour l’événement de la semaine.'],
  },
  sante: {
    expertise: ['Démêlez le vrai du faux sur un sujet santé courant.', 'Un conseil de prévention simple à appliquer.', 'La question santé la plus posée en ce moment — la réponse du professionnel.'],
    preuve: ['Le parcours d’un patient (avec son accord) : avant / après.', 'Une question fréquente en consultation, expliquée.'],
    coulisses: ['Présentez votre cabinet et votre approche.', 'Une journée au cabinet à {ville}.', 'Les coulisses d’une journée de consultations (sans patient identifiable).'],
    offre: ['Prendre rendez-vous : créneaux et modalités.', 'Nouvelle prestation ou nouvel horaire disponible.', 'Téléconsultation disponible — comment ça marche.'],
  },
  beaute: {
    preuve: ['Une transformation avant / après (avec accord client).', 'Un avis client mis en avant.', 'La réalisation de la semaine — technique et résultat.'],
    pratique: ['Routine ou astuce beauté à reproduire chez soi.', 'Le produit / soin qu’on recommande et pourquoi.', 'Comment entretenir ce soin entre deux rendez-vous.'],
    coulisses: ['L’ambiance du salon à {ville}.', 'Présentez l’équipe ou une nouvelle technique.', 'L’envers du décor : la préparation avant l’ouverture.'],
    offre: ['Prenez RDV en ligne.', 'Offre de saison ou nouveau soin à découvrir.', 'Pack cadeau à offrir — idée originale pour une occasion spéciale.'],
  },
  immobilier: {
    expertise: ['Décryptez le marché immobilier de {ville} en 3 points clés.', 'Les étapes d’une vente réussie, expliquées.', 'Comment négocier au bon moment — les signaux à surveiller.'],
    preuve: ['Bien vendu : le défi et le résultat (délai, prix).', 'Témoignage d’un client vendeur ou acheteur.'],
    pratique: ['Checklist pour préparer la visite de son bien.', 'Les erreurs à éviter quand on vend.', 'Comment estimer soi-même la valeur de son bien (méthode simple).'],
    offre: ['Nouveau bien à la vente — visite sur demande.', 'Estimation gratuite de votre bien à {ville}.'],
  },
  artisanat: {
    preuve: ['Chantier terminé : avant / après en images.', 'Un avis client après intervention.', 'Le projet du mois : ce qui a été réalisé et le résultat final.'],
    pratique: ['Le bon réflexe d’entretien pour éviter les soucis.', 'Comment bien choisir son artisan.', 'Les signes qui montrent qu’il faut intervenir rapidement.'],
    coulisses: ['Un chantier en cours étape par étape.', 'Le savoir-faire et les outils du métier.', 'Une journée de travail sur le terrain à {ville}.'],
    offre: ['Demandez un devis gratuit à {ville}.', 'Disponibilités du moment pour vos travaux.', 'Intervention rapide possible — contactez-nous.'],
  },
  commerce: {
    preuve: ['Le produit best-seller du moment et pourquoi il plaît.', 'Un avis client mis en avant.', 'Coup de cœur client : ce produit qu’on recommande depuis des mois.'],
    pratique: ['Comment bien choisir / utiliser un de vos produits.', 'Nos coups de cœur de la saison.', 'Guide d’achat rapide : quel produit pour quel besoin.'],
    coulisses: ['Les coulisses de la boutique à {ville}.', 'L’arrivage / le réassort en vidéo.', 'La sélection de la semaine : comment on choisit nos produits.'],
    offre: ['Nouveauté en rayon — venez la découvrir.', 'Offre ou click & collect à {ville}.', 'Promo de la semaine — en boutique seulement.'],
  },
  btob: {
    expertise: ['Un insight sur votre marché B2B.', 'Le problème métier que vous résolvez, en clair.', 'Pourquoi la plupart des solutions échouent sur ce type de défi.'],
    preuve: ['Cas client : contexte, solution, résultat obtenu.', 'Un témoignage client à mettre en avant.'],
    pratique: ['Un framework ou un modèle utile à vos prospects.', 'La FAQ d’un acheteur type, traitée.', 'Les 3 questions à poser avant de choisir un fournisseur dans votre domaine.'],
    offre: ['Réservez une démo ou un audit.', 'Téléchargez notre ressource (livre blanc, étude).', 'Prenez RDV pour un diagnostic gratuit.'],
  },
  agence: {
    expertise: [
      'Les 3 erreurs de communication que font la plupart des PME (et comment les corriger).',
      'Pourquoi votre identité visuelle doit évoluer tous les 3 à 5 ans.',
      'Personal branding vs. brand entreprise : par quoi commencer ?',
      'Le brief créatif parfait : ce qu’il doit absolument contenir.',
    ],
    preuve: [
      'Avant / après : refonte de l’identité visuelle d’un client à {ville}.',
      'Campagne réussie : le concept, le déploiement, les retombées.',
      'Projet du mois : les coulisses de la création.',
    ],
    pratique: [
      '5 règles pour une prise de parole plus impactante sur les réseaux.',
      'Checklist : préparer un brief créatif en 10 minutes.',
      'Comment choisir les bons visuels pour votre communication — sans être graphiste.',
    ],
    actualite: [
      'Les tendances design qui dominent en ce moment — et celles à éviter.',
      'Ce que les algorithmes favorisent cette année — décryptage pratique.',
      'Le format de contenu qui performe le mieux en ce moment sur chaque réseau.',
    ],
    offre: [
      'Nos formules d’accompagnement communication — voyons ensemble.',
      'Vous souhaitez retravailler votre image ? Prenons 30 minutes.',
      'Audit de communication offert — demandez le vôtre à {ville}.',
    ],
  },
  tech: {
    expertise: [
      'Comment choisir le bon outil pour votre équipe sans vous perdre dans les comparatifs.',
      'Les 3 indicateurs que vous devriez suivre mais que vous négligez.',
      'Par où commencer votre transformation digitale — le bon ordre.',
      'Sécurité, RGPD, conformité : ce que vous devez savoir en pratique.',
    ],
    preuve: [
      'Cas client : comment leur défi a été résolu grâce à notre approche.',
      'Déploiement terminé : ce qui a changé à J+90 pour notre client.',
    ],
    pratique: [
      'Automatisez cette tâche répétitive en quelques minutes avec les bons outils.',
      'Le workflow que nos utilisateurs les plus efficaces ont en commun.',
      'Un raccourci ou une intégration que vous n’utilisez peut-être pas encore.',
    ],
    actualite: [
      'Ce que l’IA change concrètement dans votre secteur — sans le bla-bla.',
      'La réglementation IA / RGPD : ce que vous devez savoir dès maintenant.',
      'La nouveauté tech de la semaine qui va vraiment changer les usages.',
    ],
    offre: [
      'Démo en 20 minutes : voyez notre solution en conditions réelles.',
      'Essai gratuit sans engagement — commencez maintenant.',
      'Audit ou diagnostic offert pour votre infrastructure actuelle.',
    ],
  },
  liberal: {
    expertise: [
      'La question que vos clients vous posent le plus souvent — et la réponse claire.',
      'Démystifier une idée reçue courante dans votre domaine d’exercice.',
      'Quand faut-il absolument consulter un professionnel ? Les bons repères.',
      'La différence entre deux notions souvent confondues — expliquée simplement.',
    ],
    preuve: [
      'Un dossier mené à bien : la situation, l’approche, le résultat (anonymisé).',
      'Ce que vos clients apprécient dans votre accompagnement — en leurs mots.',
    ],
    pratique: [
      'Les documents à rassembler avant votre rendez-vous — liste pratique.',
      'Ce que vous pouvez gérer vous-même, et ce qu’il vaut mieux déléguer.',
      'Un point de vigilance à connaître absolument dans votre situation.',
    ],
    actualite: [
      'Ce que change la nouvelle réglementation pour vos clients à {ville}.',
      'Veille professionnelle : une décision ou évolution à connaître dans votre domaine.',
      'L’actualité de votre profession ce mois-ci — décryptée sans jargon.',
    ],
    offre: [
      'Première consultation à {ville} — prenez rendez-vous en ligne.',
      'Honoraires transparents : comment on travaille avec vous.',
      'Accompagnement disponible à distance ou à {ville} — demandez-nous.',
    ],
  },
};

export function profileFor(sector: string): string {
  const s = sector.toLowerCase();
  if (/(formation|conseil|coach|consult|forma)/.test(s)) return 'formation';
  if (/(restau|food|traiteur|boulang|p[âa]tiss|caf[ée]|\bbar\b|pizz|cuisine|brasserie)/.test(s)) return 'restauration';
  if (/(sant[ée]|m[ée]dical|kin[ée]|ost[ée]o|infirm|dentaire|bien.?[êe]tre|naturo|sophro|psy|th[ée]rap)/.test(s)) return 'sante';
  if (/(beaut[ée]|esth[ée]tique|coiff|ongle|\bspa\b|maquill|barbier)/.test(s)) return 'beaute';
  if (/(immobil|courtier)/.test(s)) return 'immobilier';
  if (/(artisan|b[âa]timent|\bbtp\b|plomb|[ée]lectri|menuis|ma[çc]on|r[ée]nov|peinture|couvreur|paysag)/.test(s)) return 'artisanat';
  if (/(commerce|boutique|magasin|retail|pr[êe]t.?[àa].?porter|d[ée]co|fleur|[ée]picerie)/.test(s)) return 'commerce';
  if (/(agence\b|communication\b|publicit[ée]|graphiste|cr[ée]atif)/.test(s)) return 'agence';
  if (/(saas|logiciel|digital\b|\bapp\b|informatique|cloud|cyber|software|num[ée]rique)/.test(s)) return 'tech';
  if (/(avocat|notaire|expert.comptable|comptable\b|architecte\b|juriste|lib[ée]rale)/.test(s)) return 'liberal';
  if (/(b2b|btob|industri|grossiste|service.{0,8}entreprise|fournisseur)/.test(s)) return 'btob';
  return 'default';
}

function ideasFor(profile: string, pillarKey: string): string[] {
  const o = PROFILE_IDEAS[profile];
  return (o && o[pillarKey]) || DEFAULT_IDEAS[pillarKey] || [];
}

/* Raccourcit un secteur libellé long pour qu'il s'insère naturellement dans une phrase. */
function sectorShort(sector: string): string {
  const cut = sector.split(/[—\-–,(]/)[0].trim();
  const w = cut.toLowerCase();
  return w || sector.toLowerCase();
}

export interface PlanItem {
  date: string;        // ISO yyyy-mm-dd
  label: string;       // "lun. 24 juin"
  monthLabel: string;  // "juin 2026"
  weekIndex: number;
  pillarKey: string;
  pillar: string;
  format: string;
  network: string;
  idea: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Jours de publication préférés, par ordre de priorité (getDay : 0=dim). */
const PREF_DAYS = [2, 4, 1, 3, 5, 6, 0];

export function generatePlan(opts: { sector: string; city?: string; weeks: number; perWeek: number }): PlanItem[] {
  const { sector, city = '', weeks, perWeek } = opts;
  const profile = profileFor(sector);
  const secShort = sectorShort(sector);
  const cityTxt = city || 'votre ville';

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today); monday.setDate(today.getDate() + mondayOffset);

  const items: PlanItem[] = [];
  const ideaIdx: Record<string, number> = {};
  let pillarCounter = 0;

  for (let w = 0; w < weeks; w++) {
    const slots: Date[] = [];
    for (let i = 0; i < perWeek; i++) {
      const g = PREF_DAYS[i % 7];
      const off = g === 0 ? 6 : g - 1;
      const d = new Date(monday);
      d.setDate(monday.getDate() + w * 7 + off);
      if (d >= today) slots.push(d);
    }
    slots.sort((a, b) => a.getTime() - b.getTime());

    for (const d of slots) {
      const pillar = PILLARS[pillarCounter % PILLARS.length];
      pillarCounter++;
      const bank = ideasFor(profile, pillar.key);
      const k = pillar.key;
      ideaIdx[k] = ideaIdx[k] ?? 0;
      const raw = bank.length ? bank[ideaIdx[k] % bank.length] : '';
      ideaIdx[k]++;
      const idea = raw.replace(/\{secteur\}/g, secShort).replace(/\{ville\}/g, cityTxt);
      items.push({
        date: iso(d),
        label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
        monthLabel: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        weekIndex: w,
        pillarKey: pillar.key,
        pillar: pillar.label,
        format: pillar.format,
        network: pillar.network,
        idea,
      });
    }
  }
  return items;
}

/* Construit un CSV téléchargeable du planning. */
export function planToCsv(items: PlanItem[]): string {
  const head = ['Date', 'Pilier', 'Format', 'Réseau', 'Idée de publication'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const rows = items.map((p) => [p.date, p.pillar, p.format, p.network, p.idea].map(esc).join(','));
  return [head.map(esc).join(','), ...rows].join('\r\n');
}

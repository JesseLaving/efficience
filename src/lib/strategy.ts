/* Stratégie & audience — réponses au questionnaire du Configurateur.
   Distinct du profil (identité légale/site) : ce sont les réponses qualitatives
   qui pilotent la personnalisation de l'IA (ton, cible, objectif) et le choix
   des KPI initiaux. Persisté en localStorage, synchronisé par espace comme le
   reste (voir AuthWrapper). */
const LS = 'eff_strategy_v1';

export type Goal = 'notoriete' | 'leads' | 'ventes' | 'fidelisation';

export const TONES = ['Professionnel', 'Chaleureux', 'Direct', 'Inspirant', 'Humoristique'];

export const FREQUENCIES = ['Quotidienne', 'Plusieurs fois par semaine', 'Hebdomadaire', 'Mensuelle'];

export const GOALS: { key: Goal; label: string }[] = [
  { key: 'notoriete', label: 'Notoriété & visibilité' },
  { key: 'leads', label: 'Génération de leads' },
  { key: 'ventes', label: 'Ventes directes' },
  { key: 'fidelisation', label: 'Fidélisation clients' },
];

export interface SpaceStrategy {
  audience: string;
  products: string;
  goal: Goal | '';
  tone: string;
  frequency: string;
  competitors?: string;
  differentiators?: string;
  /** Réponse à la question spécifique au secteur (voir SECTOR_QUESTIONS) —
      alimente un KPI supplémentaire pertinent en plus de ceux liés à l'objectif. */
  sectorAnswerKpi?: string;
  capturedAt: string;
}

export interface SectorQuestion { question: string; options: { label: string; kpi: string }[]; }

/* Une question ciblée par profil de secteur (voir profileFor() dans
   editorial.ts) — chaque réponse pointe vers un KPI du catalogue (kpi.ts)
   pertinent pour ce type d'activité, en complément des KPI liés à l'objectif
   prioritaire. */
export const SECTOR_QUESTIONS: Record<string, SectorQuestion> = {
  formation: {
    question: 'Comment délivrez-vous principalement vos formations ?',
    options: [
      { label: 'En présentiel', kpi: 'orders' },
      { label: 'À distance / e-learning', kpi: 'siteClicks' },
      { label: 'Les deux', kpi: 'orders' },
    ],
  },
  restauration: {
    question: 'Quel type d’établissement gérez-vous ?',
    options: [
      { label: 'Restaurant traditionnel', kpi: 'gRating' },
      { label: 'Vente à emporter / fast-food', kpi: 'orders' },
      { label: 'Traiteur / événementiel', kpi: 'messages' },
    ],
  },
  sante: {
    question: 'Comment vos patients prennent-ils rendez-vous ?',
    options: [
      { label: 'Plateforme en ligne (Doctolib…)', kpi: 'siteClicks' },
      { label: 'Téléphone / accueil', kpi: 'messages' },
    ],
  },
  beaute: {
    question: 'Comment vos clients réservent-ils principalement ?',
    options: [
      { label: 'En ligne', kpi: 'siteClicks' },
      { label: 'Téléphone / en institut', kpi: 'messages' },
    ],
  },
  immobilier: {
    question: 'Quel type de transactions gérez-vous principalement ?',
    options: [
      { label: 'Vente', kpi: 'orders' },
      { label: 'Location', kpi: 'messages' },
      { label: 'Les deux', kpi: 'orders' },
    ],
  },
  artisanat: {
    question: 'D’où viennent principalement vos demandes de devis ?',
    options: [
      { label: 'Votre site web', kpi: 'siteClicks' },
      { label: 'Bouche-à-oreille / recommandation', kpi: 'gRating' },
    ],
  },
  commerce: {
    question: 'Vendez-vous aussi en ligne ?',
    options: [
      { label: 'Boutique uniquement', kpi: 'gViews' },
      { label: 'Boutique + vente en ligne', kpi: 'siteClicks' },
    ],
  },
  btob: {
    question: 'Votre cycle de vente est plutôt…',
    options: [
      { label: 'Court (moins d’un mois)', kpi: 'orders' },
      { label: 'Long (plusieurs mois)', kpi: 'crmContacts' },
    ],
  },
  agence: {
    question: 'Quel est votre type de mission le plus fréquent ?',
    options: [
      { label: 'Projets ponctuels', kpi: 'orders' },
      { label: 'Accompagnement récurrent', kpi: 'crmContacts' },
    ],
  },
  tech: {
    question: 'Quel est votre modèle économique principal ?',
    options: [
      { label: 'Abonnement (SaaS)', kpi: 'newSubs' },
      { label: 'Licence / vente unique', kpi: 'orders' },
    ],
  },
  liberal: {
    question: 'Comment vos clients vous contactent-ils le plus souvent ?',
    options: [
      { label: 'Prise de rendez-vous en ligne', kpi: 'siteClicks' },
      { label: 'Téléphone / recommandation', kpi: 'messages' },
    ],
  },
  default: {
    question: 'Comment vos clients vous contactent-ils le plus souvent ?',
    options: [
      { label: 'Votre site web', kpi: 'siteClicks' },
      { label: 'Téléphone / réseaux sociaux', kpi: 'messages' },
    ],
  },
};

export function loadStrategy(): SpaceStrategy | null {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? JSON.parse(raw) as SpaceStrategy : null;
  } catch { return null; }
}

export function saveStrategy(s: SpaceStrategy): void {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ }
}

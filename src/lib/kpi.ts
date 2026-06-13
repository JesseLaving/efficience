import { UI, BRAND } from './icons';

export interface Trend { dir: 'up' | 'down' | 'neutral'; val: string; since?: string; }
export interface KpiDef {
  label: string;
  icon: string;
  src: string;
  val: number;
  live?: 'reach';
  fmt: string;
  trend?: Trend;
  suggested?: boolean;
  why?: string;
  target?: number;
  custom?: boolean;
}

/* ---------- source labels (data origin) ---------- */
export const SRC: Record<string, { label: string; glyph: string }> = {
  global: { label: 'Tous réseaux', glyph: UI.target },
  instagram: { label: 'Instagram', glyph: BRAND.instagram },
  facebook: { label: 'Facebook', glyph: BRAND.facebook },
  google: { label: 'Google Business', glyph: BRAND.google },
  tiktok: { label: 'TikTok', glyph: BRAND.tiktok },
  site: { label: 'Site web', glyph: UI.link },
  crm: { label: 'Base clients', glyph: UI.users },
  email: { label: 'E-mailing', glyph: UI.mail },
  manual: { label: 'Saisie manuelle', glyph: UI.edit },
};

/* ---------- KPI catalogue (linked to the business activity) ---------- */
export const CATALOG: Record<string, KpiDef> = {
  subs: { label: 'Abonnés · tous réseaux', icon: 'users', src: 'global', val: 0, live: 'reach', fmt: 'int', trend: { dir: 'up', val: '+128', since: 'sur 30 jours' } },
  engagement: { label: 'Taux d’engagement', icon: 'heart', src: 'global', val: 6.1, fmt: 'pct', trend: { dir: 'up', val: '+0,4 pt', since: 'vs. mois préc.' } },
  posts: { label: 'Posts à venir', icon: 'calendar', src: 'global', val: 8, fmt: 'int', trend: { dir: 'neutral', val: 'cette semaine' } },
  review: { label: 'À valider', icon: 'clock', src: 'global', val: 3, fmt: 'int', trend: { dir: 'down', val: 'action requise' } },

  reach: { label: 'Portée locale · 30j', icon: 'target', src: 'global', val: 18420, fmt: 'int', trend: { dir: 'up', val: '+34 %', since: 'vs. mois préc.' }, suggested: true, why: 'Vos réseaux connectés' },
  gRating: { label: 'Note Google', icon: 'target', src: 'google', val: 4.8, fmt: 'rating', trend: { dir: 'up', val: '+0,2', since: '92 avis' }, suggested: true, why: 'Fiche Google détectée' },
  gViews: { label: 'Visites fiche Google', icon: 'eye', src: 'google', val: 3120, fmt: 'int', trend: { dir: 'up', val: '+12 %', since: 'recherche locale' }, suggested: true, why: 'Référencement local' },
  orders: { label: 'Réservations / commandes', icon: 'clipboard', src: 'site', val: 86, fmt: 'int', trend: { dir: 'up', val: '+15 %', since: 'cette semaine' }, suggested: true, why: 'Activité boulangerie' },
  basket: { label: 'Panier moyen', icon: 'euro', src: 'crm', val: 21.4, fmt: 'eur', trend: { dir: 'up', val: '+1,2 €', since: 'base clients' }, suggested: true, why: 'Issu de votre CRM' },
  emailOpen: { label: 'Taux d’ouverture e-mail', icon: 'mailopen', src: 'email', val: 40.5, fmt: 'pct', trend: { dir: 'up', val: '+11 pts', since: 'vs. secteur' }, suggested: true, why: 'Vos campagnes' },

  newSubs: { label: 'Nouveaux abonnés · 30j', icon: 'users', src: 'global', val: 128, fmt: 'int', trend: { dir: 'up', val: '+18 %' } },
  siteClicks: { label: 'Clics vers le site', icon: 'cursor', src: 'site', val: 642, fmt: 'int', trend: { dir: 'up', val: '+9 %' } },
  messages: { label: 'Messages reçus', icon: 'inbox', src: 'global', val: 24, fmt: 'int', trend: { dir: 'neutral', val: 'à traiter' } },
  crmContacts: { label: 'Contacts opt-in (CRM)', icon: 'shield', src: 'crm', val: 1124, fmt: 'int', trend: { dir: 'up', val: '+42' } },
  emailRevenue: { label: 'CA e-mailing estimé', icon: 'euro', src: 'email', val: 2380, fmt: 'eur', trend: { dir: 'up', val: '+320 €' } },
  storyViews: { label: 'Vues de stories', icon: 'eye', src: 'instagram', val: 5400, fmt: 'int', trend: { dir: 'up', val: '+22 %' } },
  postsMonth: { label: 'Posts publiés ce mois', icon: 'image', src: 'global', val: 18, fmt: 'int', trend: { dir: 'neutral', val: 'objectif 20' } },
};

export interface KpiState { board: string[]; custom: Record<string, KpiDef>; suggestOpen: boolean; }

const LS = 'eff_kpis_v2';
export function loadKpiState(): KpiState {
  try {
    const s = JSON.parse(localStorage.getItem(LS) || 'null');
    if (s && s.board) return s;
  } catch { /* ignore */ }
  return { board: ['subs', 'engagement', 'posts', 'review'], custom: {}, suggestOpen: true };
}
export function saveKpiState(s: KpiState): void {
  localStorage.setItem(LS, JSON.stringify(s));
}

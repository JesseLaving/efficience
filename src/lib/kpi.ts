import { UI, BRAND } from './icons';

export interface Trend { dir: 'up' | 'down' | 'neutral'; val: string; since?: string; }
export interface KpiDef {
  label: string;
  icon: string;
  src: string;
  val: number;
  /** Hook to a real, computed value. Keys map to live Meta aggregates in the Dashboard.
   *  'reach' is kept as an alias of 'followers' for backward-compat with persisted state. */
  live?: 'reach' | 'followers' | 'engagementRate' | 'totalEngagement' | 'reachInsights' | 'postsMonth';
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

/* ---------- KPI catalogue ----------
   Values start at 0 and trends are neutral: no figure is invented.
   Real numbers appear once accounts are connected and data flows in. */
const NT: Trend = { dir: 'neutral', val: '—' };
export const CATALOG: Record<string, KpiDef> = {
  subs: { label: 'Abonnés · tous réseaux', icon: 'users', src: 'global', val: 0, live: 'followers', fmt: 'int', trend: NT },
  engagement: { label: 'Taux d’engagement', icon: 'heart', src: 'global', val: 0, live: 'engagementRate', fmt: 'pct', trend: NT },
  posts: { label: 'Posts à venir', icon: 'calendar', src: 'global', val: 0, fmt: 'int', trend: { dir: 'neutral', val: 'cette semaine' } },
  review: { label: 'À valider', icon: 'clock', src: 'global', val: 0, fmt: 'int', trend: NT },

  reach: { label: 'Portée · 30j', icon: 'target', src: 'global', val: 0, live: 'reachInsights', fmt: 'int', trend: NT, suggested: true, why: 'Vos réseaux connectés' },
  engagementTotal: { label: 'Interactions · publications', icon: 'heart', src: 'global', val: 0, live: 'totalEngagement', fmt: 'int', trend: NT, suggested: true, why: 'J’aime + commentaires + partages' },
  gRating: { label: 'Note Google', icon: 'target', src: 'google', val: 0, fmt: 'rating', trend: NT, suggested: true, why: 'Fiche Google' },
  gViews: { label: 'Visites fiche Google', icon: 'eye', src: 'google', val: 0, fmt: 'int', trend: NT, suggested: true, why: 'Référencement local' },
  orders: { label: 'Demandes / leads', icon: 'clipboard', src: 'site', val: 0, fmt: 'int', trend: NT, suggested: true, why: 'Activité conseil & formation' },
  basket: { label: 'Panier moyen', icon: 'euro', src: 'crm', val: 0, fmt: 'eur', trend: NT, suggested: true, why: 'Issu de votre CRM' },
  emailOpen: { label: 'Taux d’ouverture e-mail', icon: 'mailopen', src: 'email', val: 0, fmt: 'pct', trend: NT, suggested: true, why: 'Vos campagnes' },

  newSubs: { label: 'Nouveaux abonnés · 30j', icon: 'users', src: 'global', val: 0, fmt: 'int', trend: NT },
  siteClicks: { label: 'Clics vers le site', icon: 'cursor', src: 'site', val: 0, fmt: 'int', trend: NT },
  messages: { label: 'Messages reçus', icon: 'inbox', src: 'global', val: 0, fmt: 'int', trend: { dir: 'neutral', val: 'à traiter' } },
  crmContacts: { label: 'Contacts opt-in (CRM)', icon: 'shield', src: 'crm', val: 0, fmt: 'int', trend: NT },
  emailRevenue: { label: 'CA e-mailing estimé', icon: 'euro', src: 'email', val: 0, fmt: 'eur', trend: NT },
  storyViews: { label: 'Vues de stories', icon: 'eye', src: 'instagram', val: 0, fmt: 'int', trend: NT },
  postsMonth: { label: 'Posts publiés ce mois', icon: 'image', src: 'global', val: 0, live: 'postsMonth', fmt: 'int', trend: NT },
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

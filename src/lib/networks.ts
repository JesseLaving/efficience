import { BUSINESS } from './business';

export interface NetPage {
  name: string;
  handle: string;
  metricN: number;
  metric: string;
  verified?: boolean;
  rating?: boolean;
}

export interface Network {
  id: string;
  name: string;
  kind: string;
  desc: string;
  page: NetPage;
  def?: boolean;
}

/* The platforms Efficience Marketing can connect.
   No account is pre-connected and no metric is invented: every page
   starts at 0 — real figures arrive only once a real account is linked.
   `desc` is the generic value proposition of each platform (not data). */
const empty = (metric = 'abonnés'): NetPage => ({ name: BUSINESS.name, handle: '', metricN: 0, metric });

export const NETWORKS: Network[] = [
  { id: 'instagram', name: 'Instagram', kind: 'Compte professionnel',
    desc: 'Reels, stories et carrousels — planifiés et mesurés au même endroit.',
    page: empty() },
  { id: 'facebook', name: 'Facebook', kind: 'Page',
    desc: 'Programmez vos publications et répondez aux avis depuis l’app.',
    page: empty() },
  { id: 'google', name: 'Google Business', kind: 'Fiche d’établissement',
    desc: 'Avis, horaires et posts Google pour booster le référencement local.',
    page: { name: BUSINESS.name, handle: '', metricN: 0, metric: 'avis Google', rating: true } },
  { id: 'linkedin', name: 'LinkedIn', kind: 'Page entreprise',
    desc: 'Affirmez l’image de marque employeur et le savoir-faire de conseil.',
    page: empty() },
  { id: 'tiktok', name: 'TikTok', kind: 'Compte business',
    desc: 'Formats courts et coulisses — là où la portée se construit vite.',
    page: empty() },
  { id: 'x', name: 'X', kind: 'Compte',
    desc: 'Actus express et interactions professionnelles en temps réel.',
    page: empty() },
  { id: 'youtube', name: 'YouTube', kind: 'Chaîne',
    desc: 'Tutos et formats longs pour asseoir l’expertise et la pédagogie.',
    page: empty() },
  { id: 'pinterest', name: 'Pinterest', kind: 'Compte pro',
    desc: 'Épingles inspirantes — utiles pour les contenus visuels et fiches.',
    page: empty() },
];

export const netName = (id: string): string => (NETWORKS.find((n) => n.id === id) || { name: id }).name;

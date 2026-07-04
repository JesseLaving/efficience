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

/** Real publication readiness per platform — reflects the actual app-review
 *  status granted by each platform, not just whether OAuth connection works.
 *  A network can connect (read a real page/profile) while publishing still
 *  fails, because the write scope needs separate platform approval:
 *   - 'ready'   — publication réellement fonctionnelle aujourd'hui.
 *   - 'pending' — connexion possible, mais la publication échouera tant que
 *                 la plateforme n'a pas validé l'accès en écriture.
 *   - 'test'    — fonctionnel uniquement pour les comptes Google ajoutés
 *                 comme testeurs (app en mode Test, pas encore vérifiée).
 *  Update this map the day an approval comes through — never leave it
 *  guessing at a status nobody confirmed. */
export type PublishStatus = 'ready' | 'pending' | 'test';
export const PUBLISH_STATUS: Record<string, PublishStatus> = {
  instagram: 'ready',
  facebook: 'ready',
  linkedin: 'ready',
  google: 'pending',
  tiktok: 'pending',
  youtube: 'test',
};
export const PUBLISH_STATUS_REASON: Record<PublishStatus, string> = {
  ready: 'Publication active',
  pending: 'En attente de validation de la plateforme',
  test: 'Mode test — réservé aux comptes ajoutés comme testeurs',
};

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

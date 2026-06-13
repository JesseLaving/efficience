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

/* The active client's social pages (Boulangerie Martin). */
export const NETWORKS: Network[] = [
  { id: 'instagram', name: 'Instagram', kind: 'Compte professionnel',
    desc: 'Reels, stories et carrousels — planifiés et mesurés au même endroit.',
    page: { name: 'Boulangerie Martin', handle: '@boulangerie.martin', metricN: 4312, metric: 'abonnés', verified: true }, def: true },
  { id: 'facebook', name: 'Facebook', kind: 'Page',
    desc: 'Programmez vos publications et répondez aux avis depuis l’app.',
    page: { name: 'Boulangerie Martin', handle: 'fb.com/boulangeriemartin', metricN: 2180, metric: 'abonnés', verified: true }, def: true },
  { id: 'google', name: 'Google Business', kind: 'Fiche d’établissement',
    desc: 'Avis, horaires et posts Google pour booster le référencement local.',
    page: { name: 'Boulangerie Martin — Lyon 3e', handle: '4,8 ★ · 92 avis', metricN: 92, metric: 'avis Google', rating: true }, def: true },
  { id: 'linkedin', name: 'LinkedIn', kind: 'Page entreprise',
    desc: 'Affirmez l’image de marque employeur et le savoir-faire artisanal.',
    page: { name: 'Boulangerie Martin', handle: 'linkedin.com/company/...', metricN: 542, metric: 'abonnés' } },
  { id: 'tiktok', name: 'TikTok', kind: 'Compte business',
    desc: 'Les coulisses du fournil en vidéo courte, là où la portée explose.',
    page: { name: 'boulangerie.martin', handle: '@boulangerie.martin', metricN: 1920, metric: 'abonnés' } },
  { id: 'x', name: 'X', kind: 'Compte',
    desc: 'Actus express et interactions locales en temps réel.',
    page: { name: 'Boulangerie Martin', handle: '@boul_martin', metricN: 380, metric: 'abonnés' } },
  { id: 'youtube', name: 'YouTube', kind: 'Chaîne',
    desc: 'Tutos recettes et formats longs pour asseoir l’expertise.',
    page: { name: 'Boulangerie Martin', handle: '@boulangeriemartin', metricN: 156, metric: 'abonnés' } },
  { id: 'pinterest', name: 'Pinterest', kind: 'Compte pro',
    desc: 'Épingles inspirantes — idéales pour les recettes et la pâtisserie.',
    page: { name: 'Boulangerie Martin', handle: '@boulangeriemartin', metricN: 240, metric: 'abonnés' } },
];

export const netName = (id: string): string => (NETWORKS.find((n) => n.id === id) || { name: id }).name;

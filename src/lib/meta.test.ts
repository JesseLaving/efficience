import { describe, expect, it } from 'vitest';
import { aggregateMeta, type MetaPost, type MetaStatAccount } from './meta';

/* Compte Meta minimal : seuls les champs lus par aggregateMeta sont peuplés,
   le reste reflète ce que renvoie l'API quand la donnée est indisponible. */
function account(over: Partial<MetaStatAccount> = {}): MetaStatAccount {
  return {
    network: 'instagram',
    name: 'Compte',
    followers: 0,
    mediaCount: null,
    summary: { posts: 0, likes: 0, comments: 0, shares: 0, avgEngagement: 0, engagementRate: null },
    insights: { available: true, reach: null, impressions: null },
    postsReason: null,
    posts: [],
    ...over,
  };
}

const metaPost = (id: string, date: string | null): MetaPost => ({
  id,
  network: 'instagram',
  type: 'IMAGE',
  caption: '',
  date,
  permalink: null,
  image: null,
  likes: null,
  comments: null,
  shares: null,
});

const isoInCurrentMonth = () => {
  const now = new Date();
  // Le 15 à midi : jamais à cheval sur un mois, quel que soit le fuseau.
  return new Date(now.getFullYear(), now.getMonth(), 15, 12).toISOString();
};
const isoLastMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 15, 12).toISOString();
};

describe('agrégats Meta du tableau de bord', () => {
  it('ne fabrique aucun chiffre quand il n’y a pas de compte', () => {
    const empty = aggregateMeta(null);
    expect(empty.followers).toBe(0);
    // null, et non 0 : une mesure absente n'est pas une mesure nulle.
    expect(empty.engagementRate).toBeNull();
    expect(empty.reach).toBeNull();
    expect(empty.impressions).toBeNull();
  });

  it('additionne abonnés et engagement de tous les comptes', () => {
    const agg = aggregateMeta([
      account({ followers: 1200, summary: { posts: 3, likes: 30, comments: 5, shares: 2, avgEngagement: 12, engagementRate: 3 } }),
      account({ network: 'facebook', followers: 800, summary: { posts: 2, likes: 10, comments: 1, shares: 0, avgEngagement: 5, engagementRate: 1 } }),
    ]);
    expect(agg.followers).toBe(2000);
    expect(agg.totalEngagement).toBe(48);
    expect(agg.postsAnalyzed).toBe(5);
  });

  it('pondère le taux d’engagement par l’audience, pas par le nombre de comptes', () => {
    // Une moyenne simple donnerait 2 % ; le petit compte pèserait autant que
    // le gros, ce qui surestimerait la performance réelle.
    const agg = aggregateMeta([
      account({ followers: 9000, summary: { posts: 1, likes: 0, comments: 0, shares: 0, avgEngagement: 0, engagementRate: 1 } }),
      account({ network: 'facebook', followers: 1000, summary: { posts: 1, likes: 0, comments: 0, shares: 0, avgEngagement: 0, engagementRate: 3 } }),
    ]);
    expect(agg.engagementRate).toBeCloseTo(1.2, 5);
  });

  it('ne compte dans le mois que les posts du mois courant', () => {
    const agg = aggregateMeta([
      account({ posts: [
        metaPost('a', isoInCurrentMonth()),
        metaPost('b', isoInCurrentMonth()),
        metaPost('c', isoLastMonth()),
      ] }),
    ]);
    expect(agg.postsMonth).toBe(2);
  });

  it('ignore une date illisible au lieu de compter un post fantôme', () => {
    const agg = aggregateMeta([
      account({ posts: [metaPost('a', 'pas une date')] }),
    ]);
    expect(agg.postsMonth).toBe(0);
  });

  it('laisse portée et impressions à null si aucun compte ne les fournit', () => {
    const agg = aggregateMeta([account({ followers: 10 })]);
    expect(agg.reach).toBeNull();
    expect(agg.impressions).toBeNull();
  });
});

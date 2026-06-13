/* ============================================================
   Efficience — synthetic client base (CRM), seeded for stability.
   Ported from the prototype's contacts.js data layer.
   ============================================================ */

export interface Contact {
  id: number;
  first: string;
  last: string;
  name: string;
  email: string;
  city: string;
  lastDays: number;
  basket: number;
  consent: boolean;
  tags: string[];
  interest: string;
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20240614);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const FIRST = ['Camille', 'Lucas', 'Emma', 'Hugo', 'Léa', 'Nathan', 'Chloé', 'Louis', 'Manon', 'Théo', 'Sarah', 'Jules', 'Inès', 'Adam', 'Lina', 'Tom', 'Jade', 'Raphaël', 'Zoé', 'Noah', 'Alice', 'Gabriel', 'Anaïs', 'Maël', 'Eva', 'Sacha', 'Romane', 'Enzo', 'Clara', 'Yanis', 'Juliette', 'Axel', 'Margaux', 'Nolan', 'Léna', 'Ethan', 'Louise', 'Mathis', 'Ambre', 'Liam'];
const LAST = ['Martin', 'Bernard', 'Dubois', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Faure', 'Rousseau', 'Lambert'];
const CITIES: [string, number][] = [
  ['Lyon 3e', 26], ['Lyon 6e', 14], ['Villeurbanne', 16], ['Lyon 7e', 11],
  ['Caluire', 8], ['Bron', 8], ['Vénissieux', 7], ['Lyon 2e', 6], ['Écully', 4],
];
const cityBag: string[] = [];
CITIES.forEach(([c, w]) => { for (let i = 0; i < w; i++) cityBag.push(c); });
const TAG_POOL = ['Pâtisserie', 'Pain', 'Traiteur', 'Sans gluten'];

// Empty base by default — no invented contacts. The seeded generator below
// stays available (it builds nothing while TOTAL is 0) so the CRM renders 0.
export const TOTAL = 0;

function buildPopulation(): Contact[] {
  const pop: Contact[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const first = pick(FIRST), last = pick(LAST);
    const city = pick(cityBag);
    const basket = Math.round((10 + Math.pow(rnd(), 1.8) * 52) * 10) / 10;
    const lastDays = Math.floor(Math.pow(rnd(), 1.4) * 170);
    const consent = rnd() < 0.9;
    const interest = pick(TAG_POOL);
    const tags = [interest];
    if (basket >= 34 && lastDays <= 50) tags.unshift('VIP');
    else if (lastDays <= 24) tags.unshift('Nouveau');
    else if (lastDays >= 90) tags.unshift('Inactif');
    const slug = (first + '.' + last).toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '');
    pop.push({
      id: i, first, last, name: first + ' ' + last,
      email: slug + '@' + pick(['gmail.com', 'orange.fr', 'outlook.fr', 'free.fr', 'sfr.fr']),
      city, lastDays, basket, consent, tags, interest,
    });
  }
  return pop;
}

export const POP: Contact[] = buildPopulation();

/* avatar gradients — on-brand green→teal family */
const AV_GRAD = [
  'linear-gradient(150deg,#0e4a39,#10b981)', 'linear-gradient(150deg,#0d3b4a,#1bb0a6)',
  'linear-gradient(150deg,#10463a,#2fd6a1)', 'linear-gradient(150deg,#143a2e,#3bbf86)',
  'linear-gradient(150deg,#0c3f43,#14b8a6)',
];
export const initials = (c: Contact): string => (c.first[0] + c.last[0]).toUpperCase();
export const avFor = (c: Contact): string => AV_GRAD[(c.first.charCodeAt(0) + c.last.charCodeAt(0)) % AV_GRAD.length];

/* ---------- segments ---------- */
export interface Segment {
  id: string;
  name: string;
  desc: string;
  icon: string;
  pred: (c: Contact) => boolean;
}

export const SEGMENTS: Segment[] = [
  { id: 'all', name: 'Tous les clients', desc: 'Base complète', icon: 'users', pred: () => true },
  { id: 'vip', name: 'Clients fidèles', desc: 'Panier moyen ≥ 30 €', icon: 'euro', pred: (c) => c.basket >= 30 },
  { id: 'new', name: 'Nouveaux clients', desc: '1er achat < 30 jours', icon: 'sparkles2', pred: (c) => c.lastDays <= 30 },
  { id: 'lyon', name: 'Avignonnais', desc: 'Ville commence par « Avignon »', icon: 'pin', pred: (c) => c.city.startsWith('Avignon') },
  { id: 'dormant', name: 'À réactiver', desc: 'Inactifs depuis > 75 j', icon: 'clock', pred: (c) => c.lastDays > 75 },
  { id: 'consent', name: 'Opt-in marketing', desc: 'Consentement email OK', icon: 'shield', pred: (c) => c.consent },
];

export const segCount = (s: Segment): number => POP.filter(s.pred).length;

export interface SegmentInfo { id: string; name: string; desc: string; icon: string; count: number; }
export const segmentInfos = (): SegmentInfo[] =>
  SEGMENTS.map((s) => ({ id: s.id, name: s.name, desc: s.desc, icon: s.icon, count: segCount(s) }));

/* ---------- builder field model ---------- */
export interface FieldDef {
  label: string;
  ops: string[];
  type: 'select' | 'num';
  options?: string[];
  unit?: string;
  ph?: string;
  test?: (c: Contact, op: string, v: string) => boolean;
  testTag?: (c: Contact, v: string) => boolean;
}

export const FIELDS: Record<string, FieldDef> = {
  city: { label: 'Ville', ops: ['est', 'n’est pas'], type: 'select', options: [...new Set(cityBag)],
    test: (c, op, v) => (op === 'est' ? c.city === v : c.city !== v) },
  basket: { label: 'Panier moyen', ops: ['supérieur à', 'inférieur à'], type: 'num', unit: '€', ph: '30',
    test: (c, op, v) => (op === 'supérieur à' ? c.basket >= (+v || 0) : c.basket < (+v || 0)) },
  lastDays: { label: 'Dernier achat', ops: ['il y a moins de', 'il y a plus de'], type: 'num', unit: 'jours', ph: '30',
    test: (c, op, v) => (op === 'il y a moins de' ? c.lastDays <= (+v || 0) : c.lastDays > (+v || 0)) },
  consent: { label: 'Consentement email', ops: ['est'], type: 'select', options: ['Accepté', 'Refusé'],
    test: (c, _op, v) => (v === 'Accepté' ? c.consent : !c.consent) },
  tag: { label: 'Tag / intérêt', ops: ['contient'], type: 'select', options: ['VIP', 'Nouveau', 'Inactif', ...TAG_POOL],
    test: () => true, testTag: (c, v) => c.tags.includes(v) },
};

export interface Criterion { field: string; op: string; value: string; }

export function matchCriteria(c: Contact, criteria: Criterion[]): boolean {
  return criteria.every((cr) => {
    const f = FIELDS[cr.field];
    if (!f) return true;
    if (cr.field === 'tag') return f.testTag!(c, cr.value);
    return f.test!(c, cr.op, cr.value);
  });
}

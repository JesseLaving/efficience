/* ============================================================
   Segmentation de la base clients — opère sur les contacts RÉELS
   importés (voir contacts.ts). Aucune donnée n'est inventée ici :
   ce module ne fait que filtrer/compter des contacts existants.
   ============================================================ */
import type { Contact } from './contacts';

export type { Contact };

/* avatar gradients — on-brand sage→moss family */
const AV_GRAD = [
  'linear-gradient(150deg,#3c5233,#5b7550)', 'linear-gradient(150deg,#33473f,#4f7d6e)',
  'linear-gradient(150deg,#4a5c33,#7c9a52)', 'linear-gradient(150deg,#3d4a2e,#6b8557)',
  'linear-gradient(150deg,#35473d,#5a8570)',
];
export const initials = (c: Contact): string => ((c.first[0] || c.name[0] || '?') + (c.last[0] || '')).toUpperCase();
export const avFor = (c: Contact): string => AV_GRAD[((c.first.charCodeAt(0) || 0) + (c.last.charCodeAt(0) || 0)) % AV_GRAD.length];

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
  { id: 'vip', name: 'Clients fidèles', desc: 'Panier moyen ≥ 30 €', icon: 'euro', pred: (c) => (c.basket ?? 0) >= 30 },
  { id: 'new', name: 'Nouveaux clients', desc: '1er achat < 30 jours', icon: 'sparkles2', pred: (c) => c.lastDays != null && c.lastDays <= 30 },
  { id: 'dormant', name: 'À réactiver', desc: 'Inactifs depuis > 75 j', icon: 'clock', pred: (c) => c.lastDays != null && c.lastDays > 75 },
  { id: 'consent', name: 'Opt-in marketing', desc: 'Consentement email OK', icon: 'shield', pred: (c) => c.consent === true },
  { id: 'noemail', name: 'Sans e-mail', desc: 'Contact sans adresse e-mail', icon: 'users', pred: (c) => !c.email },
];

export const segCount = (s: Segment, contacts: Contact[]): number => contacts.filter(s.pred).length;

export interface SegmentInfo { id: string; name: string; desc: string; icon: string; count: number; }
export const segmentInfos = (contacts: Contact[]): SegmentInfo[] =>
  SEGMENTS.map((s) => ({ id: s.id, name: s.name, desc: s.desc, icon: s.icon, count: segCount(s, contacts) }));

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

/* Les options de ville sont calculées dynamiquement depuis les contacts réels
   (voir fieldsFor) — plus de liste de villes fictive en dur. */
export function fieldsFor(contacts: Contact[]): Record<string, FieldDef> {
  const cities = [...new Set(contacts.map((c) => c.city).filter((c): c is string => !!c))].sort();
  return {
    city: { label: 'Ville', ops: ['est', 'n’est pas'], type: 'select', options: cities.length ? cities : ['—'],
      test: (c, op, v) => (op === 'est' ? c.city === v : c.city !== v) },
    basket: { label: 'Panier moyen', ops: ['supérieur à', 'inférieur à'], type: 'num', unit: '€', ph: '30',
      test: (c, op, v) => (op === 'supérieur à' ? (c.basket ?? 0) >= (+v || 0) : (c.basket ?? 0) < (+v || 0)) },
    lastDays: { label: 'Dernier achat', ops: ['il y a moins de', 'il y a plus de'], type: 'num', unit: 'jours', ph: '30',
      test: (c, op, v) => { const d = c.lastDays ?? Infinity; return op === 'il y a moins de' ? d <= (+v || 0) : d > (+v || 0); } },
    consent: { label: 'Consentement email', ops: ['est'], type: 'select', options: ['Accepté', 'Refusé'],
      test: (c, _op, v) => (v === 'Accepté' ? c.consent === true : c.consent !== true) },
    tag: { label: 'Tag', ops: ['contient'], type: 'select', options: [...new Set(contacts.flatMap((c) => c.tags || []))].sort(),
      test: () => true, testTag: (c, v) => (c.tags || []).includes(v) },
  };
}

export interface Criterion { field: string; op: string; value: string; }

export function matchCriteria(c: Contact, criteria: Criterion[], fields: Record<string, FieldDef>): boolean {
  return criteria.every((cr) => {
    const f = fields[cr.field];
    if (!f) return true;
    if (cr.field === 'tag') return f.testTag!(c, cr.value);
    return f.test!(c, cr.op, cr.value);
  });
}

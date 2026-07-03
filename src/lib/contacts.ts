/* ============================================================
   Import de contacts dans la base clients — fichier (CSV) ou
   Google Contacts. Détection de colonnes par correspondance
   d'alias (FR/EN), fusion par e-mail, persistance locale
   (synchronisée par espace via AuthWrapper).
   ============================================================ */

export interface Contact {
  id: string;
  first: string;
  last: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  /** Panier moyen (€) — seulement si la source fournit une donnée d'achat réelle. */
  basket?: number;
  /** Jours depuis le dernier achat — idem, jamais inventé. */
  lastDays?: number;
  /** null = non renseigné (ni accepté, ni refusé explicitement). */
  consent: boolean | null;
  tags: string[];
  source: 'file' | 'google';
}

const LS_KEY = 'eff_contacts_v1';

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function saveContacts(list: Contact[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

/* ---------- délimité (CSV) ---------- */

export interface ParsedTable { headers: string[]; rows: string[][]; }

function detectDelimiter(sample: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of sample) if (ch in counts) counts[ch]++;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [','])[0];
}

/* Parseur CSV tolérant (RFC4180-ish) : champs entre guillemets, guillemets
   échappés ("") et délimiteur auto-détecté (virgule ou point-virgule, usage
   courant des exports Excel français). */
export function parseDelimited(text: string): ParsedTable {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const firstLine = clean.slice(0, clean.indexOf('\n') > -1 ? clean.indexOf('\n') : clean.length);
  const delim = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const [headers, ...body] = nonEmpty.length ? nonEmpty : [[]];
  return { headers: (headers || []).map((h) => h.trim()), rows: body };
}

/* ---------- détection de colonnes ---------- */

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export type TargetField = 'first' | 'last' | 'name' | 'email' | 'phone' | 'city' | 'basket' | 'lastDays' | 'consent' | 'tags';

const ALIASES: Record<TargetField, string[]> = {
  email: ['email', 'mail', 'courriel', 'adresseemail', 'e mail'],
  first: ['prenom', 'firstname', 'first', 'givenname'],
  last: ['nom', 'lastname', 'last', 'surname', 'familyname', 'nomdefamille'],
  name: ['nomcomplet', 'fullname', 'name', 'contact', 'client', 'nomprenom'],
  phone: ['telephone', 'tel', 'phone', 'mobile', 'portable', 'numero', 'numerodetelephone'],
  city: ['ville', 'city', 'localite', 'commune'],
  basket: ['paniermoyen', 'panier', 'basket', 'montant', 'ca', 'chiffredaffaires', 'valeur', 'depensemoyenne'],
  lastDays: ['dernierachat', 'lastpurchase', 'derniereactivite', 'recence', 'dateachat', 'lastorder'],
  consent: ['consentement', 'optin', 'optinemail', 'rgpd', 'consent', 'newsletter', 'accepteemail'],
  tags: ['tags', 'etiquettes', 'segment', 'categorie', 'interet'],
};

/* Ordre de priorité pour l'assignation gloutonne (une colonne du fichier ne
   sert qu'à un seul champ Efficience). */
const FIELD_ORDER: TargetField[] = ['email', 'first', 'last', 'name', 'phone', 'city', 'basket', 'lastDays', 'consent', 'tags'];

export interface ColumnMapping { field: TargetField; headerIndex: number | null; confidence: number; }

export function detectMapping(headers: string[]): ColumnMapping[] {
  const normed = headers.map(norm);
  const used = new Set<number>();
  const out: ColumnMapping[] = [];
  for (const field of FIELD_ORDER) {
    const aliases = ALIASES[field];
    let best: { idx: number; score: number } | null = null;
    normed.forEach((h, idx) => {
      if (used.has(idx) || !h) return;
      let score = 0;
      if (aliases.includes(h)) score = 100;
      else if (aliases.some((a) => h.includes(a) || a.includes(h))) score = 70;
      if (score && (!best || score > best.score)) best = { idx, score };
    });
    const match = best as { idx: number; score: number } | null;
    if (match) { used.add(match.idx); out.push({ field, headerIndex: match.idx, confidence: match.score }); }
    else out.push({ field, headerIndex: null, confidence: 0 });
  }
  return out;
}

/* ---------- lignes → contacts ---------- */

function parseBasket(raw: string): number | undefined {
  const v = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

function parseLastDays(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Date explicite (jj/mm/aaaa, jj-mm-aaaa ou aaaa-mm-jj) → jours écoulés depuis aujourd'hui.
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let d: Date | null = null;
  if (dmy) d = new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  else if (ymd) d = new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  if (d && !isNaN(d.getTime())) {
    const days = Math.round((Date.now() - d.getTime()) / 86400000);
    return days >= 0 ? days : undefined;
  }
  const n = parseInt(trimmed.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseConsent(raw: string): boolean | null {
  const v = norm(raw);
  if (!v) return null;
  if (['oui', 'yes', 'true', '1', 'accepte', 'optin', 'y'].includes(v)) return true;
  if (['non', 'no', 'false', '0', 'refuse', 'optout', 'n'].includes(v)) return false;
  return null;
}

let idCounter = 0;
function makeId(email: string, name: string): string {
  const key = email ? norm(email) : norm(name);
  idCounter++;
  return key ? `c_${key}_${idCounter}` : `c_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function rowsToContacts(_headers: string[], rows: string[][], mapping: ColumnMapping[], source: Contact['source'] = 'file'): Contact[] {
  const idx = (f: TargetField) => mapping.find((m) => m.field === f)?.headerIndex ?? null;
  const iEmail = idx('email'), iFirst = idx('first'), iLast = idx('last'), iName = idx('name');
  const iPhone = idx('phone'), iCity = idx('city'), iBasket = idx('basket'), iLastDays = idx('lastDays');
  const iConsent = idx('consent'), iTags = idx('tags');
  const get = (row: string[], i: number | null) => (i != null && i < row.length ? (row[i] || '').trim() : '');

  const out: Contact[] = [];
  for (const row of rows) {
    const email = get(row, iEmail).toLowerCase();
    let first = get(row, iFirst), last = get(row, iLast);
    const fullName = get(row, iName);
    if (!first && !last && fullName) {
      const parts = fullName.split(/\s+/);
      first = parts[0] || ''; last = parts.slice(1).join(' ');
    }
    const name = (first + ' ' + last).trim() || fullName;
    if (!name && !email) continue; // ligne vide — on ignore

    const basketRaw = get(row, iBasket);
    const lastDaysRaw = get(row, iLastDays);
    const tagsRaw = get(row, iTags);

    out.push({
      id: makeId(email, name),
      first: first || name.split(' ')[0] || '',
      last: last || name.split(' ').slice(1).join(' '),
      name: name || email,
      email,
      phone: get(row, iPhone) || undefined,
      city: get(row, iCity) || undefined,
      basket: basketRaw ? parseBasket(basketRaw) : undefined,
      lastDays: lastDaysRaw ? parseLastDays(lastDaysRaw) : undefined,
      consent: iConsent != null ? parseConsent(get(row, iConsent)) : null,
      tags: tagsRaw ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
      source,
    });
  }
  return out;
}

/* ---------- fusion (dédoublonnage par e-mail) ---------- */

export function mergeContacts(existing: Contact[], incoming: Contact[]): Contact[] {
  const byKey = new Map<string, Contact>();
  const order: string[] = [];
  const keyOf = (c: Contact) => (c.email ? 'e:' + norm(c.email) : 'n:' + norm(c.name) + ':' + c.id);
  for (const c of existing) { const k = keyOf(c); if (!byKey.has(k)) order.push(k); byKey.set(k, c); }
  for (const c of incoming) {
    const k = keyOf(c);
    const prev = byKey.get(k);
    if (prev) {
      byKey.set(k, {
        ...prev,
        first: c.first || prev.first, last: c.last || prev.last, name: c.name || prev.name,
        phone: c.phone ?? prev.phone, city: c.city ?? prev.city,
        basket: c.basket ?? prev.basket, lastDays: c.lastDays ?? prev.lastDays,
        consent: c.consent ?? prev.consent,
        tags: [...new Set([...(prev.tags || []), ...(c.tags || [])])],
      });
    } else { order.push(k); byKey.set(k, c); }
  }
  return order.map((k) => byKey.get(k)!);
}

/* ---------- export CSV ---------- */

export function contactsToCsv(contacts: Contact[]): string {
  const head = ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Ville', 'Panier moyen', 'Dernier achat (jours)', 'Consentement', 'Tags'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const rows = contacts.map((c) => [
    c.first, c.last, c.email, c.phone || '', c.city || '',
    c.basket != null ? String(c.basket) : '', c.lastDays != null ? String(c.lastDays) : '',
    c.consent === true ? 'Oui' : c.consent === false ? 'Non' : '', (c.tags || []).join('; '),
  ].map(esc).join(','));
  return [head.map(esc).join(','), ...rows].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

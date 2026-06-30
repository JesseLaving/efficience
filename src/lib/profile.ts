/* Per-space company profile — captured at onboarding from the domain the user
   enters, then enriched by the real analysis backend (INSEE/SIRENE + site).
   Persisted in localStorage so it syncs with the active space and survives
   reloads. This is the single source of truth for "who this space belongs to";
   getBusiness() in business.ts merges it over the Efficience fallback. */
import type { CompanyResult, SiteResponse } from './api';

const LS = 'eff_profile_v1';

export interface SpaceProfile {
  domain: string;
  name: string;
  initials: string;
  email?: string | null;
  siren?: string | null;
  siret?: string | null;
  naf?: string | null;
  sector?: string | null;        // NAF libellé (secteur d'activité)
  city?: string | null;          // commune
  codePostal?: string | null;
  region?: string | null;
  addressLine?: string | null;
  capturedAt?: string;
}

export function initialsFrom(name: string): string {
  const words = (name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function loadProfile(): SpaceProfile | null {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? JSON.parse(raw) as SpaceProfile : null;
  } catch { return null; }
}

export function saveProfile(p: SpaceProfile): void {
  try { localStorage.setItem(LS, JSON.stringify(p)); } catch { /* ignore */ }
}

export function clearProfile(): void {
  try { localStorage.removeItem(LS); } catch { /* ignore */ }
}

/** Build a profile from the entered domain + the real analysis results. */
export function profileFromAnalysis(domain: string, company: CompanyResult | null, site: SiteResponse | null): SpaceProfile {
  const name = company?.nom || site?.brand?.name || site?.basic?.ogTitle || site?.basic?.title || domain;
  const region = company?.region
    || (company?.commune ? `${company.commune}${company.codePostal ? ' · ' + company.codePostal : ''}` : null);
  const addressLine = [company?.commune, company?.codePostal].filter(Boolean).join(' · ') || company?.adresse || null;
  return {
    domain,
    name,
    initials: initialsFrom(name),
    siren: company?.siren ?? null,
    siret: company?.siret ?? null,
    naf: company?.naf?.code ?? null,
    sector: company?.naf?.libelle ?? null,
    city: company?.commune ?? null,
    codePostal: company?.codePostal ?? null,
    region,
    addressLine,
    capturedAt: new Date().toISOString(),
  };
}

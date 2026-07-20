/* Client for the real analysis backend (serverless /api functions).
   In dev and on Vercel (or any custom domain aliased to the same Vercel
   project) the API is same-origin (/api). Only the static-copy fallbacks
   (InfinityFree, GitHub Pages) have no serverless functions and must proxy
   to the deployed Vercel API. */
/* Résout l'URL de l'API. VITE_API_BASE (baké au build) a priorité. Sinon :
   - toute copie statique connue (42web/InfinityFree, GitHub Pages) → l'API
     Vercel déployée, car ces copies n'ont pas de fonctions serverless ;
   - tout le reste (localhost, *.vercel.app, ou un domaine perso pointé sur
     ce même projet Vercel, ex. app.efficienceconsulting.com) → same-origin
     '/api'. Same-origin est aussi indispensable pour que le cookie de
     session (authentification) reste sur le bon domaine. */
function resolveApiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined;
  if (env) return env;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h.endsWith('.42web.io') || h.endsWith('.github.io')) return 'https://efficience.vercel.app/api';
    return '/api';
  }
  return '/api';
}
export const API_BASE = resolveApiBase();

export interface CompanyResult {
  nom: string | null; sigle: string | null; siren: string | null; siret: string | null;
  naf: { code: string | null; libelle: string | null };
  naf2025: string | null;
  section: string | null; sectionLabel: string | null;
  formeJuridique: string | null; formeJuridiqueLabel: string | null; categorie: string | null;
  categorieAnnee: string | number | null;
  dateCreation: string | null; dateFermeture: string | null; dateMaj: string | null; etatAdministratif: string | null;
  tva: string | null; idcc: string | null;
  effectif: string | null; effectifAnnee: number | string | null; employeur: boolean | null;
  commune: string | null; codePostal: string | null; adresse: string | null; region: string | null; departement: string | null; enseigne: string | null;
  latitude: number | null; longitude: number | null;
  nda: string | null;
  badges: {
    organismeFormation: boolean; qualiopi: boolean; ess: boolean; rge: boolean;
    bio: boolean; association: boolean; entrepreneurIndividuel: boolean; societeMission: boolean;
    servicePublic: boolean; achatsResponsables: boolean; siae: boolean;
    patrimoineVivant: boolean; avocat: boolean; egapro: boolean; bilanGes: boolean;
  };
  dirigeants: { nom: string | null; qualite: string | null; anneeNaissance: string | null; type: string | null }[];
  finances: { annee: string; ca: number | null; resultatNet: number | null }[] | null;
  nombreEtablissements: number | null;
  nombreEtablissementsTotal: number | null;
}
export interface CompanyResponse { query: string; total: number; results: CompanyResult[]; }

export interface BrandKit {
  name: string | null;
  themeColor: string | null;
  logo: string | null;
  fonts: string[];
  palette: string[];
  accent: string | null;
  dark: string | null;
  light: string | null;
  available: boolean;
}

export interface SiteResponse {
  url: string;
  brand?: BrandKit | null;
  basic: {
    status?: number; finalUrl?: string; https?: boolean; server?: string | null; contentType?: string | null;
    sizeKB?: number; lang?: string | null; title?: string | null; metaDescription?: string | null;
    ogTitle?: string | null; ogImage?: string | null; canonical?: string | null; viewport?: boolean;
    h1Count?: number; imgCount?: number; linkCount?: number; jsRendered?: boolean; error?: string;
    keywords?: { word: string; count: number }[];
    legal?: { mentionsLegales: boolean; cgvCgu: boolean; politiqueConfidentialite: boolean; cookies: boolean };
  };
  pagespeed: {
    available: boolean; error?: string; strategy?: string;
    scores?: { performance: number | null; seo: number | null; accessibilite: number | null; bonnesPratiques: number | null };
    metrics?: { fcp: string | null; lcp: string | null; cls: string | null; tbt: string | null; speedIndex: string | null; tti: string | null; ttfb: string | null };
    seoChecks?: Record<string, boolean | null>;
    issues?: { seo: Audit[]; accessibilite: Audit[]; bonnesPratiques: Audit[] };
    opportunites?: { id: string; title: string; savingsMs: number }[];
  };
  psiKeyConfigured: boolean;
}
export interface Audit { id: string; title: string; score: number; displayValue: string | null; }

export interface CompetitorEntry { nom: string | null; siren: string | null; commune: string | null; departement: string | null; categorie: string | null; effectif: string | null; }
export interface CompetitorsResponse { naf: string; departement: string | null; local: CompetitorEntry[]; national: CompetitorEntry[]; }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as T;
}

export const analyzeCompany = (q: string) => get<CompanyResponse>(`/analyze/company?q=${encodeURIComponent(q)}`);
export const analyzeSite = (url: string) => get<SiteResponse>(`/analyze/site?url=${encodeURIComponent(url)}`);
export const analyzeCompetitors = (naf: string, departement?: string | null, excludeSiren?: string | null) =>
  get<CompetitorsResponse>(`/analyze/competitors?naf=${encodeURIComponent(naf)}${departement ? `&departement=${encodeURIComponent(departement)}` : ''}${excludeSiren ? `&excludeSiren=${encodeURIComponent(excludeSiren)}` : ''}`);

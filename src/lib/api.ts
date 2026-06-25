/* Client for the real analysis backend (serverless /api functions).
   In dev and on Vercel the API is same-origin (/api). For the static 42web
   copy, build with VITE_API_BASE=https://<vercel-app>/api so it calls the
   deployed functions (which send CORS *). */
/* Résout l'URL de l'API. VITE_API_BASE (baké au build) a priorité. Sinon :
   - localhost / *.vercel.app → same-origin '/api' (dev + déploiement Vercel) ;
   - tout autre hôte (42web, GitHub Pages, domaine perso) → l'API Vercel déployée,
     car ces copies statiques n'ont pas de fonctions serverless. Évite les 404. */
function resolveApiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined;
  if (env) return env;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app')) return '/api';
    return 'https://efficience.vercel.app/api';
  }
  return '/api';
}
export const API_BASE = resolveApiBase();

export interface CompanyResult {
  nom: string | null; sigle: string | null; siren: string | null; siret: string | null;
  naf: { code: string | null; libelle: string | null };
  formeJuridique: string | null; formeJuridiqueLabel: string | null; categorie: string | null;
  dateCreation: string | null; dateMaj: string | null; etatAdministratif: string | null;
  effectif: string | null; effectifAnnee: number | string | null; employeur: boolean | null;
  commune: string | null; codePostal: string | null; adresse: string | null; region: string | null; enseigne: string | null;
  nda: string | null;
  badges: {
    organismeFormation: boolean; qualiopi: boolean; ess: boolean; rge: boolean;
    bio: boolean; association: boolean; entrepreneurIndividuel: boolean; societeMission: boolean;
  };
  dirigeants: { nom: string | null; qualite: string | null; anneeNaissance: string | null; type: string | null }[];
  finances: { annee: string; ca: number | null; resultatNet: number | null }[] | null;
  nombreEtablissements: number | null;
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

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as T;
}

export const analyzeCompany = (q: string) => get<CompanyResponse>(`/company?q=${encodeURIComponent(q)}`);
export const analyzeSite = (url: string) => get<SiteResponse>(`/site?url=${encodeURIComponent(url)}`);

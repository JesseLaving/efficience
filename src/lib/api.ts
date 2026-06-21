/* Client for the real analysis backend (serverless /api functions).
   In dev and on Vercel the API is same-origin (/api). For the static 42web
   copy, build with VITE_API_BASE=https://<vercel-app>/api so it calls the
   deployed functions (which send CORS *). */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';

export interface CompanyResult {
  nom: string | null; sigle: string | null; siren: string | null; siret: string | null;
  naf: { code: string | null; libelle: string | null };
  formeJuridique: string | null; dateCreation: string | null; etatAdministratif: string | null;
  effectif: string | null; commune: string | null; codePostal: string | null; adresse: string | null;
  dirigeants: { nom: string | null; qualite: string | null }[];
  nombreEtablissements: number | null;
}
export interface CompanyResponse { query: string; total: number; results: CompanyResult[]; }

export interface SiteResponse {
  url: string;
  basic: {
    status?: number; finalUrl?: string; https?: boolean; server?: string | null; contentType?: string | null;
    sizeKB?: number; lang?: string | null; title?: string | null; metaDescription?: string | null;
    ogTitle?: string | null; ogImage?: string | null; canonical?: string | null; viewport?: boolean;
    h1Count?: number; imgCount?: number; linkCount?: number; jsRendered?: boolean; error?: string;
  };
  pagespeed: {
    available: boolean; error?: string;
    scores?: { performance: number | null; seo: number | null; accessibilite: number | null; bonnesPratiques: number | null };
    metrics?: { fcp: string | null; lcp: string | null; cls: string | null; tbt: string | null };
    seoChecks?: Record<string, boolean>;
  };
  psiKeyConfigured: boolean;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as T;
}

export const analyzeCompany = (q: string) => get<CompanyResponse>(`/company?q=${encodeURIComponent(q)}`);
export const analyzeSite = (url: string) => get<SiteResponse>(`/site?url=${encodeURIComponent(url)}`);

import type { BrandKit } from './api';
import { getBusiness } from './business';

export type { BrandKit };

const LS = 'eff_brand_v1';
const URL_LS = 'eff_site_url';

export const getStoredSiteUrl = () => localStorage.getItem(URL_LS) || 'efficiencemarketing.com';
export const setStoredSiteUrl = (u: string) => localStorage.setItem(URL_LS, u);

/* Kit de repli : l'identité réelle connue d'Efficience (nom + accent de marque
   de l'app). Sert tant que l'extraction du site n'a pas encore tourné — aucune
   donnée inventée, ce sont les couleurs réelles du produit Efficience. */
export function fallbackBrand(): BrandKit {
  return {
    name: getBusiness().name,
    themeColor: '#00d992',
    logo: null,
    fonts: ['Inter'],
    palette: ['#00d992', '#0b3b2e', '#0a0f0d'],
    accent: '#00d992',
    dark: '#0a0f0d',
    light: '#f4fbf8',
    available: false,
  };
}

/* Complète un kit (extrait ou partiel) avec des valeurs sûres pour le rendu. */
export function normalizeBrand(raw: Partial<BrandKit> | null | undefined): BrandKit {
  const fb = fallbackBrand();
  if (!raw) return fb;
  const palette = (raw.palette && raw.palette.length ? raw.palette : fb.palette).slice(0, 6);
  const accent = raw.accent || palette[0] || fb.accent;
  return {
    name: raw.name || fb.name,
    themeColor: raw.themeColor || accent,
    logo: raw.logo || null,
    fonts: (raw.fonts && raw.fonts.length ? raw.fonts : fb.fonts).slice(0, 4),
    palette,
    accent,
    dark: raw.dark || fb.dark,
    light: raw.light || fb.light,
    available: !!raw.available,
  };
}

export function getStoredBrand(): BrandKit | null {
  try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.palette) return s as BrandKit; } catch { /* ignore */ }
  return null;
}
export function setStoredBrand(b: BrandKit): void { localStorage.setItem(LS, JSON.stringify(b)); }

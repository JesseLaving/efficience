import { createContext, useCallback, useContext, useState } from 'react';
import { analyzeSite, type SiteResponse } from '../lib/api';
import {
  fallbackBrand, getStoredBrand, getStoredSiteUrl, normalizeBrand, setStoredBrand, setStoredSiteUrl,
  type BrandKit,
} from '../lib/brand';

/* Charte graphique extraite du site (générateur de visuels). Extrait de
   EffContext — lu seulement par VisualGenerator + Onboarding. */
interface BrandCtx {
  brandKit: BrandKit;
  brandStatus: 'idle' | 'loading' | 'error';
  setBrandKit: (b: BrandKit) => void;
  applySiteBrand: (site: SiteResponse) => void;
  refreshBrand: (url?: string) => Promise<void>;
}

const Ctx = createContext<BrandCtx | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brandKit, setBrandKitState] = useState<BrandKit>(() => getStoredBrand() || fallbackBrand());
  const [brandStatus, setBrandStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const setBrandKit = useCallback((b: BrandKit) => { const n = normalizeBrand(b); setBrandKitState(n); setStoredBrand(n); }, []);
  const applySiteBrand = useCallback((site: SiteResponse) => {
    if (site && site.brand && (site.brand.available || (site.brand.palette && site.brand.palette.length))) {
      const n = normalizeBrand(site.brand);
      setBrandKitState(n); setStoredBrand(n);
    }
  }, []);
  const refreshBrand = useCallback(async (url?: string) => {
    const target = (url || getStoredSiteUrl()).trim();
    if (!target) return;
    setStoredSiteUrl(target);
    setBrandStatus('loading');
    try {
      const site = await analyzeSite(target);
      if (site && site.brand) { const n = normalizeBrand(site.brand); setBrandKitState(n); setStoredBrand(n); }
      setBrandStatus('idle');
    } catch { setBrandStatus('error'); }
  }, []);

  const value: BrandCtx = { brandKit, brandStatus, setBrandKit, applySiteBrand, refreshBrand };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBrand(): BrandCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBrand must be used within BrandProvider');
  return c;
}

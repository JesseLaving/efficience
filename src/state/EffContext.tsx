import { createContext, useCallback, useContext, useState } from 'react';
import { BUSINESS } from '../lib/business';
import { showToast } from '../lib/toast';
import { UI } from '../lib/icons';
import { analyzeSite, type SiteResponse } from '../lib/api';
import {
  loadScheduled, addScheduled, updateScheduled, removeScheduled, type ScheduledPost,
} from '../lib/calendar';
import {
  fallbackBrand, getStoredBrand, getStoredSiteUrl, normalizeBrand, setStoredBrand, setStoredSiteUrl,
  type BrandKit,
} from '../lib/brand';

export type ScreenId =
  | 'dashboard' | 'connexion' | 'studio' | 'planning' | 'calendar'
  | 'contacts' | 'campagnes' | 'stats' | 'inbox'
  | 'config' | 'settings' | 'help';

const SCR_LS = 'eff_screen_v1';

interface ClientProfile { name: string; initials: string; }

/* App-level state: navigation, client profile, CRM flag, one-shot seeds (studio /
   campaign), the editorial calendar and the brand kit. Network connections live
   in ConnectionsContext (extracted from this former god-context). */
interface EffCtx {
  screen: ScreenId;
  show: (id: ScreenId) => void;
  client: ClientProfile;
  setClient: (c: ClientProfile) => void;
  crmImported: boolean;
  setCrmImported: (v: boolean) => void;
  campaignSeed: { seg: string } | null;
  newCampaign: (seg: string) => void;
  clearCampaignSeed: () => void;
  /* --- Studio prefill (depuis le Planning éditorial) --- */
  studioSeed: string | null;
  seedStudio: (text: string) => void;
  clearStudioSeed: () => void;
  /* --- charte graphique extraite du site (générateur de visuels) --- */
  brandKit: BrandKit;
  brandStatus: 'idle' | 'loading' | 'error';
  setBrandKit: (b: BrandKit) => void;
  applySiteBrand: (site: SiteResponse) => void;
  refreshBrand: (url?: string) => Promise<void>;
  /* --- calendrier de programmation --- */
  scheduled: ScheduledPost[];
  addToCalendar: (p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'>) => void;
  updateCalendar: (id: string, patch: Partial<ScheduledPost>) => void;
  removeFromCalendar: (id: string) => void;
}

const Ctx = createContext<EffCtx | null>(null);

export function EffProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(
    () => (localStorage.getItem(SCR_LS) as ScreenId) || 'connexion'
  );
  const [client, setClient] = useState<ClientProfile>({ name: BUSINESS.name, initials: BUSINESS.initials });
  const [campaignSeed, setCampaignSeed] = useState<{ seg: string } | null>(null);
  const [crmImported, setCrmImportedState] = useState<boolean>(() => localStorage.getItem('eff_crm_v2') === '1');
  const [studioSeed, setStudioSeed] = useState<string | null>(null);
  const [brandKit, setBrandKitState] = useState<BrandKit>(() => getStoredBrand() || fallbackBrand());
  const [brandStatus, setBrandStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [scheduled, setScheduled] = useState<ScheduledPost[]>(() => loadScheduled());

  const setCrmImported = useCallback((v: boolean) => {
    setCrmImportedState(v);
    if (v) localStorage.setItem('eff_crm_v2', '1');
    else localStorage.removeItem('eff_crm_v2');
  }, []);

  const show = useCallback((id: ScreenId) => {
    setScreen(id);
    localStorage.setItem(SCR_LS, id);
  }, []);

  const newCampaign = useCallback((seg: string) => { setCampaignSeed({ seg }); show('campagnes'); }, [show]);
  const clearCampaignSeed = useCallback(() => setCampaignSeed(null), []);

  const seedStudio = useCallback((t: string) => { setStudioSeed(t); show('studio'); }, [show]);
  const clearStudioSeed = useCallback(() => setStudioSeed(null), []);

  const addToCalendar = useCallback((p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'>) => {
    setScheduled((list) => addScheduled(list, p));
    showToast(UI.calendar, 'Ajouté au calendrier de programmation');
    show('calendar');
  }, [show]);
  const updateCalendar = useCallback((id: string, patch: Partial<ScheduledPost>) => { setScheduled((list) => updateScheduled(list, id, patch)); }, []);
  const removeFromCalendar = useCallback((id: string) => { setScheduled((list) => removeScheduled(list, id)); }, []);

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

  const value: EffCtx = {
    screen, show,
    client, setClient,
    crmImported, setCrmImported,
    campaignSeed, newCampaign, clearCampaignSeed,
    studioSeed, seedStudio, clearStudioSeed,
    brandKit, brandStatus, setBrandKit, applySiteBrand, refreshBrand,
    scheduled, addToCalendar, updateCalendar, removeFromCalendar,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEff(): EffCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEff must be used within EffProvider');
  return c;
}

import { createContext, useCallback, useContext, useState } from 'react';
import { getBusiness } from '../lib/business';

export type ScreenId =
  | 'dashboard' | 'connexion' | 'studio' | 'planning' | 'calendar'
  | 'contacts' | 'campagnes' | 'stats' | 'inbox'
  | 'config' | 'settings' | 'help';

const SCR_LS = 'eff_screen_v1';

interface ClientProfile { name: string; initials: string; }

/* App-level state: navigation, client profile, CRM flag, and one-shot seeds
   (studio / campaign). Network connections live in ConnectionsContext, the
   editorial calendar in CalendarContext, the brand kit in BrandContext — all
   extracted from this former god-context. */
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
}

const Ctx = createContext<EffCtx | null>(null);

export function EffProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(
    () => (localStorage.getItem(SCR_LS) as ScreenId) || 'connexion'
  );
  const [client, setClient] = useState<ClientProfile>(() => {
    const b = getBusiness();
    return { name: b.name, initials: b.initials };
  });
  const [campaignSeed, setCampaignSeed] = useState<{ seg: string } | null>(null);
  const [crmImported, setCrmImportedState] = useState<boolean>(() => localStorage.getItem('eff_crm_v2') === '1');
  const [studioSeed, setStudioSeed] = useState<string | null>(null);

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

  const value: EffCtx = {
    screen, show,
    client, setClient,
    crmImported, setCrmImported,
    campaignSeed, newCampaign, clearCampaignSeed,
    studioSeed, seedStudio, clearStudioSeed,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEff(): EffCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEff must be used within EffProvider');
  return c;
}

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
  campaignSeed: { seg: string } | null;
  newCampaign: (seg: string) => void;
  clearCampaignSeed: () => void;
  /* --- Studio prefill (depuis le Planning éditorial ou le Calendrier) --- */
  studioSeed: StudioSeed | null;
  seedStudio: (text: string) => void;
  /* Ouvre un post déjà programmé dans le Studio pour l'y retravailler
     (texte, visuel, IA) : « Programmer » mettra à jour l'entrée existante
     du calendrier au lieu d'en créer une nouvelle. */
  editPostInStudio: (p: { id: string; text: string; photoUrl: string | null; networks: string[]; dateTime: string }) => void;
  clearStudioSeed: () => void;
}

export interface StudioSeed {
  text: string;
  /* id de l'entrée du calendrier à mettre à jour — null = nouvelle création */
  editId: string | null;
  photoUrl: string | null;
  networks: string[] | null;
  dateTime: string | null;
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
  const [studioSeed, setStudioSeed] = useState<StudioSeed | null>(null);

  const show = useCallback((id: ScreenId) => {
    setScreen(id);
    localStorage.setItem(SCR_LS, id);
  }, []);

  const newCampaign = useCallback((seg: string) => { setCampaignSeed({ seg }); show('campagnes'); }, [show]);
  const clearCampaignSeed = useCallback(() => setCampaignSeed(null), []);

  const seedStudio = useCallback((t: string) => {
    setStudioSeed({ text: t, editId: null, photoUrl: null, networks: null, dateTime: null });
    show('studio');
  }, [show]);
  const editPostInStudio = useCallback((p: { id: string; text: string; photoUrl: string | null; networks: string[]; dateTime: string }) => {
    setStudioSeed({ text: p.text, editId: p.id, photoUrl: p.photoUrl, networks: p.networks, dateTime: p.dateTime });
    show('studio');
  }, [show]);
  const clearStudioSeed = useCallback(() => setStudioSeed(null), []);

  const value: EffCtx = {
    screen, show,
    client, setClient,
    campaignSeed, newCampaign, clearCampaignSeed,
    studioSeed, seedStudio, editPostInStudio, clearStudioSeed,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEff(): EffCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEff must be used within EffProvider');
  return c;
}

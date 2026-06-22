import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BUSINESS } from '../lib/business';
import { showToast } from '../lib/toast';
import { UI } from '../lib/icons';
import {
  captureMetaHash, clearStoredMetaToken, fetchMetaAccounts, getStoredMetaToken, metaLogin,
  type MetaAccount,
} from '../lib/meta';

export type Phase = 'connecting' | 'loading' | null;
export type ScreenId =
  | 'dashboard' | 'connexion' | 'studio' | 'planning'
  | 'contacts' | 'campagnes' | 'stats' | 'inbox'
  | 'config' | 'settings' | 'help';

const SCR_LS = 'eff_screen_v1';
const META_NETS = ['instagram', 'facebook'];

interface ClientProfile { name: string; initials: string; }

interface EffCtx {
  screen: ScreenId;
  show: (id: ScreenId) => void;
  connected: Record<string, boolean>;
  phase: Record<string, Phase>;
  connect: (id: string) => void;
  disconnect: (id: string) => void;
  connectAll: () => void;
  isConnected: (id: string) => boolean;
  connectedCount: number;
  totalReach: number;
  client: ClientProfile;
  setClient: (c: ClientProfile) => void;
  crmImported: boolean;
  setCrmImported: (v: boolean) => void;
  campaignSeed: { seg: string } | null;
  newCampaign: (seg: string) => void;
  clearCampaignSeed: () => void;
  /* --- real Meta (Instagram + Facebook) connection --- */
  metaConnected: boolean;
  metaUser: string | null;
  metaAccounts: MetaAccount[];
  metaStatus: 'idle' | 'loading' | 'error';
  metaError: string | null;
  accountFor: (network: string) => MetaAccount | undefined;
}

const Ctx = createContext<EffCtx | null>(null);

export function EffProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(
    () => (localStorage.getItem(SCR_LS) as ScreenId) || 'connexion'
  );
  const [client, setClient] = useState<ClientProfile>({ name: BUSINESS.name, initials: BUSINESS.initials });
  const [campaignSeed, setCampaignSeed] = useState<{ seg: string } | null>(null);
  const [crmImported, setCrmImportedState] = useState<boolean>(() => localStorage.getItem('eff_crm_v2') === '1');

  const [metaToken, setMetaToken] = useState<string | null>(() => getStoredMetaToken());
  const [metaUser, setMetaUser] = useState<string | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [metaStatus, setMetaStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [metaError, setMetaError] = useState<string | null>(null);

  // Capture the OAuth bounce (token / error in URL hash) on first load.
  useEffect(() => {
    const { token, error } = captureMetaHash();
    if (token) { setMetaToken(token); showToast(UI.check, 'Comptes Meta connectés'); }
    else if (error) { setMetaError(error); showToast(UI.close, `Connexion Meta : ${error}`); }
  }, []);

  // Load real accounts whenever we hold a token.
  useEffect(() => {
    if (!metaToken) { setMetaAccounts([]); setMetaUser(null); return; }
    let alive = true;
    setMetaStatus('loading'); setMetaError(null);
    fetchMetaAccounts(metaToken)
      .then((d) => { if (!alive) return; setMetaAccounts(d.accounts || []); setMetaUser(d.user || null); setMetaStatus('idle'); })
      .catch((e) => { if (!alive) return; setMetaError(String(e.message || e)); setMetaStatus('error'); });
    return () => { alive = false; };
  }, [metaToken]);

  const setCrmImported = useCallback((v: boolean) => {
    setCrmImportedState(v);
    if (v) localStorage.setItem('eff_crm_v2', '1');
    else localStorage.removeItem('eff_crm_v2');
  }, []);

  const show = useCallback((id: ScreenId) => {
    setScreen(id);
    localStorage.setItem(SCR_LS, id);
  }, []);

  const accountFor = useCallback((network: string) => metaAccounts.find((a) => a.network === network), [metaAccounts]);
  const isConnected = useCallback((id: string) => metaAccounts.some((a) => a.network === id), [metaAccounts]);

  const connectMeta = useCallback(() => metaLogin(), []);
  const disconnectMeta = useCallback(() => {
    clearStoredMetaToken(); setMetaToken(null); setMetaAccounts([]); setMetaUser(null); setMetaError(null);
  }, []);

  const connect = useCallback((id: string) => {
    if (META_NETS.includes(id)) connectMeta();
    else showToast(UI.link, `Connexion ${id} — bientôt (nécessite l’app développeur de cette plateforme)`);
  }, [connectMeta]);

  const disconnect = useCallback((id: string) => {
    if (META_NETS.includes(id)) disconnectMeta();
  }, [disconnectMeta]);

  const connectAll = useCallback(() => connectMeta(), [connectMeta]);

  const connected = useMemo(() => {
    const m: Record<string, boolean> = {};
    metaAccounts.forEach((a) => { m[a.network] = true; });
    return m;
  }, [metaAccounts]);

  const phase = useMemo<Record<string, Phase>>(() => {
    const loading: Record<string, Phase> = { instagram: 'loading', facebook: 'loading' };
    return metaToken && metaStatus === 'loading' ? loading : {};
  }, [metaToken, metaStatus]);

  const connectedCount = useMemo(() => new Set(metaAccounts.map((a) => a.network)).size, [metaAccounts]);
  const totalReach = useMemo(() => metaAccounts.reduce((s, a) => s + (a.followers || 0), 0), [metaAccounts]);

  const newCampaign = useCallback((seg: string) => { setCampaignSeed({ seg }); show('campagnes'); }, [show]);
  const clearCampaignSeed = useCallback(() => setCampaignSeed(null), []);

  const value: EffCtx = {
    screen, show,
    connected, phase, connect, disconnect, connectAll, isConnected,
    connectedCount, totalReach,
    client, setClient,
    crmImported, setCrmImported,
    campaignSeed, newCampaign, clearCampaignSeed,
    metaConnected: !!metaToken, metaUser, metaAccounts, metaStatus, metaError, accountFor,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEff(): EffCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEff must be used within EffProvider');
  return c;
}

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { NETWORKS } from '../lib/networks';
import { BUSINESS } from '../lib/business';

export type Phase = 'connecting' | 'loading' | null;
export type ScreenId =
  | 'dashboard' | 'connexion' | 'studio' | 'planning'
  | 'contacts' | 'campagnes' | 'stats' | 'inbox'
  | 'config' | 'settings' | 'help';

const CONN_LS = 'eff_connected_v1';
const SCR_LS = 'eff_screen_v1';

function loadConnected(): Record<string, boolean> {
  try {
    const s = JSON.parse(localStorage.getItem(CONN_LS) || 'null');
    if (s) return s;
  } catch { /* ignore */ }
  // Start vide: no account pre-connected.
  const c: Record<string, boolean> = {};
  NETWORKS.forEach((n) => { if (n.def) c[n.id] = true; });
  return c;
}

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
  /** preselected segment id handed from CRM → campaigns */
  campaignSeed: { seg: string } | null;
  newCampaign: (seg: string) => void;
  clearCampaignSeed: () => void;
}

const Ctx = createContext<EffCtx | null>(null);

export function EffProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(
    () => (localStorage.getItem(SCR_LS) as ScreenId) || 'connexion'
  );
  const [connected, setConnected] = useState<Record<string, boolean>>(loadConnected);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [client, setClient] = useState<ClientProfile>({ name: BUSINESS.name, initials: BUSINESS.initials });
  const [campaignSeed, setCampaignSeed] = useState<{ seg: string } | null>(null);
  const [crmImported, setCrmImportedState] = useState<boolean>(() => localStorage.getItem('eff_crm_v2') === '1');
  const timers = useRef<Record<string, number[]>>({});

  const setCrmImported = useCallback((v: boolean) => {
    setCrmImportedState(v);
    if (v) localStorage.setItem('eff_crm_v2', '1');
    else localStorage.removeItem('eff_crm_v2');
  }, []);

  const persistConn = (next: Record<string, boolean>) =>
    localStorage.setItem(CONN_LS, JSON.stringify(next));

  const show = useCallback((id: ScreenId) => {
    setScreen(id);
    localStorage.setItem(SCR_LS, id);
  }, []);

  const setP = (id: string, p: Phase) =>
    setPhase((prev) => ({ ...prev, [id]: p }));

  const connect = useCallback((id: string) => {
    setP(id, 'connecting');
    const t1 = window.setTimeout(() => {
      setConnected((prev) => { const next = { ...prev, [id]: true }; persistConn(next); return next; });
      setP(id, 'loading');
      const t2 = window.setTimeout(() => setP(id, null), 950);
      timers.current[id] = [t2];
    }, 1350);
    timers.current[id] = [t1];
  }, []);

  const disconnect = useCallback((id: string) => {
    setConnected((prev) => { const next = { ...prev, [id]: false }; persistConn(next); return next; });
    setP(id, null);
  }, []);

  const connectAll = useCallback(() => {
    NETWORKS.forEach((n, i) => {
      if (!connected[n.id] && !phase[n.id]) {
        window.setTimeout(() => connect(n.id), i * 260);
      }
    });
  }, [connected, phase, connect]);

  const isConnected = useCallback((id: string) => !!connected[id], [connected]);

  const connectedCount = useMemo(
    () => NETWORKS.filter((n) => connected[n.id]).length, [connected]
  );
  const totalReach = useMemo(
    () => NETWORKS.reduce((s, n) => (connected[n.id] && !n.page.rating ? s + n.page.metricN : s), 0),
    [connected]
  );

  const newCampaign = useCallback((seg: string) => { setCampaignSeed({ seg }); show('campagnes'); }, [show]);
  const clearCampaignSeed = useCallback(() => setCampaignSeed(null), []);

  const value: EffCtx = {
    screen, show,
    connected, phase, connect, disconnect, connectAll, isConnected,
    connectedCount, totalReach,
    client, setClient,
    crmImported, setCrmImported,
    campaignSeed, newCampaign, clearCampaignSeed,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEff(): EffCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEff must be used within EffProvider');
  return c;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { showToast } from '../lib/toast';
import { UI } from '../lib/icons';
import {
  clearStoredMetaToken, fetchMetaAccounts, fetchMetaStats, getStoredMetaToken, setStoredMetaToken, metaLogin,
  type MetaAccount, type MetaStatAccount,
} from '../lib/meta';
import {
  clearStoredGoogle, fetchGoogleAccounts, getStoredGoogleToken, getStoredGoogleRefresh,
  googleLogin, refreshGoogle, setStoredGoogle, type GoogleLocation,
} from '../lib/google';
import {
  clearStoredLiToken, fetchLinkedInMe, getStoredLiToken, linkedinLogin, setStoredLiToken,
  type LinkedInMe,
} from '../lib/linkedin';

export type Phase = 'connecting' | 'loading' | null;
const META_NETS = ['instagram', 'facebook'];

/* Connexions réseaux (Meta / Google / LinkedIn) — état, OAuth, comptes & stats.
   Extrait de EffContext (god-context) : ce domaine était lu par 10 écrans et
   reliait artificiellement 10 communautés du graphe. Isolé ici, une mise à jour
   d'un token/compte ne re-rend plus que les consommateurs de connexions. */
interface ConnectionsCtx {
  connected: Record<string, boolean>;
  phase: Record<string, Phase>;
  connect: (id: string) => void;
  disconnect: (id: string) => void;
  connectAll: () => void;
  isConnected: (id: string) => boolean;
  connectedCount: number;
  totalReach: number;
  /* --- Meta (Instagram + Facebook) --- */
  metaConnected: boolean;
  metaToken: string | null;
  metaUser: string | null;
  metaAccounts: MetaAccount[];
  metaStatus: 'idle' | 'loading' | 'error';
  metaError: string | null;
  accountFor: (network: string) => MetaAccount | undefined;
  metaStats: MetaStatAccount[] | null;
  metaStatsStatus: 'idle' | 'loading' | 'error';
  metaStatsError: string | null;
  refreshMetaStats: () => void;
  /* --- Google Business --- */
  googleConnected: boolean;
  googleToken: string | null;
  googleAccounts: GoogleLocation[];
  googleStatus: 'idle' | 'loading' | 'error';
  googleReason: string | null;
  connectGoogle: () => void;
  disconnectGoogle: () => void;
  refreshGoogleToken: () => Promise<string | null>;
  /* --- LinkedIn (member profile) --- */
  linkedinConnected: boolean;
  linkedinToken: string | null;
  linkedinMe: LinkedInMe | null;
  connectLinkedin: () => void;
  disconnectLinkedin: () => void;
}

const Ctx = createContext<ConnectionsCtx | null>(null);

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const [metaToken, setMetaToken] = useState<string | null>(() => getStoredMetaToken());
  const [metaUser, setMetaUser] = useState<string | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [metaStatus, setMetaStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaStats, setMetaStats] = useState<MetaStatAccount[] | null>(null);
  const [metaStatsStatus, setMetaStatsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [metaStatsError, setMetaStatsError] = useState<string | null>(null);

  const [googleToken, setGoogleToken] = useState<string | null>(() => getStoredGoogleToken());
  const [googleAccounts, setGoogleAccounts] = useState<GoogleLocation[]>([]);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [googleReason, setGoogleReason] = useState<string | null>(null);

  const [linkedinToken, setLinkedinToken] = useState<string | null>(() => getStoredLiToken());
  const [linkedinMe, setLinkedinMe] = useState<LinkedInMe | null>(null);

  // Capture the OAuth bounce (Meta + Google + LinkedIn tokens / errors in URL hash) once.
  useEffect(() => {
    if (!location.hash) return;
    const h = new URLSearchParams(location.hash.slice(1));
    const mt = h.get('meta_token'), me = h.get('meta_error');
    const gt = h.get('google_token'), gr = h.get('google_refresh'), ge = h.get('google_error');
    const lt = h.get('li_token'), le = h.get('li_error');
    if (mt || me || gt || ge || lt || le) history.replaceState(null, '', location.pathname + location.search);
    if (mt) { setStoredMetaToken(mt); setMetaToken(mt); showToast(UI.check, 'Comptes Meta connectés'); }
    else if (me) { setMetaError(me); showToast(UI.close, `Connexion Meta : ${me}`); }
    if (gt) { setStoredGoogle(gt, gr || undefined); setGoogleToken(gt); showToast(UI.check, 'Google Business connecté'); }
    else if (ge) { setGoogleReason(ge); showToast(UI.close, `Connexion Google : ${ge}`); }
    if (lt) { setStoredLiToken(lt); setLinkedinToken(lt); showToast(UI.check, 'LinkedIn connecté'); }
    else if (le) { showToast(UI.close, `Connexion LinkedIn : ${le}`); }
  }, []);

  // Load Google locations whenever we hold a token.
  useEffect(() => {
    if (!googleToken) { setGoogleAccounts([]); return; }
    let alive = true;
    setGoogleStatus('loading'); setGoogleReason(null);
    fetchGoogleAccounts(googleToken)
      .then((d) => { if (!alive) return; setGoogleAccounts(d.accounts || []); setGoogleReason(d.available ? null : (d.reason || null)); setGoogleStatus('idle'); })
      .catch((e) => { if (!alive) return; setGoogleReason(String(e.message || e)); setGoogleStatus('error'); });
    return () => { alive = false; };
  }, [googleToken]);

  // Load LinkedIn member profile when a token is held.
  useEffect(() => {
    if (!linkedinToken) { setLinkedinMe(null); return; }
    let alive = true;
    fetchLinkedInMe(linkedinToken)
      .then((d) => { if (alive) setLinkedinMe(d); })
      .catch(() => { if (alive) setLinkedinMe(null); });
    return () => { alive = false; };
  }, [linkedinToken]);

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

  // Load real engagement stats (posts, likes, insights) once a token is held —
  // shared by both the Statistics screen and the Dashboard.
  useEffect(() => {
    if (!metaToken) { setMetaStats(null); setMetaStatsError(null); return; }
    let alive = true;
    setMetaStatsStatus('loading'); setMetaStatsError(null);
    fetchMetaStats(metaToken)
      .then((d) => { if (!alive) return; setMetaStats(d.accounts || []); setMetaStatsStatus('idle'); })
      .catch((e) => { if (!alive) return; setMetaStatsError(String(e.message || e)); setMetaStatsStatus('error'); });
    return () => { alive = false; };
  }, [metaToken]);

  const refreshMetaStats = useCallback(() => {
    if (!metaToken) return;
    setMetaStatsStatus('loading'); setMetaStatsError(null);
    fetchMetaStats(metaToken)
      .then((d) => { setMetaStats(d.accounts || []); setMetaStatsStatus('idle'); })
      .catch((e) => { setMetaStatsError(String(e.message || e)); setMetaStatsStatus('error'); });
  }, [metaToken]);

  const accountFor = useCallback((network: string) => metaAccounts.find((a) => a.network === network), [metaAccounts]);
  const isConnected = useCallback((id: string) => (id === 'google' ? !!googleToken : id === 'linkedin' ? !!linkedinToken : metaAccounts.some((a) => a.network === id)), [metaAccounts, googleToken, linkedinToken]);

  const connectMeta = useCallback(() => metaLogin(), []);
  const disconnectMeta = useCallback(() => {
    clearStoredMetaToken(); setMetaToken(null); setMetaAccounts([]); setMetaUser(null); setMetaError(null);
  }, []);

  const connectGoogle = useCallback(() => googleLogin(), []);
  const disconnectGoogle = useCallback(() => {
    clearStoredGoogle(); setGoogleToken(null); setGoogleAccounts([]); setGoogleReason(null);
  }, []);
  const refreshGoogleToken = useCallback(async () => {
    const r = getStoredGoogleRefresh();
    if (!r) return null;
    try { const t = await refreshGoogle(r); setStoredGoogle(t); setGoogleToken(t); return t; } catch { return null; }
  }, []);

  const connectLinkedin = useCallback(() => linkedinLogin(), []);
  const disconnectLinkedin = useCallback(() => { clearStoredLiToken(); setLinkedinToken(null); setLinkedinMe(null); }, []);

  const connect = useCallback((id: string) => {
    if (META_NETS.includes(id)) connectMeta();
    else if (id === 'google') connectGoogle();
    else if (id === 'linkedin') connectLinkedin();
    else showToast(UI.link, `Connexion ${id} — bientôt (nécessite l’app développeur de cette plateforme)`);
  }, [connectMeta, connectGoogle, connectLinkedin]);

  const disconnect = useCallback((id: string) => {
    if (META_NETS.includes(id)) disconnectMeta();
    else if (id === 'google') disconnectGoogle();
    else if (id === 'linkedin') disconnectLinkedin();
  }, [disconnectMeta, disconnectGoogle, disconnectLinkedin]);

  const connectAll = useCallback(() => connectMeta(), [connectMeta]);

  const connected = useMemo(() => {
    const m: Record<string, boolean> = {};
    metaAccounts.forEach((a) => { m[a.network] = true; });
    if (googleToken) m.google = true;
    if (linkedinToken) m.linkedin = true;
    return m;
  }, [metaAccounts, googleToken, linkedinToken]);

  const phase = useMemo<Record<string, Phase>>(() => {
    const loading: Record<string, Phase> = { instagram: 'loading', facebook: 'loading' };
    return metaToken && metaStatus === 'loading' ? loading : {};
  }, [metaToken, metaStatus]);

  const connectedCount = useMemo(() => new Set(metaAccounts.map((a) => a.network)).size + (googleToken ? 1 : 0) + (linkedinToken ? 1 : 0), [metaAccounts, googleToken, linkedinToken]);
  const totalReach = useMemo(() => metaAccounts.reduce((s, a) => s + (a.followers || 0), 0), [metaAccounts]);

  const value: ConnectionsCtx = {
    connected, phase, connect, disconnect, connectAll, isConnected, connectedCount, totalReach,
    metaConnected: !!metaToken, metaToken, metaUser, metaAccounts, metaStatus, metaError, accountFor,
    metaStats, metaStatsStatus, metaStatsError, refreshMetaStats,
    googleConnected: !!googleToken, googleToken, googleAccounts, googleStatus, googleReason,
    connectGoogle, disconnectGoogle, refreshGoogleToken,
    linkedinConnected: !!linkedinToken, linkedinToken, linkedinMe, connectLinkedin, disconnectLinkedin,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnections(): ConnectionsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConnections must be used within ConnectionsProvider');
  return c;
}

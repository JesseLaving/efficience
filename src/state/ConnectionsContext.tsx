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
  clearStoredYoutube, fetchYoutubeChannel, getStoredYoutubeToken, getStoredYoutubeRefresh,
  setStoredYoutube, youtubeLogin, type YoutubeChannel,
} from '../lib/google';
import {
  clearStoredLiToken, fetchLinkedInMe, getStoredLiToken, linkedinLogin, setStoredLiToken,
  type LinkedInMe,
} from '../lib/linkedin';
import {
  clearStoredTiktok, fetchTiktokUserInfo, getStoredTiktokToken, getStoredTiktokRefresh,
  refreshTiktok, setStoredTiktok, tiktokLogin, type TiktokProfile,
} from '../lib/tiktok';

export type Phase = 'connecting' | 'loading' | null;
const META_NETS = ['instagram', 'facebook'];

/* Connexions réseaux (Meta / Google / LinkedIn / YouTube / TikTok) — état,
   OAuth, comptes & stats. Extrait de EffContext (god-context) : ce domaine
   était lu par 10 écrans et reliait artificiellement 10 communautés du
   graphe. Isolé ici, une mise à jour d'un token/compte ne re-rend plus que
   les consommateurs de connexions. */
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
  /* --- YouTube (stats de chaîne) --- */
  youtubeConnected: boolean;
  youtubeToken: string | null;
  youtubeChannel: YoutubeChannel | null;
  youtubeStatus: 'idle' | 'loading' | 'error';
  youtubeReason: string | null;
  connectYoutube: () => void;
  disconnectYoutube: () => void;
  /* --- TikTok --- */
  tiktokConnected: boolean;
  tiktokToken: string | null;
  tiktokProfile: TiktokProfile | null;
  tiktokStatus: 'idle' | 'loading' | 'error';
  tiktokReason: string | null;
  connectTiktok: () => void;
  disconnectTiktok: () => void;
  refreshTiktokToken: () => Promise<string | null>;
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

  const [youtubeToken, setYoutubeToken] = useState<string | null>(() => getStoredYoutubeToken());
  const [youtubeChannel, setYoutubeChannel] = useState<YoutubeChannel | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [youtubeReason, setYoutubeReason] = useState<string | null>(null);

  const [tiktokToken, setTiktokToken] = useState<string | null>(() => getStoredTiktokToken());
  const [tiktokProfile, setTiktokProfile] = useState<TiktokProfile | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [tiktokReason, setTiktokReason] = useState<string | null>(null);

  // Capture the OAuth bounce (Meta + Google + LinkedIn + YouTube + TikTok tokens / errors in URL hash) once.
  useEffect(() => {
    if (!location.hash) return;
    const h = new URLSearchParams(location.hash.slice(1));
    const mt = h.get('meta_token'), me = h.get('meta_error');
    const gt = h.get('google_token'), gr = h.get('google_refresh'), ge = h.get('google_error');
    const lt = h.get('li_token'), le = h.get('li_error');
    const yt = h.get('yt_token'), yr = h.get('yt_refresh'), ye = h.get('yt_error');
    const tt = h.get('tt_token'), tr = h.get('tt_refresh'), to = h.get('tt_openid'), te = h.get('tt_error');
    if (mt || me || gt || ge || lt || le || yt || ye || tt || te) history.replaceState(null, '', location.pathname + location.search);
    if (mt) { setStoredMetaToken(mt); setMetaToken(mt); showToast(UI.check, 'Comptes Meta connectés'); }
    else if (me) { setMetaError(me); showToast(UI.close, `Connexion Meta : ${me}`); }
    if (gt) { setStoredGoogle(gt, gr || undefined); setGoogleToken(gt); showToast(UI.check, 'Google Business connecté'); }
    else if (ge) { setGoogleReason(ge); showToast(UI.close, `Connexion Google : ${ge}`); }
    if (lt) { setStoredLiToken(lt); setLinkedinToken(lt); showToast(UI.check, 'LinkedIn connecté'); }
    else if (le) { showToast(UI.close, `Connexion LinkedIn : ${le}`); }
    if (yt) { setStoredYoutube(yt, yr || undefined); setYoutubeToken(yt); showToast(UI.check, 'YouTube connecté'); }
    else if (ye) { setYoutubeReason(ye); showToast(UI.close, `Connexion YouTube : ${ye}`); }
    if (tt) { setStoredTiktok(tt, tr || undefined, to || undefined); setTiktokToken(tt); showToast(UI.check, 'TikTok connecté'); }
    else if (te) { setTiktokReason(te); showToast(UI.close, `Connexion TikTok : ${te}`); }
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

  // Load YouTube channel stats whenever we hold a token.
  useEffect(() => {
    if (!youtubeToken) { setYoutubeChannel(null); return; }
    let alive = true;
    setYoutubeStatus('loading'); setYoutubeReason(null);
    fetchYoutubeChannel(youtubeToken)
      .then((d) => { if (!alive) return; setYoutubeChannel(d.channel || null); setYoutubeReason(d.available ? null : (d.reason || null)); setYoutubeStatus('idle'); })
      .catch((e) => { if (!alive) return; setYoutubeReason(String(e.message || e)); setYoutubeStatus('error'); });
    return () => { alive = false; };
  }, [youtubeToken]);

  // Load TikTok profile + stats whenever we hold a token.
  useEffect(() => {
    if (!tiktokToken) { setTiktokProfile(null); return; }
    let alive = true;
    setTiktokStatus('loading'); setTiktokReason(null);
    fetchTiktokUserInfo(tiktokToken)
      .then((d) => { if (!alive) return; setTiktokProfile(d.profile || null); setTiktokReason(d.available ? null : (d.reason || null)); setTiktokStatus('idle'); })
      .catch((e) => { if (!alive) return; setTiktokReason(String(e.message || e)); setTiktokStatus('error'); });
    return () => { alive = false; };
  }, [tiktokToken]);

  const refreshMetaStats = useCallback(() => {
    if (!metaToken) return;
    setMetaStatsStatus('loading'); setMetaStatsError(null);
    fetchMetaStats(metaToken)
      .then((d) => { setMetaStats(d.accounts || []); setMetaStatsStatus('idle'); })
      .catch((e) => { setMetaStatsError(String(e.message || e)); setMetaStatsStatus('error'); });
  }, [metaToken]);

  const accountFor = useCallback((network: string) => metaAccounts.find((a) => a.network === network), [metaAccounts]);
  const isConnected = useCallback((id: string) => (
    id === 'google' ? !!googleToken
      : id === 'linkedin' ? !!linkedinToken
      : id === 'youtube' ? !!youtubeToken
      : id === 'tiktok' ? !!tiktokToken
      : metaAccounts.some((a) => a.network === id)
  ), [metaAccounts, googleToken, linkedinToken, youtubeToken, tiktokToken]);

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

  const connectYoutube = useCallback(() => youtubeLogin(), []);
  const disconnectYoutube = useCallback(() => {
    clearStoredYoutube(); setYoutubeToken(null); setYoutubeChannel(null); setYoutubeReason(null);
  }, []);

  const connectTiktok = useCallback(() => tiktokLogin(), []);
  const disconnectTiktok = useCallback(() => {
    clearStoredTiktok(); setTiktokToken(null); setTiktokProfile(null); setTiktokReason(null);
  }, []);
  const refreshTiktokToken = useCallback(async () => {
    const r = getStoredTiktokRefresh();
    if (!r) return null;
    const res = await refreshTiktok(r);
    if (!res) return null;
    setStoredTiktok(res.token, res.refresh); setTiktokToken(res.token);
    return res.token;
  }, []);

  const connect = useCallback((id: string) => {
    if (META_NETS.includes(id)) connectMeta();
    else if (id === 'google') connectGoogle();
    else if (id === 'linkedin') connectLinkedin();
    else if (id === 'youtube') connectYoutube();
    else if (id === 'tiktok') connectTiktok();
    else showToast(UI.link, `Connexion ${id} — bientôt (nécessite l’app développeur de cette plateforme)`);
  }, [connectMeta, connectGoogle, connectLinkedin, connectYoutube, connectTiktok]);

  const disconnect = useCallback((id: string) => {
    if (META_NETS.includes(id)) disconnectMeta();
    else if (id === 'google') disconnectGoogle();
    else if (id === 'linkedin') disconnectLinkedin();
    else if (id === 'youtube') disconnectYoutube();
    else if (id === 'tiktok') disconnectTiktok();
  }, [disconnectMeta, disconnectGoogle, disconnectLinkedin, disconnectYoutube, disconnectTiktok]);

  const connectAll = useCallback(() => connectMeta(), [connectMeta]);

  const connected = useMemo(() => {
    const m: Record<string, boolean> = {};
    metaAccounts.forEach((a) => { m[a.network] = true; });
    if (googleToken) m.google = true;
    if (linkedinToken) m.linkedin = true;
    if (youtubeToken) m.youtube = true;
    if (tiktokToken) m.tiktok = true;
    return m;
  }, [metaAccounts, googleToken, linkedinToken, youtubeToken, tiktokToken]);

  const phase = useMemo<Record<string, Phase>>(() => {
    const loading: Record<string, Phase> = { instagram: 'loading', facebook: 'loading' };
    return metaToken && metaStatus === 'loading' ? loading : {};
  }, [metaToken, metaStatus]);

  const connectedCount = useMemo(() => new Set(metaAccounts.map((a) => a.network)).size + (googleToken ? 1 : 0) + (linkedinToken ? 1 : 0) + (youtubeToken ? 1 : 0) + (tiktokToken ? 1 : 0), [metaAccounts, googleToken, linkedinToken, youtubeToken, tiktokToken]);
  const totalReach = useMemo(() => metaAccounts.reduce((s, a) => s + (a.followers || 0), 0) + (youtubeChannel?.subscribers || 0) + (tiktokProfile?.followers || 0), [metaAccounts, youtubeChannel, tiktokProfile]);

  const value: ConnectionsCtx = {
    connected, phase, connect, disconnect, connectAll, isConnected, connectedCount, totalReach,
    metaConnected: !!metaToken, metaToken, metaUser, metaAccounts, metaStatus, metaError, accountFor,
    metaStats, metaStatsStatus, metaStatsError, refreshMetaStats,
    googleConnected: !!googleToken, googleToken, googleAccounts, googleStatus, googleReason,
    connectGoogle, disconnectGoogle, refreshGoogleToken,
    linkedinConnected: !!linkedinToken, linkedinToken, linkedinMe, connectLinkedin, disconnectLinkedin,
    youtubeConnected: !!youtubeToken, youtubeToken, youtubeChannel, youtubeStatus, youtubeReason, connectYoutube, disconnectYoutube,
    tiktokConnected: !!tiktokToken, tiktokToken, tiktokProfile, tiktokStatus, tiktokReason, connectTiktok, disconnectTiktok, refreshTiktokToken,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnections(): ConnectionsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConnections must be used within ConnectionsProvider');
  return c;
}

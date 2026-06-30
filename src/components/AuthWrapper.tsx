import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSpaceData, saveSpaceData } from '../lib/auth';
import { LoginScreen } from './LoginScreen';
import { SpaceSelector } from './SpaceSelector';
import { ProfileMenu } from './ProfileMenu';
import { App } from '../App';
import '../styles/AuthWrapper.css';

// localStorage key that records which space's data is currently loaded into
// localStorage. Excluded from the synced snapshot.
const ACTIVE_KEY = 'eff_active_space';

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k === ACTIVE_KEY) continue;
    const v = localStorage.getItem(k);
    if (v != null) out[k] = v;
  }
  return out;
}

export function AuthWrapper() {
  const { isAuth, user, loading } = useAuth();
  const initialActive = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;
  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(initialActive ? Number(initialActive) : null);
  const [activating, setActivating] = useState(false);
  const lastSaved = useRef<string>('');

  // Switch space: pull the space's stored data into localStorage and reload so
  // every provider (which reads localStorage at boot) re-initialises. A brand
  // new/empty space keeps the current localStorage and seeds itself on save.
  const activateSpace = useCallback(async (spaceId: number) => {
    if (localStorage.getItem(ACTIVE_KEY) === String(spaceId)) {
      setActiveSpaceId(spaceId);
      return;
    }
    setActivating(true);
    try {
      const data = await getSpaceData(spaceId) as Record<string, string>;
      const keys = Object.keys(data || {});
      if (keys.length > 0) {
        // Existing space → replace localStorage with its snapshot.
        Object.keys(snapshot()).forEach((k) => localStorage.removeItem(k));
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'string') localStorage.setItem(k, v);
        }
      }
      // Empty space → keep current localStorage; it becomes this space's seed.
      localStorage.setItem(ACTIVE_KEY, String(spaceId));
      window.location.reload();
    } catch (e) {
      console.error('Failed to activate space:', e);
      setActivating(false);
    }
  }, []);

  // Autosave: snapshot localStorage to the server when it changes.
  useEffect(() => {
    if (!activeSpaceId) return;
    lastSaved.current = JSON.stringify(snapshot());
    const tick = () => {
      const snap = JSON.stringify(snapshot());
      if (snap !== lastSaved.current) {
        lastSaved.current = snap;
        saveSpaceData(activeSpaceId, JSON.parse(snap)).catch((e) => console.error('Autosave failed:', e));
      }
    };
    const id = window.setInterval(tick, 4000);
    const onLeave = () => {
      const snap = JSON.stringify(snapshot());
      if (snap !== lastSaved.current) {
        navigator.sendBeacon?.(
          `/api/spaces/data?spaceId=${activeSpaceId}`,
          new Blob([JSON.stringify({ data: JSON.parse(snap) })], { type: 'application/json' })
        );
      }
    };
    window.addEventListener('beforeunload', onLeave);
    return () => { window.clearInterval(id); window.removeEventListener('beforeunload', onLeave); };
  }, [activeSpaceId]);

  if (loading) {
    return <div className="auth-loading">Authentification…</div>;
  }

  if (!isAuth) {
    return <LoginScreen />;
  }

  return (
    <div className="auth-layout">
      <header className="auth-header">
        <div className="auth-header-left">
          <img src={`${import.meta.env.BASE_URL}assets/logo-green.png`} alt="Efficience" style={{ width: 24, height: 24 }} />
          <h1>Efficience</h1>
        </div>
        <div className="auth-header-center">
          <SpaceSelector selectedSpaceId={activeSpaceId ?? undefined} onSelect={activateSpace} />
        </div>
        <div className="auth-header-right">
          <ProfileMenu name={user?.name} email={user?.email} />
        </div>
      </header>

      <div className="auth-content">
        {activating ? (
          <div className="auth-loading">Chargement de l'espace…</div>
        ) : activeSpaceId ? (
          <App />
        ) : (
          <div className="auth-empty">
            <p>Sélectionnez ou créez un espace pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  );
}

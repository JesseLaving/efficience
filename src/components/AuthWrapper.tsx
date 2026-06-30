import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSpaceData, saveSpaceData } from '../lib/auth';
import { LoginScreen } from './LoginScreen';
import { SpaceSelector } from './SpaceSelector';
import { ProfileMenu } from './ProfileMenu';
import { App } from '../App';
import '../styles/AuthWrapper.css';

export function AuthWrapper() {
  const { isAuth, user, loading } = useAuth();
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [spaceLoading, setSpaceLoading] = useState(true);
  const [appData, setAppData] = useState<Record<string, any> | null>(null);

  // Load space data when space is selected
  useEffect(() => {
    if (selectedSpaceId === null) return;

    async function loadSpace(spaceId: number) {
      try {
        setSpaceLoading(true);
        const data = await getSpaceData(spaceId);
        setAppData(data);
        // Restore localStorage from space data
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      } catch (e) {
        console.error('Failed to load space data:', e);
      } finally {
        setSpaceLoading(false);
      }
    }

    loadSpace(selectedSpaceId);
  }, [selectedSpaceId]);

  // Auto-save to server
  useEffect(() => {
    if (!selectedSpaceId || !appData) return;

    const timer = setTimeout(() => {
      saveSpaceData(selectedSpaceId, appData).catch(e => {
        console.error('Failed to save space data:', e);
      });
    }, 2000); // Debounce saves every 2s

    return () => clearTimeout(timer);
  }, [appData, selectedSpaceId]);

  // Monitor localStorage changes and update appData
  useEffect(() => {
    if (!selectedSpaceId) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.newValue) {
        try {
          const value = JSON.parse(e.newValue);
          setAppData(prev => prev ? { ...prev, [e.key!]: value } : null);
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [selectedSpaceId]);

  if (loading) {
    return <div className="auth-loading">Authentification...</div>;
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
          {spaceLoading ? (
            <div className="space-loading">Chargement...</div>
          ) : (
            <SpaceSelector selectedSpaceId={selectedSpaceId ?? undefined} onSelect={setSelectedSpaceId} />
          )}
        </div>

        <div className="auth-header-right">
          <ProfileMenu name={user?.name} email={user?.email} />
        </div>
      </header>

      <div className="auth-content">
        {selectedSpaceId && !spaceLoading && <App />}
      </div>
    </div>
  );
}

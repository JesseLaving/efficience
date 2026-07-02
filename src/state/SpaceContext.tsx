import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getSpaces, createSpace as apiCreateSpace, renameSpace as apiRenameSpace, deleteSpace as apiDeleteSpace,
  type Space,
} from '../lib/auth';

/* Liste des espaces (multi-tenant) — source unique de vérité, partagée par le
   SpaceSelector (en-tête) et l'écran Réglages (renommer / supprimer l'espace
   actif). Ne gère PAS l'activation (changement d'espace + rechargement des
   données locales) : ça reste dans AuthWrapper, qui possède ACTIVE_KEY. */
interface SpaceCtx {
  spaces: Space[];
  loading: boolean;
  activeSpaceId: number | null;
  createSpace: (name: string) => Promise<Space>;
  renameSpace: (id: number, name: string) => Promise<Space>;
  deleteSpace: (id: number) => Promise<void>;
}

const Ctx = createContext<SpaceCtx | null>(null);

export function SpaceProvider({ children, activeSpaceId, onActiveSpaceDeleted }: {
  children: React.ReactNode;
  activeSpaceId: number | null;
  /** Appelé après suppression réussie de l'espace ACTUELLEMENT actif — à
      AuthWrapper de nettoyer le localStorage et recharger. */
  onActiveSpaceDeleted: () => void;
}) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getSpaces()
      .then((list) => { if (alive) setSpaces(list); })
      .catch((e) => console.error('Failed to load spaces:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const createSpace = useCallback(async (name: string) => {
    const space = await apiCreateSpace(name);
    setSpaces((prev) => [space, ...prev]);
    return space;
  }, []);

  const renameSpace = useCallback(async (id: number, name: string) => {
    const updated = await apiRenameSpace(id, name);
    setSpaces((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteSpace = useCallback(async (id: number) => {
    await apiDeleteSpace(id);
    setSpaces((prev) => prev.filter((s) => s.id !== id));
    if (id === activeSpaceId) onActiveSpaceDeleted();
  }, [activeSpaceId, onActiveSpaceDeleted]);

  const value: SpaceCtx = { spaces, loading, activeSpaceId, createSpace, renameSpace, deleteSpace };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpaces(): SpaceCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSpaces must be used within SpaceProvider');
  return c;
}

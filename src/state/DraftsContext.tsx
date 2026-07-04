import { createContext, useCallback, useContext, useState } from 'react';
import { loadDrafts, saveDrafts, type Draft } from '../lib/drafts';

interface DraftsCtx {
  drafts: Draft[];
  saveDraft: (d: Draft) => void;
  deleteDraft: (id: string) => void;
}

const Ctx = createContext<DraftsCtx | null>(null);

export function DraftsProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => loadDrafts());

  const saveDraft = useCallback((d: Draft) => {
    setDrafts((prev) => {
      const next = [d, ...prev.filter((p) => p.id !== d.id)];
      saveDrafts(next);
      return next;
    });
  }, []);

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveDrafts(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ drafts, saveDraft, deleteDraft }}>{children}</Ctx.Provider>;
}

export function useDrafts(): DraftsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDrafts must be used within DraftsProvider');
  return c;
}

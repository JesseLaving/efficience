import { createContext, useCallback, useContext, useState } from 'react';
import {
  loadSavedSegments, saveSavedSegments, loadGroups, saveGroups,
  type SavedSegment, type Group,
} from '../lib/segments';
import type { Criterion } from '../lib/population';

const uid = () => Math.random().toString(36).slice(2, 10);

interface SegmentsCtx {
  savedSegments: SavedSegment[];
  groups: Group[];
  createSegment: (name: string, criteria: Criterion[]) => void;
  deleteSegment: (id: string) => void;
  createGroup: (name: string) => Group;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  addToGroup: (groupId: string, contactIds: string[]) => void;
  removeFromGroup: (groupId: string, contactId: string) => void;
}

const Ctx = createContext<SegmentsCtx | null>(null);

export function SegmentsProvider({ children }: { children: React.ReactNode }) {
  const [savedSegments, setSavedSegments] = useState<SavedSegment[]>(() => loadSavedSegments());
  const [groups, setGroups] = useState<Group[]>(() => loadGroups());

  const createSegment = useCallback((name: string, criteria: Criterion[]) => {
    setSavedSegments((prev) => {
      const next = [...prev, { id: uid(), name, criteria, createdAt: new Date().toISOString() }];
      saveSavedSegments(next);
      return next;
    });
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setSavedSegments((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSavedSegments(next);
      return next;
    });
  }, []);

  const createGroup = useCallback((name: string): Group => {
    const g: Group = { id: uid(), name, contactIds: [], createdAt: new Date().toISOString() };
    setGroups((prev) => {
      const next = [...prev, g];
      saveGroups(next);
      return next;
    });
    return g;
  }, []);

  const renameGroup = useCallback((id: string, name: string) => {
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, name } : g));
      saveGroups(next);
      return next;
    });
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveGroups(next);
      return next;
    });
  }, []);

  const addToGroup = useCallback((groupId: string, contactIds: string[]) => {
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId
        ? { ...g, contactIds: [...new Set([...g.contactIds, ...contactIds])] }
        : g));
      saveGroups(next);
      return next;
    });
  }, []);

  const removeFromGroup = useCallback((groupId: string, contactId: string) => {
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId
        ? { ...g, contactIds: g.contactIds.filter((id) => id !== contactId) }
        : g));
      saveGroups(next);
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{
      savedSegments, groups, createSegment, deleteSegment,
      createGroup, renameGroup, deleteGroup, addToGroup, removeFromGroup,
    }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSegments(): SegmentsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSegments must be used within SegmentsProvider');
  return c;
}

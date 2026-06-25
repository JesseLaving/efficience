import { createContext, useCallback, useContext, useState } from 'react';
import { showToast } from '../lib/toast';
import { UI } from '../lib/icons';
import { useEff } from './EffContext';
import {
  loadScheduled, addScheduled, updateScheduled, removeScheduled, type ScheduledPost,
} from '../lib/calendar';

/* Calendrier de programmation. Extrait de EffContext — lu seulement par l'écran
   Calendar + EditorialPlanning. Dépend de useEff() pour la navigation
   (addToCalendar ouvre l'écran calendrier) ; doit donc être rendu sous EffProvider. */
interface CalendarCtx {
  scheduled: ScheduledPost[];
  addToCalendar: (p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'>) => void;
  updateCalendar: (id: string, patch: Partial<ScheduledPost>) => void;
  removeFromCalendar: (id: string) => void;
}

const Ctx = createContext<CalendarCtx | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { show } = useEff();
  const [scheduled, setScheduled] = useState<ScheduledPost[]>(() => loadScheduled());

  const addToCalendar = useCallback((p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'>) => {
    setScheduled((list) => addScheduled(list, p));
    showToast(UI.calendar, 'Ajouté au calendrier de programmation');
    show('calendar');
  }, [show]);
  const updateCalendar = useCallback((id: string, patch: Partial<ScheduledPost>) => { setScheduled((list) => updateScheduled(list, id, patch)); }, []);
  const removeFromCalendar = useCallback((id: string) => { setScheduled((list) => removeScheduled(list, id)); }, []);

  const value: CalendarCtx = { scheduled, addToCalendar, updateCalendar, removeFromCalendar };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalendar(): CalendarCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCalendar must be used within CalendarProvider');
  return c;
}

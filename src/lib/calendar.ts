/* Calendrier de programmation — file d'attente persistante des publications.
   Stocke localement (navigateur) les posts à publier : texte, réseaux, visuel,
   date/heure prévue. La publication automatique à l'heure (backend) viendra
   s'appuyer sur cette même structure. */

export type SchedStatus = 'scheduled' | 'published' | 'failed';

export interface ScheduledPost {
  id: string;
  dateTime: string;        // "2026-07-02T09:00"
  text: string;
  networks: string[];      // instagram | facebook | linkedin | google
  photoUrl?: string | null;
  pillar?: string | null;
  status: SchedStatus;
  createdAt: string;
  lastResult?: string | null;
  auto?: boolean;        // auto-publication serveur activée
  googleEventId?: string | null; // synchronisé vers l'agenda Google dédié — présent une fois poussé
}

const LS = 'eff_calendar_v1';

function uid(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return 'p_' + Math.abs(Math.floor(Math.random() * 1e9)).toString(36);
}

export function loadScheduled(): ScheduledPost[] {
  try {
    const a = JSON.parse(localStorage.getItem(LS) || '[]');
    if (Array.isArray(a)) return a as ScheduledPost[];
  } catch { /* ignore */ }
  return [];
}
export function saveScheduled(list: ScheduledPost[]): void {
  localStorage.setItem(LS, JSON.stringify(list));
}

export function addScheduled(list: ScheduledPost[], p: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'> & { status?: SchedStatus; createdAt?: string }): ScheduledPost[] {
  const item: ScheduledPost = {
    id: uid(),
    createdAt: p.createdAt || new Date().toISOString(),
    status: p.status || 'scheduled',
    dateTime: p.dateTime,
    text: p.text,
    networks: p.networks || [],
    photoUrl: p.photoUrl ?? null,
    pillar: p.pillar ?? null,
    lastResult: null,
  };
  const next = [...list, item].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  saveScheduled(next);
  return next;
}
export function updateScheduled(list: ScheduledPost[], id: string, patch: Partial<ScheduledPost>): ScheduledPost[] {
  const next = list.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  saveScheduled(next);
  return next;
}
export function removeScheduled(list: ScheduledPost[], id: string): ScheduledPost[] {
  const next = list.filter((x) => x.id !== id);
  saveScheduled(next);
  return next;
}

/* "2026-07-02" + heure par défaut → "2026-07-02T09:00". */
export function defaultDateTime(isoDate: string, hour = 9): string {
  const hh = String(hour).padStart(2, '0');
  return `${isoDate}T${hh}:00`;
}

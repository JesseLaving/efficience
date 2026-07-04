/* ============================================================
   Groupes et segments enregistrés par l'utilisateur — persistés en
   localStorage, synchronisés par espace comme les contacts et le
   calendrier (voir AuthWrapper : snapshot générique de toutes les clés).

   Un « segment » enregistré est une règle (critères) réévaluée en temps
   réel sur la base de contacts actuelle. Un « groupe » est une liste
   figée de contacts choisis à la main. Les deux viennent compléter les
   segments fixes (population.ts) et le générateur de critères ad-hoc,
   qui restaient jusqu'ici non persistés.
   ============================================================ */
import type { Criterion } from './population';

export interface SavedSegment {
  id: string;
  name: string;
  criteria: Criterion[];
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  contactIds: string[];
  createdAt: string;
}

const LS_SEGMENTS = 'eff_saved_segments_v1';
const LS_GROUPS = 'eff_groups_v1';

export function loadSavedSegments(): SavedSegment[] {
  try {
    const raw = localStorage.getItem(LS_SEGMENTS);
    return raw ? JSON.parse(raw) as SavedSegment[] : [];
  } catch { return []; }
}

export function saveSavedSegments(list: SavedSegment[]): void {
  try { localStorage.setItem(LS_SEGMENTS, JSON.stringify(list)); } catch { /* ignore */ }
}

export function loadGroups(): Group[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS);
    return raw ? JSON.parse(raw) as Group[] : [];
  } catch { return []; }
}

export function saveGroups(list: Group[]): void {
  try { localStorage.setItem(LS_GROUPS, JSON.stringify(list)); } catch { /* ignore */ }
}

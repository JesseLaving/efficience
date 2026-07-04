/* Brouillons Studio — persistés en localStorage et synchronisés par espace
   comme le reste de l'état de l'app (voir AuthWrapper). Avant ce fichier,
   « Enregistrer le brouillon » dans Studio ne faisait rien de réel : le
   bouton affichait juste un texte de confirmation sans jamais rien stocker. */
export type DraftType = 'post' | 'story' | 'email';

export interface Draft {
  id: string;
  type: DraftType;
  text: string;
  networks: string[];
  ratio: string;
  photoUrl: string | null;
  subject?: string;
  preheader?: string;
  savedAt: number;
}

const LS = 'eff_drafts_v1';

export function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(LS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveDrafts(list: Draft[]): void {
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ }
}

/* Historique des campagnes e-mail — persisté en localStorage et synchronisé
   par espace comme les contacts et le calendrier (voir AuthWrapper). Sans
   ça, l'historique vivait uniquement dans l'état local de l'écran Campagnes
   et disparaissait à chaque navigation vers un autre écran (le conteneur
   `.canvas` de App.tsx est remonté avec une clé différente à chaque
   changement d'écran, ce qui démonte Campagnes et perd son état). */
export interface Campaign {
  name: string; seg: string; status: 'sent' | 'sched' | 'draft';
  recipients: number; open: number | null; click: number | null; when: string;
}

const LS = 'eff_campaigns_v1';

export function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? JSON.parse(raw) as Campaign[] : [];
  } catch { return []; }
}

export function saveCampaigns(list: Campaign[]): void {
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ }
}

/* Historique des campagnes e-mail — persisté en localStorage et synchronisé
   par espace comme les contacts et le calendrier (voir AuthWrapper). Sans
   ça, l'historique vivait uniquement dans l'état local de l'écran Campagnes
   et disparaissait à chaque navigation vers un autre écran (le conteneur
   `.canvas` de App.tsx est remonté avec une clé différente à chaque
   changement d'écran, ce qui démonte Campagnes et perd son état). */
export interface Campaign {
  /** Identifiant stable qui relie la campagne à ses événements d'e-mail
   *  (ouvertures, clics, désinscriptions) côté serveur. Absent des campagnes
   *  créées avant le suivi : leurs statistiques restent alors indisponibles,
   *  affichées « — » plutôt qu'à zéro. */
  id?: string;
  name: string; seg: string; status: 'sent' | 'sched' | 'draft' | 'failed';
  recipients: number; open: number | null; click: number | null; when: string;
  /** Résultat réel du dernier envoi (Resend) — absent pour les campagnes
   *  programmées ou antérieures à la mise en place de l'envoi réel. */
  sentCount?: number; failedCount?: number; sendError?: string | null;
}

const LS = 'eff_campaigns_v1';

/* Identifiant restreint à [A-Za-z0-9_-] : c'est le seul jeu de caractères
   accepté par Resend pour une valeur de tag, et c'est par ce tag que le
   webhook rattache un événement à sa campagne. */
export function newCampaignId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `c${Date.now().toString(36)}${rnd}`;
}

export interface CampaignStats {
  opened?: number; clicked?: number; bounced?: number;
  complained?: number; unsubscribed?: number;
}

export function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? JSON.parse(raw) as Campaign[] : [];
  } catch { return []; }
}

export function saveCampaigns(list: Campaign[]): void {
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ }
}

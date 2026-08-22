/* Historique des campagnes e-mail — persisté en localStorage et synchronisé
   par espace comme les contacts et le calendrier (voir AuthWrapper). Sans
   ça, l'historique vivait uniquement dans l'état local de l'écran Campagnes
   et disparaissait à chaque navigation vers un autre écran (le conteneur
   `.canvas` de App.tsx est remonté avec une clé différente à chaque
   changement d'écran, ce qui démonte Campagnes et perd son état). */
/* Libellés d'état, partagés par l'écran Campagnes et la recherche globale :
   le type impose l'exhaustivité, si bien qu'un nouvel état ne peut plus
   s'afficher en anglais brut dans l'une des deux vues. */
export const CAMPAIGN_STATUS_LABEL: Record<Campaign["status"], string> = {
  sent: "Envoyée",
  sched: "Programmée",
  draft: "Brouillon",
  failed: "Échec",
};

export interface Campaign {
  /** Identifiant stable qui relie la campagne à ses événements d'e-mail
   *  (ouvertures, clics, désinscriptions) côté serveur. Absent des campagnes
   *  créées avant le suivi : leurs statistiques restent alors indisponibles,
   *  affichées « — » plutôt qu'à zéro. */
  id?: string;
  name: string; seg: string; status: 'sent' | 'sched' | 'draft' | 'failed';
  recipients: number; open: number | null; click: number | null; when: string;
  /** Identifiant du segment ciblé, pour rouvrir la campagne sur la bonne
   *  audience (le nom seul ne suffit pas à la retrouver). */
  segId?: string;
  /** Contenu rédigé, conservé pour pouvoir rouvrir et modifier la campagne.
   *  Sans lui, une campagne programmée était une impasse : le message invitait
   *  à « revenir l'envoyer » alors que le texte n'était nulle part. */
  content?: CampaignContent;
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

/* Contenu éditable d'une campagne. `subject` est l'objet retenu (et non la
   liste des propositions IA) : une fois la campagne enregistrée, seul le choix
   final compte pour la rouvrir. */
export interface CampaignContent {
  subject: string;
  pre: string;
  headline: string;
  body: string[];
  cta: string;
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

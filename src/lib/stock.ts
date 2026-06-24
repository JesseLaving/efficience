import { API_BASE } from './api';
import { profileFor } from './editorial';

export interface StockPhoto {
  id: number;
  thumb: string;
  url: string;        // URL publique (affichage + publication via API)
  portrait?: string;
  landscape?: string;
  width?: number;
  height?: number;
  avgColor?: string | null;
  photographer?: string | null;
  photographerUrl?: string | null;
  alt?: string;
  link?: string | null;
}
export interface StockResponse { available: boolean; reason?: string; query?: string; total?: number; photos: StockPhoto[]; }

export async function fetchStockPhotos(query: string, orientation = 'square'): Promise<StockResponse> {
  const r = await fetch(`${API_BASE}/stock?q=${encodeURIComponent(query)}&orientation=${encodeURIComponent(orientation)}`);
  const d = await r.json().catch(() => ({ available: false, reason: 'Réponse invalide', photos: [] }));
  return d as StockResponse;
}

/* Thèmes visuels par secteur — des mots-clés qui « photographient » bien. */
const THEME: Record<string, string> = {
  formation: 'formation professionnelle réunion équipe',
  restauration: 'restaurant cuisine plat gastronomie',
  sante: 'santé bien-être soin cabinet',
  beaute: 'salon beauté soin esthétique',
  immobilier: 'maison immobilier clé intérieur',
  artisanat: 'artisan chantier travaux outils',
  commerce: 'boutique shopping produit vitrine',
  btob: 'bureau équipe travail entreprise',
  default: 'entreprise professionnel bureau',
};

const STOP = new Set(['et', 'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'aux', 'au', 'en', 'pour', 'avec', 'sur', 'par', 'votre', 'vos', 'à', 'qui', 'que', 'ce', 'cette', 'dans', 'comment', 'plus', 'vous', 'est', 'ne', 'pas', 'son', 'ses', 'leur', 'tout', 'son']);

/* Ratio de la plateforme → orientation Pexels. */
export function orientationFor(ratio: string): string {
  const [w, h] = (ratio || '1:1').split(':').map(Number);
  if (!w || !h) return 'square';
  if (h > w) return 'portrait';
  if (w > h) return 'landscape';
  return 'square';
}

/* Construit une requête photo à partir du sujet + du secteur. */
export function photoQueryFor(subject: string, sector: string): string {
  const theme = THEME[profileFor(sector)] || THEME.default;
  const words = (subject || '')
    .replace(/[#@][^\s]+/g, ' ')
    .replace(/[^A-Za-zÀ-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()))
    .slice(0, 2);
  // Un ou deux mots du sujet + le thème sectoriel → photos pertinentes.
  return (words.join(' ') + ' ' + theme).trim().split(/\s+/).slice(0, 4).join(' ');
}

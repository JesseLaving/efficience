/* Client for the AI backend (/api/ai/* → Gemini in priority, with a few
   free-tier fallback providers for text). Every call degrades gracefully:
   when no key is configured or the call fails, the backend returns
   { available:false, reason } and callers fall back to the local template
   engines (AIDA / editorial) or, for images, to Pollinations. */
import { API_BASE } from './api';
import type { MetaStatAccount } from './meta';
import type { TiktokVideo } from './tiktok';

/** Échantillon des légendes de publications RÉELLES les plus récentes,
 *  tous réseaux connectés confondus (Meta expose déjà les légendes ; LinkedIn
 *  et Google Business n'offrent aucune lecture d'historique de publication).
 *  Sert de référence de style pour l'IA — jamais affiché tel quel, jamais
 *  recopié mot pour mot par le prompt. */
export function sampleRecentCaptions(
  metaStats: MetaStatAccount[] | null | undefined,
  tiktokVideos: TiktokVideo[] | null | undefined,
  max = 6,
): string[] {
  const items: { text: string; at: number }[] = [];
  for (const acc of metaStats || []) {
    for (const p of acc.posts || []) {
      if (p.caption && p.caption.trim()) items.push({ text: p.caption.trim(), at: p.date ? Date.parse(p.date) || 0 : 0 });
    }
  }
  for (const v of tiktokVideos || []) {
    if (v.description && v.description.trim()) items.push({ text: v.description.trim(), at: v.createdAt ? v.createdAt * 1000 : 0 });
  }
  items.sort((a, b) => b.at - a.at);
  return items.slice(0, max).map((i) => i.text);
}

export interface AiContext {
  name?: string;
  sector?: string;
  city?: string;
  network?: string;
  pillar?: string;
  tone?: string;
  audience?: string;
  /** Limite réelle de caractères du réseau ciblé (ex. 280 pour X) — permet à
      l'IA d'écrire une longueur réaliste plutôt que de deviner. */
  maxLength?: number;
  /** Objectif prioritaire déclaré au Configurateur (notoriété/leads/ventes/fidélisation). */
  goal?: string;
  /** Produits/services phares — du questionnaire de stratégie. */
  products?: string;
  /** Concurrents connus — du questionnaire de stratégie (optionnel). */
  competitors?: string;
  /** Échantillon de légendes de publications RÉELLES déjà publiées sur les
      réseaux connectés (Meta/TikTok) — sert de référence de style pour que
      l'IA imite le ton et les sujets déjà utilisés, jamais recopié tel quel. */
  recentPosts?: string[];
}

export interface AiEmail { subject: string; preheader: string; body: string; cta: string; }

interface PostResult { available: boolean; text?: string; variants?: string[]; reason?: string; }
interface EmailResult { available: boolean; email?: AiEmail; reason?: string; }

async function post(kind: string, brief: string, context: AiContext): Promise<any> {
  const r = await fetch(`${API_BASE}/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, brief, context }),
  });
  return r.json().catch(() => ({ available: false, reason: `HTTP ${r.status}` }));
}

export function generatePost(brief: string, context: AiContext = {}): Promise<PostResult> {
  return post('post', brief, context);
}
export function improvePost(text: string, context: AiContext = {}): Promise<PostResult> {
  return post('improve', text, context);
}
export function generateEmail(objective: string, context: AiContext = {}): Promise<EmailResult> {
  return post('email', objective, context);
}
export function generateHashtags(text: string, context: AiContext = {}): Promise<PostResult> {
  return post('hashtags', text, context);
}

/* Génération d'image par IA — Gemini natif (gemini-2.5-flash-image) en
   priorité, haute qualité. Retourne une data-URL (image encodée en base64) :
   pas d'hébergement à part, directement affichable et compositable, mais
   doit être uploadée (uploadImage) pour obtenir une URL publique publiable. */
export interface AiImageResult { available: boolean; dataUrl?: string; provider?: string; reason?: string; }

export async function generateAiImage(prompt: string, ratio = '1:1'): Promise<AiImageResult> {
  try {
    const r = await fetch(`${API_BASE}/ai/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.slice(0, 800), ratio }),
    });
    return await r.json();
  } catch (e) {
    return { available: false, reason: String((e as Error).message || e) };
  }
}

/* Sujets de publication personnalisés par IA pour le planning éditorial —
   un slot = {pillar, format, network} ; renvoie une idée par slot, dans le
   même ordre. Les dates restent calculées localement (jamais par le LLM). */
export interface AiPlanSlot { pillar: string; format: string; network: string; }
export interface AiPlanResult { available: boolean; ideas?: string[]; reason?: string; }

export async function generateAiPlanIdeas(context: AiContext, slots: AiPlanSlot[]): Promise<AiPlanResult> {
  try {
    const r = await fetch(`${API_BASE}/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, slots }),
    });
    return await r.json();
  } catch (e) {
    return { available: false, reason: String((e as Error).message || e) };
  }
}

/* Génération d'image par IA — Pollinations (gratuit, sans clé, CORS *, modèle
   Flux). Repli automatique quand Gemini est indisponible. L'URL est
   déterministe (prompt+seed) et publique → directement affichable,
   compositable (canvas) et publiable. */
export function aiImageUrl(prompt: string, ratio = '1:1', seed?: number): string {
  const [rw, rh] = (ratio || '1:1').split(':').map(Number);
  const base = 1024;
  const W = base;
  const H = rw && rh ? Math.round((base * rh) / rw) : base;
  const s = seed ?? Math.floor(Math.random() * 1e6);
  const p = encodeURIComponent(prompt.slice(0, 400));
  // enhance=true : Pollinations réécrit/enrichit le prompt via un modèle avant
  // génération — améliore nettement le rendu pour un prompt court/générique.
  // referrer : identifie l'app (utile si un compte Pollinations est enregistré
  // plus tard — sans ça, reste sans effet mais ne coûte rien).
  // private=true : n'expose pas les visuels de marque du client dans le flux public.
  return `https://image.pollinations.ai/prompt/${p}?width=${W}&height=${H}&nologo=true&model=flux&seed=${s}`
    + `&enhance=true&private=true&referrer=efficienceconsulting.com`;
}

/* Prompt d'image par défaut, dérivé du sujet de la publication + du secteur. */
export function aiImagePrompt(subject: string, sector?: string): string {
  const subj = (subject || '').replace(/[#@\n]/g, ' ').trim().slice(0, 160) || 'communication d’entreprise';
  const sec = sector ? `, secteur ${sector}` : '';
  return `Photographie professionnelle illustrant : ${subj}${sec}. Lumineuse, moderne, style corporate épuré, haute qualité, sans texte.`;
}

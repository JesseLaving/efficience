/* Client for the AI copywriting backend (/api/ai/generate → Anthropic).
   Every call degrades gracefully: when the key isn't configured the backend
   returns { available:false, reason } and callers fall back to the template
   engine (AIDA / editorial). */
import { API_BASE } from './api';

export interface AiContext {
  name?: string;
  sector?: string;
  city?: string;
  network?: string;
  pillar?: string;
  tone?: string;
  audience?: string;
}

export interface AiEmail { subject: string; preheader: string; body: string; cta: string; }

interface PostResult { available: boolean; text?: string; reason?: string; }
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

/* Génération d'image par IA — Pollinations (gratuit, sans clé, CORS *, modèle
   Flux). L'URL est déterministe (prompt+seed) et publique → directement
   affichable, compositable (canvas) et publiable. */
export function aiImageUrl(prompt: string, ratio = '1:1', seed?: number): string {
  const [rw, rh] = (ratio || '1:1').split(':').map(Number);
  const base = 1024;
  const W = base;
  const H = rw && rh ? Math.round((base * rh) / rw) : base;
  const s = seed ?? Math.floor(Math.random() * 1e6);
  const p = encodeURIComponent(prompt.slice(0, 400));
  return `https://image.pollinations.ai/prompt/${p}?width=${W}&height=${H}&nologo=true&model=flux&seed=${s}`;
}

/* Prompt d'image par défaut, dérivé du sujet de la publication + du secteur. */
export function aiImagePrompt(subject: string, sector?: string): string {
  const subj = (subject || '').replace(/[#@\n]/g, ' ').trim().slice(0, 160) || 'communication d’entreprise';
  const sec = sector ? `, secteur ${sector}` : '';
  return `Photographie professionnelle illustrant : ${subj}${sec}. Lumineuse, moderne, style corporate épuré, haute qualité, sans texte.`;
}

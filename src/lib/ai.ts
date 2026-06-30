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

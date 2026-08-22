import { API_BASE } from './api';

export interface EmailRecipient { id?: string; email: string; first?: string; name?: string; }
export interface EmailBusiness { name: string; email?: string; addressLine?: string; }

export interface SendCampaignPayload {
  spaceId: number;
  /** Rattache les ouvertures/clics à cette campagne via les tags Resend. */
  campaignId?: string;
  business: EmailBusiness;
  subject: string;
  preheader?: string;
  headline: string;
  bodyParagraphs: string[];
  cta?: string;
  ctaUrl?: string;
  contacts: EmailRecipient[];
}

/* Statistiques réelles rapportées par Resend, par identifiant de campagne.
   Une campagne absente n'a simplement aucun événement : l'appelant doit
   afficher « — », jamais 0 — l'absence de mesure n'est pas une mesure nulle.
   `null` distingue l'échec du chargement d'un relevé vide : un {} renvoyé sur
   erreur ferait afficher 0 % d'ouverture au lieu de « — ». */
export async function fetchCampaignStats(
  spaceId: number,
): Promise<Record<string, Record<string, number>> | null> {
  try {
    const r = await fetch(`${API_BASE}/email/stats?spaceId=${spaceId}`);
    if (!r.ok) return null;
    const d = await r.json();
    return (d && d.stats) || {};
  } catch {
    return null;
  }
}

export interface SendCampaignResultItem { email: string; ok: boolean; id?: string; reason?: string; }
export interface SendCampaignResult {
  ok: boolean; reason?: string; sent?: number; failed?: number; total?: number; results?: SendCampaignResultItem[];
}

export async function sendCampaignEmail(payload: SendCampaignPayload): Promise<SendCampaignResult> {
  try {
    const r = await fetch(`${API_BASE}/email/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, reason: String((e as Error).message || e) };
  }
}

/* ---------- programmation des campagnes ---------- */

export interface ScheduleCampaignPayload {
  spaceId: number;
  campaignId: string;
  /** Instant d'envoi (ms depuis epoch), toujours dans le futur. */
  whenMs: number;
  business: EmailBusiness;
  subject: string;
  preheader?: string;
  headline: string;
  bodyParagraphs: string[];
  cta?: string;
  ctaUrl?: string;
  /* Destinataires FIGÉS à la programmation : la base de contacts vit dans le
     navigateur, le serveur ne peut donc pas la relire à l'heure dite. */
  contacts: EmailRecipient[];
}

export interface ScheduleResult { ok: boolean; reason?: string; whenMs?: number }

export async function scheduleCampaignEmail(p: ScheduleCampaignPayload): Promise<ScheduleResult> {
  const { spaceId, campaignId, whenMs, contacts, ...payload } = p;
  try {
    const r = await fetch(`${API_BASE}/email/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaceId, campaignId, whenMs, payload, contacts }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, reason: (d && (d.reason || d.error)) || `HTTP ${r.status}` };
    return d ?? { ok: false, reason: 'Réponse invalide du serveur de programmation.' };
  } catch (e) {
    return { ok: false, reason: String((e as Error).message || e) };
  }
}

export async function cancelScheduledCampaign(spaceId: number, id: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const r = await fetch(`${API_BASE}/email/unschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaceId, id }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, reason: (d && (d.reason || d.error)) || `HTTP ${r.status}` };
    return d ?? { ok: false };
  } catch (e) {
    return { ok: false, reason: String((e as Error).message || e) };
  }
}

export interface ServerScheduledCampaign {
  id: string;
  whenMs: number;
  status: 'scheduled' | 'sending' | 'sent' | 'failed';
  /** Instant réel de l'envoi — le cron passe toutes les ~10 min, il ne
   *  coïncide donc pas avec l'heure demandée. */
  sentAt?: number | null;
  result?: { ok: boolean; sent: number; failed: number; total: number; reason: string | null } | null;
}

/** État réel de la file côté serveur — c'est lui qui fait foi une fois
 *  l'heure passée, l'envoi ayant lieu sans le navigateur. */
export async function fetchScheduledCampaigns(spaceId: number): Promise<ServerScheduledCampaign[]> {
  try {
    const r = await fetch(`${API_BASE}/email/scheduled?spaceId=${spaceId}`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d && d.campaigns) || [];
  } catch {
    return [];
  }
}

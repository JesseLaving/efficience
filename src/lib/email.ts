import { API_BASE } from './api';

export interface EmailRecipient { id?: string; email: string; first?: string; name?: string; }
export interface EmailBusiness { name: string; email?: string; addressLine?: string; }

export interface SendCampaignPayload {
  spaceId: number;
  business: EmailBusiness;
  subject: string;
  preheader?: string;
  headline: string;
  bodyParagraphs: string[];
  cta?: string;
  ctaUrl?: string;
  contacts: EmailRecipient[];
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

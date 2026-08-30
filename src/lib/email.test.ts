import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelScheduledCampaign,
  fetchCampaignStats,
  fetchScheduledCampaigns,
  scheduleCampaignEmail,
} from './email';

/** Remplace fetch et rend la dernière requête inspectable. */
function mockFetch(response: { status?: number; body?: unknown } | Error) {
  const spy = vi.fn(async () => {
    if (response instanceof Error) throw response;
    const status = response.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response.body,
    } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

/* La signature du faux fetch ne déclare pas ses arguments (ils ne servent pas
   à produire la réponse) : on relit l'appel avec le type réel de fetch. */
const bodyOf = (spy: ReturnType<typeof mockFetch>) => {
  const calls = (spy as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
  return JSON.parse(String(calls[0][1]?.body));
};

const campaign = {
  spaceId: 7,
  campaignId: 'camp_1',
  whenMs: Date.now() + 86_400_000,
  business: { name: 'Atelier Durand' },
  subject: 'Objet',
  headline: 'Titre',
  bodyParagraphs: ['Bonjour {prenom},'],
  contacts: [{ email: 'camille@exemple.com' }],
};

afterEach(() => vi.unstubAllGlobals());

describe('programmation d’une campagne', () => {
  it('sépare le contenu des destinataires dans la requête', () => {
    const spy = mockFetch({ body: { ok: true, whenMs: campaign.whenMs } });
    return scheduleCampaignEmail(campaign).then(() => {
      const sent = bodyOf(spy);
      expect(sent.spaceId).toBe(7);
      expect(sent.campaignId).toBe('camp_1');
      expect(sent.whenMs).toBe(campaign.whenMs);
      // Le serveur attend le contenu sous `payload` et la liste à part :
      // aplatir les deux ferait échouer la validation côté serveur.
      expect(sent.payload.subject).toBe('Objet');
      expect(sent.payload.contacts).toBeUndefined();
      expect(sent.contacts).toHaveLength(1);
    });
  });

  it('remonte le motif du refus serveur', async () => {
    mockFetch({ status: 400, body: { ok: false, reason: 'La date d’envoi doit être dans le futur.' } });
    const r = await scheduleCampaignEmail(campaign);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('La date d’envoi doit être dans le futur.');
  });

  it('ne prétend jamais avoir programmé quand le réseau tombe', async () => {
    mockFetch(new Error('offline'));
    const r = await scheduleCampaignEmail(campaign);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('offline');
  });

  it('signale une réponse serveur vide plutôt que de la prendre pour un succès', async () => {
    mockFetch({ status: 200, body: null });
    const r = await scheduleCampaignEmail(campaign);
    expect(r.ok).toBe(false);
  });
});

describe('annulation d’un envoi programmé', () => {
  it('transmet l’espace et la campagne', async () => {
    const spy = mockFetch({ body: { ok: true } });
    await cancelScheduledCampaign(7, 'camp_1');
    expect(bodyOf(spy)).toEqual({ spaceId: 7, id: 'camp_1' });
  });

  it('échoue franchement quand le serveur refuse', async () => {
    mockFetch({ status: 403, body: { reason: 'Espace introuvable.' } });
    const r = await cancelScheduledCampaign(7, 'camp_1');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('Espace introuvable.');
  });
});

describe('lecture des statistiques e-mail', () => {
  it('distingue l’échec de chargement d’un relevé vide', async () => {
    // null = jamais chargé, donc « — » à l'écran ; {} = chargé mais aucun
    // événement, donc de vrais zéros. Les confondre affichait 0 % d'ouverture
    // sur une API injoignable.
    mockFetch({ status: 500, body: {} });
    expect(await fetchCampaignStats(7)).toBeNull();

    mockFetch(new Error('offline'));
    expect(await fetchCampaignStats(7)).toBeNull();

    mockFetch({ body: { stats: {} } });
    expect(await fetchCampaignStats(7)).toEqual({});
  });

  it('renvoie les relevés par campagne', async () => {
    mockFetch({ body: { stats: { camp_1: { opened: 12, clicked: 3 } } } });
    expect(await fetchCampaignStats(7)).toEqual({ camp_1: { opened: 12, clicked: 3 } });
  });
});

describe('état de la file d’envoi', () => {
  it('renvoie une file vide plutôt qu’une erreur quand le serveur ne répond pas', async () => {
    mockFetch(new Error('offline'));
    expect(await fetchScheduledCampaigns(7)).toEqual([]);
  });

  it('rapporte l’état de chaque campagne programmée', async () => {
    mockFetch({ body: { ok: true, campaigns: [{ id: 'camp_1', whenMs: 1, status: 'sent', sentAt: 2 }] } });
    const q = await fetchScheduledCampaigns(7);
    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('sent');
    expect(q[0].sentAt).toBe(2);
  });
});

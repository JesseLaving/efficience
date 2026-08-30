import { afterEach, describe, expect, it, vi } from 'vitest';
import { availableProviders, generateText, generateWithFallback } from './generate.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('choix des fournisseurs IA', () => {
  it('ne propose rien quand rien n’est configuré', () => {
    expect(availableProviders({})).toEqual([]);
  });

  it('met la passerelle en tête quand elle est configurée', () => {
    // Renseigner l'URL est un choix explicite d'exploitation ; une clé de
    // fournisseur peut, elle, traîner dans l'environnement sans intention.
    const list = availableProviders({
      OMNIROUTE_BASE_URL: 'http://gw.example/v1',
      GEMINI_API_KEY: 'g',
      GROQ_API_KEY: 'q',
    });
    expect(list).toEqual(['omniroute', 'gemini', 'groq']);
  });

  it('garde les fournisseurs directs comme repli, dans l’ordre historique', () => {
    expect(availableProviders({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' })).toEqual(['gemini', 'anthropic']);
    expect(availableProviders({ OPENROUTER_API_KEY: 'o' })).toEqual(['openrouter']);
  });
});

describe('chaîne de repli', () => {
  const call = (results) => vi.fn(async (provider) => {
    const r = results[provider];
    if (r instanceof Error) throw r;
    return r;
  });

  it('renvoie le premier fournisseur qui répond', async () => {
    const fn = call({ omniroute: 'texte passerelle' });
    const out = await generateWithFallback(['omniroute', 'gemini'], 's', 'u', 100, fn);
    expect(out.text).toBe('texte passerelle');
    expect(out.provider).toBe('omniroute');
    expect(out.triedBefore).toEqual([]);
    // Gemini n'a pas été sollicité : pas de double facturation quand le
    // premier fournisseur fait son travail.
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('bascule sur le suivant quand la passerelle ne répond pas', async () => {
    const fn = call({ omniroute: new Error('ECONNREFUSED'), gemini: 'texte gemini' });
    const out = await generateWithFallback(['omniroute', 'gemini'], 's', 'u', 100, fn);
    expect(out.text).toBe('texte gemini');
    // Le fournisseur annoncé est celui qui a RÉELLEMENT répondu.
    expect(out.provider).toBe('gemini');
    expect(out.triedBefore).toEqual(['omniroute']);
  });

  it('remonte le motif de chaque échec, pas seulement du dernier', async () => {
    const fn = call({ omniroute: new Error('ECONNREFUSED'), gemini: new Error('quota atteint') });
    await expect(generateWithFallback(['omniroute', 'gemini'], 's', 'u', 100, fn))
      .rejects.toThrow(/omniroute : ECONNREFUSED.*gemini : quota atteint/);
  });

  it('échoue franchement quand aucun fournisseur n’est configuré', async () => {
    await expect(generateWithFallback([], 's', 'u', 100, call({}))).rejects.toThrow('Aucun fournisseur');
  });
});

describe('appel de la passerelle', () => {
  function mockFetch(body, ok = true) {
    const spy = vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => body }));
    vi.stubGlobal('fetch', spy);
    return spy;
  }
  const sent = (spy) => JSON.parse(spy.mock.calls[0][1].body);
  const headers = (spy) => spy.mock.calls[0][1].headers;
  const reply = { choices: [{ message: { content: 'réponse' } }] };

  it('construit l’URL à partir de la base, sans doubler la barre oblique', async () => {
    const spy = mockFetch(reply);
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gw.example/v1/');
    await generateText('omniroute', 's', 'u', 100);
    expect(spy.mock.calls[0][0]).toBe('http://gw.example/v1/chat/completions');
  });

  it('laisse la passerelle choisir le backend par défaut', async () => {
    const spy = mockFetch(reply);
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gw.example/v1');
    await generateText('omniroute', 's', 'u', 100);
    expect(sent(spy).model).toBe('auto');
  });

  it('respecte le modèle imposé quand il est configuré', async () => {
    const spy = mockFetch(reply);
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gw.example/v1');
    vi.stubEnv('OMNIROUTE_MODEL', 'oc/gpt-4o-mini');
    await generateText('omniroute', 's', 'u', 100);
    expect(sent(spy).model).toBe('oc/gpt-4o-mini');
  });

  it('n’envoie pas d’en-tête d’autorisation sans clé', async () => {
    // Une passerelle auto-hébergée peut tourner sans authentification, et un
    // « Bearer » vide est refusé par certaines implémentations.
    const spy = mockFetch(reply);
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gw.example/v1');
    await generateText('omniroute', 's', 'u', 100);
    expect(headers(spy).Authorization).toBeUndefined();
  });

  it('envoie la clé quand la passerelle en exige une', async () => {
    const spy = mockFetch(reply);
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gw.example/v1');
    vi.stubEnv('OMNIROUTE_API_KEY', 'secret');
    await generateText('omniroute', 's', 'u', 100);
    expect(headers(spy).Authorization).toBe('Bearer secret');
  });

  it('échoue quand la passerelle renvoie une réponse vide', async () => {
    mockFetch({ choices: [{ message: { content: '   ' } }] });
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gw.example/v1');
    await expect(generateText('omniroute', 's', 'u', 100)).rejects.toThrow('Réponse IA vide');
  });
});

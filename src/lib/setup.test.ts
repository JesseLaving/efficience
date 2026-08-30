import { describe, expect, it } from 'vitest';
import { buildSetup } from './setup';

const input = (over: Partial<Parameters<typeof buildSetup>[0]> = {}) => ({
  hasProfile: false,
  connectedCount: 0,
  scheduledCount: 0,
  contactsCount: 0,
  ...over,
});

describe('parcours de prise en main', () => {
  it('pointe la première étape non faite', () => {
    expect(buildSetup(input()).next?.key).toBe('profile');
    expect(buildSetup(input({ hasProfile: true })).next?.key).toBe('networks');
    expect(buildSetup(input({ hasProfile: true, connectedCount: 2 })).next?.key).toBe('schedule');
  });

  it('ne considère le parcours terminé qu’une fois les étapes requises faites', () => {
    const partial = buildSetup(input({ hasProfile: true, connectedCount: 1 }));
    expect(partial.complete).toBe(false);

    const done = buildSetup(input({ hasProfile: true, connectedCount: 1, scheduledCount: 1 }));
    expect(done.complete).toBe(true);
    expect(done.next).toBeNull();
  });

  it('n’exige pas l’import de contacts pour terminer', () => {
    // L'import est utile aux campagnes e-mail, mais bloquer la prise en main
    // dessus retiendrait un utilisateur qui ne veut que publier.
    const s = buildSetup(input({ hasProfile: true, connectedCount: 1, scheduledCount: 1 }));
    expect(s.complete).toBe(true);
    expect(s.steps.find((x) => x.key === 'contacts')?.optional).toBe(true);
    expect(s.requiredCount).toBe(3);
  });

  it('compte les étapes faites, facultative comprise', () => {
    const s = buildSetup(input({ hasProfile: true, connectedCount: 1, contactsCount: 40 }));
    expect(s.doneCount).toBe(3);
    expect(s.complete).toBe(false);
  });

  it('déduit chaque étape de l’état réel, jamais d’un drapeau affiché', () => {
    // Une étape validée hors du parcours (réseau connecté depuis un autre
    // écran) doit compter malgré tout.
    const s = buildSetup(input({ connectedCount: 1 }));
    expect(s.steps.find((x) => x.key === 'networks')?.done).toBe(true);
    expect(s.steps.find((x) => x.key === 'profile')?.done).toBe(false);
  });
});

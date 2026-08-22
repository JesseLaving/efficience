import { beforeEach, describe, expect, it } from 'vitest';
import {
  WARN_DAYS,
  clearTokenExpiry,
  expiresBefore,
  formatExpiry,
  getTokenExpiry,
  setTokenExpiry,
  tokenExpiry,
} from './tokenExpiry';

const DAY = 86_400_000;

describe('échéance des jetons réseaux', () => {
  beforeEach(() => localStorage.clear());

  it('convertit le expires_in de l’OAuth en échéance absolue', () => {
    const before = Date.now();
    setTokenExpiry('meta', 60 * DAY / 1000);
    const at = getTokenExpiry('meta');
    expect(at).not.toBeNull();
    expect(at!).toBeGreaterThanOrEqual(before + 60 * DAY - 1000);
  });

  it('accepte la valeur telle que la renvoie une URL (chaîne)', () => {
    setTokenExpiry('linkedin', '5184000');
    expect(getTokenExpiry('linkedin')).not.toBeNull();
  });

  it('efface l’échéance quand le réseau n’en communique aucune', () => {
    setTokenExpiry('meta', 3600);
    setTokenExpiry('meta', null);
    expect(getTokenExpiry('meta')).toBeNull();
  });

  it('ignore une durée absurde plutôt que de dater le jeton dans le passé', () => {
    setTokenExpiry('meta', -42);
    expect(getTokenExpiry('meta')).toBeNull();
    setTokenExpiry('meta', 'trois semaines');
    expect(getTokenExpiry('meta')).toBeNull();
  });

  it('classe l’échéance en ok / soon / expired', () => {
    const now = Date.now();

    setTokenExpiry('meta', 30 * DAY / 1000);
    expect(tokenExpiry('meta', now)?.status).toBe('ok');

    setTokenExpiry('meta', (WARN_DAYS - 1) * DAY / 1000);
    expect(tokenExpiry('meta', now)?.status).toBe('soon');

    localStorage.setItem('eff_exp_meta', String(now - DAY));
    expect(tokenExpiry('meta', now)?.status).toBe('expired');
  });

  it('ne présume rien quand l’échéance est inconnue', () => {
    // Jeton obtenu avant cette fonctionnalité : aucun état, et surtout aucun
    // blocage — présumer l'expiration empêcherait de programmer sans raison.
    expect(tokenExpiry('meta')).toBeNull();
    expect(expiresBefore('meta', Date.now() + 365 * DAY)).toBe(false);
  });

  it('refuse d’armer une publication postérieure à l’échéance', () => {
    const now = Date.now();
    setTokenExpiry('meta', 10 * DAY / 1000);
    expect(expiresBefore('meta', now + 3 * DAY)).toBe(false);
    expect(expiresBefore('meta', now + 20 * DAY)).toBe(true);
  });

  it('formate l’échéance en français lisible', () => {
    const now = Date.now();
    const state = (days: number) => {
      localStorage.setItem('eff_exp_meta', String(now + days * DAY + 60_000));
      return tokenExpiry('meta', now)!;
    };
    expect(formatExpiry(state(12))).toBe('dans 12 jours');
    expect(formatExpiry(state(1))).toBe('demain');
    expect(formatExpiry(state(0))).toBe("aujourd'hui");
    expect(formatExpiry(state(-1))).toBe('depuis hier');
    expect(formatExpiry(state(-5))).toBe('depuis 5 jours');
  });

  it('oublie l’échéance à la déconnexion du réseau', () => {
    setTokenExpiry('meta', 3600);
    clearTokenExpiry('meta');
    expect(tokenExpiry('meta')).toBeNull();
  });
});

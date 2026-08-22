/* Durée de vie des jetons réseaux.

   Meta et LinkedIn délivrent des jetons valables ~60 jours et ne fournissent
   AUCUN jeton de rafraîchissement : passé ce délai, la seule issue est une
   reconnexion manuelle. Sans date d'expiration conservée, l'application ne
   pouvait pas le savoir — une publication programmée trois semaines à l'avance
   partait vers un jeton périmé et échouait en silence.

   Google, YouTube, TikTok et Google Agenda sont absents d'ici : ils ont un
   jeton de rafraîchissement, donc leur expiration se règle sans l'utilisateur. */

export type ExpiringNet = 'meta' | 'linkedin';

/** En deçà, on prévient : il reste assez de temps pour reconnecter sans
    interrompre les publications déjà programmées. */
export const WARN_DAYS = 7;

const DAY_MS = 86_400_000;
const key = (net: ExpiringNet) => `eff_exp_${net}`;

/** Enregistre l'échéance à partir du `expires_in` (secondes) renvoyé par
 *  l'OAuth. Une valeur absente ou inexploitable efface l'échéance connue
 *  plutôt que d'en inventer une. */
export function setTokenExpiry(net: ExpiringNet, expiresInSeconds?: string | number | null): void {
  const secs = Number(expiresInSeconds);
  if (!Number.isFinite(secs) || secs <= 0) {
    clearTokenExpiry(net);
    return;
  }
  try {
    localStorage.setItem(key(net), String(Date.now() + secs * 1000));
  } catch {
    /* stockage indisponible — on continue sans échéance connue */
  }
}

export function clearTokenExpiry(net: ExpiringNet): void {
  try {
    localStorage.removeItem(key(net));
  } catch {
    /* ignore */
  }
}

/** Échéance en millisecondes, ou null si inconnue (jeton obtenu avant cette
 *  fonctionnalité, ou réseau qui ne communique pas de durée de vie). */
export function getTokenExpiry(net: ExpiringNet): number | null {
  try {
    const raw = localStorage.getItem(key(net));
    if (!raw) return null;
    const at = Number(raw);
    return Number.isFinite(at) && at > 0 ? at : null;
  } catch {
    return null;
  }
}

export interface ExpiryState {
  /** Échéance absolue (ms depuis epoch). */
  at: number;
  /** Jours entiers restants — négatif une fois l'échéance passée. */
  days: number;
  status: 'ok' | 'soon' | 'expired';
}

/** État lisible de l'échéance, ou null si elle est inconnue. */
export function tokenExpiry(net: ExpiringNet, now: number = Date.now()): ExpiryState | null {
  const at = getTokenExpiry(net);
  if (at == null) return null;
  const days = Math.floor((at - now) / DAY_MS);
  return { at, days, status: at <= now ? 'expired' : days <= WARN_DAYS ? 'soon' : 'ok' };
}

/** Vrai si le jeton sera expiré à la date donnée — sert à refuser d'armer une
 *  publication automatique qui ne pourrait de toute façon pas partir.
 *  Une échéance inconnue ne bloque jamais : on ne présume pas d'un problème. */
export function expiresBefore(net: ExpiringNet, whenMs: number): boolean {
  const at = getTokenExpiry(net);
  return at != null && at <= whenMs;
}

/** « dans 12 jours », « demain », « aujourd'hui », « depuis 3 jours ». */
export function formatExpiry(state: ExpiryState): string {
  const { days } = state;
  if (days < -1) return `depuis ${Math.abs(days)} jours`;
  if (days < 0) return 'depuis hier';
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

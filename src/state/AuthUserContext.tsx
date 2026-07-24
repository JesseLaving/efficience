/* Utilisateur authentifié (compte Google), exposé aux écrans.

   À distinguer du "client"/espace : l'espace décrit l'ENTREPRISE analysée
   (nom, SIREN, secteur), alors qu'ici il s'agit de la PERSONNE connectée.
   Les écrans qui s'adressent à l'utilisateur ("Bonjour …") doivent lire ceci,
   sinon ils affichent le nom d'un autre. */
import { createContext, useContext } from 'react';
import type { AuthUser } from '../lib/auth';

const Ctx = createContext<AuthUser | null>(null);

export function AuthUserProvider({ user, children }: { user: AuthUser | null; children: React.ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

/** L'utilisateur connecté, ou null si la session n'est pas encore résolue. */
export function useAuthUser(): AuthUser | null {
  return useContext(Ctx);
}

/** Prénom de l'utilisateur connecté, pour les salutations. Renvoie null quand
 *  le nom est inconnu — l'appelant doit alors saluer sans nom plutôt que
 *  d'inventer ou de retomber sur un nom en dur. */
export function firstNameOf(user: AuthUser | null): string | null {
  const raw = (user?.name || '').trim();
  if (raw) return raw.split(/\s+/)[0];
  // Repli : partie locale de l'e-mail ("prenom.nom@…" → "Prenom").
  const local = (user?.email || '').split('@')[0];
  const guess = local.split(/[._-]/).filter(Boolean)[0];
  return guess ? guess.charAt(0).toUpperCase() + guess.slice(1) : null;
}

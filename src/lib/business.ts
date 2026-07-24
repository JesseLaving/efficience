/* ============================================================
   Identité de repli, utilisée tant que l'espace n'a pas de profil.
   L'identité réelle vient du profil par espace capturé à l'onboarding ;
   getBusiness() le fusionne par-dessus ce repli.

   Ce repli est volontairement NEUTRE : il servait auparavant les coordonnées
   réelles du compte d'origine (nom, e-mail, ville), si bien que tout autre
   utilisateur n'ayant pas terminé l'onboarding voyait — et publiait sous —
   l'identité de quelqu'un d'autre. Aucune donnée personnelle ici.

   Les métriques (abonnés, contacts, stats) restent à 0/vide : l'app démarre
   vierge et se remplit avec les actions réelles de l'utilisateur.
   ============================================================ */
import { loadProfile } from './profile';

export const BUSINESS = {
  name: 'Votre entreprise',
  initials: '—',
  email: '',
  city: '',
  region: '',
  addressLine: '',
  sector: '',
};

export type Business = typeof BUSINESS;

/* The active space's identity. Returns the per-space profile captured at
   onboarding (from the entered domain), merged over the Efficience fallback so
   every screen personalises to the logged-in user's company. Read at render
   time — never cache at module scope, or you capture the fallback before the
   profile loads. Imported lazily to avoid a cycle (profile.ts imports api.ts). */
export function getBusiness(): Business {
  try {
    const p = loadProfile();
    if (!p) return BUSINESS;
    return {
      ...BUSINESS,
      name: p.name || BUSINESS.name,
      initials: p.initials || BUSINESS.initials,
      email: p.email || BUSINESS.email,
      city: p.city || BUSINESS.city,
      region: p.region || BUSINESS.region,
      addressLine: p.addressLine || BUSINESS.addressLine,
      sector: p.sector || BUSINESS.sector,
    };
  } catch {
    return BUSINESS;
  }
}

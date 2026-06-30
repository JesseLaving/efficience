/* ============================================================
   Identity fallback (Efficience Marketing — Jesse's own real data).
   For multi-user spaces the active identity comes from the per-space profile
   captured at onboarding; getBusiness() merges it over this fallback.
   Metrics (followers, contacts, stats) stay 0/empty: the app starts vide and
   is populated by the user's real actions — no invented data.
   ============================================================ */
import { loadProfile } from './profile';

export const BUSINESS = {
  name: 'Efficience Marketing',
  owner: 'Jesse Laving',
  initials: 'EM',
  email: 'js.laving@gmail.com',
  city: 'Avignon',
  region: 'Vaucluse · Provence',
  addressLine: 'Avignon · Vaucluse',
  sector: 'Conseil & formation — stratégie commerciale, marketing & communication',
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

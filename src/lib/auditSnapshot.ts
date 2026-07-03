/* Instantané de l'analyse du site + de l'entreprise, capturé à la fin du
   Configurateur. Persisté pour permettre de régénérer le rapport d'audit
   PLUS TARD (depuis Réglages) avec, cette fois, les données réseaux sociaux
   réelles — au moment du Configurateur, aucun réseau n'est encore connecté
   (l'étape suivante est justement de les connecter). */
import type { CompanyResult, SiteResponse } from './api';

const LS = 'eff_audit_snapshot_v1';

export interface AuditSnapshot {
  company: CompanyResult | null;
  site: SiteResponse | null;
  capturedAt: string;
}

export function saveAuditSnapshot(s: AuditSnapshot): void {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ }
}

export function loadAuditSnapshot(): AuditSnapshot | null {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? JSON.parse(raw) as AuditSnapshot : null;
  } catch { return null; }
}

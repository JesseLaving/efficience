/* Préconisations du rapport d'audit — pointent vers les vraies formations et
   accompagnements proposés sur efficienceconsulting.com (jamais un service
   inventé). Les 3 services ont une URL confirmée ; les formations n'ont pas
   de slug individuel vérifié, on renvoie donc vers la page d'accueil plutôt
   que de deviner une URL. Règles déclenchées par des signaux RÉELS détectés
   dans l'audit (scores, réseaux connectés, secteur, objectif) — jamais un
   besoin supposé sans preuve. */

const SITE = 'https://efficienceconsulting.com/';

export interface Recommendation { title: string; reason: string; url: string; }

interface RecoInput {
  seoScore: number | null;
  hasMetaDescription: boolean;
  legalOk: boolean;
  hasSocialConnected: boolean;
  goal: string;
  sectorProfile: string;
}

const FORMATION = (title: string, reason: string): Recommendation => ({ title, reason, url: SITE });
const SERVICE = (title: string, reason: string, id: string): Recommendation => ({ title, reason, url: `${SITE}offre.html?id=${id}` });

export function buildRecommendations(input: RecoInput): Recommendation[] {
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  const push = (r: Recommendation) => { if (!seen.has(r.title)) { seen.add(r.title); out.push(r); } };

  if (input.seoScore != null && input.seoScore < 70 || !input.hasMetaDescription) {
    push(FORMATION('Formation Marketing digital · SEO/SEA', 'Votre score SEO ou vos balises de référencement peuvent être renforcés.'));
  }
  if (!input.hasSocialConnected) {
    push(FORMATION('Formation Community management', 'Aucun réseau social connecté pour l’instant — structurer une présence sociale régulière.'));
    push(SERVICE('Communication digitale', 'Accompagnement pour poser une stratégie de présence web et réseaux sociaux.', 'communication-digitale'));
  }
  if (!input.legalOk) {
    push(SERVICE('Conseil & stratégie', 'Certaines pages légales obligatoires (mentions légales, CGV, confidentialité) ne sont pas détectées sur le site — un audit permettra de sécuriser la conformité.', 'conseil'));
  }
  if (input.goal === 'leads' || input.goal === 'ventes') {
    push(FORMATION('Formation Négociation commerciale', 'Votre objectif prioritaire porte sur les leads/ventes — renforcer la posture commerciale.'));
    push(SERVICE('Coaching & accompagnement', 'Coaching individuel pour structurer votre prospection et votre posture commerciale.', 'coaching'));
  }
  if (input.goal === 'notoriete') {
    push(FORMATION('Formation Stratégie de communication', 'Votre objectif prioritaire est la notoriété — clarifier messages, cibles et canaux.'));
  }
  if (input.sectorProfile === 'immobilier') {
    push(FORMATION('Formation Immobilier & prospection', 'Secteur immobilier détecté — prospection, mandats et conformité ALUR.'));
  }
  if (input.sectorProfile === 'commerce') {
    push(FORMATION('Formation E-commerce', 'Activité commerce détectée — parcours d’achat, fiches produit, tunnel de conversion.'));
  }
  if (input.sectorProfile === 'tech') {
    push(FORMATION('Formation IA appliquée au travail', 'Secteur tech détecté — intégrer l’IA dans vos process quotidiens.'));
  }

  return out.slice(0, 5);
}

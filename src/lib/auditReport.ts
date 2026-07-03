/* Rapport d'audit complet, téléchargeable en PDF depuis le Configurateur (ou
   plus tard depuis Réglages, une fois les réseaux connectés) — compile
   l'identité légale (INSEE), l'audit SEO/PageSpeed complet, la conformité
   légale, des concurrents RÉELS (même API publique que l'identité), les
   réseaux sociaux connectés, les réponses au questionnaire de stratégie, les
   KPI recommandés et des préconisations pointant vers les vraies formations
   d'efficienceconsulting.com. Aucune donnée inventée : tout vient de
   l'analyse réelle déjà effectuée, ou reste explicitement marqué comme
   indisponible. */
import { jsPDF } from 'jspdf';
import type { CompanyResult, SiteResponse, CompetitorEntry } from './api';
import { analyzeCompetitors } from './api';
import { CATALOG } from './kpi';
import { buildRecommendations } from './recommendations';
import { profileFor } from './editorial';
import type { Goal } from './strategy';

export interface ReportStrategy {
  audience: string; products: string; goal: Goal | ''; tone: string; frequency: string;
  competitors: string; differentiators: string;
}
export interface SocialSnapshot { network: string; label: string; followers: number | null; engagementRate?: number | null; }
export interface AuditReportInput {
  profile: { name: string; sector: string; domain: string };
  company: CompanyResult | null;
  site: SiteResponse | null;
  strategy: ReportStrategy;
  kpiIds: string[];
  /** Réseaux connectés au moment de la génération — vide/absent pendant le
      Configurateur (les réseaux ne sont connectés qu'à l'étape suivante). */
  social?: SocialSnapshot[];
}

const GOAL_LABELS: Record<string, string> = {
  notoriete: 'Notoriété & visibilité', leads: 'Génération de leads',
  ventes: 'Ventes directes', fidelisation: 'Fidélisation clients',
};

const MARGIN = 20, PAGE_W = 210, PAGE_H = 297, MAX_W = PAGE_W - MARGIN * 2;
const ACC: [number, number, number] = [91, 117, 80];

export async function buildAuditReportPdf(input: AuditReportInput): Promise<void> {
  const { profile, company, site, strategy, kpiIds, social } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  const ensureSpace = (h: number) => { if (y + h > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; } };
  const h1 = (text: string) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...ACC);
    doc.text(text, MARGIN, y); y += 7;
    doc.setDrawColor(210, 214, 200); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 6;
  };
  const h2 = (text: string) => {
    ensureSpace(9);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    doc.text(text, MARGIN, y); y += 6;
  };
  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    const lines = doc.splitTextToSize(value || '—', MAX_W - 45);
    ensureSpace(Math.max(6, lines.length * 5));
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
    doc.text(lines, MARGIN + 45, y);
    y += Math.max(6, lines.length * 5);
  };
  const para = (text: string) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(text, MAX_W);
    ensureSpace(lines.length * 5 + 2);
    doc.text(lines, MARGIN, y); y += lines.length * 5 + 2;
  };
  const checkRow = (label: string, ok: boolean | null) => {
    ensureSpace(6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
    doc.text(label, MARGIN, y);
    const color: [number, number, number] = ok === true ? ACC : ok === false ? [179, 69, 59] : [150, 150, 150];
    const mark = ok === true ? 'Oui' : ok === false ? 'Non' : '—';
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
    doc.text(mark, MARGIN + MAX_W - 15, y);
    y += 6;
  };
  /** Petit diagramme en barres horizontales — items bornés à quelques lignes,
      pas de pagination interne (utilisé pour de courtes listes de scores). */
  const barChart = (items: { label: string; value: number; max: number; valueLabel?: string; color?: [number, number, number] }[]) => {
    const barH = 4.2, rowH = 11;
    ensureSpace(items.length * rowH + 2);
    for (const it of items) {
      const pct = it.max > 0 ? Math.max(0, Math.min(1, it.value / it.max)) : 0;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
      doc.text(it.label, MARGIN, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
      doc.text(it.valueLabel ?? String(Math.round(it.value)), MARGIN + MAX_W, y, { align: 'right' });
      y += 2;
      doc.setFillColor(230, 232, 224); doc.rect(MARGIN, y, MAX_W, barH, 'F');
      const c = it.color || ACC;
      doc.setFillColor(...c); doc.rect(MARGIN, y, MAX_W * pct, barH, 'F');
      y += barH + 5;
    }
  };

  // En-tête
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ACC);
  doc.text('Rapport d’audit', MARGIN, y); y += 9;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90, 90, 90);
  doc.text(`${profile.name} — généré le ${new Date().toLocaleDateString('fr-FR')}`, MARGIN, y);
  y += 12;

  // ---------- Identité de l'entreprise ----------
  h1('Identité de l’entreprise');
  row('Nom', profile.name);
  row('Secteur', company?.naf?.libelle || profile.sector || '—');
  row('Domaine', profile.domain);
  if (company) {
    row('SIREN', company.siren || '—');
    row('Forme juridique', company.formeJuridiqueLabel || company.formeJuridique || '—');
    row('Adresse', [company.commune, company.codePostal].filter(Boolean).join(' · ') || '—');
    if (company.dateCreation) row('Création', company.dateCreation.slice(0, 10));
    if (company.dirigeants?.[0]?.nom) row('Dirigeant', company.dirigeants[0].nom);
  } else {
    para('Entreprise non identifiée automatiquement dans la base SIRENE.');
  }
  y += 4;

  // ---------- Audit du site internet (SEO, PageSpeed/Lighthouse, mots-clés) ----------
  h1('Audit du site internet');
  const ps = site?.pagespeed;
  const basic = site?.basic;
  if (ps?.available && ps.scores) {
    h2('Scores Lighthouse (mobile)');
    barChart([
      { label: 'Performance', value: ps.scores.performance ?? 0, max: 100, color: ACC },
      { label: 'SEO', value: ps.scores.seo ?? 0, max: 100, color: ACC },
      { label: 'Accessibilité', value: ps.scores.accessibilite ?? 0, max: 100, color: ACC },
      { label: 'Bonnes pratiques', value: ps.scores.bonnesPratiques ?? 0, max: 100, color: ACC },
    ]);
    y += 2;
    if (ps.metrics) {
      h2('Vitesse de chargement (Core Web Vitals)');
      row('Premier affichage (FCP)', ps.metrics.fcp || '—');
      row('Plus grand affichage (LCP)', ps.metrics.lcp || '—');
      row('Stabilité visuelle (CLS)', ps.metrics.cls || '—');
      row('Réactivité (TBT)', ps.metrics.tbt || '—');
      y += 2;
    }
    if (ps.seoChecks) {
      h2('Vérifications SEO techniques');
      checkRow('Balise <title> présente', ps.seoChecks.title ?? null);
      checkRow('Meta description présente', ps.seoChecks.metaDescription ?? null);
      checkRow('Page explorable par les moteurs', ps.seoChecks.crawlable ?? null);
      checkRow('Adaptée mobile (viewport)', ps.seoChecks.viewport ?? null);
      checkRow('Données structurées (Schema.org)', ps.seoChecks.structuredData ?? null);
      y += 2;
    }
    if (ps.opportunites?.length) {
      h2('Pistes d’amélioration techniques');
      for (const o of ps.opportunites.slice(0, 5)) para(`•  ${o.title} (gain estimé : ${(o.savingsMs / 1000).toFixed(1)} s)`);
      y += 2;
    }
  } else {
    para('Audit Lighthouse indisponible pour ce site.');
  }
  if (basic?.title || basic?.metaDescription) {
    h2('Référencement — contenu déclaré');
    if (basic.title) row('Titre de la page', basic.title);
    if (basic.metaDescription) row('Meta description', basic.metaDescription);
  }
  if (basic?.keywords?.length) {
    h2('Mots-clés dominants (fréquence réelle du contenu)');
    para(basic.keywords.map((k) => `${k.word} (${k.count})`).join(' · '));
  }
  y += 4;

  // ---------- Conformité légale ----------
  h1('Conformité légale');
  if (company?.badges) {
    h2('Certifications & statuts (base SIRENE)');
    const b = company.badges;
    const active = [
      b.qualiopi && 'Certifié Qualiopi', b.organismeFormation && 'Organisme de formation déclaré',
      b.rge && 'Reconnu Garant de l’Environnement (RGE)', b.ess && 'Économie sociale et solidaire (ESS)',
      b.bio && 'Certification Bio', b.societeMission && 'Société à mission',
    ].filter(Boolean) as string[];
    para(active.length ? active.join(' · ') : 'Aucune certification particulière détectée dans la base SIRENE.');
    y += 2;
  }
  if (basic?.legal) {
    h2('Pages légales détectées sur le site');
    checkRow('Mentions légales', basic.legal.mentionsLegales);
    checkRow('CGV / CGU', basic.legal.cgvCgu);
    checkRow('Politique de confidentialité', basic.legal.politiqueConfidentialite);
    checkRow('Information sur les cookies', basic.legal.cookies);
  } else {
    para('Analyse des pages légales indisponible.');
  }
  y += 4;

  // ---------- Concurrents & références nationales ----------
  h1('Concurrents & références du secteur');
  if (company?.naf?.code) {
    try {
      const comp = await analyzeCompetitors(company.naf.code, company.departement, company.siren);
      const listLine = (c: CompetitorEntry) => `${c.nom || '—'}${c.commune ? ` — ${c.commune}` : ''}`;
      if (comp.local.length) {
        h2(`Concurrents dans votre région (secteur ${company.naf.libelle || company.naf.code})`);
        for (const c of comp.local) para(`•  ${listLine(c)}`);
        y += 2;
      }
      if (comp.national.length) {
        h2('Références nationales du secteur');
        for (const c of comp.national.slice(0, 5)) para(`•  ${listLine(c)}`);
      }
      if (!comp.local.length && !comp.national.length) para('Aucune entreprise comparable trouvée dans la base SIRENE pour ce secteur.');
    } catch (e) {
      para(`Recherche de concurrents indisponible : ${String((e as Error).message || e)}`);
    }
  } else {
    para('Code secteur (NAF) non identifié — recherche de concurrents impossible.');
  }
  y += 4;

  // ---------- Réseaux sociaux ----------
  h1('Réseaux sociaux');
  if (social && social.length) {
    h2('Abonnés par réseau');
    const maxFollowers = Math.max(1, ...social.map((s) => s.followers || 0));
    barChart(social.map((s) => ({ label: s.label, value: s.followers || 0, max: maxFollowers, color: ACC })));
    const withRate = social.filter((s) => s.engagementRate != null);
    if (withRate.length) {
      y += 2; h2('Taux d’engagement');
      for (const s of withRate) row(s.label, `${(s.engagementRate as number).toFixed(1)} %`);
    }
  } else {
    para('Aucun réseau social connecté pour le moment. Connectez vos réseaux depuis l’écran « Connexion des réseaux », puis régénérez ce rapport depuis Réglages pour l’enrichir de vos statistiques réelles.');
  }
  y += 4;

  // ---------- Charte graphique ----------
  h1('Charte graphique');
  if (site?.brand?.available) {
    row('Couleur d’accent', site.brand.accent || '—');
    if (site.brand.palette?.length) row('Palette', site.brand.palette.slice(0, 5).join(', '));
    if (site.brand.fonts?.length) row('Polices', site.brand.fonts.slice(0, 3).join(', '));
  } else {
    para('Charte graphique non extraite automatiquement.');
  }
  y += 4;

  // ---------- Stratégie & audience ----------
  h1('Stratégie & audience');
  row('Cible principale', strategy.audience || '—');
  row('Produits/services phares', strategy.products || '—');
  row('Objectif prioritaire', strategy.goal ? (GOAL_LABELS[strategy.goal] || strategy.goal) : '—');
  row('Ton souhaité', strategy.tone || '—');
  row('Fréquence de publication', strategy.frequency || '—');
  if (strategy.competitors) row('Concurrents connus', strategy.competitors);
  if (strategy.differentiators) row('Ce qui différencie', strategy.differentiators);
  y += 4;

  // ---------- KPI recommandés ----------
  h1('Indicateurs recommandés');
  if (kpiIds.length) {
    for (const id of kpiIds) { const def = CATALOG[id]; if (def) para(`•  ${def.label}`); }
  } else {
    para('Aucun objectif prioritaire renseigné — indicateurs par défaut appliqués.');
  }
  y += 4;

  // ---------- Préconisations ----------
  h1('Préconisations');
  const recos = buildRecommendations({
    seoScore: ps?.scores?.seo ?? null,
    hasMetaDescription: !!basic?.metaDescription,
    legalOk: !!(basic?.legal && basic.legal.mentionsLegales && basic.legal.politiqueConfidentialite),
    hasSocialConnected: !!(social && social.length),
    goal: strategy.goal || '',
    sectorProfile: profileFor(company?.naf?.libelle || profile.sector || ''),
  });
  if (recos.length) {
    for (const r of recos) {
      h2(r.title);
      para(r.reason);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...ACC);
      ensureSpace(6); doc.text(r.url, MARGIN, y); y += 7;
    }
  } else {
    para('Aucune préconisation spécifique à ce stade — votre présence en ligne et votre conformité sont déjà solides.');
  }

  const filename = `audit-${(profile.name || 'entreprise').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.pdf`;
  doc.save(filename);
}

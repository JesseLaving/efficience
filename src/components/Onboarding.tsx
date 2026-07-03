import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { useBrand } from '../state/BrandContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { setStoredSiteUrl } from '../lib/brand';
import { loadProfile, saveProfile, profileFromAnalysis, initialsFrom } from '../lib/profile';
import { saveStrategy, GOALS, TONES, FREQUENCIES, SECTOR_QUESTIONS, type Goal } from '../lib/strategy';
import { profileFor } from '../lib/editorial';
import { loadKpiState, saveKpiState, boardForGoal, isDefaultBoard } from '../lib/kpi';
import { analyzeCompany, analyzeSite, type CompanyResult, type SiteResponse } from '../lib/api';
import { saveAuditSnapshot } from '../lib/auditSnapshot';
import { OnboardingContactImport } from './OnboardingContactImport';
// jsPDF pèse plusieurs centaines de Ko — chargé à la demande (import() dans
// downloadReport) pour ne pas alourdir le bundle principal de tout le monde
// pour une action rare (télécharger le rapport d'audit).

const ndaFmt = (s: string | null) => (s && s.length === 11 ? `${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8)}` : s);
const scoreColor = (n: number | null | undefined) =>
  n == null ? 'var(--tx-3)' : n >= 90 ? 'var(--acc)' : n >= 50 ? 'var(--warn)' : 'var(--danger)';

// Strip protocol/www and keep the second-level label, used as a fallback search
// term when the user doesn't give a SIREN and the site exposes no clear name.
function domainLabel(d: string): string {
  try {
    const host = d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return host.split('.')[0] || host;
  } catch { return d; }
}

type Status = 'idle' | 'active' | 'done' | 'error';

export function Onboarding() {
  const { show, setClient } = useEff();
  const { applySiteBrand, brandKit, setBrandKit } = useBrand();
  const prof0 = loadProfile();
  const [step, setStep] = useState<'form' | 'scan' | 'result' | 'questions' | 'import'>('form');
  const [siret, setSiret] = useState(prof0?.siret || prof0?.siren || '');
  const [domain, setDomain] = useState(prof0?.domain || '');
  const [stInsee, setStInsee] = useState<Status>('idle');
  const [stSite, setStSite] = useState<Status>('idle');
  const [company, setCompany] = useState<CompanyResult | null>(null);
  const [site, setSite] = useState<SiteResponse | null>(null);
  // Éditable à l'étape « result » : l'utilisateur confirme/ajuste son identité.
  const [editName, setEditName] = useState('');
  const [editSector, setEditSector] = useState('');
  const [editAccent, setEditAccent] = useState<string | null>(null);
  // Étape « questions » : stratégie & audience — pilote la personnalisation
  // de l'IA (ton, cible, objectif) et le choix des KPI initiaux.
  const [audience, setAudience] = useState('');
  const [products, setProducts] = useState('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [tone, setTone] = useState('');
  const [frequency, setFrequency] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [differentiators, setDifferentiators] = useState('');
  const [sectorAnswerKpi, setSectorAnswerKpi] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const sectorQuestion = SECTOR_QUESTIONS[profileFor(editSector)] || SECTOR_QUESTIONS.default;

  const close = () => show('dashboard');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Domain-first analysis: scan the site (brand + audit), then look up the legal
  // entity by the discovered name (or the SIREN, if the user provided one).
  const analyze = () => {
    const d = domain.trim();
    if (!d) return;
    setStep('scan'); setCompany(null); setSite(null);
    setStInsee('active'); setStSite('active');
    const finish = () => setTimeout(() => setStep('result'), 350);

    let siteResult: SiteResponse | null = null;
    analyzeSite(d)
      .then((r) => { siteResult = r; setSite(r); applySiteBrand(r); setStSite('done'); })
      .catch(() => setStSite('error'))
      .finally(() => {
        const q = siret.trim()
          || siteResult?.brand?.name
          || siteResult?.basic?.ogTitle
          || siteResult?.basic?.title
          || domainLabel(d);
        analyzeCompany(q)
          .then((r) => {
            const c = r.results[0] || null;
            setCompany(c); setStInsee(c ? 'done' : 'error');
            // Pré-remplit les champs éditables avec les données réelles.
            setEditName(c?.nom || siteResult?.brand?.name || siteResult?.basic?.ogTitle || siteResult?.basic?.title || domainLabel(d));
            setEditSector(c?.naf?.libelle || '');
            setEditAccent(siteResult?.brand?.accent || siteResult?.brand?.palette?.[0] || null);
          })
          .catch(() => setStInsee('error'))
          .finally(finish);
      });
  };

  const goToQuestions = () => setStep('questions');

  const apply = () => {
    const base = profileFromAnalysis(domain.trim(), company, site);
    const name = editName.trim() || base.name;
    const prof = { ...base, name, initials: initialsFrom(name), sector: editSector.trim() || base.sector };
    saveProfile(prof);
    setStoredSiteUrl(domain.trim());
    if (editAccent && brandKit) setBrandKit({ ...brandKit, accent: editAccent });
    setClient({ name: prof.name, initials: prof.initials });

    saveStrategy({
      audience: audience.trim(), products: products.trim(), goal, tone,
      frequency, competitors: competitors.trim(), differentiators: differentiators.trim(),
      sectorAnswerKpi: sectorAnswerKpi || undefined,
      capturedAt: new Date().toISOString(),
    });

    // Permet de régénérer le rapport d'audit plus tard (depuis Réglages),
    // une fois les réseaux sociaux connectés.
    saveAuditSnapshot({ company, site, capturedAt: new Date().toISOString() });

    // Ne personnalise le tableau de bord que si l'utilisateur n'a pas déjà
    // ajusté ses KPI à la main (ré-exécuter le Configurateur plus tard ne
    // doit jamais écraser une personnalisation existante).
    if (goal) {
      const current = loadKpiState();
      if (isDefaultBoard(current)) {
        const board = boardForGoal(goal);
        if (sectorAnswerKpi && !board.includes(sectorAnswerKpi)) board.push(sectorAnswerKpi);
        saveKpiState({ board, custom: {}, suggestOpen: true });
      }
    }

    localStorage.setItem('eff_onboarded', '1');
    localStorage.setItem('eff_guide_connect', '1'); // bannière « connectez vos réseaux » sur l'écran Connexion
    show('connexion');
    showToast(UI.check, `Espace personnalisé pour <b style="margin-left:3px">${prof.name}</b> — dernière étape : connectez vos réseaux`);
  };

  const downloadReport = async () => {
    setPdfBusy(true);
    try {
      const { buildAuditReportPdf } = await import('../lib/auditReport');
      await buildAuditReportPdf({
        profile: { name: editName.trim() || domain, sector: editSector.trim(), domain: domain.trim() },
        company, site,
        strategy: { audience, products, goal, tone, frequency, competitors, differentiators },
        kpiIds: goal ? boardForGoal(goal) : [],
      });
    } catch (e) {
      showToast(UI.close, `Échec de la génération du rapport : ${String((e as Error).message || e)}`);
    } finally { setPdfBusy(false); }
  };

  const stepLabel = step === 'form' ? 'Étape 1 / 5 · Domaine'
    : step === 'scan' ? 'Étape 2 / 5 · Analyse'
    : step === 'result' ? 'Étape 3 / 5 · Confirmation'
    : step === 'questions' ? 'Étape 4 / 5 · Stratégie & audience'
    : 'Étape 5 / 5 · Import de contacts (facultatif)';
  const ps = site?.pagespeed;
  const palette = (site?.brand?.palette && site.brand.palette.length ? site.brand.palette.slice(0, 4) : ['#5b7550', '#3c5233', '#7c9a70', '#eef0e8']);

  return createPortal(
    <div className="onb">
      <div className="onb-card">
        <div className="onb-top">
          <img src={`${import.meta.env.BASE_URL}assets/logo-green.png`} alt="Efficience" />
          <span className="ot-step">{stepLabel}</span>
          <button className="onb-x" aria-label="Fermer" onClick={close}><Icon name="close" /></button>
        </div>

        {step === 'form' && (
          <>
            <div className="onb-body">
              <div className="onb-eyebrow">Configurateur</div>
              <h2>Renseignez le domaine de votre entreprise</h2>
              <p className="onb-lead">À partir de votre nom de domaine, Efficience récupère automatiquement vos données légales officielles (SIREN/SIRET, secteur d’activité, zone géographique via INSEE/SIRENE), audite votre site (Lighthouse) et extrait votre charte graphique. Données réelles uniquement, rien n’est inventé.</p>
              <div className="onb-form">
                <div className="field"><label className="field-lbl">Nom de domaine <span style={{ color: 'var(--acc)' }}>*</span></label>
                  <input className="inp" placeholder="monentreprise.fr" value={domain} onChange={(e) => setDomain(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') analyze(); }} /></div>
                <div className="field"><label className="field-lbl">SIREN / SIRET <span style={{ color: 'var(--tx-3)' }}>(optionnel — détecté automatiquement)</span></label>
                  <input className="inp siret-inp" maxLength={17} placeholder="483 591 616" value={siret} onChange={(e) => setSiret(e.target.value)} /></div>
              </div>
            </div>
            <div className="onb-foot">
              <span className="grow"><RawIcon svg={UI.shield} style={{ width: 13, height: 13, display: 'inline-grid', verticalAlign: -2, color: 'var(--acc)' }} /> Données publiques officielles · conforme RGPD</span>
              <button className="btn outline" onClick={close}>Plus tard</button>
              <button className="btn acc" onClick={analyze} disabled={!domain.trim()}><Icon name="search" />Analyser mon entreprise</button>
            </div>
          </>
        )}

        {step === 'scan' && (
          <>
            <div className="onb-body">
              <div className="onb-eyebrow">Analyse en cours</div>
              <h2>Récupération de vos données réelles</h2>
              <div className="scan-wrap" style={{ marginTop: 22 }}>
                <div className="scan-list">
                  {([
                    ['Site web · charte graphique', 'Couleurs, logo, polices, audit Lighthouse', stSite],
                    ['INSEE · base SIRENE', 'SIREN/SIRET, secteur (NAF), zone géographique, dirigeants', stInsee],
                  ] as [string, string, Status][]).map(([label, sub, st]) => (
                    <div key={label} className={'scan-item' + (st === 'active' ? ' active' : st === 'done' ? ' done' : '')}>
                      <div className="si-logo"><RawIcon svg={st === 'error' ? UI.close : UI.shield} /></div>
                      <div className="si-n">{label}<div style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 400 }}>{sub}</div></div>
                      <div className="si-found">{st === 'done' ? 'Récupéré' : st === 'error' ? 'Indisponible' : ''}</div>
                      <div className="si-state">{st === 'active' ? <span className="spin lt" /> : st === 'done' ? <RawIcon svg={UI.check} /> : st === 'error' ? <RawIcon svg={UI.close} style={{ color: 'var(--warn)' }} /> : null}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 4 }}>L’audit Lighthouse rend réellement votre page (≈ 20–30 s).</p>
              </div>
            </div>
            <div className="onb-foot"><span className="grow">Analyse des sources publiques officielles…</span></div>
          </>
        )}

        {step === 'result' && (
          <>
            <div className="onb-body">
              <div className="onb-eyebrow" style={{ color: 'var(--acc)' }}>Confirmez votre profil — données réelles, modifiables</div>
              <div className="disc-head" style={{ marginTop: 14, alignItems: 'flex-start' }}>
                <div className="dh-logo" style={{ background: `linear-gradient(150deg,#3c5233,${editAccent || '#5b7550'} 58%,${editAccent || '#7c9a70'})` }}>{initialsFrom(editName || domain || '—')}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="inp" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom de l’entreprise" style={{ fontWeight: 600 }} />
                  <input className="inp" value={editSector} onChange={(e) => setEditSector(e.target.value)} placeholder="Secteur d’activité" style={{ fontSize: 13 }} />
                  {company && <div className="dh-meta">{[company.codePostal && company.commune ? `${company.codePostal} ${company.commune}` : null, company.dateCreation ? 'créée en ' + company.dateCreation.slice(0, 4) : null].filter(Boolean).join(' · ')}</div>}
                </div>
              </div>
              {!company && <div style={{ color: 'var(--warn)', marginTop: 10, fontSize: 12.5 }}>Entreprise non identifiée automatiquement — renseignez le SIREN/SIRET pour l’associer, ou continuez : le nom, le site et la charte sont enregistrés.</div>}

              <div className="disc-grid">
                <div className="disc-card">
                  <div className="dc-l"><Icon name="shield" />Identité légale (INSEE)</div>
                  {company ? <>
                    <div className="disc-info-row"><span className="k">SIREN</span><span className="v mono">{company.siren || '—'}</span></div>
                    <div className="disc-info-row"><span className="k">Forme</span><span className="v">{company.formeJuridiqueLabel || company.formeJuridique || '—'}</span></div>
                    <div className="disc-info-row"><span className="k">Code NAF</span><span className="v">{company.naf.code || '—'}</span></div>
                    {company.nda && <div className="disc-info-row"><span className="k">N° formation</span><span className="v mono">{ndaFmt(company.nda)}</span></div>}
                    <div className="disc-info-row"><span className="k">Dirigeant</span><span className="v">{company.dirigeants[0]?.nom || '—'}</span></div>
                  </> : <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>—</div>}
                </div>

                <div className="disc-card">
                  <div className="dc-l"><Icon name="chart" />Audit du site (Lighthouse)</div>
                  {ps?.available && ps.scores ? (
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '4px 0 6px' }}>
                      {([['Perf', ps.scores.performance], ['SEO', ps.scores.seo], ['Access.', ps.scores.accessibilite], ['Best', ps.scores.bonnesPratiques]] as [string, number | null][]).map(([l, v]) => (
                        <div key={l} style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: scoreColor(v) }}>{v == null ? '—' : v}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>{site ? (site.psiKeyConfigured ? 'Audit indisponible.' : 'Scores Lighthouse non configurés.') : '—'}</div>}
                  {ps?.available && ps.opportunites && ps.opportunites[0] && (
                    <div style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 6 }}>Principal gain : <b>{ps.opportunites[0].title}</b> (−{(ps.opportunites[0].savingsMs / 1000).toFixed(1)} s)</div>
                  )}
                </div>

                <div className="disc-card">
                  <div className="dc-l"><Icon name="image" />Charte visuelle {site?.brand?.available && <span style={{ fontSize: 10.5, color: 'var(--acc)', fontWeight: 600 }}>· extraite du site</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', margin: '2px 0 6px' }}>Couleur d’accent — cliquez pour choisir</div>
                  <div className="swatch-row">{palette.map((c) => (
                    <button type="button" key={c} onClick={() => setEditAccent(c)} title={c}
                      style={{ all: 'unset', cursor: 'pointer' }}>
                      <div className="swatch" style={{ background: c, outline: editAccent === c ? '2px solid var(--acc)' : 'none', outlineOffset: 2, borderRadius: 6 }}>
                        <span>{editAccent === c ? '✓' : c}</span>
                      </div>
                    </button>
                  ))}</div>
                  {site?.brand?.fonts && site.brand.fonts.length > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 6 }}>Police : {site.brand.fonts.slice(0, 2).join(', ')}</div>
                  )}
                </div>

                <div className="disc-card">
                  <div className="dc-l"><Icon name="sparkles2" />Pré-configuration</div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Identité légale &amp; secteur appliqués à l’espace</span></div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Charte graphique extraite &amp; enregistrée</span></div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Zone géographique &amp; audit du site enregistrés</span></div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Réseaux sociaux : à connecter (étape suivante)</span></div>
                </div>
              </div>
            </div>
            <div className="onb-foot">
              <span className="grow">Étape suivante : quelques questions sur votre stratégie.</span>
              <button className="btn outline" onClick={() => setStep('form')}>Recommencer</button>
              <button className="btn acc" onClick={goToQuestions}><Icon name="arrowright" />Continuer</button>
            </div>
          </>
        )}

        {step === 'questions' && (
          <>
            <div className="onb-body">
              <div className="onb-eyebrow">Stratégie &amp; audience</div>
              <h2>Quelques questions pour calibrer votre outil</h2>
              <p className="onb-lead">Vos réponses personnalisent les suggestions de l’IA (ton, sujets) et le tableau de bord (KPI proposés en priorité). Tout reste modifiable ensuite dans Réglages.</p>

              <div className="onb-form" style={{ display: 'grid', gap: 16 }}>
                <div className="field">
                  <label className="field-lbl">Qui est votre cible principale ? <span style={{ color: 'var(--acc)' }}>*</span></label>
                  <input className="inp" placeholder="Ex : particuliers à Avignon, dirigeants de PME, familles avec enfants…" value={audience} onChange={(e) => setAudience(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-lbl">Vos produits ou services phares <span style={{ color: 'var(--acc)' }}>*</span></label>
                  <input className="inp" placeholder="Ex : accompagnement commercial, formation vente, coaching dirigeants…" value={products} onChange={(e) => setProducts(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-lbl">Objectif prioritaire <span style={{ color: 'var(--acc)' }}>*</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {GOALS.map((g) => (
                      <button
                        key={g.key} type="button" onClick={() => setGoal(g.key)}
                        style={{
                          fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 'var(--r-btn)', cursor: 'pointer',
                          border: '1px solid ' + (goal === g.key ? 'var(--acc)' : 'var(--line)'),
                          background: goal === g.key ? 'var(--acc)' : 'transparent',
                          color: goal === g.key ? 'var(--on-acc)' : 'var(--tx-2)',
                        }}
                      >{g.label}</button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field-lbl">Ton de communication souhaité <span style={{ color: 'var(--acc)' }}>*</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TONES.map((t) => (
                      <button
                        key={t} type="button" onClick={() => setTone(t)}
                        className={'chip-btn' + (tone === t ? ' on' : '')}
                        style={{
                          fontSize: 12.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                          border: '1px solid ' + (tone === t ? 'var(--acc)' : 'var(--line)'),
                          background: tone === t ? 'var(--acc-soft)' : 'transparent',
                          color: tone === t ? 'var(--acc)' : 'var(--tx-2)',
                        }}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field-lbl">Fréquence de publication souhaitée <span style={{ color: 'var(--acc)' }}>*</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {FREQUENCIES.map((f) => (
                      <button
                        key={f} type="button" onClick={() => setFrequency(f)}
                        style={{
                          fontSize: 12.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                          border: '1px solid ' + (frequency === f ? 'var(--acc)' : 'var(--line)'),
                          background: frequency === f ? 'var(--acc-soft)' : 'transparent',
                          color: frequency === f ? 'var(--acc)' : 'var(--tx-2)',
                        }}
                      >{f}</button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field-lbl">{sectorQuestion.question} <span style={{ color: 'var(--tx-3)' }}>(optionnel — affine vos KPI)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sectorQuestion.options.map((o) => (
                      <button
                        key={o.label} type="button" onClick={() => setSectorAnswerKpi(o.kpi)}
                        style={{
                          fontSize: 12.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                          border: '1px solid ' + (sectorAnswerKpi === o.kpi ? 'var(--acc)' : 'var(--line)'),
                          background: sectorAnswerKpi === o.kpi ? 'var(--acc-soft)' : 'transparent',
                          color: sectorAnswerKpi === o.kpi ? 'var(--acc)' : 'var(--tx-2)',
                        }}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>

                <div className="onb-form of-2">
                  <div className="field">
                    <label className="field-lbl">Concurrents connus <span style={{ color: 'var(--tx-3)' }}>(optionnel)</span></label>
                    <input className="inp" placeholder="Noms ou zones de concurrence" value={competitors} onChange={(e) => setCompetitors(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-lbl">Ce qui vous différencie <span style={{ color: 'var(--tx-3)' }}>(optionnel)</span></label>
                    <input className="inp" placeholder="Votre atout principal face à la concurrence" value={differentiators} onChange={(e) => setDifferentiators(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="onb-foot">
              <button className="btn outline" onClick={downloadReport} disabled={pdfBusy}>
                {pdfBusy ? <span className="spin lt" /> : <Icon name="download" />}Télécharger le rapport d’audit (PDF)
              </button>
              <span className="grow" />
              <button className="btn outline" onClick={() => setStep('result')}>Retour</button>
              <button className="btn acc" disabled={!audience.trim() || !products.trim() || !goal || !tone || !frequency} onClick={() => setStep('import')}>
                <Icon name="arrowright" />Continuer
              </button>
            </div>
          </>
        )}

        {step === 'import' && (
          <>
            <div className="onb-body">
              <div className="onb-eyebrow">Import de contacts <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— facultatif</span></div>
              <h2>Importez votre base clients dès maintenant</h2>
              <p className="onb-lead">Cette étape est optionnelle : vous pourrez toujours importer vos contacts plus tard depuis l’écran « Base clients ». Autant le faire maintenant si vous avez le fichier sous la main.</p>
              <OnboardingContactImport />
            </div>
            <div className="onb-foot">
              <button className="btn outline" onClick={() => setStep('questions')}>Retour</button>
              <span className="grow" />
              <button className="btn outline" onClick={apply}>Passer cette étape</button>
              <button className="btn acc" onClick={apply}><Icon name="rocket" />Terminer &amp; connecter mes réseaux</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

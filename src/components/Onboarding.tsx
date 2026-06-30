import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { useBrand } from '../state/BrandContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { setStoredSiteUrl } from '../lib/brand';
import { loadProfile, saveProfile, profileFromAnalysis, initialsFrom } from '../lib/profile';
import { analyzeCompany, analyzeSite, type CompanyResult, type SiteResponse } from '../lib/api';

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
  const { applySiteBrand } = useBrand();
  const prof0 = loadProfile();
  const [step, setStep] = useState<'form' | 'scan' | 'result'>('form');
  const [siret, setSiret] = useState(prof0?.siret || prof0?.siren || '');
  const [domain, setDomain] = useState(prof0?.domain || '');
  const [stInsee, setStInsee] = useState<Status>('idle');
  const [stSite, setStSite] = useState<Status>('idle');
  const [company, setCompany] = useState<CompanyResult | null>(null);
  const [site, setSite] = useState<SiteResponse | null>(null);

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
          .then((r) => { setCompany(r.results[0] || null); setStInsee(r.results[0] ? 'done' : 'error'); })
          .catch(() => setStInsee('error'))
          .finally(finish);
      });
  };

  const apply = () => {
    const prof = profileFromAnalysis(domain.trim(), company, site);
    saveProfile(prof);
    setStoredSiteUrl(domain.trim());
    setClient({ name: prof.name, initials: prof.initials });
    localStorage.setItem('eff_onboarded', '1');
    close();
    showToast(UI.check, `Espace personnalisé pour <b style="margin-left:3px">${prof.name}</b>`);
  };

  const stepLabel = step === 'form' ? 'Étape 1 / 3' : step === 'scan' ? 'Étape 2 / 3' : 'Étape 3 / 3';
  const ps = site?.pagespeed;
  const palette = (site?.brand?.palette && site.brand.palette.length ? site.brand.palette.slice(0, 4) : ['#00d992', '#10b981', '#0e4a39', '#101010']);
  const logoInitials = initialsFrom(company?.nom || site?.brand?.name || domain || '—');

  return createPortal(
    <div className="onb">
      <div className="onb-card">
        <div className="onb-top">
          <img src={`${import.meta.env.BASE_URL}assets/logo-green.png`} alt="Efficience" />
          <span className="ot-step">{stepLabel}</span>
          <button className="onb-x" onClick={close}><Icon name="close" /></button>
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
              <div className="onb-eyebrow" style={{ color: 'var(--acc)' }}>Profil reconstitué — données réelles</div>
              {company ? (
                <div className="disc-head" style={{ marginTop: 14 }}>
                  <div className="dh-logo" style={{ background: 'linear-gradient(150deg,#0e4a39,#10b981 58%,#00d992)' }}>{logoInitials}</div>
                  <div><div className="dh-n">{company.nom}{company.etatAdministratif === 'A' && <RawIcon svg={UI.check} className="vrf" />}</div>
                    <div className="dh-meta">{[company.naf.libelle, company.codePostal && company.commune ? `${company.codePostal} ${company.commune}` : null, company.dateCreation ? 'créée en ' + company.dateCreation.slice(0, 4) : null].filter(Boolean).join(' · ')}</div></div>
                </div>
              ) : <div style={{ color: 'var(--warn)', marginTop: 14 }}>Entreprise non identifiée automatiquement — renseignez le SIREN/SIRET pour l’associer, ou continuez : le site et la charte sont enregistrés.</div>}

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
                  <div className="swatch-row">{palette.map((c) => <div className="swatch" style={{ background: c }} key={c}><span>{c}</span></div>)}</div>
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
              <span className="grow">Analyse complète disponible dans « Analyse entreprise &amp; site ».</span>
              <button className="btn outline" onClick={() => setStep('form')}>Recommencer</button>
              <button className="btn acc" onClick={apply}><Icon name="rocket" />Personnaliser mon espace</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

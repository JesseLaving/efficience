import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { BUSINESS as BIZ } from '../lib/business';
import { analyzeCompany, analyzeSite, type CompanyResult, type SiteResponse } from '../lib/api';

const ndaFmt = (s: string | null) => (s && s.length === 11 ? `${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8)}` : s);
const scoreColor = (n: number | null | undefined) =>
  n == null ? 'var(--tx-3)' : n >= 90 ? 'var(--acc)' : n >= 50 ? 'var(--warn)' : 'var(--danger)';

type Status = 'idle' | 'active' | 'done' | 'error';

export function Onboarding() {
  const { show, setClient } = useEff();
  const [step, setStep] = useState<'form' | 'scan' | 'result'>('form');
  const [siret, setSiret] = useState('483591616');           // Efficience Marketing (EI) — real SIREN
  const [domain, setDomain] = useState('efficiencemarketing.com');
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

  // First connection: launch the real analysis automatically.
  useEffect(() => {
    if (!localStorage.getItem('eff_onboarded')) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = () => {
    setStep('scan'); setCompany(null); setSite(null);
    setStInsee('active'); setStSite('active');
    let done = 0; const tick = () => { if (++done === 2) setTimeout(() => setStep('result'), 350); };
    analyzeCompany(siret.trim() || BIZ.name)
      .then((r) => { setCompany(r.results[0] || null); setStInsee(r.results[0] ? 'done' : 'error'); })
      .catch(() => setStInsee('error'))
      .finally(tick);
    analyzeSite(domain.trim() || BIZ.name)
      .then((r) => { setSite(r); setStSite('done'); })
      .catch(() => setStSite('error'))
      .finally(tick);
  };

  const apply = () => {
    setClient({ name: BIZ.name, initials: BIZ.initials });
    localStorage.setItem('eff_onboarded', '1');
    close();
    showToast(UI.check, `Espace personnalisé pour <b style="margin-left:3px">${company?.nom || BIZ.name}</b>`);
  };

  const stepLabel = step === 'form' ? 'Étape 1 / 3' : step === 'scan' ? 'Étape 2 / 3' : 'Étape 3 / 3';
  const ps = site?.pagespeed;

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
              <h2>Analysons votre entreprise en 30 secondes</h2>
              <p className="onb-lead">Renseignez votre SIRET et votre site : Efficience récupère vos données légales officielles (INSEE / SIRENE) et réalise un audit technique de votre site (Lighthouse). Données réelles uniquement, rien n’est inventé.</p>
              <div className="onb-form">
                <div className="field"><label className="field-lbl">Numéro SIREN / SIRET</label>
                  <input className="inp siret-inp" maxLength={17} placeholder="483 591 616" value={siret} onChange={(e) => setSiret(e.target.value)} /></div>
                <div className="field"><label className="field-lbl">Site web</label>
                  <input className="inp" placeholder="efficiencemarketing.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
              </div>
            </div>
            <div className="onb-foot">
              <span className="grow"><RawIcon svg={UI.shield} style={{ width: 13, height: 13, display: 'inline-grid', verticalAlign: -2, color: 'var(--acc)' }} /> Données publiques officielles · conforme RGPD</span>
              <button className="btn outline" onClick={close}>Passer</button>
              <button className="btn acc" onClick={analyze}><Icon name="search" />Analyser mon entreprise</button>
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
                    ['INSEE · base SIRENE', 'Identité légale, NAF, dirigeants', stInsee],
                    ['Google Lighthouse', 'Audit performance, SEO & accessibilité du site', stSite],
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
                  <div className="dh-logo" style={{ background: 'linear-gradient(150deg,#0e4a39,#10b981 58%,#00d992)' }}>{BIZ.initials}</div>
                  <div><div className="dh-n">{company.nom}{company.etatAdministratif === 'A' && <RawIcon svg={UI.check} className="vrf" />}</div>
                    <div className="dh-meta">{[company.naf.libelle, company.codePostal && company.commune ? `${company.codePostal} ${company.commune}` : null, company.dateCreation ? 'créée en ' + company.dateCreation.slice(0, 4) : null].filter(Boolean).join(' · ')}</div></div>
                </div>
              ) : <div style={{ color: 'var(--warn)', marginTop: 14 }}>Entreprise introuvable — vérifiez le SIREN/SIRET.</div>}

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
                  <div className="dc-l"><Icon name="image" />Charte visuelle</div>
                  <div className="swatch-row">{['#00d992', '#10b981', '#0e4a39', '#101010'].map((c) => <div className="swatch" style={{ background: c }} key={c}><span>{c}</span></div>)}</div>
                </div>

                <div className="disc-card">
                  <div className="dc-l"><Icon name="sparkles2" />Pré-configuration</div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Identité légale appliquée à l’espace</span></div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Audit du site enregistré</span></div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Réseaux sociaux : à connecter (étape suivante)</span></div>
                  <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Ton de marque : direct &amp; pédagogique</span></div>
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

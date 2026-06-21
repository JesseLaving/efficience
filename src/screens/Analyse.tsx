import { useState } from 'react';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { analyzeCompany, analyzeSite, type CompanyResult, type SiteResponse } from '../lib/api';

const frDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return d ? `${d}/${m}/${y}` : s;
};
const scoreColor = (n: number | null | undefined) =>
  n == null ? 'var(--tx-3)' : n >= 90 ? 'var(--acc)' : n >= 50 ? 'var(--warn)' : 'var(--danger)';

function Score({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="crm-stat" style={{ textAlign: 'center' }}>
      <div className="cs-v" style={{ color: scoreColor(value), fontSize: 30 }}>{value == null ? '—' : value}</div>
      <div className="cs-f" style={{ marginTop: 6 }}>{label}</div>
    </div>
  );
}

export function Analyse() {
  const [siret, setSiret] = useState('483591616'); // Efficience Marketing (EI) — real SIREN
  const [site, setSite] = useState('efficiencemarketing.com');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<{ total: number; result: CompanyResult } | null>(null);
  const [siteRes, setSiteRes] = useState<SiteResponse | null>(null);
  const [err, setErr] = useState<{ company?: string; site?: string }>({});

  const run = async () => {
    setLoading(true); setErr({}); setCompany(null); setSiteRes(null);
    const [c, s] = await Promise.allSettled([
      siret.trim() ? analyzeCompany(siret.trim()) : Promise.reject(new Error('vide')),
      site.trim() ? analyzeSite(site.trim()) : Promise.reject(new Error('vide')),
    ]);
    if (c.status === 'fulfilled') {
      const first = c.value.results[0];
      if (first) setCompany({ total: c.value.total, result: first });
      else setErr((e) => ({ ...e, company: 'Aucune entreprise trouvée pour cette recherche.' }));
    } else setErr((e) => ({ ...e, company: c.reason?.message || 'Erreur' }));
    if (s.status === 'fulfilled') setSiteRes(s.value);
    else setErr((e) => ({ ...e, site: s.reason?.message || 'Erreur' }));
    setLoading(false);
  };

  const ps = siteRes?.pagespeed;
  const b = siteRes?.basic;

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Analyse</div>
          <h1>Analysez votre entreprise et votre site</h1>
          <p>Données légales réelles (INSEE/SIRENE) et audit technique de votre site (Lighthouse). Rien n’est inventé : ce qui n’est pas disponible est affiché « — ».</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div className="field">
            <label className="field-lbl">Entreprise — nom ou SIREN/SIRET</label>
            <input className="inp" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="Ex : 483 591 616 ou Efficience Marketing" />
          </div>
          <div className="field">
            <label className="field-lbl">Site web</label>
            <input className="inp" value={site} onChange={(e) => setSite(e.target.value)} placeholder="efficiencemarketing.com" />
          </div>
          <button className="btn acc" onClick={run} disabled={loading} style={{ height: 38 }}>
            {loading ? <><span className="spin" />Analyse…</> : <><Icon name="search" />Analyser</>}
          </button>
        </div>
      </div>

      <div className="dash-grid">
        {/* ---- Company ---- */}
        <div className="card">
          <div className="card-h"><div><h3>Identité légale</h3><div className="sub">Source : INSEE / SIRENE (api.gouv.fr)</div></div>
            {company && <span className="chip on"><RawIcon svg={UI.check} />vérifié</span>}</div>
          <div className="pad">
            {err.company && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err.company}</div>}
            {!company && !err.company && <div style={{ color: 'var(--tx-3)', fontSize: 13 }}>Lancez une analyse pour afficher les données légales.</div>}
            {company && (() => { const r = company.result; return (
              <>
                <div style={{ fontFamily: 'var(--ff-disp)', fontSize: 20, fontWeight: 600, color: 'var(--tx-str)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.nom}{r.etatAdministratif === 'A' && <RawIcon svg={UI.check} style={{ width: 16, height: 16, color: 'var(--acc)' }} />}
                </div>
                {company.total > 1 && <div style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 12px' }}>{company.total} résultats — 1er affiché</div>}
                {[
                  ['SIREN', r.siren], ['SIRET (siège)', r.siret],
                  ['Code NAF', r.naf.code ? `${r.naf.code}${r.naf.libelle ? ' · ' + r.naf.libelle : ''}` : '—'],
                  ['Forme juridique', r.formeJuridique || '—'],
                  ['Création', frDate(r.dateCreation)],
                  ['État', r.etatAdministratif === 'A' ? 'Active' : r.etatAdministratif === 'C' ? 'Cessée' : (r.etatAdministratif || '—')],
                  ['Effectif', r.effectif || '—'],
                  ['Commune', [r.codePostal, r.commune].filter(Boolean).join(' ') || '—'],
                  ['Établissements', r.nombreEtablissements != null ? String(r.nombreEtablissements) : '—'],
                ].map(([k, v]) => (
                  <div className="disc-info-row" key={k as string}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
                {r.dirigeants.length > 0 && (
                  <div className="disc-info-row"><span className="k">Dirigeant(s)</span><span className="v">{r.dirigeants.map((d) => d.nom + (d.qualite ? ` (${d.qualite})` : '')).join(', ')}</span></div>
                )}
              </>
            ); })()}
          </div>
        </div>

        {/* ---- Site ---- */}
        <div className="card">
          <div className="card-h"><div><h3>Audit du site</h3><div className="sub">Lighthouse (Google PageSpeed) + en-têtes HTTP</div></div></div>
          <div className="pad">
            {err.site && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err.site}</div>}
            {!siteRes && !err.site && <div style={{ color: 'var(--tx-3)', fontSize: 13 }}>Lancez une analyse pour auditer le site.</div>}
            {siteRes && (
              <>
                {ps?.available && ps.scores ? (
                  <div className="crm-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 14 }}>
                    <Score label="Perf" value={ps.scores.performance} />
                    <Score label="SEO" value={ps.scores.seo} />
                    <Score label="Accessibilité" value={ps.scores.accessibilite} />
                    <Score label="Bonnes pratiques" value={ps.scores.bonnesPratiques} />
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: 'var(--warn)', marginBottom: 12, padding: '10px 12px', border: '1px solid rgba(232,163,61,.35)', borderRadius: 'var(--r-btn)', background: 'rgba(232,163,61,.08)' }}>
                    {siteRes.psiKeyConfigured ? `Lighthouse indisponible : ${ps?.error || 'erreur'}` : 'Scores Lighthouse désactivés — ajoutez une clé Google PageSpeed (gratuite) côté serveur (GOOGLE_PSI_KEY) pour les activer.'}
                  </div>
                )}
                {ps?.available && ps.metrics && (
                  <div className="disc-info-row"><span className="k">Web Vitals</span><span className="v" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>LCP {ps.metrics.lcp || '—'} · CLS {ps.metrics.cls || '—'} · TBT {ps.metrics.tbt || '—'}</span></div>
                )}
                {[
                  ['HTTP', b?.status != null ? `${b.status}${b.https ? ' · HTTPS' : ' · non sécurisé'}` : '—'],
                  ['Titre', b?.title || (b?.jsRendered ? '(rendu en JavaScript)' : '—')],
                  ['Méta description', b?.metaDescription || '—'],
                  ['Serveur', b?.server || '—'],
                  ['Poids HTML', b?.sizeKB != null ? `${b.sizeKB} Ko` : '—'],
                  ['Structure', b ? `${b.h1Count ?? 0} H1 · ${b.imgCount ?? 0} images · ${b.linkCount ?? 0} liens` : '—'],
                ].map(([k, v]) => (
                  <div className="disc-info-row" key={k as string}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
                {b?.jsRendered && <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 8 }}>Site rendu côté JavaScript — les balises SEO ne sont visibles qu’après rendu (mesuré par Lighthouse).</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

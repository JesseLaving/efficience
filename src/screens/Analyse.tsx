import { useState } from 'react';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { fr } from '../lib/format';
import { analyzeCompany, analyzeSite, type CompanyResult, type SiteResponse, type Audit } from '../lib/api';

const frDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-');
  return d ? `${d}/${m}/${y}` : (m ? `${m}/${y}` : s);
};
const eur = (n: number | null) => (n == null ? '—' : fr(Math.round(n)) + ' €');
const scoreColor = (n: number | null | undefined) =>
  n == null ? 'var(--tx-3)' : n >= 90 ? 'var(--acc)' : n >= 50 ? 'var(--warn)' : 'var(--danger)';
const ndaFmt = (s: string | null) => (s && s.length === 11 ? `${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8)}` : s);

function Score({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="crm-stat" style={{ textAlign: 'center' }}>
      <div className="cs-v" style={{ color: scoreColor(value), fontSize: 30 }}>{value == null ? '—' : value}</div>
      <div className="cs-f" style={{ marginTop: 6 }}>{label}</div>
    </div>
  );
}

function IssueList({ title, items }: { title: string; items: Audit[] }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 7 }}>{title}</div>
      {items.map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', fontSize: 12.5, color: 'var(--tx-2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor(Math.round(a.score * 100)), flex: 'none', marginTop: 5 }} />
          <span style={{ flex: 1 }}>{a.title}{a.displayValue ? <span style={{ color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}> · {a.displayValue}</span> : null}</span>
        </div>
      ))}
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
  const m = ps?.metrics;

  const badgeList = (r: CompanyResult) => {
    const out: string[] = [];
    if (r.badges.organismeFormation) out.push('Organisme de formation');
    if (r.badges.qualiopi) out.push('Qualiopi');
    if (r.badges.ess) out.push('ESS');
    if (r.badges.rge) out.push('RGE');
    if (r.badges.bio) out.push('Bio');
    if (r.badges.societeMission) out.push('Société à mission');
    if (r.badges.association) out.push('Association');
    return out;
  };

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Analyse</div>
          <h1>Analysez votre entreprise et votre site</h1>
          <p>Données légales réelles (INSEE/SIRENE) et audit technique approfondi de votre site (Lighthouse). Rien n’est inventé : ce qui n’est pas disponible est affiché « — ».</p>
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
            {company && (() => { const r = company.result; const badges = badgeList(r); return (
              <>
                <div style={{ fontFamily: 'var(--ff-disp)', fontSize: 20, fontWeight: 600, color: 'var(--tx-str)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.nom}{r.etatAdministratif === 'A' && <RawIcon svg={UI.check} style={{ width: 16, height: 16, color: 'var(--acc)' }} />}
                </div>
                {company.total > 1 && <div style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>{company.total} résultats — 1er affiché</div>}
                {badges.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 4px' }}>
                    {badges.map((bl) => <span key={bl} className="chip on" style={{ fontSize: 11.5 }}><RawIcon svg={UI.check} />{bl}</span>)}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  {([
                    ['SIREN', r.siren], ['SIRET (siège)', r.siret],
                    ['Code NAF', r.naf.code ? `${r.naf.code}${r.naf.libelle ? ' · ' + r.naf.libelle : ''}` : '—'],
                    ['Forme juridique', r.formeJuridiqueLabel || r.formeJuridique || '—'],
                    ['Catégorie', r.categorie || '—'],
                    ['Création', frDate(r.dateCreation)],
                    ['État', r.etatAdministratif === 'A' ? 'Active' : r.etatAdministratif === 'C' ? 'Cessée' : (r.etatAdministratif || '—')],
                    ['Effectif', r.effectif ? `${r.effectif}${r.effectifAnnee ? ` (${r.effectifAnnee})` : ''}` : '—'],
                    ['N° déclaration formation', r.nda ? ndaFmt(r.nda) : '—'],
                    ['Localisation', [r.codePostal, r.commune].filter(Boolean).join(' ') || '—'],
                    ['Établissements', r.nombreEtablissements != null ? String(r.nombreEtablissements) : '—'],
                    ['Mise à jour', frDate(r.dateMaj)],
                  ] as [string, string][]).filter(([, v]) => v !== '—' || true).map(([k, v]) => (
                    <div className="disc-info-row" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                  ))}
                  {r.dirigeants.length > 0 && (
                    <div className="disc-info-row"><span className="k">Dirigeant(s)</span><span className="v">{r.dirigeants.map((d) => d.nom + (d.anneeNaissance ? ` (${d.anneeNaissance})` : '') + (d.qualite ? ` — ${d.qualite}` : '')).join(', ')}</span></div>
                  )}
                  {r.finances && r.finances.length > 0 && (
                    <div className="disc-info-row"><span className="k">Comptes publiés</span><span className="v" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {r.finances.map((f) => `${f.annee}: CA ${eur(f.ca)} · RN ${eur(f.resultatNet)}`).join('  ·  ')}</span></div>
                  )}
                </div>
              </>
            ); })()}
          </div>
        </div>

        {/* ---- Site ---- */}
        <div className="card">
          <div className="card-h"><div><h3>Audit du site</h3><div className="sub">Lighthouse (Google PageSpeed, mobile) + en-têtes HTTP</div></div></div>
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
                    {siteRes.psiKeyConfigured ? `Lighthouse indisponible : ${ps?.error || 'erreur'}` : 'Scores Lighthouse désactivés — clé Google PageSpeed non configurée côté serveur.'}
                  </div>
                )}
                {ps?.available && m && (
                  <div className="disc-info-row"><span className="k">Web Vitals</span><span className="v" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>LCP {m.lcp || '—'} · CLS {m.cls || '—'} · TBT {m.tbt || '—'} · SI {m.speedIndex || '—'} · TTFB {m.ttfb || '—'}</span></div>
                )}
                {([
                  ['HTTP', b?.status != null ? `${b.status}${b.https ? ' · HTTPS' : ' · non sécurisé'}` : '—'],
                  ['Titre', b?.title || (b?.jsRendered ? '(rendu en JavaScript)' : '—')],
                  ['Méta description', b?.metaDescription || '—'],
                  ['Poids HTML', b?.sizeKB != null ? `${b.sizeKB} Ko` : '—'],
                  ['Structure', b ? `${b.h1Count ?? 0} H1 · ${b.imgCount ?? 0} images · ${b.linkCount ?? 0} liens` : '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div className="disc-info-row" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}

                {ps?.available && ps.opportunites && ps.opportunites.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 7 }}>Performance — gains potentiels</div>
                    {ps.opportunites.map((o) => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 12.5, color: 'var(--tx-2)' }}>
                        <span>{o.title}</span><span style={{ fontFamily: 'var(--mono)', color: 'var(--warn)', flex: 'none' }}>−{(o.savingsMs / 1000).toFixed(1)} s</span>
                      </div>
                    ))}
                  </div>
                )}
                {ps?.available && ps.issues && (
                  <>
                    <IssueList title="À corriger — SEO" items={ps.issues.seo} />
                    <IssueList title="À corriger — Accessibilité" items={ps.issues.accessibilite} />
                    <IssueList title="À corriger — Bonnes pratiques" items={ps.issues.bonnesPratiques} />
                  </>
                )}
                {b?.jsRendered && <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 10 }}>Site rendu côté JavaScript — les balises SEO ne sont visibles qu’après rendu (mesuré par Lighthouse).</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

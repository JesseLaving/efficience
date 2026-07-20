import { useState, useRef, useEffect } from 'react';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { fr } from '../lib/format';
import { analyzeCompany, analyzeSite, type CompanyResult, type SiteResponse, type Audit } from '../lib/api';
import { loadProfile } from '../lib/profile';
import { AiLoader } from '../components/AiLoader';

const frDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-');
  return d ? `${d}/${m}/${y}` : (m ? `${m}/${y}` : s);
};
const eur = (n: number | null) => (n == null ? '—' : fr(Math.round(n)) + ' €');
const scoreColor = (n: number | null | undefined) =>
  n == null ? 'var(--tx-3)' : n >= 90 ? 'var(--acc)' : n >= 50 ? 'var(--warn)' : 'var(--danger)';
const ndaFmt = (s: string | null) => (s && s.length === 11 ? `${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8)}` : s);

// Lighthouse-style circular score gauge: a track ring plus a coloured arc that
// animates from empty to the score on mount (draw-on, like the dashboard chart).
// value == null → an empty ring with "—", never a fabricated score.
function Score({ label, value }: { label: string; value: number | null | undefined }) {
  const arcRef = useRef<SVGCircleElement>(null);
  const R = 30;
  const C = 2 * Math.PI * R;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color = scoreColor(value);
  useEffect(() => {
    const el = arcRef.current;
    if (!el) return;
    el.style.strokeDasharray = String(C);
    el.style.strokeDashoffset = String(C);
    el.getBoundingClientRect(); // force reflow so the transition runs
    el.style.transition = 'stroke-dashoffset 1.1s var(--ease, ease)';
    el.style.strokeDashoffset = String(C * (1 - v / 100));
  }, [v, C]);
  return (
    <div className="crm-stat" style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto' }}>
        <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
          <circle cx="38" cy="38" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle ref={arcRef} cx="38" cy="38" r={R} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" transform="rotate(-90 38 38)"
            style={{ strokeDasharray: C, strokeDashoffset: C }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700, color }}>
          {value == null ? '—' : value}
        </div>
      </div>
      <div className="cs-f" style={{ marginTop: 8 }}>{label}</div>
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
  const prof = loadProfile();
  const [siret, setSiret] = useState(prof?.siret || prof?.siren || '');
  const [site, setSite] = useState(prof?.domain || '');
  const [loading, setLoading] = useState(false);
  /* On conserve TOUS les résultats, pas seulement le premier : une recherche par
     nom peut renvoyer plusieurs entreprises homonymes, dont des cessées — sans
     choix possible, on analysait silencieusement la mauvaise. */
  const [company, setCompany] = useState<{ total: number; results: CompanyResult[] } | null>(null);
  const [pick, setPick] = useState(0);
  const [siteRes, setSiteRes] = useState<SiteResponse | null>(null);
  const [err, setErr] = useState<{ company?: string; site?: string }>({});

  const run = async () => {
    setLoading(true); setErr({}); setCompany(null); setPick(0); setSiteRes(null);
    const [c, s] = await Promise.allSettled([
      siret.trim() ? analyzeCompany(siret.trim()) : Promise.reject(new Error('vide')),
      site.trim() ? analyzeSite(site.trim()) : Promise.reject(new Error('vide')),
    ]);
    if (c.status === 'fulfilled') {
      // Les entreprises encore actives passent devant : l'API classe par
      // pertinence textuelle et remonte parfois une société cessée en premier.
      const list = [...(c.value.results || [])].sort(
        (a, z) => (z.etatAdministratif === 'A' ? 1 : 0) - (a.etatAdministratif === 'A' ? 1 : 0),
      );
      if (list.length) setCompany({ total: c.value.total, results: list });
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
    if (r.badges.servicePublic) out.push('Service public');
    if (r.badges.siae) out.push('Insertion (SIAE)');
    if (r.badges.avocat) out.push('Avocat');
    if (r.badges.patrimoineVivant) out.push('Patrimoine vivant');
    if (r.badges.achatsResponsables) out.push('Achats responsables');
    // Déclarations extra-financières : angles éditoriaux RSE exploitables.
    if (r.badges.egapro) out.push('Index égalité pro');
    if (r.badges.bilanGes) out.push('Bilan GES');
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

      {loading && (
        <div className="card" style={{ marginBottom: 16 }}>
          <AiLoader
            lead="Analyse en cours"
            phrases={['Interrogation de l’INSEE (SIRENE)…', 'Audit technique du site (Lighthouse)…', 'Calcul des scores et recommandations…']}
          />
        </div>
      )}

      <div className="dash-grid">
        {/* ---- Company ---- */}
        <div className="card">
          <div className="card-h"><div><h3>Identité légale</h3><div className="sub">Source : INSEE / SIRENE (api.gouv.fr)</div></div>
            {company && <span className="chip on"><RawIcon svg={UI.check} />vérifié</span>}</div>
          <div className="pad">
            {err.company && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err.company}</div>}
            {!company && !err.company && <div style={{ color: 'var(--tx-3)', fontSize: 13 }}>Lancez une analyse pour afficher les données légales.</div>}
            {company && (() => { const r = company.results[Math.min(pick, company.results.length - 1)]; const badges = badgeList(r); return (
              <>
                {company.results.length > 1 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 6 }}>
                      {company.total} entreprise{company.total > 1 ? 's' : ''} trouvée{company.total > 1 ? 's' : ''} — choisissez la bonne :
                    </div>
                    <div className="km-fmt-row">
                      {company.results.map((o, i) => (
                        <button
                          key={(o.siren || '') + i}
                          type="button"
                          className={'km-fmt' + (i === pick ? ' on' : '')}
                          onClick={() => setPick(i)}
                          title={[o.nom, o.adresse].filter(Boolean).join(' — ')}
                        >
                          {(o.nom || 'Sans nom').slice(0, 28)}
                          {o.codePostal ? ` · ${o.codePostal}` : ''}
                          {o.etatAdministratif !== 'A' ? ' · cessée' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ fontFamily: 'var(--ff-disp)', fontSize: 20, fontWeight: 600, color: 'var(--tx-str)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.nom}{r.etatAdministratif === 'A' && <RawIcon svg={UI.check} style={{ width: 16, height: 16, color: 'var(--acc)' }} />}
                </div>
                {r.etatAdministratif !== 'A' && (
                  <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 4 }}>
                    Entreprise cessée{r.dateFermeture ? ` le ${frDate(r.dateFermeture)}` : ''}.
                  </div>
                )}
                {badges.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 4px' }}>
                    {badges.map((bl) => <span key={bl} className="chip on" style={{ fontSize: 11.5 }}><RawIcon svg={UI.check} />{bl}</span>)}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  {([
                    ['SIREN', r.siren], ['SIRET (siège)', r.siret],
                    ['N° TVA intracom.', r.tva || '—'],
                    ['Code NAF', r.naf.code ? `${r.naf.code}${r.naf.libelle ? ' · ' + r.naf.libelle : ''}` : '—'],
                    ['NAF 2025', r.naf2025 || '—'],
                    ['Secteur', r.sectionLabel || r.section || '—'],
                    ['Forme juridique', r.formeJuridiqueLabel || r.formeJuridique || '—'],
                    ['Catégorie', r.categorie ? `${r.categorie}${r.categorieAnnee ? ` (${r.categorieAnnee})` : ''}` : '—'],
                    ['Convention collective', r.idcc ? `IDCC ${r.idcc}` : '—'],
                    ['Création', frDate(r.dateCreation)],
                    ['État', r.etatAdministratif === 'A' ? 'Active' : r.etatAdministratif === 'C' ? 'Cessée' : (r.etatAdministratif || '—')],
                    ...(r.dateFermeture ? [['Fermeture', frDate(r.dateFermeture)] as [string, string]] : []),
                    ['Effectif', r.effectif ? `${r.effectif}${r.effectifAnnee ? ` (${r.effectifAnnee})` : ''}` : '—'],
                    ['N° déclaration formation', r.nda ? ndaFmt(r.nda) : '—'],
                    ['Adresse du siège', r.adresse || '—'],
                    ['Localisation', [r.codePostal, r.commune].filter(Boolean).join(' ') || '—'],
                    ['Établissements ouverts', r.nombreEtablissements != null
                      ? `${r.nombreEtablissements}${r.nombreEtablissementsTotal != null ? ` sur ${r.nombreEtablissementsTotal}` : ''}`
                      : '—'],
                    ['Mise à jour', frDate(r.dateMaj)],
                  ] as [string, string][]).filter(([, v]) => v !== '—' || true).map(([k, v]) => (
                    <div className="disc-info-row" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                  ))}
                  {r.latitude != null && r.longitude != null && (
                    <div className="disc-info-row">
                      <span className="k">Coordonnées</span>
                      <span className="v">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--acc)' }}
                        >
                          {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)} — voir la carte
                        </a>
                      </span>
                    </div>
                  )}
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
                  <div style={{ fontSize: 12.5, color: 'var(--warn)', marginBottom: 12, padding: '10px 12px', border: '1px solid rgba(143,100,35,.35)', borderRadius: 'var(--r-btn)', background: 'rgba(143,100,35,.08)' }}>
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

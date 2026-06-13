import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { fr } from '../lib/format';
import { countUp } from '../lib/countup';
import {
  POP, TOTAL, SEGMENTS, FIELDS, segCount, matchCriteria, avFor, initials,
  type Criterion, type Contact, type Segment,
} from '../lib/population';

const COLUMNS = [
  { src: 'prenom', to: 'Prénom', dt: '#2fd6a1' },
  { src: 'nom', to: 'Nom', dt: '#2fd6a1' },
  { src: 'email', to: 'E-mail', dt: '#6fb3ff' },
  { src: 'ville', to: 'Ville', dt: '#e8a33d' },
  { src: 'dernier_achat', to: 'Dernier achat', dt: '#c084fc' },
  { src: 'panier_moyen', to: 'Panier moyen', dt: '#c084fc' },
  { src: 'opt_in_email', to: 'Consentement', dt: '#00d992' },
];
const MATCH = [99, 98, 100, 96, 94, 97, 100];

type Flow = 'idle' | 'analyzing' | 'mapped' | 'confirming';

export function Contacts() {
  const { crmImported, setCrmImported, newCampaign } = useEff();
  const [flow, setFlow] = useState<Flow>('idle');
  const [seg, setSeg] = useState('all');
  const [custom, setCustom] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [q, setQ] = useState('');
  const totalRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  /* ---------- import simulation ---------- */
  const runImport = () => {
    if (flow !== 'idle') return;
    setFlow('analyzing');
  };
  useEffect(() => {
    if (flow !== 'analyzing') return;
    const bar = barRef.current;
    if (bar) {
      requestAnimationFrame(() => { bar.style.right = '0%'; });
      setTimeout(() => { if (bar) bar.style.right = '38%'; }, 60);
      setTimeout(() => { if (bar) bar.style.right = '8%'; }, 700);
    }
    const t = setTimeout(() => setFlow('mapped'), 1250);
    return () => clearTimeout(t);
  }, [flow]);

  const confirmImport = () => {
    setFlow('confirming');
    setTimeout(() => { setCrmImported(true); setFlow('idle'); }, 1100);
  };

  useEffect(() => {
    if (crmImported) countUp(totalRef.current, TOTAL);
  }, [crmImported]);

  /* ---------- filtering ---------- */
  const activeSeg: Segment = SEGMENTS.find((x) => x.id === seg) || SEGMENTS[0];
  let list: Contact[] = custom ? POP.filter((c) => matchCriteria(c, criteria)) : POP.filter(activeSeg.pred);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(ql) || c.email.includes(ql) || c.city.toLowerCase().includes(ql));
  }
  const rows = list.slice(0, 10);
  const builderCount = custom || criteria.length ? POP.filter((c) => matchCriteria(c, criteria)).length : 0;

  const pickSeg = (id: string) => { setCustom(false); setSeg(id); setQ(''); };
  const addCriterion = () => {
    const keys = Object.keys(FIELDS);
    const used = criteria.map((c) => c.field);
    const field = keys.find((k) => !used.includes(k)) || 'basket';
    const f = FIELDS[field];
    setCriteria([...criteria, { field, op: f.ops[0], value: f.type === 'select' ? f.options![0] : (f.ph || '20') }]);
    setCustom(true);
  };
  const removeCriterion = (i: number) => {
    const next = criteria.filter((_, idx) => idx !== i);
    setCriteria(next);
    setCustom(next.length > 0);
  };
  const changeCriterion = (i: number, key: 'field' | 'op' | 'value', val: string) => {
    const next = criteria.map((cr, idx) => {
      if (idx !== i) return cr;
      if (key === 'field') {
        const f = FIELDS[val];
        return { field: val, op: f.ops[0], value: f.type === 'select' ? f.options![0] : (f.ph || '20') };
      }
      return { ...cr, [key]: val };
    });
    setCriteria(next);
    setCustom(next.length > 0);
  };

  const segName = custom ? 'Segment personnalisé' : activeSeg.name;
  const optin = POP.filter((c) => c.consent).length;
  const avg = POP.length ? POP.reduce((s, c) => s + c.basket, 0) / POP.length : 0;
  const pctOfBase = (n: number) => (TOTAL ? Math.round((n / TOTAL) * 100) : 0);

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">CRM · Base clients</div>
          <h1>Vos contacts, prêts à être ciblés</h1>
          <p>Importez votre base Excel ou CSV : Efficience détecte les colonnes, fusionne les doublons et la rend segmentable en un instant — sans quitter l’app.</p>
        </div>
        {crmImported && <ExportButton />}
      </div>

      {/* import host */}
      {flow === 'idle' ? (
        crmImported ? (
          <div className="imp-zone" style={{ padding: '18px 22px' }} onClick={runImport}>
            <div className="iz-ic" style={{ width: 42, height: 42, borderRadius: 11 }}><Icon name="upload" style={{ width: 21, height: 21 }} /></div>
            <div>
              <div className="iz-t" style={{ fontSize: 14 }}>Mettre à jour votre base</div>
              <div className="iz-s">Glissez un nouveau fichier pour ajouter ou actualiser des contacts.</div>
            </div>
            <div className="iz-cta"><button className="btn sm" onClick={(e) => { e.stopPropagation(); runImport(); }}>Importer un fichier</button></div>
          </div>
        ) : (
          <div className="imp-zone" onClick={runImport}>
            <div className="iz-ic"><Icon name="upload" /></div>
            <div>
              <div className="iz-t">Importez votre base clients</div>
              <div className="iz-s">Glissez-déposez votre fichier ou <b>parcourez vos fichiers</b>. Jusqu’à 50 000 contacts.</div>
              <div className="iz-formats">
                <span className="fmt-chip"><Icon name="sheet" />.xlsx</span>
                <span className="fmt-chip"><Icon name="sheet" />.csv</span>
                <span className="fmt-chip"><Icon name="sheet" />.xls</span>
              </div>
            </div>
            <div className="iz-cta"><button className="btn acc" onClick={(e) => { e.stopPropagation(); runImport(); }}><Icon name="upload" />Choisir un fichier</button></div>
          </div>
        )
      ) : (
        <div className="imp-flow">
          <div className="if-head">
            <div className="if-file"><Icon name="sheet" /></div>
            <div>
              <div className="if-name">base_clients_boulangerie.csv</div>
              <div className="if-sub" ref={subRef}>{flow === 'analyzing' ? 'Lecture du fichier…' : '7 colonnes détectées'}</div>
            </div>
            <div className="if-state">
              {flow === 'analyzing'
                ? <><span className="spin lt" />Analyse…</>
                : <><RawIcon svg={UI.check} style={{ width: 16, height: 16, color: 'var(--acc)' }} />Correspondance auto</>}
            </div>
          </div>
          <div className="imp-bar"><i ref={barRef as React.RefObject<HTMLElement>} /></div>
          {(flow === 'mapped' || flow === 'confirming') && (
            <div>
              <div className="map-grid">
                <div className="map-head"><span>Colonne du fichier</span><span /><span>Champ Efficience</span><span style={{ textAlign: 'right' }}>Fiabilité</span></div>
                {COLUMNS.map((c, i) => (
                  <div className="map-row" style={{ animationDelay: i * 90 + 'ms' }} key={c.src}>
                    <div className="map-col"><span className="dt" style={{ background: c.dt }} />{c.src}</div>
                    <div className="map-arrow"><Icon name="arrowright" /></div>
                    <div className="map-col map-to"><Icon name="check" />{c.to}</div>
                    <div className="map-match">{MATCH[i]} %</div>
                  </div>
                ))}
              </div>
              <div className="imp-foot">
                <div className="grow">Détection des colonnes — importez un fichier réel pour remplir votre base.</div>
                <button className="btn outline" onClick={() => setFlow('idle')}>Annuler</button>
                <button className="btn acc" disabled={flow === 'confirming'} style={flow === 'confirming' ? { opacity: 0.8 } : undefined} onClick={confirmImport}>
                  {flow === 'confirming' ? <><span className="spin" />Import en cours…</> : <><Icon name="check" />Importer le fichier</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* main CRM */}
      {crmImported && flow === 'idle' && (
        <div className="fade-in">
          <div className="crm-stats">
            <div className="crm-stat"><div className="cs-l"><Icon name="users" />Contacts</div><div className="cs-v" ref={totalRef}>0</div><div className="cs-f">base importée · synchronisée</div></div>
            <div className="crm-stat"><div className="cs-l"><Icon name="shield" />Opt-in marketing</div><div className="cs-v">{fr(optin)}</div><div className="cs-f"><span className="acc">{pctOfBase(optin)} %</span> · conforme RGPD</div></div>
            <div className="crm-stat"><div className="cs-l"><Icon name="euro" />Panier moyen</div><div className="cs-v">{avg.toFixed(1).replace('.', ',')} €</div><div className="cs-f">tous clients confondus</div></div>
            <div className="crm-stat"><div className="cs-l"><Icon name="filter" />Segments actifs</div><div className="cs-v">{SEGMENTS.length}</div><div className="cs-f">prêts pour le ciblage</div></div>
          </div>

          <div className="crm-layout">
            <div className="seg-rail">
              <div className="seg-card">
                <div className="sc-h"><h3>Segments</h3><Icon name="filter" style={{ width: 15, height: 15, color: 'var(--tx-3)' }} /></div>
                <div className="seg-list">
                  {SEGMENTS.map((s) => (
                    <div key={s.id} className={'seg-item' + (!custom && seg === s.id ? ' active' : '')} onClick={() => pickSeg(s.id)}>
                      <div className="si-ic"><RawIcon svg={UI[s.icon as keyof typeof UI] || UI.users} /></div>
                      <div className="si-t"><div className="si-n">{s.name}</div><div className="si-d">{s.desc}</div></div>
                      <div className="si-c">{fr(segCount(s))}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="seg-card">
                <div className="sc-h"><h3>Créer un segment</h3><Icon name="sliders" style={{ width: 15, height: 15, color: 'var(--acc)' }} /></div>
                <div className="builder">
                  <p className="bld-lead">Combinez des critères : Efficience recompte votre audience en temps réel.</p>
                  <div>
                    {criteria.map((cr, idx) => {
                      const f = FIELDS[cr.field];
                      return (
                        <div key={idx}>
                          <div className="crit-row" style={{ gridTemplateColumns: '1fr auto' }}>
                            <div className="crit-grid full" style={{ gridTemplateColumns: '1fr' }}>
                              <select className="inp" value={cr.field} onChange={(e) => changeCriterion(idx, 'field', e.target.value)}>
                                {Object.entries(FIELDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </div>
                            <button className="crit-x" onClick={() => removeCriterion(idx)}><Icon name="trash" /></button>
                          </div>
                          <div className="crit-row" style={{ marginTop: -2 }}>
                            <div className="crit-grid">
                              <select className="inp" value={cr.op} onChange={(e) => changeCriterion(idx, 'op', e.target.value)}>
                                {f.ops.map((o) => <option key={o}>{o}</option>)}
                              </select>
                              {f.type === 'select' ? (
                                <select className="inp" value={cr.value} onChange={(e) => changeCriterion(idx, 'value', e.target.value)}>
                                  {f.options!.map((o) => <option key={o}>{o}</option>)}
                                </select>
                              ) : (
                                <div style={{ position: 'relative' }}>
                                  <input className="inp" type="number" value={cr.value} placeholder={f.ph || ''} style={{ paddingRight: f.unit ? 42 : 12 }} onChange={(e) => changeCriterion(idx, 'value', e.target.value)} />
                                  {f.unit && <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>{f.unit}</span>}
                                </div>
                              )}
                            </div>
                            <span />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="add-crit" onClick={addCriterion}><Icon name="plus" />Ajouter un critère</button>
                  {criteria.length > 0 && (
                    <>
                      <div className="bld-result">
                        <div className="br-v">{fr(builderCount)}</div>
                        <div className="br-t">contacts correspondent.<br /><b>{pctOfBase(builderCount)} %</b> de votre base ciblée.</div>
                      </div>
                      <SaveSegmentButton onSave={() => setCustom(true)} />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="ct-card">
              <div className="ct-head">
                <div className="ct-title">{segName}<span className="seg-pill">{fr(list.length)} contacts</span></div>
                <div className="ct-search"><input className="inp" placeholder="Rechercher un contact…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ct-table">
                  <thead><tr><th>Contact</th><th>Ville</th><th className="num">Panier moy.</th><th>Dernier achat</th><th>Tags</th><th style={{ textAlign: 'center' }}>Opt-in</th></tr></thead>
                  <tbody>
                    {rows.length ? rows.map((c) => (
                      <tr key={c.id}>
                        <td><div className="ct-name"><div className="av" style={{ background: avFor(c) }}>{initials(c)}</div><div><div className="cn-t">{c.name}</div><div className="cn-e">{c.email}</div></div></div></td>
                        <td><span className="ct-city"><Icon name="pin" />{c.city}</span></td>
                        <td className="num">{c.basket.toFixed(1).replace('.', ',')} €</td>
                        <td>{c.lastDays === 0 ? 'aujourd’hui' : 'il y a ' + c.lastDays + ' j'}</td>
                        <td><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{c.tags.map((t) => <span key={t} className={'tag-chip ' + (t === 'VIP' ? 'vip' : t === 'Nouveau' ? 'new' : '')}>{t}</span>)}</div></td>
                        <td style={{ textAlign: 'center' }}>{c.consent ? <span className="consent-y"><Icon name="check" /></span> : <span className="consent-n"><Icon name="close" /></span>}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6}><div className="crm-empty" style={{ minHeight: 180 }}>
                        <div className="ce-ic"><Icon name="filter" /></div>
                        <div className="ce-t">Aucun contact dans ce segment</div>
                        <p>Ajustez vos critères pour élargir l’audience.</p>
                      </div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="ct-foot">
                <span>Affichage de <span className="mono">{rows.length}</span> sur <span className="mono">{fr(list.length)}</span> contacts</span>
                <button className="btn ghost sm" onClick={() => newCampaign(custom ? 'custom' : seg)}><Icon name="mail" />Créer une campagne pour ce segment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ExportButton() {
  const [txt, setTxt] = useState<React.ReactNode>(<><Icon name="download" />Exporter le segment</>);
  return <button className="btn outline" onClick={() => { setTxt('Export .csv généré'); setTimeout(() => setTxt(<><Icon name="download" />Exporter le segment</>), 1100); }}>{txt}</button>;
}

function SaveSegmentButton({ onSave }: { onSave: () => void }) {
  const [txt, setTxt] = useState<React.ReactNode>(<><Icon name="filter" />Cibler ce segment</>);
  return (
    <button className="btn acc block" style={{ marginTop: 12 }} onClick={() => { onSave(); setTxt('Segment ciblé ✓'); setTimeout(() => setTxt(<><Icon name="filter" />Cibler ce segment</>), 1100); }}>{txt}</button>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useContacts } from '../state/ContactsContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { fr } from '../lib/format';
import { countUp } from '../lib/countup';
import { showToast } from '../lib/toast';
import {
  SEGMENTS, fieldsFor, matchCriteria, initials, avFor,
  type Criterion, type Contact, type Segment,
} from '../lib/population';
import {
  parseDelimited, detectMapping, rowsToContacts, contactsToCsv, downloadCsv,
  type ColumnMapping, type ParsedTable, type TargetField,
} from '../lib/contacts';
import { googleContactsLogin, consumeGoogleContactsHash, fetchGoogleContacts, mapGoogleContacts } from '../lib/google';

const FIELD_LABELS: Record<TargetField, string> = {
  email: 'E-mail', first: 'Prénom', last: 'Nom', name: 'Nom complet',
  phone: 'Téléphone', city: 'Ville', basket: 'Panier moyen', lastDays: 'Dernier achat',
  consent: 'Consentement', tags: 'Tags',
};

type Flow = 'idle' | 'analyzing' | 'mapped' | 'confirming';

export function Contacts() {
  const { newCampaign } = useEff();
  const { contacts, addContacts } = useContacts();
  const [flow, setFlow] = useState<Flow>('idle');
  const [seg, setSeg] = useState('all');
  const [custom, setCustom] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [q, setQ] = useState('');
  const totalRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [gcBusy, setGcBusy] = useState(false);

  const fields = useMemo(() => fieldsFor(contacts), [contacts]);

  /* ---------- import fichier réel ---------- */
  const openPicker = () => fileInputRef.current?.click();

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      showToast(UI.close, 'Format Excel non pris en charge — exportez votre fichier en .csv (Enregistrer sous → CSV) puis réessayez.');
      return;
    }
    setFileName(file.name);
    setFlow('analyzing');
    const text = await file.text();
    setTimeout(() => {
      const table = parseDelimited(text);
      setParsed(table);
      setMapping(detectMapping(table.headers));
      setFlow(table.headers.length ? 'mapped' : 'idle');
      if (!table.headers.length) showToast(UI.close, 'Fichier vide ou illisible.');
    }, 500);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const changeMapping = (field: TargetField, headerIndex: number | null) => {
    setMapping((prev) => prev.map((m) => (m.field === field ? { ...m, headerIndex, confidence: headerIndex != null ? 100 : 0 } : m)));
  };

  const cancelImport = () => { setFlow('idle'); setParsed(null); setMapping([]); setFileName(''); };

  const confirmImport = () => {
    if (!parsed) return;
    setFlow('confirming');
    setTimeout(() => {
      const built = rowsToContacts(parsed.headers, parsed.rows, mapping, 'file');
      const stats = addContacts(built);
      setFlow('idle'); setParsed(null); setMapping([]); setFileName('');
      showToast(UI.check, `${fr(stats.imported)} ligne(s) traitée(s) — ${fr(stats.added)} nouveaux, ${fr(stats.updated)} mis à jour.`);
    }, 700);
  };

  /* ---------- import Google Contacts ---------- */
  const connectGoogleContacts = () => googleContactsLogin();

  useEffect(() => {
    const { token, error } = consumeGoogleContactsHash();
    if (error) { showToast(UI.close, `Connexion Google Contacts : ${error}`); return; }
    if (!token) return;
    setGcBusy(true);
    fetchGoogleContacts(token)
      .then((d) => {
        if (!d.available) { showToast(UI.close, `Google Contacts : ${d.reason || 'indisponible'}`); return; }
        const built = mapGoogleContacts(d.contacts || []);
        const stats = addContacts(built);
        showToast(UI.check, `Google Contacts : ${fr(stats.added)} nouveaux, ${fr(stats.updated)} mis à jour.`);
      })
      .catch((e) => showToast(UI.close, `Google Contacts : ${String(e.message || e)}`))
      .finally(() => setGcBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (contacts.length) countUp(totalRef.current, contacts.length);
  }, [contacts.length]);

  /* ---------- filtrage ---------- */
  const activeSeg: Segment = SEGMENTS.find((x) => x.id === seg) || SEGMENTS[0];
  let list: Contact[] = custom ? contacts.filter((c) => matchCriteria(c, criteria, fields)) : contacts.filter(activeSeg.pred);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(ql) || c.email.includes(ql) || (c.city || '').toLowerCase().includes(ql));
  }
  const rows = list.slice(0, 10);
  const builderCount = custom || criteria.length ? contacts.filter((c) => matchCriteria(c, criteria, fields)).length : 0;

  const pickSeg = (id: string) => { setCustom(false); setSeg(id); setQ(''); };
  const addCriterion = () => {
    const keys = Object.keys(fields);
    const used = criteria.map((c) => c.field);
    const field = keys.find((k) => !used.includes(k)) || 'basket';
    const f = fields[field];
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
        const f = fields[val];
        return { field: val, op: f.ops[0], value: f.type === 'select' ? f.options![0] : (f.ph || '20') };
      }
      return { ...cr, [key]: val };
    });
    setCriteria(next);
    setCustom(next.length > 0);
  };

  const segName = custom ? 'Segment personnalisé' : activeSeg.name;
  const optin = contacts.filter((c) => c.consent === true).length;
  const avg = contacts.length ? contacts.reduce((s, c) => s + (c.basket || 0), 0) / contacts.length : 0;
  const pctOfBase = (n: number) => (contacts.length ? Math.round((n / contacts.length) * 100) : 0);

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">CRM · Base clients</div>
          <h1>Vos contacts, prêts à être ciblés</h1>
          <p>Importez un fichier CSV ou connectez Google Contacts : Efficience détecte les colonnes, fusionne les doublons (par e-mail) et rend votre base segmentable — sans donnée inventée.</p>
        </div>
        {contacts.length > 0 && <ExportButton contacts={list} />}
      </div>

      <input ref={fileInputRef} type="file" accept=".csv,.txt" hidden onChange={onPick} />

      {/* import host */}
      {flow === 'idle' ? (
        <div className="imp-zone" onDrop={onDrop} onDragOver={onDragOver} onClick={contacts.length ? undefined : openPicker}>
          <div className="iz-ic" style={contacts.length ? { width: 42, height: 42, borderRadius: 11 } : undefined}>
            <Icon name="upload" style={contacts.length ? { width: 21, height: 21 } : undefined} />
          </div>
          <div>
            <div className="iz-t" style={contacts.length ? { fontSize: 14 } : undefined}>
              {contacts.length ? 'Mettre à jour votre base' : 'Importez votre base clients'}
            </div>
            <div className="iz-s">
              {contacts.length
                ? 'Glissez un nouveau fichier CSV pour ajouter ou actualiser des contacts.'
                : <>Glissez-déposez un fichier <b>.csv</b> ou <b>parcourez vos fichiers</b>. Export Excel/Google Sheets en CSV supporté.</>}
            </div>
            {!contacts.length && (
              <div className="iz-formats"><span className="fmt-chip"><Icon name="sheet" />.csv</span></div>
            )}
          </div>
          <div className="iz-cta" style={{ display: 'flex', gap: 8 }}>
            <button className={contacts.length ? 'btn sm' : 'btn acc'} onClick={(e) => { e.stopPropagation(); openPicker(); }}>
              <Icon name="upload" />{contacts.length ? 'Importer un fichier' : 'Choisir un fichier'}
            </button>
            <button className="btn outline sm" disabled={gcBusy} onClick={(e) => { e.stopPropagation(); connectGoogleContacts(); }}>
              {gcBusy ? <span className="spin lt" /> : <Icon name="link" />}Google Contacts
            </button>
          </div>
        </div>
      ) : (
        <div className="imp-flow">
          <div className="if-head">
            <div className="if-file"><Icon name="sheet" /></div>
            <div>
              <div className="if-name">{fileName}</div>
              <div className="if-sub">
                {flow === 'analyzing' ? 'Lecture du fichier…' : `${parsed?.headers.length || 0} colonnes détectées · ${parsed?.rows.length || 0} lignes`}
              </div>
            </div>
            <div className="if-state">
              {flow === 'analyzing'
                ? <><span className="spin lt" />Analyse…</>
                : <><RawIcon svg={UI.check} style={{ width: 16, height: 16, color: 'var(--acc)' }} />Correspondance auto</>}
            </div>
          </div>
          <div className="imp-bar"><i ref={barRef as React.RefObject<HTMLElement>} style={{ right: flow === 'analyzing' ? '38%' : '0%' }} /></div>
          {(flow === 'mapped' || flow === 'confirming') && parsed && (
            <div>
              <div className="map-grid">
                <div className="map-head"><span>Colonne du fichier</span><span /><span>Champ Efficience</span><span style={{ textAlign: 'right' }}>Fiabilité</span></div>
                {mapping.map((m, i) => (
                  <div className="map-row" style={{ animationDelay: i * 90 + 'ms' }} key={m.field}>
                    <div className="map-col">
                      <select className="inp" style={{ padding: '5px 8px', fontSize: 12.5 }} value={m.headerIndex ?? ''} onChange={(e) => changeMapping(m.field, e.target.value === '' ? null : +e.target.value)}>
                        <option value="">— ignorer —</option>
                        {parsed.headers.map((h, hi) => <option key={hi} value={hi}>{h}</option>)}
                      </select>
                    </div>
                    <div className="map-arrow"><Icon name="arrowright" /></div>
                    <div className="map-col map-to"><Icon name="check" />{FIELD_LABELS[m.field]}</div>
                    <div className="map-match">{m.headerIndex != null ? `${m.confidence || 60} %` : '—'}</div>
                  </div>
                ))}
              </div>
              <div className="imp-foot">
                <div className="grow">Ajustez la correspondance si besoin, puis confirmez l’import.</div>
                <button className="btn outline" onClick={cancelImport}>Annuler</button>
                <button className="btn acc" disabled={flow === 'confirming'} style={flow === 'confirming' ? { opacity: 0.8 } : undefined} onClick={confirmImport}>
                  {flow === 'confirming' ? <><span className="spin" />Import en cours…</> : <><Icon name="check" />Importer le fichier</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* main CRM */}
      {contacts.length > 0 && flow === 'idle' && (
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
                      <div className="si-c">{fr(contacts.filter(s.pred).length)}</div>
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
                      const f = fields[cr.field];
                      return (
                        <div key={idx}>
                          <div className="crit-row" style={{ gridTemplateColumns: '1fr auto' }}>
                            <div className="crit-grid full" style={{ gridTemplateColumns: '1fr' }}>
                              <select className="inp" value={cr.field} onChange={(e) => changeCriterion(idx, 'field', e.target.value)}>
                                {Object.entries(fields).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </div>
                            <button className="crit-x" aria-label="Supprimer ce critère" onClick={() => removeCriterion(idx)}><Icon name="trash" /></button>
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
                        <td><div className="ct-name"><div className="av" style={{ background: avFor(c) }}>{initials(c)}</div><div><div className="cn-t">{c.name}</div><div className="cn-e">{c.email || '—'}</div></div></div></td>
                        <td><span className="ct-city"><Icon name="pin" />{c.city || '—'}</span></td>
                        <td className="num">{c.basket != null ? c.basket.toFixed(1).replace('.', ',') + ' €' : '—'}</td>
                        <td>{c.lastDays == null ? '—' : c.lastDays === 0 ? 'aujourd’hui' : 'il y a ' + c.lastDays + ' j'}</td>
                        <td><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{(c.tags || []).map((t) => <span key={t} className="tag-chip">{t}</span>)}</div></td>
                        <td style={{ textAlign: 'center' }}>{c.consent === true ? <span className="consent-y"><Icon name="check" /></span> : c.consent === false ? <span className="consent-n"><Icon name="close" /></span> : <span style={{ color: 'var(--tx-3)' }}>—</span>}</td>
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

function ExportButton({ contacts }: { contacts: Contact[] }) {
  const [txt, setTxt] = useState<React.ReactNode>(<><Icon name="download" />Exporter le segment</>);
  const doExport = () => {
    downloadCsv('contacts_efficience.csv', contactsToCsv(contacts));
    setTxt('Export .csv généré');
    setTimeout(() => setTxt(<><Icon name="download" />Exporter le segment</>), 1100);
  };
  return <button className="btn outline" onClick={doExport}>{txt}</button>;
}

function SaveSegmentButton({ onSave }: { onSave: () => void }) {
  const [txt, setTxt] = useState<React.ReactNode>(<><Icon name="filter" />Cibler ce segment</>);
  return (
    <button className="btn acc block" style={{ marginTop: 12 }} onClick={() => { onSave(); setTxt('Segment ciblé ✓'); setTimeout(() => setTxt(<><Icon name="filter" />Cibler ce segment</>), 1100); }}>{txt}</button>
  );
}

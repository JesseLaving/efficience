import { useEffect, useMemo, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useContacts } from '../state/ContactsContext';
import { useSegments } from '../state/SegmentsContext';
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
import { NameModal } from '../components/NameModal';
import { AddContactModal } from '../components/AddContactModal';
import { EditContactModal } from '../components/EditContactModal';

const FIELD_LABELS: Record<TargetField, string> = {
  email: 'E-mail', first: 'Prénom', last: 'Nom', name: 'Nom complet',
  phone: 'Téléphone', city: 'Ville', company: 'Société', jobTitle: 'Poste',
  basket: 'Panier moyen', lastDays: 'Dernier achat', lastContactAt: 'Dernier contact',
  createdAt: 'Date de création', notes: 'Notes', consent: 'Consentement', tags: 'Tags',
};

type Flow = 'idle' | 'analyzing' | 'mapped' | 'confirming';
type Audience = { kind: 'fixed' | 'custom' | 'saved' | 'group'; id: string };

const frDate = (iso?: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return d ? `${d}/${m}/${y}` : iso;
};

/* Infobulle au survol d'une ligne — regroupe les champs saisis à la main qui
   n'ont pas leur propre colonne (trop de colonnes rendraient le tableau
   illisible), sans les cacher complètement. */
function contactTooltip(c: Contact): string | undefined {
  const lines = [
    c.phone ? `Téléphone : ${c.phone}` : null,
    c.createdAt ? `Client depuis le ${frDate(c.createdAt)}` : null,
    c.lastContactAt ? `Dernier contact le ${frDate(c.lastContactAt)}` : null,
    c.notes ? `Notes : ${c.notes}` : null,
  ].filter((l): l is string => !!l);
  return lines.length ? lines.join('\n') : undefined;
}

export function Contacts() {
  const { newCampaign } = useEff();
  const { contacts, addContacts, updateContact, removeContact } = useContacts();
  const {
    savedSegments, groups, createSegment, deleteSegment,
    createGroup, deleteGroup, addToGroup, removeFromGroup,
  } = useSegments();
  const [flow, setFlow] = useState<Flow>('idle');
  const [audience, setAudience] = useState<Audience>({ kind: 'fixed', id: 'all' });
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | 'saveSegment' | 'createGroup' | 'addContact'>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
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
  const activeSeg: Segment = SEGMENTS.find((x) => x.id === audience.id) || SEGMENTS[0];
  const activeSavedSeg = savedSegments.find((s) => s.id === audience.id);
  const activeGroup = groups.find((g) => g.id === audience.id);

  let list: Contact[];
  if (audience.kind === 'custom') list = contacts.filter((c) => matchCriteria(c, criteria, fields));
  else if (audience.kind === 'saved' && activeSavedSeg) list = contacts.filter((c) => matchCriteria(c, activeSavedSeg.criteria, fields));
  else if (audience.kind === 'group' && activeGroup) { const ids = new Set(activeGroup.contactIds); list = contacts.filter((c) => ids.has(c.id)); }
  else list = contacts.filter(activeSeg.pred);

  if (q) {
    const ql = q.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(ql) || c.email.includes(ql) || (c.city || '').toLowerCase().includes(ql));
  }
  const rows = list.slice(0, 10);
  const builderCount = audience.kind === 'custom' || criteria.length ? contacts.filter((c) => matchCriteria(c, criteria, fields)).length : 0;

  const pickSeg = (id: string) => { setAudience({ kind: 'fixed', id }); setQ(''); setSelected(new Set()); };
  const pickSaved = (id: string) => { setAudience({ kind: 'saved', id }); setQ(''); setSelected(new Set()); };
  const pickGroup = (id: string) => { setAudience({ kind: 'group', id }); setQ(''); setSelected(new Set()); };

  const addCriterion = () => {
    const keys = Object.keys(fields);
    const used = criteria.map((c) => c.field);
    const field = keys.find((k) => !used.includes(k)) || 'basket';
    const f = fields[field];
    setCriteria([...criteria, { field, op: f.ops[0], value: f.type === 'select' ? f.options![0] : (f.ph || '20') }]);
    setAudience({ kind: 'custom', id: '' });
  };
  const removeCriterion = (i: number) => {
    const next = criteria.filter((_, idx) => idx !== i);
    setCriteria(next);
    setAudience(next.length > 0 ? { kind: 'custom', id: '' } : { kind: 'fixed', id: 'all' });
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
    setAudience(next.length > 0 ? { kind: 'custom', id: '' } : { kind: 'fixed', id: 'all' });
  };

  const segName = audience.kind === 'custom' ? 'Segment personnalisé'
    : audience.kind === 'saved' ? (activeSavedSeg?.name || 'Segment enregistré')
      : audience.kind === 'group' ? (activeGroup?.name || 'Groupe')
        : activeSeg.name;
  const optin = contacts.filter((c) => c.consent === true).length;
  const avg = contacts.length ? contacts.reduce((s, c) => s + (c.basket || 0), 0) / contacts.length : 0;
  const pctOfBase = (n: number) => (contacts.length ? Math.round((n / contacts.length) * 100) : 0);

  /* ---------- sélection & groupes ---------- */
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => (
    rows.length && rows.every((c) => prev.has(c.id)) ? new Set() : new Set(rows.map((c) => c.id))
  ));

  const handleGroupPick = (value: string) => {
    if (!value) return;
    if (value === '__new__') { setModal('createGroup'); return; }
    addToGroup(value, [...selected]);
    showToast(UI.check, `${fr(selected.size)} contact(s) ajouté(s) au groupe.`);
    setSelected(new Set());
  };

  const campaignAudienceId = audience.kind === 'fixed' ? audience.id
    : audience.kind === 'saved' ? `saved:${audience.id}`
      : audience.kind === 'group' ? `group:${audience.id}`
        : null;

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
          <div className="iz-cta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={contacts.length ? 'btn sm' : 'btn acc'} onClick={(e) => { e.stopPropagation(); openPicker(); }}>
              <Icon name="upload" />{contacts.length ? 'Importer un fichier' : 'Choisir un fichier'}
            </button>
            <button className="btn outline sm" disabled={gcBusy} onClick={(e) => { e.stopPropagation(); connectGoogleContacts(); }}>
              {gcBusy ? <span className="spin lt" /> : <Icon name="link" />}Google Contacts
            </button>
            <button className="btn outline sm" onClick={(e) => { e.stopPropagation(); setModal('addContact'); }}>
              <Icon name="plus" />Ajouter un contact
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
            <div className="crm-stat"><div className="cs-l"><Icon name="filter" />Segments actifs</div><div className="cs-v">{SEGMENTS.length + savedSegments.length + groups.length}</div><div className="cs-f">prêts pour le ciblage</div></div>
          </div>

          <div className="crm-layout">
            <div className="seg-rail">
              <div className="seg-card">
                <div className="sc-h"><h3>Segments</h3><Icon name="filter" style={{ width: 15, height: 15, color: 'var(--tx-3)' }} /></div>
                <div className="seg-list">
                  {SEGMENTS.map((s) => (
                    <div key={s.id} className={'seg-item' + (audience.kind === 'fixed' && audience.id === s.id ? ' active' : '')} onClick={() => pickSeg(s.id)}>
                      <div className="si-ic"><RawIcon svg={UI[s.icon as keyof typeof UI] || UI.users} /></div>
                      <div className="si-t"><div className="si-n">{s.name}</div><div className="si-d">{s.desc}</div></div>
                      <div className="si-c">{fr(contacts.filter(s.pred).length)}</div>
                    </div>
                  ))}
                  {savedSegments.map((s) => (
                    <div key={s.id} className={'seg-item' + (audience.kind === 'saved' && audience.id === s.id ? ' active' : '')} onClick={() => pickSaved(s.id)}>
                      <div className="si-ic"><RawIcon svg={UI.sliders} /></div>
                      <div className="si-t"><div className="si-n">{s.name}</div><div className="si-d">Segment enregistré</div></div>
                      <div className="si-c">{fr(contacts.filter((c) => matchCriteria(c, s.criteria, fields)).length)}</div>
                      <button
                        className="si-del" aria-label={`Supprimer le segment ${s.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSegment(s.id);
                          if (audience.kind === 'saved' && audience.id === s.id) setAudience({ kind: 'fixed', id: 'all' });
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="seg-card">
                <div className="sc-h">
                  <h3>Groupes</h3>
                  <button className="btn ghost sm" onClick={() => setModal('createGroup')}><Icon name="plus" />Nouveau</button>
                </div>
                <div className="seg-list">
                  {groups.length === 0 && (
                    <p className="seg-empty">Cochez des contacts dans le tableau pour créer votre premier groupe.</p>
                  )}
                  {groups.map((g) => (
                    <div key={g.id} className={'seg-item' + (audience.kind === 'group' && audience.id === g.id ? ' active' : '')} onClick={() => pickGroup(g.id)}>
                      <div className="si-ic"><RawIcon svg={UI.users} /></div>
                      <div className="si-t"><div className="si-n">{g.name}</div><div className="si-d">Groupe manuel</div></div>
                      <div className="si-c">{fr(g.contactIds.length)}</div>
                      <button
                        className="si-del" aria-label={`Supprimer le groupe ${g.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGroup(g.id);
                          if (audience.kind === 'group' && audience.id === g.id) setAudience({ kind: 'fixed', id: 'all' });
                        }}
                      >
                        <Icon name="trash" />
                      </button>
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
                      <button className="btn acc block" style={{ marginTop: 12 }} onClick={() => setModal('saveSegment')}>
                        <Icon name="filter" />Enregistrer ce segment
                      </button>
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
              {selected.size > 0 && (
                <div className="bulk-bar">
                  <span>{fr(selected.size)} contact{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</span>
                  <span className="grow" />
                  <select className="inp sm" value="" onChange={(e) => { handleGroupPick(e.target.value); e.target.value = ''; }}>
                    <option value="" disabled>Ajouter au groupe…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    <option value="__new__">+ Nouveau groupe…</option>
                  </select>
                  {audience.kind === 'group' && (
                    <button
                      className="btn outline sm"
                      onClick={() => {
                        selected.forEach((id) => removeFromGroup(audience.id, id));
                        showToast(UI.check, 'Contact(s) retiré(s) du groupe.');
                        setSelected(new Set());
                      }}
                    >
                      Retirer du groupe
                    </button>
                  )}
                  <button className="btn ghost sm" onClick={() => setSelected(new Set())}>Annuler</button>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th className="chk"><input type="checkbox" aria-label="Tout sélectionner" checked={rows.length > 0 && rows.every((c) => selected.has(c.id))} onChange={toggleAll} /></th>
                      <th>Contact</th><th>Ville</th><th className="num">Panier moy.</th><th>Dernier achat</th><th>Tags</th><th style={{ textAlign: 'center' }}>Opt-in</th><th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? rows.map((c) => (
                      <tr key={c.id} title={contactTooltip(c)}>
                        <td className="chk"><input type="checkbox" aria-label={`Sélectionner ${c.name}`} checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></td>
                        <td>
                          <div className="ct-name">
                            <div className="av" style={{ background: avFor(c) }}>{initials(c)}</div>
                            <div>
                              <div className="cn-t">{c.name}</div>
                              <div className="cn-e">{c.email || '—'}</div>
                              {(c.jobTitle || c.company) && <div className="cn-e">{[c.jobTitle, c.company].filter(Boolean).join(' · ')}</div>}
                            </div>
                          </div>
                        </td>
                        <td><span className="ct-city"><Icon name="pin" />{c.city || '—'}</span></td>
                        <td className="num">{c.basket != null ? c.basket.toFixed(1).replace('.', ',') + ' €' : '—'}</td>
                        <td>{c.lastDays == null ? '—' : c.lastDays === 0 ? 'aujourd’hui' : 'il y a ' + c.lastDays + ' j'}</td>
                        <td><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{(c.tags || []).map((t) => <span key={t} className="tag-chip">{t}</span>)}</div></td>
                        <td style={{ textAlign: 'center' }}>{c.consent === true ? <span className="consent-y"><Icon name="check" /></span> : c.consent === false ? <span className="consent-n"><Icon name="close" /></span> : <span style={{ color: 'var(--tx-3)' }}>—</span>}</td>
                        <td><button className="row-edit" aria-label={`Modifier ${c.name}`} onClick={() => setEditing(c)}><Icon name="edit" /></button></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8}><div className="crm-empty" style={{ minHeight: 180 }}>
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
                <button
                  className="btn ghost sm" disabled={!campaignAudienceId}
                  title={!campaignAudienceId ? 'Enregistrez ce segment pour pouvoir l’utiliser dans une campagne' : undefined}
                  onClick={() => { if (campaignAudienceId) newCampaign(campaignAudienceId); }}
                >
                  <Icon name="mail" />Créer une campagne pour ce segment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'saveSegment' && (
        <NameModal
          title="Enregistrer ce segment"
          subtitle={`${fr(builderCount)} contact(s) correspondent à ces critères`}
          icon="filter" placeholder="Ex : Clients Paris fidèles" confirmLabel="Enregistrer"
          onConfirm={(name) => {
            createSegment(name, criteria);
            showToast(UI.check, `Segment « ${name} » enregistré — disponible pour vos campagnes.`);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'createGroup' && (
        <NameModal
          title="Créer un groupe"
          subtitle={selected.size ? `${fr(selected.size)} contact(s) sélectionné(s) seront ajoutés` : undefined}
          icon="users" placeholder="Ex : Clients VIP Paris" confirmLabel="Créer"
          onConfirm={(name) => {
            const g = createGroup(name);
            if (selected.size) addToGroup(g.id, [...selected]);
            showToast(UI.check, `Groupe « ${name} » créé${selected.size ? ` avec ${fr(selected.size)} contact(s)` : ''}.`);
            setSelected(new Set());
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'addContact' && (
        <AddContactModal
          onAdd={(c) => {
            const stats = addContacts([c]);
            showToast(UI.check, stats.added ? `${c.name} ajouté à votre base.` : `${c.name} mis à jour (contact existant).`);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {editing && (
        <EditContactModal
          contact={editing}
          onSave={(patch) => { updateContact(editing.id, patch); showToast(UI.check, 'Contact mis à jour.'); }}
          onDelete={() => { removeContact(editing.id); showToast(UI.check, `${editing.name} supprimé de votre base.`); }}
          onClose={() => setEditing(null)}
        />
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

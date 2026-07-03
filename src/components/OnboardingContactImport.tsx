import { useRef, useState } from 'react';
import { useContacts } from '../state/ContactsContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { fr } from '../lib/format';
import {
  parseDelimited, detectMapping, rowsToContacts,
  type ColumnMapping, type ParsedTable, type TargetField,
} from '../lib/contacts';

const FIELD_LABELS: Record<TargetField, string> = {
  email: 'E-mail', first: 'Prénom', last: 'Nom', name: 'Nom complet',
  phone: 'Téléphone', city: 'Ville', basket: 'Panier moyen', lastDays: 'Dernier achat',
  consent: 'Consentement', tags: 'Tags',
};

type Flow = 'idle' | 'analyzing' | 'mapped' | 'confirming' | 'done';

/* Import CSV embarqué dans le Configurateur — étape facultative. Réutilise
   exactement le moteur de parsing/mapping de l'écran Contacts (src/lib/contacts.ts)
   pour un comportement identique, avec un tutoriel explicatif en plus puisque
   c'est ici le tout premier contact de l'utilisateur avec cette fonctionnalité. */
export function OnboardingContactImport() {
  const { addContacts } = useContacts();
  const [flow, setFlow] = useState<Flow>('idle');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [result, setResult] = useState<{ imported: number; added: number; updated: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    }, 400);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

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
      setResult(stats);
      setFlow('done');
    }, 500);
  };

  const importAnother = () => { setFlow('idle'); setParsed(null); setMapping([]); setFileName(''); setResult(null); };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="disc-card">
        <div className="dc-l"><Icon name="help" />Comment préparer votre fichier</div>
        <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.75 }}>
          <li>Ouvrez votre liste de contacts dans Excel, Google Sheets, ou exportez-la depuis votre CRM actuel.</li>
          <li>Gardez au moins une colonne <b>E-mail</b> ou <b>Nom</b> — les autres colonnes (téléphone, ville, panier moyen…) sont optionnelles.</li>
          <li>Enregistrez au format <b>CSV</b> : dans Excel, « Fichier → Enregistrer sous → CSV (séparateur point-virgule) » ; dans Google Sheets, « Fichier → Télécharger → Valeurs séparées par des virgules (.csv) ».</li>
          <li>Glissez le fichier ci-dessous : la correspondance des colonnes est détectée automatiquement, et reste modifiable avant de confirmer.</li>
        </ol>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {Object.values(FIELD_LABELS).map((l) => (
            <span key={l} className="chip" style={{ fontSize: 11 }}>{l}</span>
          ))}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv,.txt" hidden onChange={onPick} />

      {flow === 'idle' && (
        <div
          className={'imp-zone' + (dragOver ? ' drag' : '')}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={openPicker}
        >
          <div className="iz-ic"><Icon name="upload" /></div>
          <div>
            <div className="iz-t">Importez votre base clients</div>
            <div className="iz-s">Glissez-déposez un fichier <b>.csv</b> ou <b>parcourez vos fichiers</b>.</div>
            <div className="iz-formats"><span className="fmt-chip"><Icon name="sheet" />.csv</span></div>
          </div>
          <div className="iz-cta">
            <button className="btn acc" onClick={(e) => { e.stopPropagation(); openPicker(); }}><Icon name="upload" />Choisir un fichier</button>
          </div>
        </div>
      )}

      {(flow === 'analyzing' || flow === 'mapped' || flow === 'confirming') && (
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
          <div className="imp-bar"><i style={{ right: flow === 'analyzing' ? '38%' : '0%' }} /></div>
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

      {flow === 'done' && result && (
        <div className="crm-empty" style={{ minHeight: 'auto', padding: '26px 20px' }}>
          <div className="ce-ic"><RawIcon svg={UI.check} /></div>
          <div className="ce-t">{fr(result.imported)} ligne{result.imported > 1 ? 's' : ''} traitée{result.imported > 1 ? 's' : ''}</div>
          <p>{fr(result.added)} nouveaux contacts, {fr(result.updated)} mis à jour.</p>
          <button className="btn outline sm" style={{ marginTop: 10 }} onClick={importAnother}>Importer un autre fichier</button>
        </div>
      )}
    </div>
  );
}

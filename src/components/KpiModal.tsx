import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { FMT, UNIT } from '../lib/format';
import { SRC, type KpiDef } from '../lib/kpi';

const SOURCES_SEL: [string, string][] = [
  ['global', 'Réseaux sociaux'], ['google', 'Google Business'], ['site', 'Site web'],
  ['crm', 'Base clients (CRM)'], ['email', 'E-mailing'], ['manual', 'Saisie manuelle'],
];
const FMTS: [string, string][] = [['int', 'Nombre'], ['pct', 'Pourcentage'], ['eur', 'Euro'], ['rating', 'Note /5']];
const srcIcon = (s: string): string =>
  (({ global: 'target', google: 'target', site: 'cursor', crm: 'users', email: 'mail', manual: 'edit' } as Record<string, string>)[s]) || 'target';

const fmtVal = (fmt: string, v: number) => (FMT[fmt] || FMT.int)(v);

export function KpiModal({ onCreate, onClose }: { onCreate: (id: string, def: KpiDef) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [src, setSrc] = useState('global');
  const [fmt, setFmt] = useState('int');
  const [val, setVal] = useState('');
  const [target, setTarget] = useState('');
  const [period, setPeriod] = useState('30 jours');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const prevDef: KpiDef = {
    label: name || 'Nouvel indicateur', icon: srcIcon(src), src, fmt,
    val: +val || 0, trend: { dir: 'up', val: 'sur ' + period }, target: target ? +target : 0,
  };
  const s = SRC[src] || SRC.manual;
  const unit = UNIT[prevDef.fmt] ? <span className="ku">{UNIT[prevDef.fmt]}</span> : null;

  const create = () => {
    const id = 'custom-' + Date.now();
    onCreate(id, {
      label: name || 'Nouvel indicateur', icon: srcIcon(src), src, fmt,
      val: +val || 0, trend: { dir: 'up', val: 'sur ' + period, since: SRC[src].label },
      target: target ? +target : 0, custom: true,
    });
    onClose();
  };

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card">
        <div className="kmodal-top">
          <div className="km-ic"><Icon name="sliders" /></div>
          <div><h3>Créer un indicateur</h3><div className="km-s">Composez un KPI sur mesure pour votre activité</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="kmodal-body">
          <div className="field">
            <label className="field-lbl">Nom de l’indicateur</label>
            <input className="inp" placeholder="Ex : Réservations en ligne, Avis 5★, CA boutique…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Source de données</label>
              <select className="inp" value={src} onChange={(e) => setSrc(e.target.value)}>
                {SOURCES_SEL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-lbl">Période de comparaison</label>
              <select className="inp" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option>7 jours</option><option>30 jours</option><option>90 jours</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-lbl">Format</label>
            <div className="km-fmt-row">
              {FMTS.map(([v, l]) => (
                <button key={v} className={'km-fmt' + (fmt === v ? ' on' : '')} onClick={() => setFmt(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Valeur actuelle</label>
              <input className="inp" type="number" placeholder="0" value={val} onChange={(e) => setVal(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-lbl">Objectif <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
              <input className="inp" type="number" placeholder="—" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>
          <div className="km-preview">
            <div className="kml">Aperçu</div>
            <div className="kpi-board" style={{ gridTemplateColumns: '1fr', margin: 0, maxWidth: 280 }}>
              <div>
                <div className="kpi">
                  <div className="kl"><RawIcon svg={UI[prevDef.icon as keyof typeof UI] || UI.target} />{prevDef.label}</div>
                  <div className="kv"><span className="kv-n">{fmtVal(prevDef.fmt, prevDef.val)}</span>{unit}</div>
                  <div className="kf">
                    <span className="pill up"><RawIcon svg={UI.arrowup} />{prevDef.trend!.val}</span>
                    <span className="ksrc"><span dangerouslySetInnerHTML={{ __html: s.glyph }} />{s.label}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>L’indicateur s’ajoute à votre tableau de bord.</span>
          <button className="btn outline" onClick={onClose}>Annuler</button>
          <button className="btn acc" onClick={create}><RawIcon svg={UI.check} />Créer le KPI</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

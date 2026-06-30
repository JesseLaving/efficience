import { useMemo, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useCalendar } from '../state/CalendarContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { getBusiness } from '../lib/business';
import { showToast } from '../lib/toast';
import {
  DURATIONS, SECTOR_PRESETS, PILLARS, generatePlan, planToCsv, type PlanItem,
} from '../lib/editorial';
import { buildAidaPost } from '../lib/aida';
import { defaultDateTime } from '../lib/calendar';

const netLabel: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', google: 'Google Business',
};

function downloadCsv(items: PlanItem[]) {
  const csv = planToCsv(items);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'planning-editorial.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function EditorialPlanning() {
  const { client, seedStudio } = useEff();
  const { addToCalendar } = useCalendar();
  const [sector, setSector] = useState(() => getBusiness().sector);
  const [durKey, setDurKey] = useState('1m');
  const [perWeek, setPerWeek] = useState(3);
  const [plan, setPlan] = useState<PlanItem[] | null>(null);

  const weeks = DURATIONS.find((d) => d.key === durKey)?.weeks ?? 4;

  const generate = () => {
    const b = getBusiness();
    const items = generatePlan({ sector: sector.trim() || b.sector, city: b.city, weeks, perWeek });
    setPlan(items);
    showToast(UI.check, `${items.length} publications proposées`);
  };

  // Regroupe le planning par mois pour l'affichage.
  const byMonth = useMemo(() => {
    if (!plan) return [];
    const m = new Map<string, PlanItem[]>();
    for (const p of plan) {
      if (!m.has(p.monthLabel)) m.set(p.monthLabel, []);
      m.get(p.monthLabel)!.push(p);
    }
    return Array.from(m.entries());
  }, [plan]);

  // Répartition par pilier (preuve d'équilibre éditorial).
  const pillarDist = useMemo(() => {
    if (!plan) return [];
    const c: Record<string, number> = {};
    for (const p of plan) c[p.pillarKey] = (c[p.pillarKey] || 0) + 1;
    return PILLARS.filter((pl) => c[pl.key]).map((pl) => ({ ...pl, n: c[pl.key] }));
  }, [plan]);

  // Transforme le sujet en brouillon AIDA (Attention · Intérêt · Désir · Action + CTA).
  const aidaFor = (p: PlanItem) => { const b = getBusiness(); return buildAidaPost(p, { sector: sector.trim() || b.sector, name: b.name, city: b.city }); };
  const compose = (p: PlanItem) => seedStudio(aidaFor(p));
  const schedule = (p: PlanItem) => addToCalendar({ dateTime: defaultDateTime(p.date, 9), text: aidaFor(p), networks: [p.network], photoUrl: null, pillar: p.pillar });
  const copyIdea = (p: PlanItem) => {
    navigator.clipboard?.writeText(p.idea).then(() => showToast(UI.check, 'Sujet copié'), () => {});
  };

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Planning éditorial</div>
          <h1>Générez votre calendrier de publications</h1>
          <p>Un plan de contenu équilibré pour {client.name}, adapté à votre secteur d’activité. Choisissez la durée et le rythme : chaque proposition est un point de départ à personnaliser, et les dates sont réelles.</p>
        </div>
        {plan && plan.length > 0 && (
          <button className="btn outline" onClick={() => downloadCsv(plan)}><Icon name="download" />Exporter (.csv)</button>
        )}
      </div>

      {/* ---------- Configurateur ---------- */}
      <div className="card">
        <div className="card-h"><h3>Paramètres du planning</h3></div>
        <div className="pad" style={{ display: 'grid', gap: 18 }}>
          <div className="field">
            <label className="field-lbl">Secteur d’activité</label>
            <input className="inp" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex : Conseil & formation, Restauration, Immobilier…" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {SECTOR_PRESETS.map((s) => (
                <button
                  key={s}
                  className={'chip-btn' + (sector.trim() === s ? ' on' : '')}
                  onClick={() => setSector(s)}
                  style={{
                    fontSize: 12.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    border: '1px solid ' + (sector.trim() === s ? 'var(--acc)' : 'var(--line)'),
                    background: sector.trim() === s ? 'var(--acc-soft)' : 'transparent',
                    color: sector.trim() === s ? 'var(--acc)' : 'var(--tx-2)',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-lbl">Durée du planning</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DURATIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDurKey(d.key)}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 'var(--r-btn)', cursor: 'pointer',
                    border: '1px solid ' + (durKey === d.key ? 'var(--acc)' : 'var(--line)'),
                    background: durKey === d.key ? 'var(--acc)' : 'transparent',
                    color: durKey === d.key ? '#04231a' : 'var(--tx-2)',
                  }}
                >{d.label}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-lbl">Publications par semaine — <b style={{ color: 'var(--acc)' }}>{perWeek}</b></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input
                type="range" min={1} max={14} value={perWeek}
                onChange={(e) => setPerWeek(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--acc)' }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>
                ≈ {perWeek * weeks} publication{perWeek * weeks > 1 ? 's' : ''} au total
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="grow" style={{ fontSize: 12, color: 'var(--tx-3)' }}>Propositions générées localement, sans donnée inventée.</span>
            <button className="btn acc" onClick={generate}><RawIcon svg={UI.sparkles2} />{plan ? 'Régénérer le planning' : 'Générer le planning'}</button>
          </div>
        </div>
      </div>

      {/* ---------- Résultat ---------- */}
      {plan && plan.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-h"><h3>Vue d’ensemble</h3><div className="sub">{plan.length} publications · {weeks} semaine{weeks > 1 ? 's' : ''} · {perWeek}/semaine</div></div>
            <div className="pad">
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 10 }}>Équilibre par pilier éditorial</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pillarDist.map((pl) => (
                  <span key={pl.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--canvas-soft)', color: 'var(--tx-2)' }}>
                    {pl.label}<b style={{ color: 'var(--acc)' }}>{pl.n}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {byMonth.map(([month, posts]) => (
            <div className="card" style={{ marginTop: 16 }} key={month}>
              <div className="card-h">
                <h3 style={{ textTransform: 'capitalize' }}>{month}</h3>
                <div className="sub">{posts.length} publication{posts.length > 1 ? 's' : ''}</div>
              </div>
              <div className="pad" style={{ display: 'grid', gap: 10 }}>
                {posts.map((p, i) => (
                  <div key={p.date + '-' + i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas-soft)' }}>
                    <div style={{ minWidth: 92, fontSize: 12.5, color: 'var(--tx-2)', fontWeight: 600, textTransform: 'capitalize', paddingTop: 2 }}>{p.label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--acc)' }}>
                          <RawIcon svg={UI.dot} style={{ width: 12, height: 12, display: 'inline-grid' }} />{p.pillar}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>· {p.format}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tx-3)' }}>
                          · <span style={{ width: 14, height: 14, display: 'inline-grid' }}><Brand name={p.network as BrandName} /></span>{netLabel[p.network] || p.network}
                        </span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--tx-1)', lineHeight: 1.45 }}>{p.idea}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button className="btn acc sm" title="Rédiger un brouillon AIDA dans le Studio" onClick={() => compose(p)}>
                        <Icon name="spark" />Composer (AIDA)
                      </button>
                      <button className="btn outline sm" title="Ajouter au calendrier de programmation" onClick={() => schedule(p)}>
                        <Icon name="clock" />Programmer
                      </button>
                      <button className="btn ghost sm" title="Copier le sujet" onClick={() => copyIdea(p)}>
                        <Icon name="edit" />Copier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

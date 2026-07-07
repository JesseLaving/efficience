import { useMemo, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useCalendar } from '../state/CalendarContext';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { getBusiness } from '../lib/business';
import { showToast } from '../lib/toast';
import {
  DURATIONS, SECTOR_PRESETS, PILLARS, planScaffold, applyIdeas, planToCsv, type PlanItem,
} from '../lib/editorial';
import { generateAiPlanIdeas, sampleRecentCaptions, type AiContext } from '../lib/ai';
import { loadStrategy } from '../lib/strategy';
import { buildAidaPost } from '../lib/aida';
import { defaultDateTime, publishedCaptions } from '../lib/calendar';
import { AiLoader } from '../components/AiLoader';

const AI_MAX_SLOTS = 30;

const netLabel: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', google: 'Google Business',
};

/* Réseaux proposés pour la multidiffusion d'une publication du planning —
   ceux que les piliers éditoriaux peuvent assigner (voir PILLARS). */
const PLAN_NETWORKS = ['instagram', 'facebook', 'linkedin', 'google'];

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
  const { scheduled, addToCalendar } = useCalendar();
  const { isConnected, metaStats, tiktokVideos } = useConnections();
  const [sector, setSector] = useState(() => getBusiness().sector);
  const [durKey, setDurKey] = useState('1m');
  const [perWeek, setPerWeek] = useState(3);
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState<Set<PlanItem>>(new Set());
  // Réseaux sélectionnés pour la multidiffusion, par publication du planning
  // (clé = date + index). Par défaut : tous les réseaux connectés parmi
  // ceux que les piliers couvrent, sinon le réseau suggéré par le pilier.
  const [netSel, setNetSel] = useState<Record<string, string[]>>({});
  const connectedPlanNetworks = useMemo(() => PLAN_NETWORKS.filter(isConnected), [isConnected]);

  const weeks = DURATIONS.find((d) => d.key === durKey)?.weeks ?? 4;

  // Contexte commun aux appels IA (plan entier + régénération individuelle) —
  // le ton et les sujets déjà traités viennent d'abord des publications
  // RÉELLEMENT publiées via Efficience (fonctionne même sans réseau social
  // connecté), complétés par les légendes récentes des réseaux connectés.
  const buildCtx = (sec: string): AiContext => {
    const b = getBusiness();
    const strat = loadStrategy();
    return {
      name: b.name, sector: sec, city: b.city,
      audience: strat?.audience || undefined, products: strat?.products || undefined, goal: strat?.goal || undefined,
      recentPosts: [...publishedCaptions(scheduled), ...sampleRecentCaptions(metaStats, tiktokVideos)].slice(0, 6),
    };
  };

  const generate = async () => {
    const b = getBusiness();
    const sec = sector.trim() || b.sector;
    setAiNote(null);

    const scaffold = planScaffold({ weeks, perWeek });
    if (scaffold.length > AI_MAX_SLOTS) {
      showToast(UI.close, `Génération IA limitée à ${AI_MAX_SLOTS} publications à la fois — réduisez la durée ou le rythme.`);
      return;
    }
    setAiBusy(true);
    try {
      const slots = scaffold.map((s) => ({ pillar: s.pillar, format: s.format, network: s.network }));
      const res = await generateAiPlanIdeas(buildCtx(sec), slots);
      if (res.available && res.ideas) {
        setPlan(applyIdeas(scaffold, res.ideas, sec, b.city));
        showToast(UI.check, `${scaffold.length} publications proposées par IA`);
      } else {
        setPlan(applyIdeas(scaffold, [], sec, b.city));
        setAiNote(`Gemini indisponible (${res.reason || 'erreur'}) — sujets génériques utilisés en repli.`);
        showToast(UI.close, `IA indisponible : ${res.reason || 'erreur'} — repli sur les sujets génériques.`);
      }
    } catch (e) {
      setPlan(applyIdeas(scaffold, [], sec, b.city));
      setAiNote('IA indisponible — sujets génériques utilisés en repli.');
      showToast(UI.close, `IA : ${String((e as Error).message || e)}`);
    } finally { setAiBusy(false); }
  };

  // Régénère le sujet d'UNE seule publication du planning, sans toucher au
  // reste — utile pour varier un angle qui ne convient pas plutôt que de
  // relancer toute la génération.
  const regenerateOne = async (p: PlanItem) => {
    setRegenBusy((s) => new Set(s).add(p));
    try {
      const sec = sector.trim() || getBusiness().sector;
      const res = await generateAiPlanIdeas(buildCtx(sec), [{ pillar: p.pillar, format: p.format, network: p.network }]);
      const idea = res.available && res.ideas && res.ideas[0] ? res.ideas[0].trim() : '';
      if (idea) {
        setPlan((prev) => (prev ? prev.map((item) => (item === p ? { ...item, idea } : item)) : prev));
        showToast(UI.check, 'Nouveau sujet proposé');
      } else {
        showToast(UI.close, `IA indisponible : ${res.reason || 'erreur'}`);
      }
    } catch (e) {
      showToast(UI.close, `IA : ${String((e as Error).message || e)}`);
    } finally {
      setRegenBusy((s) => { const n = new Set(s); n.delete(p); return n; });
    }
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

  const keyFor = (p: PlanItem, i: number) => p.date + '-' + i;
  // Réseaux effectivement sélectionnés pour une publication : ceux choisis
  // manuellement, sinon tous les réseaux connectés couverts par le planning,
  // sinon (rien de connecté) le réseau suggéré par le pilier — jamais vide.
  const netsFor = (p: PlanItem, i: number): string[] => netSel[keyFor(p, i)] ?? (connectedPlanNetworks.length ? connectedPlanNetworks : [p.network]);
  const toggleNet = (p: PlanItem, i: number, id: string) => {
    const k = keyFor(p, i);
    const cur = netsFor(p, i);
    const next = cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id];
    if (!next.length) return; // toujours au moins un réseau sélectionné
    setNetSel((s) => ({ ...s, [k]: next }));
  };

  const schedule = (p: PlanItem, i: number) => addToCalendar({ dateTime: defaultDateTime(p.date, 9), text: aidaFor(p), networks: netsFor(p, i), photoUrl: null, pillar: p.pillar });
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
                    color: durKey === d.key ? 'var(--on-acc)' : 'var(--tx-2)',
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

          {weeks * perWeek > AI_MAX_SLOTS && (
            <div style={{ fontSize: 11.5, color: 'var(--warn)' }}>
              L’IA personnalise jusqu’à {AI_MAX_SLOTS} publications par génération — réduisez la durée ou le rythme pour ce volume ({weeks * perWeek}).
            </div>
          )}
          {aiNote && <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{aiNote}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="grow" style={{ fontSize: 12, color: 'var(--tx-3)' }}>
              Sujets rédigés par Gemini pour votre entreprise — dates et équilibre calculés localement.
            </span>
            <button className="btn acc" disabled={aiBusy} onClick={generate}>
              {aiBusy ? <span className="spin" /> : <RawIcon svg={UI.sparkles2} />}
              {plan ? 'Régénérer le planning' : 'Générer le planning'}
            </button>
          </div>
          {aiBusy && (
            <AiLoader
              lead="Génération IA en cours"
              phrases={['Analyse de votre secteur et de votre stratégie…', 'Rédaction des sujets par Gemini…', 'Équilibrage du calendrier…']}
            />
          )}
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
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.45, marginBottom: 8 }}>{p.idea}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Diffuser sur :</span>
                        {(connectedPlanNetworks.length ? connectedPlanNetworks : [p.network]).map((id) => (
                          <button
                            key={id} type="button"
                            className={'plat-chip sm' + (netsFor(p, i).includes(id) ? ' on' : '')}
                            title={netLabel[id] || id}
                            onClick={() => toggleNet(p, i, id)}
                          >
                            <Brand name={id as BrandName} />{netLabel[id] || id}<RawIcon svg={UI.check} className="pc-x" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button className="btn acc sm" title="Rédiger un brouillon AIDA dans le Studio" onClick={() => compose(p)}>
                        <Icon name="spark" />Composer (AIDA)
                      </button>
                      <button className="btn outline sm" title="Ajouter au calendrier de programmation, sur tous les réseaux sélectionnés" onClick={() => schedule(p, i)}>
                        <Icon name="clock" />Programmer
                      </button>
                      <button className="btn ghost sm" title="Copier le sujet" onClick={() => copyIdea(p)}>
                        <Icon name="edit" />Copier
                      </button>
                      <button className="btn ghost sm" disabled={regenBusy.has(p)} title="Générer un nouveau sujet par IA pour cette publication" onClick={() => regenerateOne(p)}>
                        {regenBusy.has(p) ? <span className="spin lt" /> : <RawIcon svg={UI.sparkles2} />}Nouvelle idée
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

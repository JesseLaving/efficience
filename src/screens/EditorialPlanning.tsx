import { useEffect, useMemo, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useCalendar } from '../state/CalendarContext';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { getBusiness } from '../lib/business';
import { showToast } from '../lib/toast';
import {
  DURATIONS, SECTOR_PRESETS, PILLARS, planScaffold, applyIdeas, planToCsv, loadPlan, savePlan, type PlanItem,
} from '../lib/editorial';
import { generateAiPlanIdeas, generatePost, sampleRecentCaptions, type AiContext } from '../lib/ai';
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
  const { client, seedStudio, show } = useEff();
  const { scheduled, addToCalendar } = useCalendar();
  const { isConnected, metaStats, tiktokVideos } = useConnections();
  /* Plan et réglages restaurés à l'ouverture : le plan vivait dans l'état
     local, si bien que « Rédiger le post » (qui navigue vers le Studio)
     faisait perdre tout le planning généré à chaque aller-retour. */
  const [savedPlan] = useState(() => loadPlan());
  const [sector, setSector] = useState(() => savedPlan?.sector || getBusiness().sector);
  const [durKey, setDurKey] = useState(savedPlan?.durKey || '1m');
  const [perWeek, setPerWeek] = useState(savedPlan?.perWeek ?? 3);
  const [plan, setPlan] = useState<PlanItem[] | null>(savedPlan?.items ?? null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState<Set<PlanItem>>(new Set());
  // Réseaux sélectionnés pour la multidiffusion, par publication du planning
  // (clé = id de l'item). Par défaut : tous les réseaux connectés parmi
  // ceux que les piliers couvrent, sinon le réseau suggéré par le pilier.
  const [netSel, setNetSel] = useState<Record<string, string[]>>({});
  const connectedPlanNetworks = useMemo(() => PLAN_NETWORKS.filter(isConnected), [isConnected]);

  // Persiste le plan à chaque évolution (génération, nouveau sujet, brouillon).
  useEffect(() => {
    if (plan && plan.length) savePlan({ items: plan, sector, durKey, perWeek });
  }, [plan, sector, durKey, perWeek]);

  /* Sujets déjà programmés — dérivé du calendrier RÉEL via le planKey posé à
     la programmation, jamais d'un drapeau coché à la main : supprimer la
     publication du calendrier rouvre automatiquement le sujet dans le plan. */
  const scheduledKeys = useMemo(
    () => new Set(scheduled.map((s) => s.planKey).filter(Boolean)),
    [scheduled],
  );

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
    /* Régénérer remplace le plan courant, jusque-là écrasé sans prévenir. Les
       publications déjà programmées restent au calendrier (données réelles),
       mais les brouillons rédigés et le lien plan→calendrier seraient perdus. */
    if (plan && plan.length && !window.confirm('Remplacer le planning actuel ? Les publications déjà programmées restent au calendrier.')) return;
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

  /* ---------- vue calendrier (grille mensuelle) ----------
     Le planning s'affichait en liste alors que l'écran promet « votre
     calendrier » : une liste ne montre ni les jours vides, ni le rythme réel
     des publications. La grille reprend les codes d'un agenda (mois entier,
     semaine du lundi au dimanche, pastilles cliquables). */

  // Mois couverts par le plan, dans l'ordre chronologique : { ym, label }.
  const planMonths = useMemo(() => {
    if (!plan) return [] as { ym: string; label: string }[];
    const seen = new Map<string, string>();
    for (const p of plan) {
      const ym = p.date.slice(0, 7);
      if (!seen.has(ym)) seen.set(ym, p.monthLabel);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, label]) => ({ ym, label }));
  }, [plan]);

  // Indice du mois affiché ; borné quand le plan est régénéré plus court.
  const [monthIdx, setMonthIdx] = useState(0);
  const safeMonthIdx = Math.min(monthIdx, Math.max(0, planMonths.length - 1));
  const currentMonth = planMonths[safeMonthIdx];

  // Publication sélectionnée dans la grille → panneau de détail sous le calendrier.
  const [selected, setSelected] = useState<{ p: PlanItem; i: number } | null>(null);
  // La liste reste accessible : elle sert à parcourir tous les sujets d'affilée.
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  /* Cellules du mois affiché : semaines complètes du lundi au dimanche, avec
     les jours des mois voisins en retrait pour ne pas casser la grille. */
  const monthCells = useMemo(() => {
    if (!currentMonth || !plan) return [];
    const [y, m] = currentMonth.ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    // getDay : 0 = dimanche. On décale pour une semaine commençant lundi.
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(y, m - 1, 1 - lead);
    const todayIso = new Date().toISOString().slice(0, 10);

    const byDate = new Map<string, { p: PlanItem; i: number }[]>();
    plan.forEach((p, i) => {
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      byDate.get(p.date)!.push({ p, i });
    });

    // 6 semaines : hauteur constante d'un mois à l'autre, comme un agenda.
    return Array.from({ length: 42 }, (_, k) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
      const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        iso: dIso,
        day: d.getDate(),
        outside: d.getMonth() !== m - 1,
        today: dIso === todayIso,
        items: byDate.get(dIso) || [],
      };
    });
  }, [currentMonth, plan]);

  // Répartition par pilier (preuve d'équilibre éditorial).
  const pillarDist = useMemo(() => {
    if (!plan) return [];
    const c: Record<string, number> = {};
    for (const p of plan) c[p.pillarKey] = (c[p.pillarKey] || 0) + 1;
    return PILLARS.filter((pl) => c[pl.key]).map((pl) => ({ ...pl, n: c[pl.key] }));
  }, [plan]);

  // Transforme le sujet en brouillon AIDA (Attention · Intérêt · Désir · Action + CTA).
  const aidaFor = (p: PlanItem) => { const b = getBusiness(); return buildAidaPost(p, { sector: sector.trim() || b.sector, name: b.name, city: b.city }); };

  /* Rédige le post À PARTIR du sujet du planning.

     buildAidaPost n'injecte le sujet que dans l'accroche : tout le corps vient
     de banques de phrases indexées sur le pilier et le secteur, sans lien avec
     le sujet. Un sujet « choisir sa farine bio » produisait ainsi un texte
     parlant de montée en compétences et de places limitées. Le gabarit ne sert
     donc plus que de repli quand l'IA est indisponible — et on le dit. */
  const [composing, setComposing] = useState<PlanItem | null>(null);

  /* Rédaction partagée par « Rédiger le post » et « Programmer » : les deux
     produisaient le même texte de gabarit hors sujet. Renvoie aussi la
     provenance, pour dire honnêtement quand c'est un brouillon type. */
  const writePost = async (p: PlanItem): Promise<{ text: string; ai: boolean; reason?: string }> => {
    try {
      const sec = sector.trim() || getBusiness().sector;
      const res = await generatePost(p.idea, {
        ...buildCtx(sec),
        network: netLabel[p.network] || p.network,
        pillar: p.pillar,
      });
      const text = res.available ? (res.variants?.[0] || res.text || '') : '';
      if (text.trim()) return { text: text.trim(), ai: true };
      return { text: aidaFor(p), ai: false, reason: res.reason || 'erreur' };
    } catch (e) {
      return { text: aidaFor(p), ai: false, reason: String((e as Error).message || e) };
    }
  };

  const compose = async (p: PlanItem) => {
    setComposing(p);
    const { text, ai, reason } = await writePost(p);
    /* Trace le fait réel qu'un brouillon a été rédigé pour ce sujet. Persisté
       immédiatement (et non via l'effet) : seedStudio navigue vers le Studio
       et démonte l'écran avant que l'effet de sauvegarde ne s'exécute. */
    const next = (plan ?? []).map((item) => (item.id === p.id ? { ...item, drafted: true } : item));
    setPlan(next);
    if (next.length) savePlan({ items: next, sector, durKey, perWeek });
    seedStudio(text);
    setComposing(null);
    showToast(ai ? UI.check : UI.wand, ai
      ? 'Post rédigé sur ce sujet — ouvrez le Studio pour l’ajuster'
      : `IA indisponible (${reason}) — brouillon type à personnaliser.`);
  };

  /* Identité par p.id, plus jamais par index de rendu : l'index était local au
     mois dans la liste mais global dans la grille, si bien que le même sujet
     portait deux identités selon la vue — la sélection de réseaux divergeait. */
  // Réseaux effectivement sélectionnés pour une publication : ceux choisis
  // manuellement, sinon tous les réseaux connectés couverts par le planning,
  // sinon (rien de connecté) le réseau suggéré par le pilier — jamais vide.
  const netsFor = (p: PlanItem): string[] => netSel[p.id] ?? (connectedPlanNetworks.length ? connectedPlanNetworks : [p.network]);
  const toggleNet = (p: PlanItem, id: string) => {
    const cur = netsFor(p);
    const next = cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id];
    if (!next.length) return; // toujours au moins un réseau sélectionné
    setNetSel((s) => ({ ...s, [p.id]: next }));
  };

  /* Programmer enregistrait lui aussi le texte de gabarit : la publication
     partait au calendrier avec un contenu sans rapport avec son sujet. */
  const schedule = async (p: PlanItem) => {
    // Déjà programmée : un second clic créerait un doublon au calendrier.
    if (scheduledKeys.has(p.id)) { showToast(UI.calendar, 'Ce sujet est déjà programmé — retrouvez-le dans le Calendrier.'); return; }
    setComposing(p);
    const { text, ai, reason } = await writePost(p);
    // planKey relie la publication à son sujet d'origine : c'est ce lien qui
    // marque le sujet « programmé » dans le plan.
    addToCalendar({ dateTime: defaultDateTime(p.date, 9), text, networks: netsFor(p), photoUrl: null, pillar: p.pillar, planKey: p.id });
    setComposing(null);
    // addToCalendar confirme déjà l'ajout : on ne signale ici que le repli,
    // sinon deux messages se superposeraient pour la même action.
    if (!ai) showToast(UI.wand, `Brouillon type utilisé (IA indisponible : ${reason}) — à personnaliser.`);
  };
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

          {view === 'calendar' && currentMonth && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h cal-head">
                <button
                  className="cal-nav" type="button" aria-label="Mois précédent"
                  disabled={safeMonthIdx === 0}
                  onClick={() => { setMonthIdx(safeMonthIdx - 1); setSelected(null); }}
                ><Icon name="arrowleft" /></button>
                <h3 style={{ textTransform: 'capitalize', minWidth: 150, textAlign: 'center' }}>{currentMonth.label}</h3>
                <button
                  className="cal-nav" type="button" aria-label="Mois suivant"
                  disabled={safeMonthIdx >= planMonths.length - 1}
                  onClick={() => { setMonthIdx(safeMonthIdx + 1); setSelected(null); }}
                ><Icon name="arrowright" /></button>
                <div style={{ flex: 1 }} />
                <div className="seg">
                  <button type="button" className="seg-b on">Calendrier</button>
                  <button type="button" className="seg-b" onClick={() => { setView('list'); setSelected(null); }}>Liste</button>
                </div>
              </div>

              <div className="cal-grid" role="grid" aria-label={`Planning de ${currentMonth.label}`}>
                {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d) => (
                  <div className="cal-dow" key={d}>{d}</div>
                ))}
                {monthCells.map((c) => (
                  <div key={c.iso} className={'cal-cell' + (c.outside ? ' out' : '') + (c.today ? ' today' : '')}>
                    <div className="cal-num">{c.day}</div>
                    {c.items.map(({ p, i }) => (
                      <button
                        key={p.id}
                        type="button"
                        className={'cal-ev' + (selected?.i === i ? ' sel' : '') + (scheduledKeys.has(p.id) ? ' done' : '')}
                        data-pillar={p.pillarKey}
                        title={`${p.pillar} · ${p.format}\n${p.idea}`}
                        onClick={() => setSelected(selected?.i === i ? null : { p, i })}
                      >
                        <span className="cal-ev-dot" />
                        <span className="cal-ev-txt">{p.idea || p.pillar}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Détail de la publication choisie : mêmes actions que la liste,
                  affichées sous la grille pour garder les cellules lisibles. */}
              {selected && (() => { const { p } = selected; return (
                <div className="pad cal-detail">
                  <div className="cal-detail-head">
                    <span className="cal-ev-dot" data-pillar={p.pillarKey} />
                    <strong style={{ textTransform: 'capitalize' }}>{p.label}</strong>
                    <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>· {p.pillar} · {p.format}</span>
                    {scheduledKeys.has(p.id)
                      ? <span className="plan-badge sched"><Icon name="check" />Programmée</span>
                      : p.drafted && <span className="plan-badge draft"><Icon name="edit" />Brouillon rédigé</span>}
                    <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(null)} aria-label="Fermer le détail">
                      <Icon name="close" />
                    </button>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.45, margin: '8px 0 10px' }}>{p.idea}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Diffuser sur :</span>
                    {(connectedPlanNetworks.length ? connectedPlanNetworks : [p.network]).map((id) => (
                      <button
                        key={id} type="button"
                        className={'plat-chip sm' + (netsFor(p).includes(id) ? ' on' : '')}
                        title={netLabel[id] || id}
                        onClick={() => toggleNet(p, id)}
                      >
                        <Brand name={id as BrandName} />{netLabel[id] || id}<RawIcon svg={UI.check} className="pc-x" />
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn acc sm" disabled={!!composing} onClick={() => compose(p)}>
                      {composing === p ? <span className="spin lt" /> : <Icon name="spark" />}
                      {composing === p ? 'Rédaction…' : p.drafted ? 'Rédiger à nouveau' : 'Rédiger le post'}
                    </button>
                    {scheduledKeys.has(p.id)
                      ? <button className="btn outline sm" onClick={() => show('calendar')}><Icon name="check" />Voir au calendrier</button>
                      : <button className="btn outline sm" disabled={!!composing} onClick={() => schedule(p)}><Icon name="clock" />Programmer</button>}
                    <button className="btn ghost sm" onClick={() => copyIdea(p)}><Icon name="edit" />Copier</button>
                    <button className="btn ghost sm" disabled={regenBusy.has(p)} onClick={() => regenerateOne(p)}>
                      {regenBusy.has(p) ? <span className="spin lt" /> : <RawIcon svg={UI.sparkles2} />}Nouvelle idée
                    </button>
                  </div>
                </div>
              ); })()}
            </div>
          )}

          {view === 'list' && (
            <div className="card-h" style={{ marginTop: 16, border: '1px solid var(--line)', borderRadius: 'var(--r-card) var(--r-card) 0 0', borderBottom: 'none' }}>
              <div className="sub">Vue liste</div>
              <div style={{ flex: 1 }} />
              <div className="seg">
                <button type="button" className="seg-b" onClick={() => setView('calendar')}>Calendrier</button>
                <button type="button" className="seg-b on">Liste</button>
              </div>
            </div>
          )}

          {view === 'list' && byMonth.map(([month, posts]) => (
            <div className="card" style={{ marginTop: 16 }} key={month}>
              <div className="card-h">
                <h3 style={{ textTransform: 'capitalize' }}>{month}</h3>
                <div className="sub">{posts.length} publication{posts.length > 1 ? 's' : ''}</div>
              </div>
              <div className="pad" style={{ display: 'grid', gap: 10 }}>
                {posts.map((p) => (
                  <div key={p.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas-soft)' }}>
                    <div style={{ minWidth: 92, fontSize: 12.5, color: 'var(--tx-2)', fontWeight: 600, textTransform: 'capitalize', paddingTop: 2 }}>{p.label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--acc)' }}>
                          <RawIcon svg={UI.dot} style={{ width: 12, height: 12, display: 'inline-grid' }} />{p.pillar}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>· {p.format}</span>
                        {scheduledKeys.has(p.id)
                          ? <span className="plan-badge sched"><Icon name="check" />Programmée</span>
                          : p.drafted && <span className="plan-badge draft"><Icon name="edit" />Brouillon rédigé</span>}
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.45, marginBottom: 8 }}>{p.idea}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Diffuser sur :</span>
                        {(connectedPlanNetworks.length ? connectedPlanNetworks : [p.network]).map((id) => (
                          <button
                            key={id} type="button"
                            className={'plat-chip sm' + (netsFor(p).includes(id) ? ' on' : '')}
                            title={netLabel[id] || id}
                            onClick={() => toggleNet(p, id)}
                          >
                            <Brand name={id as BrandName} />{netLabel[id] || id}<RawIcon svg={UI.check} className="pc-x" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button className="btn acc sm" title="Rédiger ce post par IA dans le Studio" disabled={!!composing} onClick={() => compose(p)}>
                        {composing === p ? <span className="spin lt" /> : <Icon name="spark" />}
                        {composing === p ? 'Rédaction…' : p.drafted ? 'Rédiger à nouveau' : 'Rédiger le post'}
                      </button>
                      {scheduledKeys.has(p.id) ? (
                        <button className="btn outline sm" title="Ce sujet est déjà programmé" onClick={() => show('calendar')}>
                          <Icon name="check" />Voir au calendrier
                        </button>
                      ) : (
                        <button className="btn outline sm" title="Ajouter au calendrier de programmation, sur tous les réseaux sélectionnés" disabled={!!composing} onClick={() => schedule(p)}>
                          <Icon name="clock" />Programmer
                        </button>
                      )}
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

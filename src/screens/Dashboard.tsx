import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useConnections } from '../state/ConnectionsContext';
import { useCalendar } from '../state/CalendarContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { FMT, UNIT } from '../lib/format';
import { countUp } from '../lib/countup';
import { netName } from '../lib/networks';
import { CATALOG, SRC, loadKpiState, saveKpiState, type KpiDef, type KpiState } from '../lib/kpi';
import { KpiModal } from '../components/KpiModal';
import { useTilt3d } from '../lib/useTilt3d';
import { aggregateMeta, engagementSeries, type MetaSeries } from '../lib/meta';

const fmtVal = (fmt: string, v: number) => (FMT[fmt] || FMT.int)(v);

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- KPI card ---------- */
function KpiCard({ id, def, raw, removing, onRemove, i }: { id: string; def: KpiDef; raw: number; removing: boolean; onRemove: (id: string) => void; i: number }) {
  const valRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const s = SRC[def.src] || SRC.manual;
  const tr = def.trend || { dir: 'neutral', val: '' };
  const unit = UNIT[def.fmt] ? <span className="ku">{UNIT[def.fmt]}</span> : null;
  const pct = def.target ? Math.min(100, (raw / def.target) * 100) : 0;

  useEffect(() => {
    countUp(valRef.current, raw, { fmt: (v) => fmtVal(def.fmt, v), dur: 850 });
    if (barRef.current) requestAnimationFrame(() => { if (barRef.current) barRef.current.style.width = pct + '%'; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, pct]);

  const pill = tr.dir === 'up'
    ? <span className="pill up"><RawIcon svg={UI.arrowup} />{tr.val}</span>
    : tr.dir === 'down'
      ? <span className="pill down"><RawIcon svg={UI.arrowdown} />{tr.val}</span>
      : <span className="pill neutral">{tr.val}</span>;

  return (
    <div className={'kpi kpi-in' + (removing ? ' kpi-out' : '')} data-kpi={id} style={{ '--i': i } as React.CSSProperties}>
      <button className="kpi-rm" title="Retirer" aria-label="Retirer cet indicateur" onClick={(e) => { e.stopPropagation(); onRemove(id); }}><Icon name="close" /></button>
      <div className="kl"><RawIcon svg={UI[def.icon as keyof typeof UI] || UI.target} />{def.label}</div>
      <div className="kv"><span className="kv-n" ref={valRef}>0</span>{unit}</div>
      <div className="kf">{pill}{tr.since && <span className="since">{tr.since}</span>}<span className="ksrc"><span dangerouslySetInnerHTML={{ __html: s.glyph }} />{s.label}</span></div>
      {def.target ? (
        <div className="ktarget">
          <div className="kt-h"><span>Objectif</span><b>{fmtVal(def.fmt, def.target)}</b></div>
          <div className="kt-bar"><i ref={barRef as React.RefObject<HTMLElement>} style={{ width: 0 }} /></div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- suggestion card ---------- */
function SugCard({ id, onAdd, i }: { id: string; onAdd: (id: string) => void; i: number }) {
  const d = CATALOG[id];
  const s = SRC[d.src] || SRC.manual;
  const tr = d.trend || { dir: 'up', val: '' };
  const val = fmtVal(d.fmt, d.val) + (UNIT[d.fmt] || '');
  const trCls = tr.dir === 'down' ? 'down' : 'up';
  const tiltRef = useTilt3d<HTMLDivElement>(5);
  return (
    <div className="sug-card tilt rise-in" ref={tiltRef} style={{ '--i': i } as React.CSSProperties}>
      <div className="sug-top">
        <div className="sg-ic"><RawIcon svg={UI[d.icon as keyof typeof UI] || UI.target} /></div>
        <div className="sg-t">
          <div className="sg-n">{d.label}</div>
          <div className="sg-src"><span dangerouslySetInnerHTML={{ __html: s.glyph }} />{d.why || s.label}</div>
        </div>
        {d.suggested && <span className="sug-badge"><RawIcon svg={UI.sparkles2} />Suggéré</span>}
      </div>
      <div className="sug-mid"><span className="sg-v">{val}</span>{tr.val && <span className={'sg-tr ' + trCls}>{tr.val}</span>}</div>
      <button className="btn outline sm sg-add" onClick={() => onAdd(id)}><RawIcon svg={UI.plus} />Ajouter au tableau</button>
    </div>
  );
}

/* ---------- chart ---------- */
function smooth(pts: number[][]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function Chart({ series }: { series: MetaSeries | null }) {
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const W = 620, H = 200, pad = 6;
  // Real engagement series when posts are available; flat baseline otherwise (no invented data).
  const raw = series && series.values.length ? series.values : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const peak = Math.max(...raw, 0);
  const max = peak > 0 ? peak * 1.15 : 105;
  const n = raw.length;
  const pts = raw.map((v, i) => [pad + (i * (W - 2 * pad)) / (n - 1), H - pad - (v / max) * (H - 2 * pad)]);
  const line = smooth(pts);
  const area = line + ` L ${pts[n - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;

  useEffect(() => {
    const path = lineRef.current;
    if (path) {
      const L = path.getTotalLength();
      path.style.strokeDasharray = String(L);
      path.style.strokeDashoffset = String(L);
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset 1.3s var(--ease,ease)';
      path.style.strokeDashoffset = '0';
    }
    const a = areaRef.current;
    if (a) { a.style.opacity = '0'; a.getBoundingClientRect(); a.style.transition = 'opacity .9s ease .3s'; a.style.opacity = '1'; }
  }, []);

  return (
    <svg className="chart-svg" viewBox="0 0 620 200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="area-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(91,117,80,.30)" />
          <stop offset="100%" stopColor="rgba(91,117,80,0)" />
        </linearGradient>
      </defs>
      <path ref={areaRef} d={area} fill="url(#area-g)" opacity="0" />
      <path ref={lineRef} d={line} fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Dashboard() {
  const { show } = useEff();
  const { totalReach, metaStats } = useConnections();
  const { scheduled } = useCalendar();
  const [state, setState] = useState<KpiState>(() => loadKpiState());
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState(false);

  const upcomingPosts = scheduled.filter((p) => p.status === 'scheduled').slice(0, 4);

  // Real Meta aggregates (followers, engagement, posts…) — all derived, never invented.
  const agg = aggregateMeta(metaStats);
  const series = engagementSeries(metaStats);

  const update = (next: KpiState) => { setState(next); saveKpiState(next); };
  const def = (id: string): KpiDef | undefined => CATALOG[id] || state.custom[id];
  const rawVal = (d: KpiDef): number => {
    switch (d.live) {
      case 'reach':
      case 'followers': return totalReach;
      case 'engagementRate': return agg.engagementRate ?? 0;
      case 'totalEngagement': return agg.totalEngagement;
      case 'reachInsights': return agg.reach ?? 0;
      case 'postsMonth': return agg.postsMonth;
      default: return d.val;
    }
  };

  const addKpi = (id: string, customDef?: KpiDef) => {
    const custom = customDef ? { ...state.custom, [id]: customDef } : state.custom;
    const board = state.board.includes(id) ? state.board : [...state.board, id];
    update({ ...state, custom, board });
  };
  const removeKpi = (id: string) => {
    setRemoving((r) => ({ ...r, [id]: true }));
    setTimeout(() => {
      setRemoving((r) => { const n = { ...r }; delete n[id]; return n; });
      setState((s) => { const next = { ...s, board: s.board.filter((x) => x !== id) }; saveKpiState(next); return next; });
    }, 220);
  };
  const toggleSuggest = () => update({ ...state, suggestOpen: !state.suggestOpen });

  const sugIds = Object.keys(CATALOG).filter((id) => !state.board.includes(id));
  sugIds.sort((a, b) => (CATALOG[b].suggested ? 1 : 0) - (CATALOG[a].suggested ? 1 : 0));
  const sugList = sugIds.slice(0, 6);

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Vue d’ensemble</div>
          <h1>Bonjour Jesse 👋 — votre tableau de bord</h1>
          <p>Connectez vos réseaux, importez votre base clients et créez vos campagnes : vos indicateurs se rempliront avec vos vraies données.</p>
        </div>
        <div className="ph-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn outline" onClick={() => setModal(true)}><Icon name="plus" />Créer un KPI</button>
          <button className="btn acc" onClick={() => show('planning')}><span className="ic">✦</span>Générer le mois avec l’IA</button>
        </div>
      </div>

      {state.board.length === 0 ? (
        <div className="crm-empty" style={{ marginBottom: 16 }}>
          <div className="ce-ic"><Icon name="grid" /></div>
          <div className="ce-t">Aucun indicateur sur votre tableau de bord</div>
          <p>Ajoutez vos premiers KPI, ou piochez parmi les suggestions basées sur votre activité ci-dessous.</p>
          <button className="btn acc" style={{ marginTop: 14 }} onClick={() => setModal(true)}><Icon name="plus" />Ajouter un KPI</button>
        </div>
      ) : (
        <div className="kpi-board">
          {state.board.map((id, i) => {
            const d = def(id);
            if (!d) return null;
            return <KpiCard key={id} id={id} def={d} raw={rawVal(d)} removing={!!removing[id]} onRemove={removeKpi} i={i} />;
          })}
          <div className="kpi add-tile" onClick={() => setModal(true)}>
            <div className="at-ic"><Icon name="plus" /></div>
            <div className="at-t">Ajouter un KPI</div>
          </div>
        </div>
      )}

      <div>
        <div className="kpi-suggest">
          <div className="ks-head">
            <div className="ks-ic"><Icon name="wand" /></div>
            <div><h3>Suggestions pour votre activité</h3><p>D’après vos réseaux connectés, votre fiche Google et votre base clients.</p></div>
            <button className="btn ghost sm ks-toggle" onClick={toggleSuggest}>{state.suggestOpen ? 'Masquer' : 'Afficher'}</button>
          </div>
          {state.suggestOpen && (
            sugList.length
              ? <div className="ks-row">{sugList.map((id, i) => <SugCard key={id} id={id} onAdd={addKpi} i={i} />)}</div>
              : <div className="ks-empty">Tous les indicateurs suggérés sont déjà sur votre tableau de bord. 🎉</div>
          )}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-h">
            <div><h3>Performance</h3><div className="sub">{series ? `Interactions par publication · ${series.from} → ${series.to}` : 'Interactions des publications récentes'}</div></div>
            <div className="chart-legend">
              <span className="lg"><i style={{ background: 'var(--acc)' }} />Interactions</span>
              {series
                ? <span className="chip"><RawIcon svg={UI.dot} />{FMT.int(series.total)} au total</span>
                : <span className="chip"><RawIcon svg={UI.dot} />En attente de données</span>}
            </div>
          </div>
          <div className="chart-wrap">
            <Chart key={series ? series.total + '-' + series.from : 'empty'} series={series} />
            <div className="chart-x">
              {series
                ? <><span>{series.labels[0]}</span><span>{series.labels[1]}</span><span>{series.labels[2]}</span></>
                : <><span>—</span><span>—</span><span>—</span></>}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h"><div><h3>Prochains posts</h3></div><button className="btn ghost sm" onClick={() => show('calendar')}>Tout voir</button></div>
            <div>
              {upcomingPosts.length === 0 ? (
                <div className="pad" style={{ color: 'var(--tx-3)', fontSize: 13.5, textAlign: 'center', padding: '28px 24px' }}>
                  Aucun post programmé. Créez-en un depuis le <b style={{ color: 'var(--tx-2)' }}>Studio</b>.
                </div>
              ) : upcomingPosts.map((p) => (
                <div className="post" key={p.id}>
                  <div className="thumb">{p.photoUrl ? <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Icon name="image" />}</div>
                  <div className="pmeta">
                    <div className="pt">{p.text.slice(0, 60)}{p.text.length > 60 ? '…' : ''}</div>
                    <div className="pl">{p.networks[0] && <Brand name={p.networks[0] as BrandName} />}<span>{p.networks.map(netName).join(', ') || 'Aucun réseau'}</span><span>·</span><span>{fmtWhen(p.dateTime)}</span></div>
                  </div>
                  <span className="tag sched">Programmé</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal && <KpiModal onCreate={addKpi} onClose={() => setModal(false)} />}
    </section>
  );
}

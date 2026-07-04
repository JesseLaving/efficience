import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useConnections } from '../state/ConnectionsContext';
import { useCalendar } from '../state/CalendarContext';
import { useDrafts } from '../state/DraftsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { showToast } from '../lib/toast';
import { netName, PUBLISH_STATUS, PUBLISH_STATUS_REASON } from '../lib/networks';
import { getBusiness } from '../lib/business';
import { generatePost, improvePost, generateHashtags, sampleRecentCaptions } from '../lib/ai';
import { TONES, loadStrategy } from '../lib/strategy';
import { PublishPanel } from '../components/PublishPanel';
import { VisualGenerator } from '../components/VisualGenerator';
import type { Draft } from '../lib/drafts';

/* ig action glyphs */
const A = {
  heart: UI.heart,
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 20.5l1.5-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3 11 14M22 3l-7 19-4-8-8-4z"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
};

interface Spec { cap: number; tags?: number; ratios: string[]; img: string; video: string; rec: string; }
type ComposeType = 'post' | 'story' | 'email';

const SPECS: Record<'post' | 'story', Record<string, Spec>> = {
  post: {
    instagram: { cap: 2200, tags: 30, ratios: ['1:1', '4:5', '1.91:1'], img: 'JPG/PNG · 30 Mo', video: '3 s–60 min', rec: '1080×1350' },
    facebook: { cap: 63206, ratios: ['1:1', '4:5', '1.91:1'], img: '≤ 30 Mo', video: '≤ 240 min', rec: '1200×1500' },
    linkedin: { cap: 3000, ratios: ['1:1', '1.91:1', '4:5'], img: '≤ 100 Mo', video: '≤ 10 min', rec: '1200×1200' },
    x: { cap: 280, ratios: ['16:9', '1:1'], img: '≤ 5 Mo', video: '≤ 2 min 20', rec: '1600×900' },
    tiktok: { cap: 2200, ratios: ['9:16'], img: '—', video: '3 s–10 min', rec: '1080×1920' },
    youtube: { cap: 5000, ratios: ['16:9'], img: 'miniature', video: '≤ 12 h', rec: '1920×1080' },
    pinterest: { cap: 500, ratios: ['2:3', '1:1'], img: '≤ 20 Mo', video: '≤ 15 min', rec: '1000×1500' },
    google: { cap: 1500, ratios: ['1.91:1', '1:1'], img: '≤ 5 Mo', video: '—', rec: '1200×900' },
  },
  story: {
    instagram: { cap: 0, ratios: ['9:16'], img: '≤ 30 Mo', video: '≤ 60 s', rec: '1080×1920' },
    facebook: { cap: 0, ratios: ['9:16'], img: '≤ 30 Mo', video: '≤ 60 s', rec: '1080×1920' },
    tiktok: { cap: 2200, ratios: ['9:16'], img: '—', video: '3 s–10 min', rec: '1080×1920' },
  },
};

// No real social handle is known — display the brand name for every preview.
const handleFor = (_id: string): string => getBusiness().name;

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const escapeTags = (s: string) => escapeHtml(s).replace(/#([\wàâäéèêëîïôöùûüç-]+)/gi, '<span class="tags">#$1</span>');

/* "2026-07-02T14:00" — l'heure pleine suivante, pour préremplir le champ de
   programmation avec une valeur plausible plutôt qu'un champ vide. */
function nextHourIso(): string {
  const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

interface Media { url: string; kind: 'image' | 'video'; name: string; size: number; }

function ratioBox(r: string) {
  const [w, h] = r.split(':').map(Number);
  const mx = 14, s = mx / Math.max(w, h);
  return <span className="rbox" style={{ width: (w * s).toFixed(1) + 'px', height: (h * s).toFixed(1) + 'px' }} />;
}

function FlashBtn({ className, label, flash, onClick }: { className: string; label: React.ReactNode; flash: string; onClick?: () => void }) {
  const [txt, setTxt] = useState<React.ReactNode>(label);
  return <button className={className} onClick={() => { onClick?.(); setTxt(flash); setTimeout(() => setTxt(label), 1200); }}>{txt}</button>;
}

export function Studio() {
  const { studioSeed, clearStudioSeed } = useEff();
  const { isConnected, metaStats, tiktokVideos } = useConnections();
  const { addToCalendar } = useCalendar();
  const [type, setType] = useState<ComposeType>('post');
  const [text, setText] = useState(studioSeed || '');

  // Le Studio peut être ouvert pré-rempli depuis le Planning éditorial.
  // On consomme le seed une seule fois (le texte reste éditable ensuite).
  useEffect(() => {
    if (studioSeed) clearStudioSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ratio, setRatio] = useState('4:5');
  const [media, setMedia] = useState<Media | null>(null);
  const [subject, setSubject] = useState('');
  const [pre, setPre] = useState('');
  const [body, setBody] = useState('');

  const availablePlatforms = (t: ComposeType): string[] => {
    if (t === 'email') return [];
    const keys = Object.keys(SPECS[t]);
    const conn = keys.filter((k) => isConnected(k));
    return conn.length ? conn : keys;
  };

  const initSel = (t: ComposeType) => {
    const av = availablePlatforms(t);
    const s = av.slice(0, Math.min(av.length, 3));
    const a = s[0] || av[0] || null;
    let r = ratio;
    if (a) { const rs = SPECS[t === 'email' ? 'post' : t][a].ratios; if (!rs.includes(r)) r = rs[0]; }
    return { sel: s, active: a, ratio: r };
  };

  const [{ sel, active }, setSelState] = useState(() => { const x = initSel('post'); return { sel: x.sel, active: x.active }; });

  const switchType = (t: ComposeType) => {
    setType(t);
    const x = initSel(t);
    setSelState({ sel: x.sel, active: x.active });
    setRatio(x.ratio);
  };

  const spec = type !== 'email' && active ? SPECS[type][active] : null;
  const curLimit = () => (type !== 'email' && active ? SPECS[type][active].cap : 0);

  const togglePlat = (id: string) => {
    let nextSel = sel.slice();
    const i = nextSel.indexOf(id);
    if (i >= 0) { if (nextSel.length > 1) nextSel.splice(i, 1); }
    else nextSel.push(id);
    let nextActive = active;
    if (!nextSel.includes(active!)) nextActive = nextSel[0];
    const rs = SPECS[type === 'email' ? 'post' : type][nextActive!].ratios;
    if (!rs.includes(ratio)) setRatio(rs[0]);
    setSelState({ sel: nextSel, active: nextActive });
  };
  const setActive = (id: string) => {
    const rs = SPECS[type === 'email' ? 'post' : type][id].ratios;
    if (!rs.includes(ratio)) setRatio(rs[0]);
    setSelState({ sel, active: id });
  };

  const loadMedia = (f: File) => {
    const kind: Media['kind'] = f.type.startsWith('video') ? 'video' : 'image';
    const rd = new FileReader();
    rd.onload = () => { setMedia({ url: rd.result as string, kind, name: f.name, size: f.size }); setPublicImageUrl(null); };
    rd.readAsDataURL(f);
  };

  const insertEmoji = () => setText((t) => t + ' ✦');

  // Rédaction / amélioration / hashtags par IA (Gemini en priorité), avec
  // repli propre si aucune clé n'est configurée.
  const [aiBusy, setAiBusy] = useState<null | 'post' | 'improve' | 'hashtags'>(null);
  const [tone, setTone] = useState<string | null>(() => loadStrategy()?.tone || null);
  const [variants, setVariants] = useState<string[] | null>(null);
  const runAi = async (mode: 'post' | 'improve') => {
    const b = getBusiness();
    const brief = text.trim();
    if (mode === 'improve' && !brief) { showToast(UI.close, 'Écrivez d’abord un texte à améliorer.'); return; }
    setAiBusy(mode);
    setVariants(null);
    try {
      const strat = loadStrategy();
      const ctx = {
        name: b.name, sector: b.sector, city: b.city, network: active ? netName(active) : undefined,
        tone: tone || undefined, maxLength: curLimit() || undefined,
        audience: strat?.audience || undefined, products: strat?.products || undefined,
        goal: strat?.goal || undefined, competitors: strat?.competitors || undefined,
        recentPosts: sampleRecentCaptions(metaStats, tiktokVideos),
      };
      const res = mode === 'improve'
        ? await improvePost(brief, ctx)
        : await generatePost(brief || `Une publication pour ${b.name} — secteur ${b.sector}`, ctx);
      if (res.available && res.text) {
        if (mode === 'post' && res.variants && res.variants.length > 1) {
          setVariants(res.variants);
          showToast(UI.check, `${res.variants.length} versions proposées par IA`);
        } else {
          setText(res.text);
          showToast(UI.check, mode === 'improve' ? 'Texte amélioré par IA' : 'Texte rédigé par IA');
        }
      } else {
        showToast(UI.close, `IA indisponible : ${res.reason || 'erreur'}`);
      }
    } catch (e) {
      showToast(UI.close, `IA : ${String((e as Error).message || e)}`);
    } finally { setAiBusy(null); }
  };
  const pickVariant = (v: string) => { setText(v); setVariants(null); };

  const runHashtags = async () => {
    const brief = text.trim();
    if (!brief) { showToast(UI.close, 'Écrivez d’abord un texte pour générer des hashtags pertinents.'); return; }
    setAiBusy('hashtags');
    try {
      const b = getBusiness();
      const ctx = { name: b.name, sector: b.sector, network: active ? netName(active) : undefined };
      const res = await generateHashtags(brief, ctx);
      if (res.available && res.text) {
        setText((t) => t + ' ' + res.text!.trim());
        showToast(UI.check, 'Hashtags ajoutés par IA');
      } else {
        showToast(UI.close, `IA indisponible : ${res.reason || 'erreur'}`);
      }
    } catch (e) {
      showToast(UI.close, `IA : ${String((e as Error).message || e)}`);
    } finally { setAiBusy(null); }
  };

  const finish = (label: string) => {
    const where = type === 'email' ? 'e-mailing' : sel.map(netName).join(', ');
    showToast(UI.calendar, `${label} · ${where}`);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragMedia, setDragMedia] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);
  const [publicImageUrl, setPublicImageUrl] = useState<string | null>(null);
  const anyConnected = sel.some((id) => isConnected(id));

  // Programmation au calendrier — même file que le Planning éditorial
  // (src/state/CalendarContext.tsx), pour que "Publier" / "Auto-publier"
  // fonctionnent à l'identique quelle que soit l'origine du post.
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState(() => nextHourIso());
  const schedule = () => {
    if (!text.trim() || !sel.length) return;
    addToCalendar({ dateTime: schedAt, text, networks: sel, photoUrl: publicImageUrl, pillar: null });
    setSchedOpen(false);
  };

  // Brouillons — persistés (src/lib/drafts.ts), synchronisés par espace comme
  // le reste de l'état. Ne stocke que l'URL publique d'un visuel éventuel
  // (VisualGenerator/Pexels) : un fichier local glissé-déposé n'a pas d'URL
  // et n'est donc pas restauré au chargement d'un brouillon.
  const { drafts, saveDraft, deleteDraft } = useDrafts();
  const [draftsOpen, setDraftsOpen] = useState(false);
  const saveDraftNow = () => {
    const hasContent = type === 'email' ? (subject.trim() || body.trim()) : text.trim();
    if (!hasContent) { showToast(UI.close, 'Rien à enregistrer pour le moment.'); return; }
    const d: Draft = {
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type, text: type === 'email' ? body : text,
      networks: type === 'email' ? [] : sel, ratio, photoUrl: publicImageUrl,
      subject: type === 'email' ? subject : undefined,
      preheader: type === 'email' ? pre : undefined,
      savedAt: Date.now(),
    };
    saveDraft(d);
    showToast(UI.check, 'Brouillon enregistré');
  };
  const loadDraft = (d: Draft) => {
    setType(d.type);
    if (d.type === 'email') {
      setSubject(d.subject || ''); setPre(d.preheader || ''); setBody(d.text);
    } else {
      setText(d.text);
      const known = Object.keys(SPECS[d.type]);
      const restored = d.networks.filter((n) => known.includes(n));
      const nextSel = restored.length ? restored : initSel(d.type).sel;
      const nextActive = nextSel[0] || null;
      setSelState({ sel: nextSel, active: nextActive });
      const rs = nextActive ? SPECS[d.type][nextActive].ratios : [];
      setRatio(rs.includes(d.ratio) ? d.ratio : (rs[0] || d.ratio));
      if (d.photoUrl) { setMedia({ url: d.photoUrl, kind: 'image', name: 'brouillon.jpg', size: 0 }); setPublicImageUrl(d.photoUrl); }
      else { setMedia(null); setPublicImageUrl(null); }
    }
    setDraftsOpen(false);
    showToast(UI.check, 'Brouillon chargé');
  };

  return (
    <section className="screen show anim">
      <div className="page-head" style={{ marginBottom: 22 }}>
        <div>
          <div className="eyebrow">Studio · Création manuelle</div>
          <h1>Composez, au format de chaque réseau</h1>
          <p>Rédigez vos publications, stories et e-mails à la main. Efficience vérifie en direct les limites de texte et les formats visuels propres à chaque plateforme.</p>
        </div>
      </div>

      <div className="ce-sec" style={{ border: 'none', padding: '0 0 18px' }}>
        <div className="switch">
          <button className={'switch-btn' + (type === 'post' ? ' on' : '')} onClick={() => switchType('post')}><Icon name="image" />Publication</button>
          <button className={'switch-btn' + (type === 'story' ? ' on' : '')} onClick={() => switchType('story')}><Icon name="sparkles2" />Story</button>
          <button className={'switch-btn' + (type === 'email' ? ' on' : '')} onClick={() => switchType('email')}><Icon name="mail" />E-mailing</button>
        </div>
      </div>

      <div className="cmp">
        <div className="cmp-edit">
          {type === 'email' ? (
            <EmailEditor subject={subject} setSubject={setSubject} pre={pre} setPre={setPre} body={body} setBody={setBody} finish={finish} onSaveDraft={saveDraftNow} />
          ) : (
            <>
              <div className="ce-sec">
                <label className="field-lbl">Plateformes {type === 'story' ? '(stories)' : ''}</label>
                <div className="plat-row">
                  {availablePlatforms(type).map((id) => {
                    const status = PUBLISH_STATUS[id];
                    const pending = status && status !== 'ready';
                    return (
                      <button
                        key={id} className={'plat-chip' + (sel.includes(id) ? ' on' : '')} onClick={() => togglePlat(id)}
                        title={pending ? PUBLISH_STATUS_REASON[status] : undefined}
                      >
                        <Brand name={id as BrandName} />{netName(id)}
                        {pending && <span className="plat-pending-dot" aria-label={PUBLISH_STATUS_REASON[status]} />}
                        <RawIcon svg={UI.check} className="pc-x" />
                      </button>
                    );
                  })}
                </div>
                {sel.some((id) => PUBLISH_STATUS[id] && PUBLISH_STATUS[id] !== 'ready') && (
                  <div className="counter" style={{ marginTop: 8, color: 'var(--tx-3)' }}>
                    <RawIcon svg={UI.warning} style={{ width: 12, height: 12, display: 'inline-grid', verticalAlign: -1.5, marginRight: 4 }} />
                    {sel.filter((id) => PUBLISH_STATUS[id] && PUBLISH_STATUS[id] !== 'ready').map((id) => `${netName(id)} : ${PUBLISH_STATUS_REASON[PUBLISH_STATUS[id]]}`).join(' · ')}
                  </div>
                )}
              </div>

              <div className="ce-sec">
                <div className="atab-row">
                  {sel.length ? sel.map((id) => (
                    <button key={id} className={'atab' + (id === active ? ' on' : '')} onClick={() => setActive(id)}><Brand name={id as BrandName} />{netName(id)}</button>
                  )) : <span style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Sélectionnez au moins une plateforme.</span>}
                </div>
                <div className="cmp-text">
                  <div className="ai-tone-row">
                    <span className="ai-tone-lbl">Ton IA :</span>
                    {TONES.map((t) => (
                      <button
                        key={t} type="button" className={'ai-tone-chip' + (tone === t ? ' on' : '')}
                        onClick={() => setTone(tone === t ? null : t)}
                      >{t}</button>
                    ))}
                  </div>
                  <textarea className="inp" placeholder="Écrivez votre message…" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="counter-row">
                    <div>{(() => {
                      const lim = curLimit(), len = text.length;
                      if (!lim) return <div className="counter">Texte superposé · <b>optionnel</b></div>;
                      const pct = Math.min(100, (len / lim) * 100);
                      const st = len > lim ? 'over' : pct > 85 ? 'warn' : '';
                      return <>
                        <div className={'counter ' + st} style={{ marginBottom: 6 }}><b>{fr(len)}</b> / {fr(lim)} caractères {len > lim && <>· <span>{fr(len - lim)} en trop</span></>}</div>
                        <div className={'counter-bar ' + st} style={{ width: 200 }}><i style={{ width: pct + '%' }} /></div>
                      </>;
                    })()}</div>
                    <div className="cmp-tools">
                      <button title="Emoji" onClick={insertEmoji}>😊</button>
                      <button title="Générer des hashtags par IA" disabled={!!aiBusy} onClick={runHashtags}>{aiBusy === 'hashtags' ? <span className="spin lt" /> : <Icon name="tag" />}</button>
                      <button title="Rédiger par IA" disabled={!!aiBusy} onClick={() => runAi('post')}>{aiBusy === 'post' ? <span className="spin lt" /> : <Icon name="wand" />}</button>
                      <button title="Améliorer le texte par IA" disabled={!!aiBusy} onClick={() => runAi('improve')}>{aiBusy === 'improve' ? <span className="spin lt" /> : <Icon name="sparkles2" />}</button>
                    </div>
                  </div>
                  {variants && (
                    <div className="ai-variants">
                      <div className="ai-variants-lbl"><RawIcon svg={UI.sparkles2} style={{ width: 13, height: 13, display: 'inline-grid' }} />Choisissez une version</div>
                      {variants.map((v, i) => (
                        <div className="ai-variant" key={i}>
                          <div className="ai-variant-txt">{v}</div>
                          <button className="btn outline sm" onClick={() => pickVariant(v)}><Icon name="check" />Utiliser</button>
                        </div>
                      ))}
                      <button className="btn ghost sm" onClick={() => setVariants(null)}>Ignorer</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="ce-sec">
                <label className="field-lbl">Format du visuel — {netName(active || '')}</label>
                <div className="ratio-row">
                  {(spec?.ratios || []).map((r) => (
                    <button key={r} className={'ratio-chip' + (r === ratio ? ' on' : '')} onClick={() => setRatio(r)}>{ratioBox(r)}{r}</button>
                  ))}
                </div>
                <div className="spec-grid">
                  <div className="spec-row"><Icon name="image" /><div><div className="sr-l">Dimensions conseillées</div><div className="sr-v">{spec?.rec || '—'}</div></div></div>
                  <div className="spec-row"><Icon name="sheet" /><div><div className="sr-l">Image · Vidéo</div><div className="sr-v">{spec?.img || '—'} · {spec?.video || '—'}</div></div></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button className="btn outline sm" onClick={() => setVisualOpen(true)} title="Composer un visuel aux couleurs de votre marque">
                    <RawIcon svg={UI.sparkles2} />Générer un visuel de marque
                  </button>
                </div>
                <div>
                  {media ? (
                    <div className="media-has">
                      <div className="mh-thumb" style={media.kind === 'video' ? { display: 'grid', placeItems: 'center', color: 'var(--acc)' } : { backgroundImage: `url('${media.url}')` }}>
                        {media.kind === 'video' && <Icon name="play" style={{ width: 20, height: 20 }} />}
                      </div>
                      <div className="mh-i"><div className="mh-n">{media.name}</div><div className="mh-m">{media.kind === 'video' ? 'Vidéo' : 'Image'} · format {ratio} · {netName(active || '')}</div></div>
                      <button className="unlink-btn" title="Retirer" aria-label="Retirer" onClick={() => { setMedia(null); setPublicImageUrl(null); }}><Icon name="trash" /></button>
                    </div>
                  ) : (
                    <div className={'media-drop' + (dragMedia ? ' drag' : '')}
                      onClick={() => fileRef.current?.click()}
                      onDragEnter={(e) => { e.preventDefault(); setDragMedia(true); }}
                      onDragOver={(e) => { e.preventDefault(); setDragMedia(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setDragMedia(false); }}
                      onDrop={(e) => { e.preventDefault(); setDragMedia(false); const f = e.dataTransfer.files[0]; if (f) loadMedia(f); }}
                    >
                      <div className="md-ic"><Icon name="upload" /></div>
                      <div className="md-t">Déposez votre visuel</div>
                      <div className="md-s">Image ou vidéo · recadrée en {ratio} pour {netName(active || '')}</div>
                      <input type="file" ref={fileRef} accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadMedia(f); }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="ce-sec">
                <label className="field-lbl">Conformité par plateforme</label>
                <div className="compl">
                  {!sel.length ? <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Aucune plateforme sélectionnée.</div> : sel.map((id) => {
                    const s = SPECS[type][id], lim = s.cap, len = text.length;
                    const over = !!lim && len > lim;
                    const pct = lim ? Math.min(100, (len / lim) * 100) : 100;
                    return (
                      <div className="compl-row" key={id}>
                        <div className="cr-name"><Brand name={id as BrandName} />{netName(id)}</div>
                        <div className={'cr-bar' + (over ? ' over' : '')}><i style={{ width: pct + '%' }} /></div>
                        {!lim ? <span className="compl-st ok"><RawIcon svg={UI.check} />texte libre</span>
                          : over ? <span className="compl-st over"><RawIcon svg={UI.close} />−{fr(len - lim)}</span>
                            : <span className="compl-st ok"><RawIcon svg={UI.check} />{fr(lim - len)} restants</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {schedOpen && (
                <div className="ce-sec" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label className="field-lbl" style={{ margin: 0, flexShrink: 0 }}>Programmer pour</label>
                  <input type="datetime-local" className="inp" style={{ width: 220 }} value={schedAt} onChange={(e) => setSchedAt(e.target.value)} />
                  <button className="btn acc sm" disabled={!text.trim() || !sel.length} onClick={schedule}><Icon name="check" />Confirmer</button>
                  <button className="btn ghost sm" onClick={() => setSchedOpen(false)}>Annuler</button>
                </div>
              )}

              <div className="ce-sec" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn outline" onClick={saveDraftNow}>Enregistrer le brouillon</button>
                <div style={{ position: 'relative' }}>
                  <button className="btn outline" onClick={() => setDraftsOpen((v) => !v)} aria-expanded={draftsOpen}>
                    <Icon name="clipboard" />Brouillons{drafts.length > 0 ? ` (${drafts.length})` : ''}
                  </button>
                  {draftsOpen && (
                    <div className="notif-dropdown">
                      <div className="notif-head">Brouillons enregistrés</div>
                      {drafts.length === 0 ? (
                        <div className="notif-empty">Aucun brouillon pour l’instant.</div>
                      ) : (
                        <div className="notif-list">
                          {drafts.map((d) => (
                            <div className="notif-item" key={d.id} style={{ alignItems: 'center' }}>
                              <button type="button" className="notif-body" style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => loadDraft(d)}>
                                <div className="notif-text">{(d.type === 'email' ? d.subject : d.text)?.slice(0, 70) || <em>Sans texte</em>}{(d.type === 'email' ? d.subject : d.text) && (d.type === 'email' ? d.subject! : d.text).length > 70 ? '…' : ''}</div>
                                <div className="notif-time">{d.type === 'email' ? 'E-mail' : d.type === 'story' ? 'Story' : 'Publication'} · {new Date(d.savedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                              </button>
                              <button type="button" className="unlink-btn" title="Supprimer ce brouillon" aria-label="Supprimer ce brouillon" onClick={() => deleteDraft(d.id)}><Icon name="trash" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!anyConnected && <span style={{ fontSize: 12, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>Reliez un réseau pour publier.</span>}
                <span style={{ flex: 1 }} />
                <button className="btn outline" disabled={!text.trim() || !sel.length} onClick={() => setSchedOpen((v) => !v)}><Icon name="clock" />Programmer</button>
                <button className="btn acc" disabled={!text.trim() || !anyConnected} onClick={() => setPublishOpen(true)}><Icon name="send" />Publier maintenant</button>
              </div>
            </>
          )}
        </div>

        <div className="cmp-prev">
          <div className="pv-bar"><Icon name="eye" /><span className="pvb-t">Aperçu</span>
            <span className="pvb-net">{type === 'email' ? <Icon name="mail" /> : active ? <Brand name={active as BrandName} /> : null}{type === 'email' ? 'E-mail' : netName(active || '')}</span>
          </div>
          <div className="pv-stage">
            {type === 'email' ? <EmailPreviewCard subject={subject} pre={pre} body={body} />
              : type === 'story' ? <StoryPreview text={text} active={active} media={media} />
                : <FeedPreview text={text} active={active} ratio={ratio} media={media} />}
          </div>
        </div>
      </div>

      {publishOpen && <PublishPanel text={text} platforms={sel} localMedia={!!media} defaultPhotoUrl={publicImageUrl} onClose={() => setPublishOpen(false)} />}
      {visualOpen && (
        <VisualGenerator
          text={text}
          ratio={ratio}
          onClose={() => setVisualOpen(false)}
          onUse={(url, size, isPublic) => {
            setMedia({ url, kind: 'image', name: isPublic ? 'photo-pexels.jpg' : 'visuel-de-marque.png', size });
            setPublicImageUrl(isPublic ? url : null);
          }}
        />
      )}
    </section>
  );
}

/* ---------- previews ---------- */
function mediaInner(media: Media | null, ratio: string) {
  if (!media) return <div className="imh"><Icon name="image" /><small>Visuel {ratio}</small></div>;
  if (media.kind === 'video') return <div className="vid-badge"><RawIcon svg={UI.play} />Vidéo</div>;
  return null;
}

function FeedPreview({ text, active, ratio, media }: { text: string; active: string | null; ratio: string; media: Media | null }) {
  const txt = text.trim();
  const bg = media && media.kind === 'image' ? { backgroundImage: `url('${media.url}')` } : {};
  return (
    <div className="ig-card">
      <div className="ig-head"><div className="ava">{getBusiness().initials}</div><div><div className="ih-n">{handleFor(active || '')}</div><div className="ih-s">{getBusiness().city} · Sponsorisé</div></div><div className="ih-net">{active && <Brand name={active as BrandName} />}</div></div>
      <div className="ig-media" style={{ aspectRatio: ratio.replace(':', '/'), ...bg }}>{mediaInner(media, ratio)}</div>
      <div className="ig-actions"><RawIcon svg={A.heart} /><RawIcon svg={A.comment} /><RawIcon svg={A.share} /><span className="grow" /><RawIcon svg={A.bookmark} /></div>
      <div className="ig-cap">{txt ? <span dangerouslySetInnerHTML={{ __html: `<b>${handleFor(active || '')}</b> ${escapeTags(txt)}` }} /> : <span className="empty">Votre légende apparaîtra ici…</span>}</div>
    </div>
  );
}

function StoryPreview({ text, active, media }: { text: string; active: string | null; media: Media | null }) {
  const txt = text.trim();
  const bg = media && media.kind === 'image' ? { backgroundImage: `url('${media.url}')` } : {};
  return (
    <div className="story-card" style={bg}>
      <div className="st-grad-top" /><div className="st-grad-bot" />
      <div className="st-net">{active && <Brand name={active as BrandName} />}</div>
      <div className="st-prog"><i /><i /><i /></div>
      <div className="st-head"><div className="ava">{getBusiness().initials}</div><div><div className="sh-n">{handleFor(active || '')}</div><div className="sh-t">il y a 2 min</div></div></div>
      {!media && <div className="st-empty"><Icon name="image" /><small>Visuel 9:16</small></div>}
      <div className="st-cap">{txt ? <span dangerouslySetInnerHTML={{ __html: escapeTags(txt) }} /> : null}</div>
    </div>
  );
}

function EmailPreviewCard({ subject, pre, body }: { subject: string; pre: string; body: string }) {
  const b = (body || '').trim();
  const paras = b ? b.split(/\n+/).map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: escapeHtml(p) }} />) : <p style={{ color: '#bbb' }}>Le corps de votre e-mail s’affiche ici…</p>;
  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div className="ep-mail">
        <div className="ep-from"><div className="ava">{getBusiness().initials}</div><div><div className="ef-t">{getBusiness().name}</div><div className="ef-s">{getBusiness().email}</div></div><div className="ef-time">09:00</div></div>
        <div className="ep-subj-line">{subject ? subject : <span style={{ color: '#bbb' }}>Objet de l’e-mail</span>}</div>
        <div style={{ fontSize: 12, color: '#999', padding: '4px 20px 0' }}>{pre || 'Pré-en-tête…'}</div>
        <div className="ep-head-band"><img src={`${import.meta.env.BASE_URL}assets/logo-white.png`} alt="Efficience" /></div>
        <div className="ep-body-c">{paras}</div>
        <div className="ep-foot"><div className="ef-social">{(['instagram', 'facebook', 'tiktok'] as BrandName[]).map((s) => <span key={s}><Brand name={s} /></span>)}</div>
          {getBusiness().name} · {getBusiness().addressLine}<br /><a href="#">Se désinscrire</a></div>
      </div>
    </div>
  );
}

/* ---------- email editor ---------- */
function EmailEditor({ subject, setSubject, pre, setPre, body, setBody, finish, onSaveDraft }: {
  subject: string; setSubject: (v: string) => void; pre: string; setPre: (v: string) => void;
  body: string; setBody: (v: string) => void; finish: (l: string) => void; onSaveDraft: () => void;
}) {
  const subjLim = 60, preLim = 90;
  const counter = (len: number, lim: number) => {
    const pct = Math.min(100, (len / lim) * 100);
    const s = len > lim ? 'over' : pct > 85 ? 'warn' : '';
    return <div className={'counter ' + s}><b>{len}</b> / {lim} {len > lim ? '· trop long pour certaines messageries' : '· longueur idéale'}</div>;
  };
  return (
    <>
      <div className="ce-sec">
        <label className="field-lbl">Objet de l’e-mail</label>
        <input className="inp" maxLength={120} placeholder="Ex : votre prochaine session de formation — places limitées" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div style={{ marginTop: 8 }}>{counter(subject.length, subjLim)}</div>
      </div>
      <div className="ce-sec">
        <label className="field-lbl">Pré-en-tête <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— aperçu dans la boîte de réception</span></label>
        <input className="inp" maxLength={140} placeholder="Une phrase d’accroche affichée après l’objet" value={pre} onChange={(e) => setPre(e.target.value)} />
        <div style={{ marginTop: 8 }}>{counter(pre.length, preLim)}</div>
      </div>
      <div className="ce-sec">
        <label className="field-lbl">Corps du message</label>
        <textarea className="inp" rows={7} placeholder="Rédigez votre e-mail…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="counter" style={{ marginTop: 8 }}>Largeur d’image conseillée <b>600 px</b> · texte alternatif requis</div>
      </div>
      <div className="ce-sec" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input className="inp" type="datetime-local" style={{ maxWidth: 220 }} />
        <span style={{ flex: 1 }} />
        <FlashBtn className="btn outline" label="Enregistrer" flash="Brouillon enregistré" onClick={onSaveDraft} />
        <button className="btn acc" onClick={() => finish('Envoi programmé')}><Icon name="send" />Programmer l’envoi</button>
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { showToast } from '../lib/toast';
import { netName } from '../lib/networks';
import { BUSINESS as BIZ } from '../lib/business';
import { PublishPanel } from '../components/PublishPanel';
import { VisualGenerator } from '../components/VisualGenerator';

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
const handleFor = (_id: string): string => BIZ.name;

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const escapeTags = (s: string) => escapeHtml(s).replace(/#([\wàâäéèêëîïôöùûüç-]+)/gi, '<span class="tags">#$1</span>');

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
  const { isConnected, studioSeed, clearStudioSeed } = useEff();
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
    rd.onload = () => setMedia({ url: rd.result as string, kind, name: f.name, size: f.size });
    rd.readAsDataURL(f);
  };

  const insert = (k: 'emoji' | 'hash' | 'ai') => {
    const map = { emoji: ' ✦', hash: ' #formation #stratégiecommerciale', ai: ' Une méthode concrète, applicable dès le lendemain. On en parle ?' };
    setText((t) => t + map[k]);
  };

  const finish = (label: string) => {
    const where = type === 'email' ? 'e-mailing' : sel.map(netName).join(', ');
    showToast(UI.calendar, `${label} · ${where}`);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragMedia, setDragMedia] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);
  const anyConnected = sel.some((id) => isConnected(id));

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
            <EmailEditor subject={subject} setSubject={setSubject} pre={pre} setPre={setPre} body={body} setBody={setBody} finish={finish} />
          ) : (
            <>
              <div className="ce-sec">
                <label className="field-lbl">Plateformes {type === 'story' ? '(stories)' : ''}</label>
                <div className="plat-row">
                  {availablePlatforms(type).map((id) => (
                    <button key={id} className={'plat-chip' + (sel.includes(id) ? ' on' : '')} onClick={() => togglePlat(id)}>
                      <Brand name={id as BrandName} />{netName(id)}<RawIcon svg={UI.check} className="pc-x" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="ce-sec">
                <div className="atab-row">
                  {sel.length ? sel.map((id) => (
                    <button key={id} className={'atab' + (id === active ? ' on' : '')} onClick={() => setActive(id)}><Brand name={id as BrandName} />{netName(id)}</button>
                  )) : <span style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Sélectionnez au moins une plateforme.</span>}
                </div>
                <div className="cmp-text">
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
                      <button title="Emoji" onClick={() => insert('emoji')}>😊</button>
                      <button title="Hashtag" onClick={() => insert('hash')}><Icon name="tag" /></button>
                      <button title="Suggestion IA" onClick={() => insert('ai')}><Icon name="wand" /></button>
                    </div>
                  </div>
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
                  <div className="spec-row"><Icon name="sheet" /><div><div className="sr-l">Image</div><div className="sr-v">{spec?.img || '—'}</div></div></div>
                  <div className="spec-row"><Icon name="play" /><div><div className="sr-l">Vidéo</div><div className="sr-v">{spec?.video || '—'}</div></div></div>
                  <div className="spec-row"><Icon name="filter" /><div><div className="sr-l">Ratio</div><div className="sr-v">{ratio}</div></div></div>
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
                      <button className="unlink-btn" title="Retirer" onClick={() => setMedia(null)}><Icon name="trash" /></button>
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

              <div className="ce-sec" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FlashBtn className="btn outline" label="Enregistrer le brouillon" flash="Brouillon enregistré" />
                <span style={{ flex: 1 }} />
                {!anyConnected && <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Reliez un réseau pour publier.</span>}
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

      {publishOpen && <PublishPanel text={text} platforms={sel} localMedia={!!media} onClose={() => setPublishOpen(false)} />}
      {visualOpen && (
        <VisualGenerator
          text={text}
          ratio={ratio}
          onClose={() => setVisualOpen(false)}
          onUse={(url, size) => setMedia({ url, kind: 'image', name: 'visuel-de-marque.png', size })}
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
      <div className="ig-head"><div className="ava">{BIZ.initials}</div><div><div className="ih-n">{handleFor(active || '')}</div><div className="ih-s">{BIZ.city} · Sponsorisé</div></div><div className="ih-net">{active && <Brand name={active as BrandName} />}</div></div>
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
      <div className="st-head"><div className="ava">{BIZ.initials}</div><div><div className="sh-n">{handleFor(active || '')}</div><div className="sh-t">il y a 2 min</div></div></div>
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
        <div className="ep-from"><div className="ava">{BIZ.initials}</div><div><div className="ef-t">{BIZ.name}</div><div className="ef-s">{BIZ.email}</div></div><div className="ef-time">09:00</div></div>
        <div className="ep-subj-line">{subject ? subject : <span style={{ color: '#bbb' }}>Objet de l’e-mail</span>}</div>
        <div style={{ fontSize: 12, color: '#999', padding: '4px 20px 0' }}>{pre || 'Pré-en-tête…'}</div>
        <div className="ep-head-band"><img src={`${import.meta.env.BASE_URL}assets/logo-white.png`} alt="Efficience" /></div>
        <div className="ep-body-c">{paras}</div>
        <div className="ep-foot"><div className="ef-social">{(['instagram', 'facebook', 'tiktok'] as BrandName[]).map((s) => <span key={s}><Brand name={s} /></span>)}</div>
          {BIZ.name} · {BIZ.addressLine}<br /><a href="#">Se désinscrire</a></div>
      </div>
    </div>
  );
}

/* ---------- email editor ---------- */
function EmailEditor({ subject, setSubject, pre, setPre, body, setBody, finish }: {
  subject: string; setSubject: (v: string) => void; pre: string; setPre: (v: string) => void;
  body: string; setBody: (v: string) => void; finish: (l: string) => void;
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
        <FlashBtn className="btn outline" label="Enregistrer" flash="Brouillon enregistré" />
        <button className="btn acc" onClick={() => finish('Envoi programmé')}><Icon name="send" />Programmer l’envoi</button>
      </div>
    </>
  );
}

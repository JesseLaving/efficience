import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrand } from '../state/BrandContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { getStoredSiteUrl } from '../lib/brand';
import { getBusiness } from '../lib/business';
import type { BrandKit } from '../lib/api';
import { TEMPLATES, dimsFor, buildVisual } from '../lib/visualTemplates';
import { fetchStockPhotos, photoQueryFor, orientationFor, type StockPhoto } from '../lib/stock';
import { aiImageUrl, aiImagePrompt } from '../lib/ai';
import { brandPhoto, uploadImage } from '../lib/upload';

interface Props {
  text: string;
  ratio: string;
  onClose: () => void;
  /** isPublic=true quand l'URL est déjà publique (photo Pexels) → publiable via API. */
  onUse: (url: string, sizeBytes: number, isPublic: boolean) => void;
}

/* Charge une image distante en data-URL (pour l'intégrer proprement au PNG
   exporté sans « tainter » le canvas). Échoue silencieusement si CORS bloque. */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!/^image\//.test(blob.type)) return null;
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
  } catch { return null; }
}

export function VisualGenerator({ text, ratio, onClose, onUse }: Props) {
  const { brandKit, brandStatus, setBrandKit, refreshBrand } = useBrand();
  const [kit, setKit] = useState<BrandKit>(brandKit);
  const [mode, setMode] = useState<'template' | 'photo' | 'ai'>('template');
  const [template, setTemplate] = useState('citation');
  const [title, setTitle] = useState('À la une');
  const [siteUrl, setSiteUrl] = useState(getStoredSiteUrl());
  const [logoData, setLogoData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // --- recherche de photos (Pexels) ---
  const [pquery, setPquery] = useState(() => photoQueryFor(text, getBusiness().sector));
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [ploading, setPloading] = useState(false);
  const [preason, setPreason] = useState<string | null>(null);
  const [selPhoto, setSelPhoto] = useState<StockPhoto | null>(null);
  const [brandPhotoOn, setBrandPhotoOn] = useState(true);
  // --- génération d'image par IA (Pollinations, gratuit) ---
  const [aiPrompt, setAiPrompt] = useState(() => aiImagePrompt(text, getBusiness().sector));
  const [aiUrl, setAiUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const generateAi = () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiUrl(aiImageUrl(aiPrompt.trim(), ratio));
  };
  const switchToAi = () => { setMode('ai'); if (!aiUrl) generateAi(); };

  const searchPhotos = async (q: string) => {
    if (!q.trim()) return;
    setPloading(true); setPreason(null);
    try {
      const d = await fetchStockPhotos(q.trim(), orientationFor(ratio));
      setPhotos(d.photos || []);
      setPreason(d.available ? (d.photos.length ? null : 'Aucune photo trouvée pour cette recherche.') : (d.reason || 'Recherche indisponible.'));
    } catch (e) { setPreason(String((e as Error).message || e)); }
    setPloading(false);
  };

  // Resynchronise quand l'extraction du site met à jour la charte.
  useEffect(() => { setKit(brandKit); }, [brandKit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Pré-charge le logo en data-URL pour l'intégrer au visuel.
  useEffect(() => {
    let alive = true;
    if (!kit.logo) { setLogoData(null); return; }
    toDataUrl(kit.logo).then((d) => { if (alive) setLogoData(d); });
    return () => { alive = false; };
  }, [kit.logo]);

  const patch = (p: Partial<BrandKit>) => { const next = { ...kit, ...p }; setKit(next); setBrandKit(next); };

  const svg = useMemo(() => buildVisual({ template, brand: kit, text, ratio, title, logoData }), [template, kit, text, ratio, title, logoData]);
  const previewSvg = useMemo(() => svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" '), [svg]);

  const rasterize = (): Promise<string> => new Promise((resolve, reject) => {
    const { w, h } = dimsFor(ratio);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e as Error); }
    };
    img.onerror = () => reject(new Error('svg'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });

  const use = async () => {
    if (mode === 'ai') {
      if (!aiUrl) { showToast(UI.close, 'Générez d’abord une image'); return; }
      setBusy(true);
      try {
        const dataUrl = brandPhotoOn
          ? await brandPhoto({ photoUrl: aiUrl, ratio, direct: true, logoData, brandName: kit.name || undefined, accent: kit.accent || undefined })
          : await toDataUrl(aiUrl);
        if (dataUrl) {
          const up = await uploadImage(dataUrl);
          if (up.ok && up.url) { setBusy(false); onUse(up.url, 0, true); showToast(UI.check, 'Image IA ajoutée (URL publique)'); onClose(); return; }
        }
        // Repli : l'URL Pollinations est publique et déterministe → publiable.
        setBusy(false);
        onUse(aiUrl, 0, true); showToast(UI.check, 'Image IA ajoutée'); onClose(); return;
      } catch {
        setBusy(false);
        onUse(aiUrl, 0, true); showToast(UI.close, 'Compositing impossible — image brute utilisée.'); onClose(); return;
      }
    }
    if (mode === 'photo') {
      if (!selPhoto) { showToast(UI.close, 'Sélectionnez une photo'); return; }
      if (brandPhotoOn) {
        setBusy(true);
        try {
          const dataUrl = await brandPhoto({ photoUrl: selPhoto.url, ratio, logoData, brandName: kit.name || undefined, accent: kit.accent || undefined });
          const up = await uploadImage(dataUrl);
          setBusy(false);
          if (up.ok && up.url) { onUse(up.url, 0, true); showToast(UI.check, 'Visuel brandé ajouté (URL publique)'); onClose(); return; }
          // Hébergement indisponible → on retombe sur la photo brute (publique aussi).
          showToast(UI.close, (up.reason || 'Hébergement indisponible') + ' — photo non brandée utilisée.');
          onUse(selPhoto.url, 0, true); onClose(); return;
        } catch {
          setBusy(false);
          showToast(UI.close, 'Compositing impossible — photo brute utilisée.');
          onUse(selPhoto.url, 0, true); onClose(); return;
        }
      }
      // Sans logo : l'URL Pexels est déjà publique → directement publiable.
      onUse(selPhoto.url, (selPhoto.width || 0) * (selPhoto.height || 0), true);
      showToast(UI.check, 'Photo ajoutée à la publication');
      onClose();
      return;
    }
    setBusy(true);
    try {
      const png = await rasterize();
      onUse(png, Math.round(png.length * 0.75), false);
      showToast(UI.check, 'Visuel ajouté à la publication');
      onClose();
    } catch { showToast(UI.close, 'Échec de la génération du visuel'); }
    setBusy(false);
  };

  const download = async () => {
    if (mode === 'ai') {
      if (aiUrl) window.open(aiUrl, '_blank', 'noopener');
      return;
    }
    if (mode === 'photo') {
      if (selPhoto) window.open(selPhoto.url, '_blank', 'noopener');
      return;
    }
    try {
      const png = await rasterize();
      const a = document.createElement('a');
      a.href = png; a.download = 'visuel-' + template + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch { showToast(UI.close, 'Échec du téléchargement'); }
  };

  const switchToPhoto = () => { setMode('photo'); if (!photos.length && !ploading) searchPhotos(pquery); };
  const modeBtn = (on: boolean): React.CSSProperties => ({ flex: 1, fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 'var(--r-btn)', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--acc)' : 'var(--line)'), background: on ? 'var(--acc)' : 'transparent', color: on ? '#04231a' : 'var(--tx-2)' });

  const fileRef = useRef<HTMLInputElement>(null);
  const onLogoFile = (f: File) => { const fr = new FileReader(); fr.onload = () => patch({ logo: fr.result as string }); fr.readAsDataURL(f); };

  return createPortal(
    <div className="kmodal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card" style={{ maxWidth: 900, width: '94vw' }}>
        <div className="kmodal-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RawIcon svg={UI.sparkles2} style={{ width: 18, height: 18, display: 'inline-grid', color: 'var(--acc)' }} />
            <b>Générateur de visuel de marque</b>
          </div>
          <button className="km-x" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body" style={{ display: 'block' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setMode('template')} style={modeBtn(mode === 'template')}><RawIcon svg={UI.sparkles2} style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> Modèle de marque</button>
            <button onClick={switchToPhoto} style={modeBtn(mode === 'photo')}><RawIcon svg={UI.image} style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> Photo du sujet</button>
            <button onClick={switchToAi} style={modeBtn(mode === 'ai')}><RawIcon svg={UI.wand} style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> Image IA</button>
          </div>
          {mode === 'template' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          {/* ---- aperçu ---- */}
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => setTemplate(t.key)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                    border: '1px solid ' + (template === t.key ? 'var(--acc)' : 'var(--line)'),
                    background: template === t.key ? 'var(--acc)' : 'transparent',
                    color: template === t.key ? '#04231a' : 'var(--tx-2)' }}>{t.label}</button>
              ))}
            </div>
            <div style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--line)', maxWidth: 420, margin: '0 auto' }}
              dangerouslySetInnerHTML={{ __html: previewSvg }} />
            {template === 'annonce' && (
              <input className="inp" style={{ marginTop: 12 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre / accroche (ex : À la une)" />
            )}
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 10 }}>
              Le visuel reprend le texte de votre publication et votre charte ({ratio}). Modifiez le texte dans le composer pour le mettre à jour.
            </div>
          </div>

          {/* ---- charte ---- */}
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div className="field">
              <label className="field-lbl">Charte depuis votre site</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="inp" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="votresite.com" />
                <button className="btn outline sm" disabled={brandStatus === 'loading'} onClick={() => refreshBrand(siteUrl)} title="Ré-extraire la charte du site">
                  {brandStatus === 'loading' ? <span className="spin lt" /> : <Icon name="refresh" />}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 6 }}>
                {kit.available ? 'Couleurs, logo et police extraits de votre site.' : 'Charte par défaut (Efficience). Lancez l’extraction pour utiliser celle de votre site.'}
              </div>
            </div>

            <div className="field">
              <label className="field-lbl">Palette</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {kit.palette.map((c, i) => (
                  <button key={c + i} title={'Définir comme couleur d’accent : ' + c} onClick={() => patch({ accent: c })}
                    style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: c, border: '2px solid ' + (kit.accent === c ? 'var(--tx-1)' : 'transparent'), boxShadow: '0 0 0 1px var(--line)' }} />
                ))}
                <label style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px dashed var(--line)' }} title="Couleur personnalisée">
                  <input type="color" value={kit.accent || '#00d992'} onChange={(e) => patch({ accent: e.target.value })} style={{ opacity: 0, width: 0, height: 0 }} />
                  <Icon name="plus" />
                </label>
              </div>
            </div>

            <div className="field">
              <label className="field-lbl">Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--line)', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'var(--canvas-soft)' }}>
                  {kit.logo ? <img src={kit.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <Icon name="image" />}
                </div>
                <button className="btn outline sm" onClick={() => fileRef.current?.click()}><Icon name="upload" />Importer</button>
                {kit.logo && <button className="btn ghost sm" onClick={() => patch({ logo: null })}><Icon name="trash" /></button>}
                <input type="file" ref={fileRef} accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); }} />
              </div>
              {kit.logo && !logoData && <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 5 }}>Logo affiché mais non intégrable à l’export (CORS) — il sera remplacé par le nom de marque dans le PNG.</div>}
            </div>

            <div className="field">
              <label className="field-lbl">Nom de marque</label>
              <input className="inp" value={kit.name || ''} onChange={(e) => patch({ name: e.target.value })} />
            </div>

            <div className="field">
              <label className="field-lbl">Police {kit.fonts[0] ? `· ${kit.fonts[0]}` : ''}</label>
              <input className="inp" value={kit.fonts[0] || ''} onChange={(e) => patch({ fonts: [e.target.value, ...kit.fonts.slice(1)] })} placeholder="Inter" />
            </div>

            <button className="btn outline" onClick={switchToAi} title="Générer une image par IA (gratuit)">
              <Icon name="wand" />Générer une image par IA
            </button>
          </div>
          </div>
          ) : mode === 'photo' ? (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input className="inp" value={pquery} onChange={(e) => setPquery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') searchPhotos(pquery); }} placeholder="Rechercher une photo (ex : formation réunion)" />
              <button className="btn acc sm" disabled={ploading} onClick={() => searchPhotos(pquery)} style={{ flexShrink: 0 }}>{ploading ? <span className="spin" /> : <Icon name="search" />}Rechercher</button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx-2)', marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={brandPhotoOn} onChange={(e) => setBrandPhotoOn(e.target.checked)} style={{ accentColor: 'var(--acc)' }} />
              Incruster mon logo {kit.logo ? '' : '(nom de marque)'} sur la photo
              <span style={{ color: 'var(--tx-3)' }}>· hébergée en URL publique</span>
            </label>
            {preason && (
              <div style={{ fontSize: 12.5, color: 'var(--warn)', marginBottom: 12 }}>
                {preason}{/Clé Pexels/.test(preason) ? <span style={{ color: 'var(--tx-3)' }}> — ajoutez la variable <b>PEXELS_API_KEY</b> dans Vercel.</span> : null}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {photos.map((p) => (
                <button key={p.id} onClick={() => setSelPhoto(p)} title={p.alt} style={{ padding: 0, border: '2px solid ' + (selPhoto && selPhoto.id === p.id ? 'var(--acc)' : 'transparent'), borderRadius: 10, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1 / 1', background: p.avgColor || 'var(--canvas-soft)' }}>
                  <img src={p.thumb} alt={p.alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
            {!photos.length && !ploading && !preason && <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Lancez une recherche pour illustrer votre sujet en photo.</div>}
            {selPhoto && (
              <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--tx-3)' }}>
                {selPhoto.photographer ? <>Photo © <a href={selPhoto.photographerUrl || '#'} target="_blank" rel="noopener" style={{ color: 'var(--tx-2)' }}>{selPhoto.photographer}</a> · Pexels — </> : 'Pexels — '}
                URL publique, publiable directement sur vos réseaux.
              </div>
            )}
          </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            {/* ---- aperçu image IA ---- */}
            <div>
              <div style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--line)', maxWidth: 420, margin: '0 auto', aspectRatio: ratio.replace(':', '/'), background: 'var(--canvas-soft)', display: 'grid', placeItems: 'center', position: 'relative' }}>
                {aiUrl ? (
                  <img src={aiUrl} alt="" onLoad={() => setAiLoading(false)} onError={() => setAiLoading(false)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : <div style={{ fontSize: 12.5, color: 'var(--tx-3)', padding: 20, textAlign: 'center' }}>Décrivez l’image puis générez.</div>}
                {aiLoading && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.25)' }}><span className="spin" /></div>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 10 }}>Image générée par IA (Flux · gratuit). Aucune donnée chiffrée, illustration uniquement.</div>
            </div>
            {/* ---- prompt ---- */}
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <div className="field">
                <label className="field-lbl">Décrivez l’image</label>
                <textarea className="inp" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={5} placeholder="Ex : photographie d’un atelier de formation lumineux, style moderne" style={{ resize: 'vertical', minHeight: 96 }} />
              </div>
              <button className="btn acc" disabled={aiLoading || !aiPrompt.trim()} onClick={generateAi}>{aiLoading ? <span className="spin" /> : <Icon name="wand" />}{aiUrl ? 'Régénérer' : 'Générer l’image'}</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={brandPhotoOn} onChange={(e) => setBrandPhotoOn(e.target.checked)} style={{ accentColor: 'var(--acc)' }} />
                Incruster mon logo {kit.logo ? '' : '(nom de marque)'} sur l’image
              </label>
            </div>
          </div>
          )}
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12, color: 'var(--tx-3)' }}>
            {mode === 'photo' ? 'Photos Pexels — URL publique, publiable directement.'
              : mode === 'ai' ? 'Image IA gratuite (Flux) — hébergée en URL publique, publiable.'
              : 'Respecte vos couleurs, logo, police et nom de marque.'}
          </span>
          <button className="btn outline" onClick={download} disabled={(mode === 'photo' && !selPhoto) || (mode === 'ai' && !aiUrl)}><Icon name="download" />Télécharger</button>
          <button className="btn acc" disabled={busy || (mode === 'photo' && !selPhoto) || (mode === 'ai' && !aiUrl)} onClick={use}>{busy ? <span className="spin" /> : <Icon name="check" />}Utiliser comme visuel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

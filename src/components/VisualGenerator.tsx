import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { getStoredSiteUrl } from '../lib/brand';
import type { BrandKit } from '../lib/api';
import { TEMPLATES, dimsFor, buildVisual } from '../lib/visualTemplates';

interface Props {
  text: string;
  ratio: string;
  onClose: () => void;
  onUse: (pngDataUrl: string, sizeBytes: number) => void;
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
  const { brandKit, brandStatus, setBrandKit, refreshBrand } = useEff();
  const [kit, setKit] = useState<BrandKit>(brandKit);
  const [template, setTemplate] = useState('citation');
  const [title, setTitle] = useState('À la une');
  const [siteUrl, setSiteUrl] = useState(getStoredSiteUrl());
  const [logoData, setLogoData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      const png = await rasterize();
      onUse(png, Math.round(png.length * 0.75));
      showToast(UI.check, 'Visuel ajouté à la publication');
      onClose();
    } catch { showToast(UI.close, 'Échec de la génération du visuel'); }
    setBusy(false);
  };

  const download = async () => {
    try {
      const png = await rasterize();
      const a = document.createElement('a');
      a.href = png; a.download = 'visuel-' + template + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch { showToast(UI.close, 'Échec du téléchargement'); }
  };

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
          <button className="km-x" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
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

            <button className="btn outline" disabled title="Génération d’images par IA — à venir (clé API requise)">
              <Icon name="wand" />Générer par IA — bientôt
            </button>
          </div>
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12, color: 'var(--tx-3)' }}>Respecte vos couleurs, logo, police et nom de marque.</span>
          <button className="btn outline" onClick={download}><Icon name="download" />Télécharger</button>
          <button className="btn acc" disabled={busy} onClick={use}>{busy ? <span className="spin" /> : <Icon name="check" />}Utiliser comme visuel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

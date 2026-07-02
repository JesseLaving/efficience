import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { netName } from '../lib/networks';
import { showToast } from '../lib/toast';
import { publishMetaPost } from '../lib/meta';
import { publishLinkedInPost } from '../lib/linkedin';
import { publishGooglePost } from '../lib/google';

interface Props { text: string; platforms: string[]; localMedia: boolean; defaultPhotoUrl?: string | null; onClose: () => void; }

interface Row { id: string; label: string; status: 'pending' | 'ok' | 'error'; reason?: string | null; url?: string | null; }

const META_NETS = ['instagram', 'facebook'];

export function PublishPanel({ text, platforms, localMedia, defaultPhotoUrl, onClose }: Props) {
  const { metaToken, metaAccounts, linkedinToken, googleToken, googleAccounts } = useConnections();
  const [photoUrl, setPhotoUrl] = useState(defaultPhotoUrl || '');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  // Split selection into networks we can actually publish to vs. the rest.
  const metaTargets = platforms.filter((p) => META_NETS.includes(p) && metaAccounts.some((a) => a.network === p));
  const canLinkedin = platforms.includes('linkedin') && !!linkedinToken;
  const canGoogle = platforms.includes('google') && !!googleToken && googleAccounts.length > 0;

  const publishable: string[] = [...metaTargets, ...(canLinkedin ? ['linkedin'] : []), ...(canGoogle ? ['google'] : [])];
  const unavailable = platforms.filter((p) => !publishable.includes(p));

  const run = async () => {
    if (!text.trim() || !publishable.length || busy) return;
    setBusy(true);
    const init: Row[] = publishable.map((id) => ({ id, label: netName(id), status: 'pending' }));
    setRows(init);
    const out: Row[] = [];
    const photo = photoUrl.trim() || undefined;

    // Meta (Instagram + Facebook) — one call, multiple targets.
    if (metaTargets.length && metaToken) {
      try {
        const res = await publishMetaPost({ token: metaToken, targets: metaTargets, message: text.trim(), photoUrl: photo });
        for (const t of metaTargets) {
          const r = (res.results || []).find((x) => x.network === t);
          out.push({ id: t, label: netName(t), status: r?.ok ? 'ok' : 'error', reason: r ? r.reason : (res.reason || 'Aucun résultat') });
        }
      } catch (e) { for (const t of metaTargets) out.push({ id: t, label: netName(t), status: 'error', reason: String((e as Error).message || e) }); }
    }

    // LinkedIn — member profile.
    if (canLinkedin && linkedinToken) {
      try {
        const r = await publishLinkedInPost(linkedinToken, text.trim(), photo);
        out.push({ id: 'linkedin', label: netName('linkedin'), status: r.ok ? 'ok' : 'error', reason: r.reason || r.error, url: r.url });
      } catch (e) { out.push({ id: 'linkedin', label: netName('linkedin'), status: 'error', reason: String((e as Error).message || e) }); }
    }

    // Google Business — one post per connected location.
    if (canGoogle && googleToken) {
      for (const loc of googleAccounts) {
        try {
          const r = await publishGooglePost({ token: googleToken, path: loc.path, summary: text.trim(), photoUrl: photo });
          out.push({ id: 'google', label: loc.title || netName('google'), status: r.ok ? 'ok' : 'error', reason: r.reason || r.error, url: r.post?.searchUrl });
        } catch (e) { out.push({ id: 'google', label: loc.title || netName('google'), status: 'error', reason: String((e as Error).message || e) }); }
      }
    }

    setRows(out);
    setBusy(false);
    if (out.some((r) => r.status === 'ok')) showToast(UI.check, `Publié sur ${out.filter((r) => r.status === 'ok').length} réseau(x)`);
  };

  const done = rows && !busy;

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(560px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic"><Icon name="send" /></div>
          <div><h3>Publier maintenant</h3><div className="km-s">Diffusion en direct sur vos réseaux connectés</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body">
          {!rows && (
            <>
              <div className="field">
                <label className="field-lbl">Réseaux qui seront publiés</label>
                {publishable.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {publishable.map((id) => (
                      <span key={id} className="plat-chip on" style={{ pointerEvents: 'none' }}>
                        <Brand name={id as BrandName} />{netName(id)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--warn)', marginTop: 4 }}>
                    Aucun réseau connecté parmi votre sélection. Reliez Instagram, Facebook, LinkedIn ou Google dans « Connexion ».
                  </div>
                )}
              </div>

              {unavailable.length > 0 && (
                <div className="field">
                  <label className="field-lbl">Non connectés <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— ignorés</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {unavailable.map((id) => (
                      <span key={id} className="plat-chip" style={{ pointerEvents: 'none', opacity: 0.55 }}>
                        <Brand name={id as BrandName} />{netName(id)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <label className="field-lbl">Aperçu du texte</label>
                <div style={{ fontSize: 13, color: 'var(--tx-2)', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas)' }}>
                  {text.trim() || <span style={{ color: 'var(--tx-3)' }}>Aucun texte saisi.</span>}
                </div>
              </div>

              {(metaTargets.length > 0 || canGoogle) && (
                <div className="field">
                  <label className="field-lbl">Image <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— URL publique (optionnel)</span></label>
                  <input className="inp" placeholder="https://…/photo.jpg" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
                  {localMedia && (
                    <div className="counter" style={{ marginTop: 6, color: 'var(--tx-3)' }}>
                      Votre visuel importé sert à l’aperçu. La publication via API exige une URL d’image publique — collez-la ici.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {rows && (
            <div style={{ display: 'grid', gap: 8 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ fontSize: 13, display: 'flex', gap: 9, alignItems: 'center', padding: '9px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas)' }}>
                  <span style={{ width: 17, height: 17 }}><Brand name={r.id as BrandName} /></span>
                  <span style={{ flex: 1 }}>{r.label}</span>
                  {r.status === 'pending' && <span className="spin" />}
                  {r.status === 'ok' && <span style={{ color: 'var(--acc)' }}><RawIcon svg={UI.check} style={{ width: 13, height: 13, display: 'inline-grid', verticalAlign: -2 }} /> publié{r.url ? <> · <a href={r.url} target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>voir</a></> : ''}</span>}
                  {r.status === 'error' && <span style={{ color: 'var(--warn)', maxWidth: 280, textAlign: 'right' }}>{r.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>
            {done ? 'Résultats par réseau ci-dessus.' : 'Aucune programmation — publication immédiate.'}
          </span>
          <button className="btn outline" onClick={onClose}>{done ? 'Fermer' : 'Annuler'}</button>
          {!done && (
            <button className="btn acc" disabled={!text.trim() || !publishable.length || busy} onClick={run}>
              {busy ? <><span className="spin" />Publication…</> : <><Icon name="send" />Publier</>}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

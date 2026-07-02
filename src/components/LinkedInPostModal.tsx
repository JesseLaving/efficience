import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { publishLinkedInPost, type LiPostResult } from '../lib/linkedin';

export function LinkedInPostModal({ onClose }: { onClose: () => void }) {
  const { linkedinToken, linkedinMe } = useConnections();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LiPostResult | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const publish = async () => {
    if (!linkedinToken || !text.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await publishLinkedInPost(linkedinToken, text.trim());
      setResult(r);
      if (r.ok) { showToast(UI.check, 'Post publié sur LinkedIn'); setText(''); }
    } catch (e) { setResult({ error: String((e as Error).message || e) }); }
    setBusy(false);
  };

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card">
        <div className="kmodal-top">
          <div className="km-ic" style={{ background: 'transparent', border: 'none' }}><Brand name="linkedin" /></div>
          <div><h3>Publier sur LinkedIn</h3><div className="km-s">{linkedinMe?.name ? `Profil : ${linkedinMe.name}` : 'Votre profil'}</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="kmodal-body">
          <div className="field">
            <label className="field-lbl">Votre post</label>
            <textarea className="inp" rows={7} maxLength={3000} placeholder="Partagez une actualité, un conseil, une réflexion…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="counter" style={{ marginTop: 6 }}><b>{text.length}</b> / 3000</div>
          </div>
          {result && (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas)' }}>
              {result.ok
                ? <span style={{ color: 'var(--acc)' }}><RawIcon svg={UI.check} style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> Publié{result.url ? <> — <a href={result.url} target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>voir le post</a></> : ''}.</span>
                : <span style={{ color: 'var(--warn)' }}>Non publié : {result.reason || result.error}</span>}
            </div>
          )}
        </div>
        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Publié en direct sur votre profil LinkedIn.</span>
          <button className="btn outline" onClick={onClose}>Fermer</button>
          <button className="btn acc" disabled={busy || !text.trim()} onClick={publish}>{busy ? <><span className="spin" />Publication…</> : <><Icon name="send" />Publier</>}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

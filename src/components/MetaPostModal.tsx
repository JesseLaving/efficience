import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { publishMetaPost, type MetaPostResult } from '../lib/meta';

interface Props { onClose: () => void; defaultTargets?: ('facebook' | 'instagram')[]; }

export function MetaPostModal({ onClose, defaultTargets = ['facebook', 'instagram'] }: Props) {
  const { metaToken, metaAccounts } = useEff();
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [targets, setTargets] = useState<Set<string>>(new Set(defaultTargets));
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<MetaPostResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const hasFB = metaAccounts.some((a) => a.network === 'facebook');
  const hasIG = metaAccounts.some((a) => a.network === 'instagram');

  const toggle = (t: string) => setTargets((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const publish = async () => {
    if (!metaToken || !message.trim() || targets.size === 0) return;
    setBusy(true); setResults(null); setErrorMsg('');
    try {
      const res = await publishMetaPost({ token: metaToken, targets: [...targets], message: message.trim(), photoUrl: photoUrl.trim() || undefined });
      setResults(res.results || []);
      if (res.ok) { showToast(UI.check, 'Publication envoyée sur Meta'); }
      else setErrorMsg(res.reason || (res.results || []).map((r) => r.reason).filter(Boolean).join(' · ') || 'Erreur inconnue.');
    } catch (e) { setErrorMsg(String((e as Error).message || e)); }
    setBusy(false);
  };

  const permIssue = /permission|privilege|content_publish|manage_posts/i.test(errorMsg);
  const canSend = message.trim().length > 0 && targets.size > 0 && !busy;

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(540px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic" style={{ background: 'transparent', border: 'none', display: 'flex', gap: 4, width: 'auto' }}>
            {hasIG && <span style={{ width: 20, height: 20 }}><Brand name="instagram" /></span>}
            {hasFB && <span style={{ width: 20, height: 20 }}><Brand name="facebook" /></span>}
          </div>
          <div><h3>Publier sur Meta</h3><div className="km-s">Instagram &amp; Facebook · diffusion en direct</div></div>
          <button className="km-x" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body">
          <div className="field">
            <label className="field-lbl">Diffuser sur</label>
            <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
              {hasFB && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13.5, color: targets.has('facebook') ? 'var(--acc)' : 'var(--tx-2)' }}>
                  <input type="checkbox" checked={targets.has('facebook')} onChange={() => toggle('facebook')} style={{ accentColor: 'var(--acc)' }} />
                  <span style={{ width: 17, height: 17 }}><Brand name="facebook" /></span> Facebook
                </label>
              )}
              {hasIG && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13.5, color: targets.has('instagram') ? 'var(--acc)' : 'var(--tx-2)' }}>
                  <input type="checkbox" checked={targets.has('instagram')} onChange={() => toggle('instagram')} style={{ accentColor: 'var(--acc)' }} />
                  <span style={{ width: 17, height: 17 }}><Brand name="instagram" /></span> Instagram
                </label>
              )}
            </div>
          </div>

          <div className="field">
            <label className="field-lbl">Votre publication</label>
            <textarea className="inp" rows={6} placeholder="Rédigez votre message…" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="counter" style={{ marginTop: 6 }}><b>{message.length}</b> caractères</div>
          </div>

          <div className="field">
            <label className="field-lbl">Image <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— URL publique (optionnel)</span></label>
            <input className="inp" placeholder="https://…/photo.jpg" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
            {targets.has('instagram') && !photoUrl.trim() && (
              <div className="counter" style={{ marginTop: 6, color: 'var(--tx-3)' }}>Instagram exige une image : une image neutre sera utilisée à défaut d’URL.</div>
            )}
          </div>

          {results && (
            <div style={{ display: 'grid', gap: 7 }}>
              {results.map((r, i) => (
                <div key={i} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas)' }}>
                  <span style={{ width: 16, height: 16 }}><Brand name={r.network as 'facebook' | 'instagram'} /></span>
                  <span style={{ flex: 1 }}>{r.page || r.network}</span>
                  {r.ok
                    ? <span style={{ color: 'var(--acc)' }}><RawIcon svg={UI.check} style={{ width: 13, height: 13, display: 'inline-grid', verticalAlign: -2 }} /> publié</span>
                    : <span style={{ color: 'var(--warn)' }}>{r.reason}</span>}
                </div>
              ))}
            </div>
          )}

          {errorMsg && (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(255,107,107,.3)', background: 'rgba(255,107,107,.07)', color: 'var(--warn)' }}>
              {errorMsg}
              {permIssue && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tx-3)' }}>
                  Ces autorisations (<code>pages_manage_posts</code> + <code>instagram_content_publish</code>) nécessitent la validation Meta App Review. En mode développeur, seul votre propre compte peut publier.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Publié en direct via l’API Meta.</span>
          <button className="btn outline" onClick={onClose}>Fermer</button>
          <button className="btn acc" disabled={!canSend} onClick={publish}>{busy ? <><span className="spin" />Publication…</> : <><Icon name="send" />Publier</>}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState } from 'react';
import { useEff } from '../state/EffContext';
import { publishMetaPost } from '../lib/meta';
import { Brand } from '../lib/Icon';

interface Props { onClose: () => void; defaultTargets?: ('facebook' | 'instagram')[]; }

type Phase = 'compose' | 'sending' | 'done' | 'error';

export function MetaPostModal({ onClose, defaultTargets = ['facebook', 'instagram'] }: Props) {
  const { metaToken, metaAccounts } = useEff();
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [targets, setTargets] = useState<Set<string>>(new Set(defaultTargets));
  const [phase, setPhase] = useState<Phase>('compose');
  const [results, setResults] = useState<Array<{ network: string; page?: string; ok: boolean; reason?: string | null }>>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const hasFB = metaAccounts.some((a) => a.network === 'facebook');
  const hasIG = metaAccounts.some((a) => a.network === 'instagram');

  function toggle(t: string) {
    setTargets((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }

  async function send() {
    if (!metaToken || !message.trim() || targets.size === 0) return;
    setPhase('sending');
    try {
      const res = await publishMetaPost({
        token: metaToken, targets: [...targets], message: message.trim(),
        photoUrl: photoUrl.trim() || undefined,
      });
      setResults(res.results || []);
      if (res.ok) setPhase('done');
      else { setErrorMsg(res.reason || res.results?.map((r) => r.reason).filter(Boolean).join(' · ') || 'Erreur inconnue.'); setPhase('error'); }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur réseau.');
      setPhase('error');
    }
  }

  const canSend = message.trim().length > 0 && targets.size > 0 && phase === 'compose';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {hasFB && <span style={{ width: 22, height: 22 }}><Brand name="facebook" /></span>}
            {hasIG && <span style={{ width: 22, height: 22 }}><Brand name="instagram" /></span>}
            <span style={{ fontWeight: 700, fontSize: 16 }}>Publier sur Meta</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {(phase === 'compose' || phase === 'sending') && (
          <>
            <div style={{ padding: '0 20px', marginTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 8 }}>Diffuser sur :</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {hasFB && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: targets.has('facebook') ? 'var(--acc)' : 'var(--tx-2)' }}>
                    <input type="checkbox" checked={targets.has('facebook')} onChange={() => toggle('facebook')} style={{ accentColor: 'var(--acc)' }} />
                    <span style={{ width: 18, height: 18 }}><Brand name="facebook" /></span> Facebook
                  </label>
                )}
                {hasIG && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: targets.has('instagram') ? 'var(--acc)' : 'var(--tx-2)' }}>
                    <input type="checkbox" checked={targets.has('instagram')} onChange={() => toggle('instagram')} style={{ accentColor: 'var(--acc)' }} />
                    <span style={{ width: 18, height: 18 }}><Brand name="instagram" /></span> Instagram
                  </label>
                )}
              </div>

              <textarea
                className="field"
                style={{ width: '100%', minHeight: 120, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }}
                placeholder="Rédigez votre publication…"
                value={message} onChange={(e) => setMessage(e.target.value)}
                disabled={phase === 'sending'}
              />

              <input
                className="field"
                style={{ width: '100%', marginBottom: 4, boxSizing: 'border-box', fontSize: 13 }}
                placeholder="URL d'une image (optionnel)"
                value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
                disabled={phase === 'sending'}
              />
              {targets.has('instagram') && !photoUrl.trim() && (
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 12 }}>
                  Instagram : une image de substitution sera utilisée si aucune URL n'est fournie.
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn ghost sm" onClick={onClose} disabled={phase === 'sending'}>Annuler</button>
              <button className="btn acc sm" onClick={send} disabled={!canSend || phase === 'sending'}>
                {phase === 'sending' ? <><span className="spin lt" />Publication…</> : 'Publier'}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && (
          <div style={{ padding: '24px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--acc)' }}>Publication envoyée ✓</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r, i) => (
                <div key={i} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 16, height: 16 }}><Brand name={r.network as 'facebook' | 'instagram'} /></span>
                  <span>{r.page || r.network}</span>
                  <span style={{ color: r.ok ? 'var(--acc)' : 'var(--danger)' }}>{r.ok ? '✓ publié' : `✗ ${r.reason}`}</span>
                </div>
              ))}
            </div>
            <button className="btn acc sm" style={{ marginTop: 20 }} onClick={onClose}>Fermer</button>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ padding: '24px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--danger)' }}>Erreur de publication</div>
            <div style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 16 }}>{errorMsg}</div>
            {errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('privilege') ? (
              <div style={{ fontSize: 12, color: 'var(--tx-3)', padding: '10px 12px', background: 'rgba(255,107,107,.06)', borderRadius: 8, border: '1px solid rgba(255,107,107,.2)', marginBottom: 16 }}>
                Ces permissions nécessitent une validation Meta App Review (<code>pages_manage_posts</code> + <code>instagram_content_publish</code>).
                En mode développeur, seul le compte du développeur peut publier.
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost sm" onClick={onClose}>Fermer</button>
              <button className="btn acc sm" onClick={() => setPhase('compose')}>Réessayer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

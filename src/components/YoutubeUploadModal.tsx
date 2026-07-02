import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { initYoutubeUpload, uploadYoutubeVideo } from '../lib/google';

interface Props { onClose: () => void; }

const MAX_MB = 2048; // garde-fou raisonnable côté UI — YouTube accepte bien plus, mais un envoi navigateur au-delà de quelques Go est peu réaliste.

export function YoutubeUploadModal({ onClose }: Props) {
  const { youtubeToken, youtubeChannel, refreshYoutubeToken } = useConnections();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose, busy]);

  const pickFile = (f: File | null) => {
    setErrorMsg(''); setVideoId(null);
    if (f && f.size > MAX_MB * 1024 * 1024) { setErrorMsg(`Fichier trop volumineux (> ${MAX_MB} Mo).`); return; }
    setFile(f);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const upload = async () => {
    if (!youtubeToken || !file || !title.trim()) return;
    setBusy(true); setErrorMsg(''); setProgress(0); setVideoId(null);
    try {
      let init = await initYoutubeUpload(youtubeToken, { title: title.trim(), description: description.trim(), privacyStatus: privacy }, file);
      if (!init.ok && init.authError) {
        // Token expiré (~1h) — un rafraîchissement silencieux puis un seul
        // nouvel essai évite de faire échouer l'envoi pour une reconnexion.
        const fresh = await refreshYoutubeToken();
        if (fresh) init = await initYoutubeUpload(fresh, { title: title.trim(), description: description.trim(), privacyStatus: privacy }, file);
      }
      if (!init.ok || !init.uploadUrl) { setErrorMsg(init.reason || 'Échec de l’initialisation de l’envoi.'); setBusy(false); return; }
      const res = await uploadYoutubeVideo(init.uploadUrl, file, setProgress);
      if (res.ok) {
        setVideoId(res.videoId || null);
        showToast(UI.check, 'Vidéo envoyée sur YouTube');
      } else {
        setErrorMsg(res.reason || 'Échec de l’envoi de la vidéo.');
      }
    } catch (e) {
      setErrorMsg(String((e as Error).message || e));
    }
    setBusy(false);
  };

  const canSend = !!file && title.trim().length > 0 && !busy && !videoId;

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(540px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic" style={{ background: 'transparent', border: 'none', width: 20, height: 20 }}><Brand name="youtube" /></div>
          <div><h3>Publier une vidéo</h3><div className="km-s">{youtubeChannel?.title || 'Chaîne YouTube'}</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose} disabled={busy}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body">
          <div className="field">
            <label className="field-lbl">Fichier vidéo</label>
            <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas)' }}>
                <Icon name="play" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{(file.size / (1024 * 1024)).toFixed(1)} Mo</div>
                </div>
                {!busy && <button className="btn ghost sm" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Changer</button>}
              </div>
            ) : (
              <button className="btn outline block" onClick={() => fileRef.current?.click()}><Icon name="upload" />Choisir un fichier vidéo</button>
            )}
          </div>

          <div className="field">
            <label className="field-lbl">Titre</label>
            <input className="inp" maxLength={100} placeholder="Titre de la vidéo" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          </div>

          <div className="field">
            <label className="field-lbl">Description <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
            <textarea className="inp" rows={4} placeholder="Description de la vidéo…" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
          </div>

          <div className="field">
            <label className="field-lbl">Confidentialité</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['unlisted', 'public', 'private'] as const).map((p) => (
                <button key={p} className={'fmt-chip' + (privacy === p ? ' on' : '')} style={{ cursor: busy ? 'default' : 'pointer' }} disabled={busy} onClick={() => setPrivacy(p)}>
                  {p === 'unlisted' ? 'Non répertoriée' : p === 'public' ? 'Publique' : 'Privée'}
                </button>
              ))}
            </div>
          </div>

          {busy && (
            <div className="field">
              <div className="counter-bar" style={{ width: '100%' }}><i style={{ width: progress + '%' }} /></div>
              <div className="counter" style={{ marginTop: 6 }}>Envoi en cours… <b>{progress}%</b></div>
            </div>
          )}

          {videoId && (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--acc-soft, rgba(91,117,80,.35))', background: 'var(--acc-soft, rgba(91,117,80,.08))' }}>
              Vidéo envoyée — en cours de traitement par YouTube.{' '}
              <a href={`https://studio.youtube.com/video/${videoId}/edit`} target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>Voir dans YouTube Studio</a>
            </div>
          )}

          {errorMsg && (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(179,69,59,.3)', background: 'rgba(179,69,59,.07)', color: 'var(--warn)' }}>
              {errorMsg}
            </div>
          )}
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Envoyé directement à YouTube — traitement après upload.</span>
          <button className="btn outline" onClick={onClose} disabled={busy}>{videoId ? 'Fermer' : 'Annuler'}</button>
          {!videoId && <button className="btn acc" disabled={!canSend} onClick={upload}>{busy ? <><span className="spin" />Envoi…</> : <><Icon name="send" />Publier</>}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

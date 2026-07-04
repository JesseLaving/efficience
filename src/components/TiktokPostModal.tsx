import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { fetchTiktokCreatorInfo, initTiktokPost, uploadTiktokVideo, type TiktokCreatorInfo } from '../lib/tiktok';

interface Props { onClose: () => void; }

const MAX_MB = 500;
const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Public', MUTUAL_FOLLOW_FRIENDS: 'Amis (abonnements réciproques)', SELF_ONLY: 'Privé (moi uniquement)',
};

export function TiktokPostModal({ onClose }: Props) {
  const { tiktokToken, tiktokProfile } = useConnections();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'direct' | 'inbox'>('direct');
  const [creator, setCreator] = useState<TiktokCreatorInfo | null>(null);
  const [privacy, setPrivacy] = useState('');
  const [loadingCreator, setLoadingCreator] = useState(true);
  const [creatorError, setCreatorError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose, busy]);

  useEffect(() => {
    if (!tiktokToken) return;
    let alive = true;
    fetchTiktokCreatorInfo(tiktokToken).then((d) => {
      if (!alive) return;
      if (d.ok && d.creator) { setCreator(d.creator); setPrivacy(d.creator.privacyOptions[0] || 'SELF_ONLY'); }
      else setCreatorError(d.reason || 'Impossible de récupérer les options de publication.');
      setLoadingCreator(false);
    });
    return () => { alive = false; };
  }, [tiktokToken]);

  const pickFile = (f: File | null) => {
    setErrorMsg('');
    if (f && f.size > MAX_MB * 1024 * 1024) { setErrorMsg(`Fichier trop volumineux (> ${MAX_MB} Mo).`); return; }
    setFile(f);
  };

  const publish = async () => {
    if (!tiktokToken || !file) return;
    if (mode === 'direct' && !privacy) return;
    setBusy(true); setErrorMsg(''); setProgress(0);
    try {
      const init = await initTiktokPost(tiktokToken, {
        title: title.trim(), privacyLevel: privacy, mode,
        disableComment: creator?.commentDisabled, disableDuet: creator?.duetDisabled, disableStitch: creator?.stitchDisabled,
      }, file);
      if (!init.ok || !init.uploadUrl) { setErrorMsg(init.reason || 'Échec de l’initialisation de l’envoi.'); setBusy(false); return; }
      const res = await uploadTiktokVideo(init.uploadUrl, file, setProgress);
      if (res.ok) { setDone(true); showToast(UI.check, mode === 'direct' ? 'Vidéo envoyée sur TikTok' : 'Vidéo envoyée dans votre boîte de réception TikTok'); }
      else setErrorMsg(res.reason || 'Échec de l’envoi de la vidéo.');
    } catch (e) {
      setErrorMsg(String((e as Error).message || e));
    }
    setBusy(false);
  };

  // Le mode brouillon (inbox) ne dépend pas de creator_info (pas de
  // privacy_level à choisir) : il reste disponible même si cet appel échoue,
  // utile en secours si Direct Post n'est pas encore approuvé par TikTok.
  const directBlocked = loadingCreator || !!creatorError;
  const canSend = !!file && !busy && !done && (mode === 'inbox' || (!directBlocked && !!privacy));

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(540px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic" style={{ background: 'transparent', border: 'none', width: 20, height: 20 }}><Brand name="tiktok" /></div>
          <div><h3>Publier une vidéo</h3><div className="km-s">{tiktokProfile?.name || creator?.nickname || 'Compte TikTok'}</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose} disabled={busy}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body">
          <div style={{ fontSize: 12.5, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(143,100,35,.3)', background: 'rgba(143,100,35,.07)', color: 'var(--tx-2)' }}>
            <b style={{ color: 'var(--warn)' }}>En attente de validation TikTok</b> — ni la publication directe ni le mode brouillon ne sont encore approuvés par TikTok : l’envoi ci-dessous échouera tant que l’un des deux ne l’est pas.
          </div>

          <div className="field">
            <label className="field-lbl">Mode de publication</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={'fmt-chip' + (mode === 'direct' ? ' on' : '')} style={{ cursor: busy ? 'default' : 'pointer' }} disabled={busy} onClick={() => setMode('direct')}>Publier directement</button>
              <button className={'fmt-chip' + (mode === 'inbox' ? ' on' : '')} style={{ cursor: busy ? 'default' : 'pointer' }} disabled={busy} onClick={() => setMode('inbox')}>Envoyer en brouillon</button>
            </div>
            {mode === 'inbox' && <div className="counter" style={{ marginTop: 6 }}>La vidéo arrive dans votre boîte de réception TikTok — vous la publiez vous-même depuis l’app.</div>}
          </div>

          {mode === 'direct' && loadingCreator ? (
            <div className="ai-thinking"><span className="spin lt" /><div>Récupération des options de publication…</div></div>
          ) : mode === 'direct' && creatorError ? (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(179,69,59,.3)', background: 'rgba(179,69,59,.07)', color: 'var(--warn)' }}>
              {creatorError} — vous pouvez utiliser le mode « Envoyer en brouillon » en attendant.
            </div>
          ) : (
            <>
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
                {creator?.maxDurationSec && <div className="counter" style={{ marginTop: 6 }}>Durée max autorisée : {Math.round(creator.maxDurationSec / 60)} min</div>}
              </div>

              <div className="field">
                <label className="field-lbl">Légende <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
                <input className="inp" maxLength={150} placeholder="Légende de la vidéo" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
              </div>

              {mode === 'direct' && (
                <div className="field">
                  <label className="field-lbl">Confidentialité</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(creator?.privacyOptions || []).map((p) => (
                      <button key={p} className={'fmt-chip' + (privacy === p ? ' on' : '')} style={{ cursor: busy ? 'default' : 'pointer' }} disabled={busy} onClick={() => setPrivacy(p)}>
                        {PRIVACY_LABEL[p] || p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {busy && (
                <div className="field">
                  <div className="counter-bar" style={{ width: '100%' }}><i style={{ width: progress + '%' }} /></div>
                  <div className="counter" style={{ marginTop: 6 }}>Envoi en cours… <b>{progress}%</b></div>
                </div>
              )}

              {done && (
                <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--acc-soft, rgba(91,117,80,.35))', background: 'var(--acc-soft, rgba(91,117,80,.08))' }}>
                  {mode === 'direct'
                    ? 'Vidéo envoyée — en cours de traitement par TikTok. Elle apparaîtra sur votre profil sous quelques minutes.'
                    : 'Vidéo envoyée dans votre boîte de réception TikTok — ouvrez l’app pour la publier.'}
                </div>
              )}

              {errorMsg && (
                <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(179,69,59,.3)', background: 'rgba(179,69,59,.07)', color: 'var(--warn)' }}>
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Envoyé directement à TikTok — traitement après upload.</span>
          <button className="btn outline" onClick={onClose} disabled={busy}>{done ? 'Fermer' : 'Annuler'}</button>
          {!done && <button className="btn acc" disabled={!canSend} onClick={publish}>{busy ? <><span className="spin" />Envoi…</> : <><Icon name="send" />Publier</>}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

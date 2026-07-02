import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand } from '../lib/Icon';
import { fr } from '../lib/format';
import { fetchTiktokVideos, type TiktokVideo } from '../lib/tiktok';

interface Props { onClose: () => void; }

export function TiktokVideosModal({ onClose }: Props) {
  const { tiktokToken, tiktokProfile } = useConnections();
  const [videos, setVideos] = useState<TiktokVideo[] | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => {
    if (!tiktokToken) return;
    let alive = true;
    fetchTiktokVideos(tiktokToken).then((d) => {
      if (!alive) return;
      if (d.ok) setVideos(d.videos);
      else { setReason(d.reason || 'Impossible de récupérer les vidéos.'); setVideos([]); }
    });
    return () => { alive = false; };
  }, [tiktokToken]);

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(640px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic" style={{ background: 'transparent', border: 'none', width: 20, height: 20 }}><Brand name="tiktok" /></div>
          <div><h3>Vos vidéos</h3><div className="km-s">{tiktokProfile?.name || 'Compte TikTok'}</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="kmodal-body">
          {videos === null ? (
            <div className="ai-thinking"><span className="spin lt" /><div>Récupération de vos vidéos…</div></div>
          ) : reason ? (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(179,69,59,.3)', background: 'rgba(179,69,59,.07)', color: 'var(--warn)' }}>{reason}</div>
          ) : videos.length === 0 ? (
            <div className="crm-empty" style={{ minHeight: 140 }}>
              <div className="ce-ic"><Icon name="play" /></div>
              <div className="ce-t">Aucune vidéo publiée pour l’instant</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {videos.map((v) => (
                <a key={v.id} href={v.url || undefined} target="_blank" rel="noopener" style={{ display: 'block', borderRadius: 'var(--r-btn)', overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'inherit' }}>
                  {v.cover
                    ? <img src={v.cover} alt="" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '9/16', background: 'var(--canvas)', display: 'grid', placeItems: 'center' }}><Icon name="play" /></div>}
                  <div style={{ padding: '6px 8px', fontSize: 11.5 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-2)' }}>{v.description || 'Sans légende'}</div>
                    <div style={{ color: 'var(--tx-3)', marginTop: 2 }}>{v.views != null ? `${fr(v.views)} vues` : '—'}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Données en lecture seule — via l’API TikTok.</span>
          <button className="btn outline" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

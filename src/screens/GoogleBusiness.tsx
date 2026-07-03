import { useState } from 'react';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';
import { publishGooglePost, type PublishResult } from '../lib/google';

const CTAS: [string, string][] = [
  ['', 'Aucun bouton'], ['LEARN_MORE', 'En savoir plus'], ['BOOK', 'Réserver'],
  ['SIGN_UP', "S'inscrire"], ['CALL', 'Appeler'], ['ORDER', 'Commander'],
];

export function GoogleBusiness() {
  const { googleConnected, googleToken, googleAccounts, googleStatus, googleReason, connectGoogle, disconnectGoogle } = useConnections();
  const [loc, setLoc] = useState('');
  const [summary, setSummary] = useState('');
  const [actionType, setActionType] = useState('');
  const [url, setUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  const path = loc || (googleAccounts[0] && googleAccounts[0].path) || '';

  const publish = async () => {
    if (!googleToken || !path || !summary.trim()) return;
    setPublishing(true); setResult(null);
    try {
      const r = await publishGooglePost({ token: googleToken, path, summary: summary.trim(), actionType: actionType || undefined, url: url.trim() || undefined, photoUrl: photoUrl.trim() || undefined });
      setResult(r);
      if (r.ok) { showToast(UI.check, 'Actualité publiée sur Google Business'); setSummary(''); setUrl(''); setPhotoUrl(''); }
      else showToast(UI.close, `Publication échouée : ${r.reason || r.error || 'erreur inconnue'}`);
    } catch (e) {
      const msg = String((e as Error).message || e);
      setResult({ error: msg });
      showToast(UI.close, `Publication échouée : ${msg}`);
    }
    setPublishing(false);
  };

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Google Business</div>
          <h1>Publiez sur votre fiche Google</h1>
          <p>Diffusez des actualités et des photos sur vos fiches d’établissement, directement via l’API officielle Google Business Profile.</p>
        </div>
        {googleConnected && <button className="btn outline" onClick={disconnectGoogle}><Icon name="unlink" />Déconnecter Google</button>}
      </div>

      {!googleConnected ? (
        <div className="net-summary">
          <div className="ns-ic"><Brand name="google" /></div>
          <div>
            <div className="ns-t">Connectez votre compte Google Business</div>
            <div className="ns-s">Autorisez l’accès à vos fiches pour publier actualités &amp; photos.</div>
          </div>
          <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={connectGoogle}><RawIcon svg={UI.link} />Connecter Google Business</button>
        </div>
      ) : (
        <>
          {/* Locations / API access state */}
          {googleStatus === 'loading' && <div style={{ color: 'var(--tx-3)', fontSize: 13, marginBottom: 14 }}><span className="spin lt" style={{ display: 'inline-block', marginRight: 8 }} />Lecture de vos fiches…</div>}
          {googleReason && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--r-card)', border: '1px solid rgba(143,100,35,.35)', background: 'rgba(143,100,35,.08)', color: 'var(--warn)', fontSize: 13, marginBottom: 16 }}>
              Accès à l’API Google Business en attente : <b>{googleReason}</b><br />
              <span style={{ color: 'var(--tx-3)' }}>La publication s’activera dès que Google aura approuvé l’accès à la Business Profile API pour votre projet.</span>
            </div>
          )}
          {googleAccounts.length > 0 && (
            <div className="net-summary">
              <div className="ns-ic"><Brand name="google" /></div>
              <div>
                <div className="ns-t">{googleAccounts.length} fiche{googleAccounts.length > 1 ? 's' : ''} connectée{googleAccounts.length > 1 ? 's' : ''}</div>
                <div className="ns-s">{googleAccounts.map((a) => a.title).filter(Boolean).join(' · ') || 'Établissement(s) Google'}</div>
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-h"><h3>Nouvelle actualité</h3></div>
            <div className="pad" style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label className="field-lbl">Fiche établissement</label>
                {googleAccounts.length > 0 ? (
                  <select className="inp" value={path} onChange={(e) => setLoc(e.target.value)}>
                    {googleAccounts.map((a) => <option key={a.path} value={a.path}>{a.title || a.location}{a.address ? ` — ${a.address}` : ''}</option>)}
                  </select>
                ) : <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Aucune fiche listée pour l’instant (accès API en attente). Vous pouvez déjà rédiger.</div>}
              </div>
              <div className="field">
                <label className="field-lbl">Texte de l’actualité</label>
                <textarea className="inp" rows={5} maxLength={1500} placeholder="Annoncez une nouveauté, un atelier, une actualité de votre activité…" value={summary} onChange={(e) => setSummary(e.target.value)} />
                <div className="counter" style={{ marginTop: 6 }}><b>{summary.length}</b> / 1500</div>
              </div>
              <div className="km-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="field-lbl">Bouton (optionnel)</label>
                  <select className="inp" value={actionType} onChange={(e) => setActionType(e.target.value)}>
                    {CTAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-lbl">Lien du bouton</label>
                  <input className="inp" placeholder="https://efficiencemarketing.com/…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!actionType} />
                </div>
              </div>
              <div className="field">
                <label className="field-lbl">Photo — URL publique <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>(optionnel)</span></label>
                <input className="inp" placeholder="https://…/photo.jpg" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
                <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 5 }}>Google exige une URL d’image accessible publiquement. (L’upload de fichier local viendra ensuite.)</div>
              </div>

              {result && (
                <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas-soft)' }}>
                  {result.ok
                    ? <span style={{ color: 'var(--acc)' }}><RawIcon svg={UI.check} style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> Publiée{result.post?.searchUrl ? <> — <a href={result.post.searchUrl} target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>voir</a></> : ''}.</span>
                    : <span style={{ color: 'var(--warn)' }}>Non publiée : {result.reason || result.error}</span>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="grow" style={{ fontSize: 12, color: 'var(--tx-3)' }}>Publié en temps réel sur votre fiche Google.</span>
                <button className="btn acc" disabled={publishing || !summary.trim()} onClick={publish}>
                  {publishing ? <><span className="spin" />Publication…</> : <><Icon name="send" />Publier l’actualité</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

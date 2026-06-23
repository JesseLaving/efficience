import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { NETWORKS, type Network } from '../lib/networks';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { countUp } from '../lib/countup';
import { BUSINESS as BIZ } from '../lib/business';
import type { MetaAccount } from '../lib/meta';
import { LinkedInPostModal } from '../components/LinkedInPostModal';
import { MetaPostModal } from '../components/MetaPostModal';

const META_NETS = ['instagram', 'facebook'];

function FlashButton({ className, label, flash, onClick }: { className: string; label: string; flash: string; onClick?: () => void }) {
  const [txt, setTxt] = useState(label);
  return (
    <button className={className} onClick={() => { onClick?.(); setTxt(flash); setTimeout(() => setTxt(label), 1100); }}>{txt}</button>
  );
}

function ProfileBlock({ net, loading, acc }: { net: Network; loading: boolean; acc?: MetaAccount }) {
  if (loading) {
    return (
      <div className="nc-profile">
        <div className="skel av" />
        <div className="pi" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel txt" style={{ width: '62%' }} />
          <div className="skel txt" style={{ width: '44%' }} />
          <div className="skel txt" style={{ width: '30%', marginTop: 2 }} />
        </div>
      </div>
    );
  }
  const name = acc?.name || BIZ.name;
  const handle = acc?.handle || 'Compte connecté';
  return (
    <div className="nc-profile">
      <div className="ava-wrap">
        {acc?.picture
          ? <img className="ava" src={acc.picture} alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} />
          : <div className="ava">{BIZ.initials}</div>}
        <span className="pbadge"><Brand name={net.id as BrandName} /></span>
      </div>
      <div className="pi">
        <div className="pn">{name}<RawIcon svg={UI.check} className="vrf" /></div>
        <div className="ph">{handle}</div>
        <div className="pf"><b>{acc?.followers != null ? fr(acc.followers) : '—'}</b> abonnés{acc?.mediaCount != null ? ` · ${fr(acc.mediaCount)} publications` : ''}</div>
      </div>
    </div>
  );
}

function NetCard({ net }: { net: Network }) {
  const { phase, connect, disconnect, isConnected, accountFor, googleAccounts, googleReason, googleStatus, show, linkedinMe } = useEff();
  const [liModal, setLiModal] = useState(false);
  const [metaModal, setMetaModal] = useState(false);
  const isConn = isConnected(net.id);
  const ph = phase[net.id];
  const acc = accountFor(net.id);
  const meta = META_NETS.includes(net.id);
  const isGoogle = net.id === 'google';
  const isLinkedin = net.id === 'linkedin';

  let stateLbl: React.ReactNode, body: React.ReactNode, foot: React.ReactNode;

  if (isLinkedin && isConn) {
    stateLbl = <span className="nc-dot on"><i />Connecté</span>;
    body = (
      <div className="nc-profile">
        <div className="ava-wrap">
          {linkedinMe?.picture ? <img className="ava" src={linkedinMe.picture} alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} /> : <div className="nc-logo" style={{ width: 48, height: 48 }}><Brand name="linkedin" /></div>}
        </div>
        <div className="pi">
          <div className="pn">{linkedinMe?.name || 'Profil LinkedIn'}<RawIcon svg={UI.check} className="vrf" /></div>
          <div className="ph">Profil membre · publication activée</div>
          <div className="pf" style={{ color: 'var(--tx-3)' }}>Page entreprise : sur validation LinkedIn</div>
        </div>
      </div>
    );
    foot = <>
      <button className="btn ghost sm grow" onClick={() => setLiModal(true)}>Publier un post</button>
      <button className="unlink-btn" title="Déconnecter" onClick={() => disconnect('linkedin')}><Icon name="unlink" /></button>
    </>;
  } else if (isGoogle && isConn) {
    const g = googleAccounts[0];
    stateLbl = <span className="nc-dot on"><i />Connecté</span>;
    body = (
      <div className="nc-profile">
        <div className="ava-wrap"><div className="nc-logo" style={{ width: 48, height: 48 }}><Brand name="google" /></div></div>
        <div className="pi">
          <div className="pn">{g ? g.title : 'Compte Google'}<RawIcon svg={UI.check} className="vrf" /></div>
          <div className="ph">{g ? (g.address || 'Fiche d’établissement') : (googleStatus === 'loading' ? 'Lecture des fiches…' : 'Compte connecté')}</div>
          <div className="pf">{g ? <><b>{googleAccounts.length}</b> fiche{googleAccounts.length > 1 ? 's' : ''}</> : (googleReason ? <span style={{ color: 'var(--warn)' }}>Accès API en attente</span> : '—')}</div>
        </div>
      </div>
    );
    foot = <>
      <button className="btn ghost sm grow" onClick={() => show('planning')}>Publier une actualité</button>
      <button className="unlink-btn" title="Déconnecter" onClick={() => disconnect('google')}><Icon name="unlink" /></button>
    </>;
  } else if (ph === 'loading') {
    stateLbl = <span className="nc-dot on"><i />Import…</span>;
    body = <ProfileBlock net={net} loading />;
    foot = <button className="btn ghost sm grow" disabled style={{ opacity: 0.5 }}><span className="spin lt" />Récupération du profil…</button>;
  } else if (isConn && meta) {
    stateLbl = <span className="nc-dot on"><i />Connecté</span>;
    body = <ProfileBlock net={net} loading={false} acc={acc} />;
    foot = <>
      <button className="btn ghost sm grow" onClick={() => setMetaModal(true)}>Publier</button>
      <button className="unlink-btn" title="Déconnecter" onClick={() => disconnect(net.id)}><Icon name="unlink" /></button>
    </>;
  } else if (isConn) {
    stateLbl = <span className="nc-dot on"><i />Connecté</span>;
    body = <ProfileBlock net={net} loading={false} acc={acc} />;
    foot = <>
      <FlashButton className="btn ghost sm grow" label="Gérer la page" flash="Ouvrez votre app native" />
      <button className="unlink-btn" title="Déconnecter" onClick={() => disconnect(net.id)}><Icon name="unlink" /></button>
    </>;
  } else {
    const integrated = meta || isGoogle || isLinkedin;
    stateLbl = <span className="nc-dot"><i />Non connecté</span>;
    body = <div className="nc-avail"><div className="nc-desc">{net.desc}{!integrated ? <><br /><span style={{ color: 'var(--tx-3)', fontSize: 12 }}>Disponible après validation de l’app {net.name}.</span></> : null}</div></div>;
    foot = integrated
      ? <button className="btn acc sm grow" onClick={() => connect(net.id)}><RawIcon svg={UI.link} />Connecter</button>
      : <button className="btn outline sm grow" onClick={() => connect(net.id)}>Bientôt disponible</button>;
  }

  return (
    <div className={'net-card' + (isConn ? ' connected' : '')} data-net={net.id}>
      <div className="nc-top">
        <div className="nc-logo"><Brand name={net.id as BrandName} /></div>
        <div><div className="nc-name">{net.name}</div><div className="nc-kind">{net.kind}</div></div>
        <div className="nc-state">{stateLbl}</div>
      </div>
      <div className="nc-body">{body}</div>
      <div className="nc-foot">{foot}</div>
      {liModal && <LinkedInPostModal onClose={() => setLiModal(false)} />}
      {metaModal && <MetaPostModal onClose={() => setMetaModal(false)} defaultTargets={net.id === 'instagram' ? ['instagram'] : ['facebook']} />}
    </div>
  );
}

export function Connexion() {
  const { connectedCount, totalReach, connectAll, metaConnected, metaUser, metaStatus, metaError } = useEff();
  const reachRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { countUp(reachRef.current, totalReach); }, [totalReach]);

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Intégrations</div>
          <h1>Connexion des réseaux</h1>
          <p>Reliez vos pages réelles via la connexion officielle. Instagram &amp; Facebook importent votre vrai nom de page, votre photo et votre nombre d’abonnés. Les autres réseaux arriveront après validation de leurs apps.</p>
        </div>
        <button className="btn acc" onClick={connectAll}><RawIcon svg={UI.link} />{metaConnected ? 'Resynchroniser' : 'Connecter Instagram & Facebook'}</button>
      </div>

      {metaError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--r-card)', border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: 'var(--danger)', fontSize: 13 }}>
          Connexion Meta : {metaError}
        </div>
      )}

      <div className="net-summary">
        <div className="ns-ic"><Icon name="target" /></div>
        <div>
          <div className="ns-t"><span>{connectedCount}</span> réseau{connectedCount > 1 ? 'x' : ''} connecté{connectedCount > 1 ? 's' : ''}{metaUser ? ` · compte Meta : ${metaUser}` : ''}</div>
          <div className="ns-s">{metaStatus === 'loading' ? 'Récupération de vos données Meta…' : 'Données officielles importées via l’API Meta.'}</div>
        </div>
        <div className="ns-stat">
          <b><span ref={reachRef}>{fr(totalReach)}</span></b>
          <span>abonnés cumulés</span>
        </div>
      </div>

      <div className="net-grid">
        {NETWORKS.map((n) => <NetCard key={n.id} net={n} />)}
      </div>
    </section>
  );
}

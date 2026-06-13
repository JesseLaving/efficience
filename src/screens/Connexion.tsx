import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { NETWORKS, type Network } from '../lib/networks';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { countUp } from '../lib/countup';

function FlashButton({ className, label, flash, onClick }: { className: string; label: string; flash: string; onClick?: () => void }) {
  const [txt, setTxt] = useState(label);
  return (
    <button
      className={className}
      onClick={() => { onClick?.(); setTxt(flash); setTimeout(() => setTxt(label), 1100); }}
    >{txt}</button>
  );
}

function ProfileBlock({ net, loading }: { net: Network; loading: boolean }) {
  const p = net.page;
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
  const metric = p.rating
    ? <><b>{p.handle.split(' ')[0]}</b> · {fr(p.metricN)} {p.metric}</>
    : <><b>{fr(p.metricN)}</b> {p.metric}</>;
  return (
    <div className="nc-profile">
      <div className="ava-wrap">
        <div className="ava">BM</div>
        <span className="pbadge"><Brand name={net.id as BrandName} /></span>
      </div>
      <div className="pi">
        <div className="pn">{p.name}{p.verified && <RawIcon svg={UI.check} className="vrf" />}</div>
        <div className="ph">{p.rating ? 'Établissement vérifié' : p.handle}</div>
        <div className="pf">{metric}</div>
      </div>
    </div>
  );
}

function NetCard({ net }: { net: Network }) {
  const { connected, phase, connect, disconnect } = useEff();
  const isConn = !!connected[net.id];
  const ph = phase[net.id];

  let stateLbl: React.ReactNode, body: React.ReactNode, foot: React.ReactNode;

  if (ph === 'connecting') {
    stateLbl = <span className="nc-dot"><i />Connexion</span>;
    body = <div className="nc-connecting"><span className="spin lt" />Connexion sécurisée à {net.name}…</div>;
    foot = <button className="btn ghost sm grow" disabled style={{ opacity: 0.5 }}>Autorisation OAuth…</button>;
  } else if (ph === 'loading' || isConn) {
    const loading = ph === 'loading';
    stateLbl = <span className="nc-dot on"><i />{loading ? 'Import…' : 'Connecté'}</span>;
    body = <ProfileBlock net={net} loading={loading} />;
    foot = loading
      ? <button className="btn ghost sm grow" disabled style={{ opacity: 0.5 }}><span className="spin lt" />Récupération du profil…</button>
      : <>
          <FlashButton className="btn ghost sm grow" label="Gérer la page" flash="Page gérée" />
          <button className="unlink-btn" title="Déconnecter" onClick={() => disconnect(net.id)}><Icon name="unlink" /></button>
        </>;
  } else {
    stateLbl = <span className="nc-dot"><i />Non connecté</span>;
    body = <div className="nc-avail"><div className="nc-desc">{net.desc}</div></div>;
    foot = <button className="btn acc sm grow" onClick={() => connect(net.id)}><RawIcon svg={UI.link} />Connecter</button>;
  }

  return (
    <div className={'net-card' + (isConn && ph !== 'loading' ? ' connected' : '')} data-net={net.id}>
      <div className="nc-top">
        <div className="nc-logo"><Brand name={net.id as BrandName} /></div>
        <div><div className="nc-name">{net.name}</div><div className="nc-kind">{net.kind}</div></div>
        <div className="nc-state">{stateLbl}</div>
      </div>
      <div className="nc-body">{body}</div>
      <div className="nc-foot">{foot}</div>
    </div>
  );
}

export function Connexion() {
  const { connectedCount, totalReach, connectAll } = useEff();
  const reachRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    countUp(reachRef.current, totalReach);
  }, [totalReach]);

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Intégrations</div>
          <h1>Connexion des réseaux</h1>
          <p>Reliez les pages de votre client en un clic. Efficience importe automatiquement la photo de profil, le nom et les statistiques de chaque page.</p>
        </div>
        <button className="btn acc" onClick={connectAll}><RawIcon svg={UI.link} />Tout connecter</button>
      </div>

      <div className="net-summary">
        <div className="ns-ic"><Icon name="target" /></div>
        <div>
          <div className="ns-t"><span>{connectedCount}</span> réseaux connectés sur 8</div>
          <div className="ns-s">Synchronisation automatique des profils et des statistiques toutes les heures.</div>
        </div>
        <div className="ns-stat">
          <b><span ref={reachRef}>{fr(totalReach)}</span></b>
          <span>audience cumulée</span>
        </div>
      </div>

      <div className="net-grid">
        {NETWORKS.map((n) => <NetCard key={n.id} net={n} />)}
      </div>
    </section>
  );
}

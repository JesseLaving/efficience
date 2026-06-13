import { useEff } from '../state/EffContext';
import { Icon } from '../lib/Icon';
import type { UIName } from '../lib/icons';

export function Placeholder({ icon, title, sub }: { icon: UIName; title: string; sub: string }) {
  const { show } = useEff();
  return (
    <section className="screen show anim">
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '62vh', textAlign: 'center' }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 18px', borderRadius: 18, display: 'grid', placeItems: 'center', color: 'var(--acc)', background: 'var(--acc-soft)', border: '1px solid var(--acc-soft2)' }}>
            <Icon name={icon} style={{ width: 30, height: 30 }} />
          </div>
          <div style={{ fontFamily: 'var(--ff-disp)', fontSize: 24, fontWeight: 600 }}>{title}</div>
          <p style={{ color: 'var(--tx-2)', margin: '10px 0 22px' }}>{sub}</p>
          <button className="btn ghost" onClick={() => show('dashboard')}>Retour à la vue d’ensemble</button>
        </div>
      </div>
    </section>
  );
}

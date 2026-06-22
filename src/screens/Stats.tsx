import { useEffect, useState } from 'react';
import { useEff } from '../state/EffContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { getStoredMetaToken, fetchMetaStats, type MetaStatAccount, type MetaPost } from '../lib/meta';

const shortDate = (s: string | null) => {
  if (!s) return '';
  const d = s.split('T')[0].split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}` : s;
};
const heartSvg = UI.heart;
const commentSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 20.5l1.5-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>`;
const shareSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3 11 14M22 3l-7 19-4-8-8-4z"/></svg>`;

function PostCard({ p }: { p: MetaPost }) {
  return (
    <a className="stat-post" href={p.permalink || '#'} target="_blank" rel="noopener" title={p.caption}>
      <div className="sp-media">
        {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="sp-noimg"><Icon name={p.network === 'instagram' ? 'image' : 'mail'} /></div>}
        {p.type === 'video' || p.type === 'reels' ? <span className="sp-badge"><RawIcon svg={UI.play} /></span> : null}
      </div>
      <div className="sp-body">
        <div className="sp-cap">{p.caption ? p.caption.slice(0, 90) : <span style={{ color: 'var(--tx-3)' }}>Sans légende</span>}</div>
        <div className="sp-meta">
          <span><RawIcon svg={heartSvg} />{p.likes != null ? fr(p.likes) : '—'}</span>
          <span><RawIcon svg={commentSvg} />{p.comments != null ? fr(p.comments) : '—'}</span>
          {p.shares != null && <span><RawIcon svg={shareSvg} />{fr(p.shares)}</span>}
          <span className="grow" />
          <span className="sp-date">{shortDate(p.date)}</span>
        </div>
      </div>
    </a>
  );
}

function AccountBlock({ a }: { a: MetaStatAccount }) {
  const s = a.summary;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="nc-logo" style={{ width: 38, height: 38 }}><Brand name={a.network as BrandName} /></div>
          <div>
            <h3>{a.name || a.network}</h3>
            <div className="sub">{a.followers != null ? `${fr(a.followers)} abonnés` : '—'}{a.mediaCount != null ? ` · ${fr(a.mediaCount)} publications` : ''}</div>
          </div>
        </div>
      </div>
      <div className="pad">
        <div className="crm-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 4 }}>
          <div className="crm-stat"><div className="cs-l"><Icon name="image" />Posts analysés</div><div className="cs-v">{s.posts}</div></div>
          <div className="crm-stat"><div className="cs-l"><RawIcon svg={heartSvg} />J’aime (total)</div><div className="cs-v">{fr(s.likes)}</div></div>
          <div className="crm-stat"><div className="cs-l"><RawIcon svg={commentSvg} />Commentaires</div><div className="cs-v">{fr(s.comments)}</div></div>
          <div className="crm-stat"><div className="cs-l"><Icon name="heart" />Engagement moy.</div><div className="cs-v">{fr(s.avgEngagement)}{s.engagementRate != null ? <span style={{ fontSize: 13, color: 'var(--tx-3)', fontFamily: 'var(--ff)', marginLeft: 6 }}>{s.engagementRate.toFixed(2).replace('.', ',')} %</span> : null}</div></div>
        </div>
        {a.insights.available ? (
          <div className="disc-info-row" style={{ marginTop: 8 }}>
            <span className="k"><Icon name="eye" style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> Insights · 28 j</span>
            <span className="v" style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>
              {a.insights.reach != null ? `Portée ${fr(a.insights.reach)}` : ''}
              {a.insights.engagement != null ? ` · Engagements ${fr(a.insights.engagement)}` : ''}
              {a.insights.impressions != null ? ` · Impressions ${fr(a.insights.impressions)}` : ''}
            </span>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--tx-3)' }}>
            {a.insights.reason
              ? <>Insights indisponibles — <span style={{ color: 'var(--warn)' }}>{a.insights.reason}</span></>
              : <>Portée &amp; impressions : à activer ({a.network === 'instagram' ? 'permission instagram_manage_insights' : 'permission read_insights'}).</>}
          </div>
        )}
      </div>
      {s.posts > 0 ? (
        <div className="pad" style={{ paddingTop: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx-3)', margin: '4px 0 12px' }}>Publications récentes</div>
          <div className="stat-grid">{a.posts.map((p) => <PostCard key={p.id} p={p} />)}</div>
        </div>
      ) : (
        <div className="pad" style={{ color: 'var(--tx-3)', fontSize: 13 }}>
          {a.postsReason
            ? <>Publications non récupérées — <span style={{ color: 'var(--warn)' }}>{a.postsReason}</span></>
            : a.network === 'facebook'
              ? 'Aucune publication native récente sur cette Page Facebook (l’API ne renvoie pas les contenus publiés uniquement via Instagram).'
              : 'Aucune publication récente récupérée pour ce compte.'}
        </div>
      )}
    </div>
  );
}

export function Stats() {
  const { metaConnected, show } = useEff();
  const [accounts, setAccounts] = useState<MetaStatAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const token = getStoredMetaToken();
    if (!token) return;
    setLoading(true); setError(null);
    fetchMetaStats(token)
      .then((d) => setAccounts(d.accounts || []))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (metaConnected) load(); /* eslint-disable-next-line */ }, [metaConnected]);

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Statistiques</div>
          <h1>Performances de vos réseaux</h1>
          <p>Données réelles importées via l’API officielle Meta : publications récentes, j’aime, commentaires et partages. Portée &amp; impressions arriveront avec la permission insights avancée.</p>
        </div>
        {metaConnected && <button className="btn outline" onClick={load} disabled={loading}>{loading ? <><span className="spin lt" />Chargement…</> : <><Icon name="refresh" />Actualiser</>}</button>}
      </div>

      {!metaConnected && (
        <div className="net-summary">
          <div className="ns-ic"><Icon name="target" /></div>
          <div>
            <div className="ns-t">Aucun réseau connecté</div>
            <div className="ns-s">Connectez Instagram &amp; Facebook pour voir vos statistiques réelles.</div>
          </div>
          <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => show('connexion')}><RawIcon svg={UI.link} />Connecter mes réseaux</button>
        </div>
      )}

      {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--r-card)', border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>Erreur : {error}</div>}
      {metaConnected && loading && !accounts && <div style={{ color: 'var(--tx-3)', fontSize: 13, padding: 24, textAlign: 'center' }}><span className="spin lt" style={{ display: 'inline-block', marginRight: 8 }} />Récupération de vos publications…</div>}
      {accounts && accounts.map((a) => <AccountBlock key={a.network + (a.name || '')} a={a} />)}
    </section>
  );
}

import { useEff } from '../state/EffContext';
import { useConnections } from '../state/ConnectionsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { type MetaStatAccount, type MetaPost } from '../lib/meta';
import { type GoogleLocation } from '../lib/google';
import { type LinkedInMe } from '../lib/linkedin';

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

function LinkedInBlock({ me }: { me: LinkedInMe }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {me.picture
            ? <img src={me.picture} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
            : <div className="nc-logo" style={{ width: 38, height: 38 }}><Brand name={'linkedin' as BrandName} /></div>}
          <div>
            <h3>{me.name || 'Profil LinkedIn'}</h3>
            <div className="sub"><Brand name={'linkedin' as BrandName} /> {me.email || 'Profil membre connecté'}</div>
          </div>
        </div>
      </div>
      <div className="pad" style={{ color: 'var(--tx-3)', fontSize: 13 }}>
        Profil membre connecté — vous pouvez publier depuis le <b style={{ color: 'var(--tx-2)' }}>Studio</b>.
        Les statistiques détaillées (abonnés, impressions de posts) nécessitent l’API LinkedIn <span style={{ color: 'var(--warn)' }}>Community Management</span> (accès partenaire soumis à validation) — non disponible pour le moment.
      </div>
    </div>
  );
}

function GoogleBlock({ accounts, reason }: { accounts: GoogleLocation[]; reason: string | null }) {
  const n = accounts.length;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="nc-logo" style={{ width: 38, height: 38 }}><Brand name={'google' as BrandName} /></div>
          <div>
            <h3>Google Business</h3>
            <div className="sub">{n ? `${n} fiche${n > 1 ? 's' : ''} connectée${n > 1 ? 's' : ''}` : 'Compte connecté'}</div>
          </div>
        </div>
      </div>
      <div className="pad">
        {n ? accounts.map((g) => (
          <div key={g.path} className="disc-info-row" style={{ marginBottom: 8 }}>
            <span className="k"><Icon name="target" style={{ width: 14, height: 14, display: 'inline-grid', verticalAlign: -2 }} /> {g.title || 'Fiche'}</span>
            <span className="v" style={{ fontSize: 12.5 }}>
              {g.address || ''}
              {g.website ? <> · <a href={g.website} target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>{g.website.replace(/^https?:\/\//, '')}</a></> : null}
            </span>
          </div>
        )) : (
          <div style={{ color: 'var(--tx-3)', fontSize: 13 }}>
            {reason
              ? <>Fiches non récupérées — <span style={{ color: 'var(--warn)' }}>{reason}</span></>
              : 'Aucune fiche d’établissement récupérée sur ce compte Google.'}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--tx-3)' }}>
          Vues de la fiche, recherches &amp; avis : nécessitent l’API <span style={{ color: 'var(--warn)' }}>Google Business Profile Performance</span> (à activer dans votre projet Google Cloud).
        </div>
      </div>
    </div>
  );
}

export function Stats() {
  const { show } = useEff();
  const {
    metaConnected, metaStats, metaStatsStatus, metaStatsError, refreshMetaStats,
    linkedinConnected, linkedinMe, googleConnected, googleAccounts, googleReason,
  } = useConnections();
  const accounts = metaStats;
  const loading = metaStatsStatus === 'loading';
  const error = metaStatsError;
  const anyConnected = metaConnected || linkedinConnected || googleConnected;

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Statistiques</div>
          <h1>Performances de vos réseaux</h1>
          <p>Données réelles importées via les API officielles de vos réseaux connectés : Instagram &amp; Facebook (publications, j’aime, commentaires, partages), LinkedIn et Google Business. Certaines métriques avancées (portée, vues de fiche, abonnés LinkedIn) nécessitent des accès API supplémentaires.</p>
        </div>
        {metaConnected && <button className="btn outline" onClick={refreshMetaStats} disabled={loading}>{loading ? <><span className="spin lt" />Chargement…</> : <><Icon name="refresh" />Actualiser</>}</button>}
      </div>

      {!anyConnected && (
        <div className="net-summary">
          <div className="ns-ic"><Icon name="target" /></div>
          <div>
            <div className="ns-t">Aucun réseau connecté</div>
            <div className="ns-s">Connectez Instagram, Facebook, LinkedIn ou Google Business pour voir vos statistiques réelles.</div>
          </div>
          <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => show('connexion')}><RawIcon svg={UI.link} />Connecter mes réseaux</button>
        </div>
      )}

      {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--r-card)', border: '1px solid rgba(179,69,59,.35)', background: 'rgba(179,69,59,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>Erreur : {error}</div>}
      {metaConnected && loading && !accounts && <div style={{ color: 'var(--tx-3)', fontSize: 13, padding: 24, textAlign: 'center' }}><span className="spin lt" style={{ display: 'inline-block', marginRight: 8 }} />Récupération de vos publications…</div>}
      {accounts && accounts.map((a) => <AccountBlock key={a.network + (a.name || '')} a={a} />)}
      {linkedinConnected && linkedinMe && <LinkedInBlock me={linkedinMe} />}
      {googleConnected && <GoogleBlock accounts={googleAccounts} reason={googleReason} />}
    </section>
  );
}

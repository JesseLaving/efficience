import { useEffect, useMemo, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useConnections } from '../state/ConnectionsContext';
import { useCalendar } from '../state/CalendarContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { netName } from '../lib/networks';
import { showToast } from '../lib/toast';
import { getStoredGoogleRefresh } from '../lib/google';
import { getBusiness } from '../lib/business';
import { syncPostsToCalendar } from '../lib/googleCalendar';
import { armAutoPublish, disarmAutoPublish, listServerScheduled } from '../lib/schedule';
import { PublishPanel } from '../components/PublishPanel';
import type { ScheduledPost } from '../lib/calendar';

const NETS = ['instagram', 'facebook', 'linkedin', 'google'];

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtTime = (iso: string) => (iso.split('T')[1] || '').slice(0, 5);
const dayKey = (iso: string) => iso.split('T')[0];

function StatusBadge({ s }: { s: ScheduledPost['status'] }) {
  if (s === 'published') return <span style={{ fontSize: 11.5, color: 'var(--acc)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><RawIcon svg={UI.check} style={{ width: 12, height: 12, display: 'inline-grid' }} />Publié</span>;
  if (s === 'failed') return <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>Échec</span>;
  return <span style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><RawIcon svg={UI.clock} style={{ width: 12, height: 12, display: 'inline-grid' }} />Programmé</span>;
}

export function Calendar() {
  const { show } = useEff();
  const { scheduled, updateCalendar, removeFromCalendar } = useCalendar();
  const {
    isConnected, metaToken, linkedinToken, googleToken, googleAccounts,
    gcalConnected, gcalToken, gcalCalendarId, gcalCalendarName,
    connectGcal, disconnectGcal, refreshGcalToken, createGcalCalendar,
  } = useConnections();
  const [publishing, setPublishing] = useState<ScheduledPost | null>(null);
  const [arming, setArming] = useState<string | null>(null);
  const [creatingCal, setCreatingCal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const createCalendar = async () => {
    setCreatingCal(true);
    const res = await createGcalCalendar(`Éditorial — ${getBusiness().name}`);
    setCreatingCal(false);
    if (res.ok) showToast(UI.check, `Agenda « ${res.summary} » créé`);
    else showToast(UI.close, res.reason || 'Échec de la création de l’agenda.');
  };

  const syncCalendar = async () => {
    if (!gcalToken || !gcalCalendarId || !scheduled.length) return;
    setSyncing(true);
    const events = scheduled.map((p) => ({ id: p.id, dateTime: p.dateTime, text: p.text, networks: p.networks, googleEventId: p.googleEventId || undefined }));
    let res = await syncPostsToCalendar(gcalToken, gcalCalendarId, events);
    // Le jeton expire après ~1h — si tout a échoué, un rafraîchissement puis un
    // seul nouvel essai avant de renoncer, comme pour Google Business/YouTube.
    if ((res.results || []).length && (res.results || []).every((r) => !r.ok)) {
      const fresh = await refreshGcalToken();
      if (fresh) res = await syncPostsToCalendar(fresh, gcalCalendarId, events);
    }
    const results = res.results || [];
    results.forEach((r) => { if (r.ok && r.googleEventId) updateCalendar(r.id, { googleEventId: r.googleEventId }); });
    setSyncing(false);
    if (!results.length) { showToast(UI.close, res.reason || 'Échec de la synchronisation.'); return; }
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    if (okCount) showToast(UI.check, `${okCount} publication${okCount > 1 ? 's' : ''} synchronisée${okCount > 1 ? 's' : ''} avec Google Agenda`);
    if (failCount) showToast(UI.close, `${failCount} échec${failCount > 1 ? 's' : ''} de synchronisation`);
  };

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>();
    for (const p of scheduled) { const k = dayKey(p.dateTime); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }
    return Array.from(m.entries());
  }, [scheduled]);

  // Synchronise les statuts depuis le serveur (le cron a pu publier des posts armés).
  useEffect(() => {
    if (!scheduled.some((p) => p.auto)) return;
    let alive = true;
    listServerScheduled().then((d) => {
      if (!alive || !d.ok || !d.posts) return;
      for (const sp of d.posts) {
        const local = scheduled.find((p) => p.id === sp.id);
        if (local && local.auto && sp.status !== 'scheduled' && local.status !== sp.status) {
          updateCalendar(local.id, { status: sp.status as ScheduledPost['status'], lastResult: sp.lastResult || null });
        }
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleNet = (p: ScheduledPost, net: string) => {
    const has = p.networks.includes(net);
    updateCalendar(p.id, { networks: has ? p.networks.filter((n) => n !== net) : [...p.networks, net] });
  };

  const arm = async (p: ScheduledPost) => {
    setArming(p.id);
    const tokens: Parameters<typeof armAutoPublish>[1] = {};
    if (p.networks.some((n) => n === 'instagram' || n === 'facebook') && metaToken) tokens.meta = metaToken;
    if (p.networks.includes('linkedin') && linkedinToken) tokens.linkedin = linkedinToken;
    if (p.networks.includes('google') && googleToken) tokens.google = { token: googleToken, refresh: getStoredGoogleRefresh(), paths: googleAccounts.map((a) => a.path) };
    const whenMs = Date.parse(p.dateTime);
    const r = await armAutoPublish({ id: p.id, whenMs, dateTime: p.dateTime, text: p.text, networks: p.networks, photoUrl: p.photoUrl || null, pillar: p.pillar || null }, tokens);
    setArming(null);
    if (r.ok) { updateCalendar(p.id, { auto: true }); showToast(UI.check, 'Auto-publication activée'); }
    else showToast(UI.close, r.reason || 'Auto-publication indisponible');
  };
  const disarm = async (p: ScheduledPost) => {
    setArming(p.id);
    await disarmAutoPublish(p.id);
    setArming(null);
    updateCalendar(p.id, { auto: false });
    showToast(UI.check, 'Auto-publication désactivée');
  };

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Calendrier de programmation</div>
          <h1>Vos publications programmées</h1>
          <p>Les posts ajoutés depuis le <b style={{ color: 'var(--tx-2)' }}>Planning éditorial</b> arrivent ici. Choisissez la date, l’heure et les réseaux, puis publiez en un clic le moment venu.</p>
        </div>
        <button className="btn outline" onClick={() => show('planning')}><Icon name="calendar" />Planning éditorial</button>
      </div>

      <div style={{ padding: '12px 16px', borderRadius: 'var(--r-card)', border: '1px solid rgba(143,100,35,.3)', background: 'rgba(143,100,35,.07)', color: 'var(--tx-2)', fontSize: 12.5, marginBottom: 16 }}>
        <b style={{ color: 'var(--acc)' }}>Auto-publier</b> = publication automatique à l’heure prévue, même app fermée (moteur serveur). <b>Publier</b> = diffusion immédiate en 1 clic. L’auto-publication nécessite l’activation du store serveur (Vercel KV) et du cron — voir la doc.
      </div>

      <div className="net-summary" style={{ marginBottom: 16 }}>
        <div className="ns-ic"><Icon name="calendar" /></div>
        <div>
          <div className="ns-t">Google Agenda</div>
          <div className="ns-s">
            {!gcalConnected
              ? 'Créez un agenda Google dédié à votre planning éditorial et synchronisez vos publications programmées.'
              : !gcalCalendarId
                ? 'Connecté — créez l’agenda dédié pour commencer à synchroniser.'
                : `Synchronisé avec « ${gcalCalendarName} ».`}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {!gcalConnected && (
            <button className="btn outline sm" onClick={connectGcal}><Icon name="link" />Connecter Google Agenda</button>
          )}
          {gcalConnected && !gcalCalendarId && (
            <button className="btn acc sm" disabled={creatingCal} onClick={createCalendar}>
              {creatingCal ? <span className="spin lt" /> : <Icon name="plus" />}Créer l’agenda
            </button>
          )}
          {gcalConnected && gcalCalendarId && (
            <button className="btn acc sm" disabled={syncing || !scheduled.length} onClick={syncCalendar} title={!scheduled.length ? 'Aucune publication programmée à synchroniser' : undefined}>
              {syncing ? <span className="spin lt" /> : <Icon name="refresh" />}Synchroniser
            </button>
          )}
          {gcalConnected && (
            <button className="unlink-btn" title="Déconnecter Google Agenda" aria-label="Déconnecter Google Agenda" onClick={disconnectGcal}><Icon name="unlink" /></button>
          )}
        </div>
      </div>

      {!scheduled.length ? (
        <div className="net-summary">
          <div className="ns-ic"><Icon name="calendar" /></div>
          <div>
            <div className="ns-t">Aucune publication programmée</div>
            <div className="ns-s">Ouvrez le Planning éditorial et cliquez « Programmer » sur un post.</div>
          </div>
          <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => show('planning')}><Icon name="calendar" />Aller au planning</button>
        </div>
      ) : (
        byDay.map(([day, posts]) => (
          <div className="card" style={{ marginBottom: 16 }} key={day}>
            <div className="card-h">
              <h3 style={{ textTransform: 'capitalize' }}>{fmtDay(posts[0].dateTime)}</h3>
              <div className="sub">{posts.length} publication{posts.length > 1 ? 's' : ''}</div>
            </div>
            <div className="pad" style={{ display: 'grid', gap: 12 }}>
              {posts.map((p) => (
                <div key={p.id} style={{ padding: '14px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--canvas-soft)' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 56, height: 56, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--canvas)', color: 'var(--tx-3)', flexShrink: 0 }}><Icon name="image" /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <input type="time" value={fmtTime(p.dateTime)} onChange={(e) => updateCalendar(p.id, { dateTime: dayKey(p.dateTime) + 'T' + (e.target.value || '09:00') })}
                          className="inp" style={{ width: 110, padding: '5px 8px', fontSize: 13 }} />
                        <StatusBadge s={p.status} />
                        {p.pillar && <span style={{ fontSize: 11, color: 'var(--acc)' }}>· {p.pillar}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--tx)', whiteSpace: 'pre-wrap', maxHeight: 96, overflow: 'hidden', lineHeight: 1.4 }}>{p.text}</div>
                      {p.lastResult && <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 6 }}>{p.lastResult}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {NETS.map((net) => {
                      const on = p.networks.includes(net);
                      const conn = isConnected(net);
                      return (
                        <button key={net} onClick={() => toggleNet(p, net)} title={conn ? netName(net) : netName(net) + ' (non connecté)'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                            border: '1px solid ' + (on ? 'var(--acc)' : 'var(--line)'), background: on ? 'var(--acc-soft)' : 'transparent',
                            color: on ? 'var(--acc)' : 'var(--tx-3)', opacity: conn ? 1 : 0.6 }}>
                          <span style={{ width: 14, height: 14, display: 'inline-grid' }}><Brand name={net as BrandName} /></span>{netName(net)}
                        </button>
                      );
                    })}
                    <span style={{ flex: 1 }} />
                    <button className="btn ghost sm" onClick={() => removeFromCalendar(p.id)} title="Supprimer"><Icon name="trash" /></button>
                    {p.auto ? (
                      <button className="btn outline sm" disabled={arming === p.id} onClick={() => disarm(p)} title="Désactiver l'auto-publication">
                        {arming === p.id ? <span className="spin lt" /> : <Icon name="clock" />}Auto activée
                      </button>
                    ) : (
                      <button className="btn outline sm" disabled={arming === p.id || !p.networks.some((n) => isConnected(n))} onClick={() => arm(p)} title="Publier automatiquement à l'heure prévue">
                        {arming === p.id ? <span className="spin lt" /> : <Icon name="clock" />}Auto-publier
                      </button>
                    )}
                    <button className="btn acc sm" disabled={!p.networks.length || !p.networks.some((n) => isConnected(n))} onClick={() => setPublishing(p)}>
                      <Icon name="send" />Publier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {publishing && (
        <PublishPanel
          text={publishing.text}
          platforms={publishing.networks}
          localMedia={false}
          defaultPhotoUrl={publishing.photoUrl || null}
          onClose={() => setPublishing(null)}
        />
      )}
    </section>
  );
}

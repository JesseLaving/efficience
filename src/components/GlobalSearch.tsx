import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { useContacts } from '../state/ContactsContext';
import { useCalendar } from '../state/CalendarContext';
import { useCampaigns } from '../state/CampaignsContext';
import { CATALOG, loadKpiState } from '../lib/kpi';
import { Icon } from '../lib/Icon';

const MAX_PER_GROUP = 6;

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<string, string> = { sent: 'Envoyée', sched: 'Programmée', draft: 'Brouillon' };

/** Recherche globale (⌘K) — contacts, publications programmées, campagnes
    e-mail et KPI affichés sur le tableau de bord : les seules sources de
    données réellement persistées et interrogeables. */
export function GlobalSearch() {
  const { show } = useEff();
  const { contacts } = useContacts();
  const { scheduled } = useCalendar();
  const { campaigns } = useCampaigns();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      else if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  const nq = norm(q.trim());
  const contactResults = useMemo(() => {
    if (!nq) return [];
    return contacts.filter((c) => norm(c.name).includes(nq) || norm(c.email).includes(nq) || (c.phone && c.phone.includes(nq))).slice(0, MAX_PER_GROUP);
  }, [contacts, nq]);
  const postResults = useMemo(() => {
    if (!nq) return [];
    return scheduled.filter((p) => norm(p.text).includes(nq) || (p.pillar && norm(p.pillar).includes(nq))).slice(0, MAX_PER_GROUP);
  }, [scheduled, nq]);
  const campaignResults = useMemo(() => {
    if (!nq) return [];
    return campaigns.filter((c) => norm(c.name).includes(nq) || norm(c.seg).includes(nq)).slice(0, MAX_PER_GROUP);
  }, [campaigns, nq]);
  // Board KPI IDs (re-read when the modal opens — cheap localStorage read,
  // and picks up any change made on the Dashboard since the last search).
  const kpiIds = useMemo(() => {
    if (!open) return [];
    const s = loadKpiState();
    return Array.from(new Set([...s.board, ...Object.keys(s.custom || {})]));
  }, [open]);
  const kpiResults = useMemo(() => {
    if (!nq) return [];
    const kpiState = loadKpiState();
    return kpiIds
      .map((id) => ({ id, def: CATALOG[id] || kpiState.custom[id] }))
      .filter((k) => k.def && norm(k.def.label).includes(nq))
      .slice(0, MAX_PER_GROUP);
  }, [kpiIds, nq]);
  const hasResults = contactResults.length > 0 || postResults.length > 0 || campaignResults.length > 0 || kpiResults.length > 0;

  const goTo = (screen: 'contacts' | 'calendar' | 'campagnes' | 'dashboard') => { show(screen); setOpen(false); };

  return (
    <>
      <button type="button" className="search" onClick={() => setOpen(true)}>
        <Icon name="search" />Rechercher un post, un client, un mot-clé…<kbd>⌘K</kbd>
      </button>
      {open && createPortal(
        <div className="search-modal" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="search-card">
            <div className="search-inp-row">
              <Icon name="search" />
              <input
                ref={inputRef} className="search-inp" placeholder="Rechercher un client, une publication, une campagne, un KPI…"
                value={q} onChange={(e) => setQ(e.target.value)}
              />
              <kbd>Échap</kbd>
            </div>
            <div className="search-results">
              {!nq ? (
                <div className="search-empty">Commencez à taper pour chercher dans vos clients, votre calendrier, vos campagnes et vos KPI.</div>
              ) : !hasResults ? (
                <div className="search-empty">Aucun résultat pour « {q} ».</div>
              ) : (
                <>
                  {contactResults.length > 0 && (
                    <div className="search-grp">
                      <div className="search-grp-lbl">Clients</div>
                      {contactResults.map((c) => (
                        <button key={c.id} type="button" className="search-item" onClick={() => goTo('contacts')}>
                          <Icon name="users" />
                          <div className="search-item-t">
                            <div className="search-item-n">{c.name}</div>
                            <div className="search-item-s">{c.email || c.phone || ''}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {postResults.length > 0 && (
                    <div className="search-grp">
                      <div className="search-grp-lbl">Calendrier</div>
                      {postResults.map((p) => (
                        <button key={p.id} type="button" className="search-item" onClick={() => goTo('calendar')}>
                          <Icon name="clock" />
                          <div className="search-item-t">
                            <div className="search-item-n">{p.text.slice(0, 70)}{p.text.length > 70 ? '…' : ''}</div>
                            <div className="search-item-s">{fmtDate(p.dateTime)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {campaignResults.length > 0 && (
                    <div className="search-grp">
                      <div className="search-grp-lbl">Campagnes</div>
                      {campaignResults.map((c, i) => (
                        <button key={`${c.name}-${i}`} type="button" className="search-item" onClick={() => goTo('campagnes')}>
                          <Icon name="mail" />
                          <div className="search-item-t">
                            <div className="search-item-n">{c.name}</div>
                            <div className="search-item-s">{c.seg} · {STATUS_LABEL[c.status] || c.status}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {kpiResults.length > 0 && (
                    <div className="search-grp">
                      <div className="search-grp-lbl">KPI</div>
                      {kpiResults.map((k) => (
                        <button key={k.id} type="button" className="search-item" onClick={() => goTo('dashboard')}>
                          <Icon name="chart" />
                          <div className="search-item-t">
                            <div className="search-item-n">{k.def.label}</div>
                            <div className="search-item-s">Tableau de bord</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

import { lazy, Suspense, useEffect, useState } from 'react';
import { useEff, type ScreenId } from './state/EffContext';
import { useConnections } from './state/ConnectionsContext';
import { useContacts } from './state/ContactsContext';
import { Icon } from './lib/Icon';
import { fr } from './lib/format';
import { Placeholder } from './screens/Placeholder';
import { NotificationBell } from './components/NotificationBell';
import { GlobalSearch } from './components/GlobalSearch';
import type { UIName } from './lib/icons';

const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })));
const Connexion = lazy(() => import('./screens/Connexion').then((m) => ({ default: m.Connexion })));
const Contacts = lazy(() => import('./screens/Contacts').then((m) => ({ default: m.Contacts })));
const Campagnes = lazy(() => import('./screens/Campagnes').then((m) => ({ default: m.Campagnes })));
const Studio = lazy(() => import('./screens/Studio').then((m) => ({ default: m.Studio })));
const Analyse = lazy(() => import('./screens/Analyse').then((m) => ({ default: m.Analyse })));
const Stats = lazy(() => import('./screens/Stats').then((m) => ({ default: m.Stats })));
const EditorialPlanning = lazy(() => import('./screens/EditorialPlanning').then((m) => ({ default: m.EditorialPlanning })));
const Calendar = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.Calendar })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));
const Onboarding = lazy(() => import('./components/Onboarding').then((m) => ({ default: m.Onboarding })));

interface NavItem { screen: ScreenId; icon: UIName; label: string; }

const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Pilotage', items: [
    { screen: 'dashboard', icon: 'grid', label: 'Vue d’ensemble' },
    { screen: 'connexion', icon: 'link', label: 'Connexion des réseaux' },
    { screen: 'studio', icon: 'spark', label: 'Studio de création' },
    { screen: 'planning', icon: 'calendar', label: 'Planning éditorial' },
    { screen: 'calendar', icon: 'clock', label: 'Calendrier' },
  ] },
  { label: 'Emailing & CRM', items: [
    { screen: 'contacts', icon: 'users', label: 'Base clients' },
    { screen: 'campagnes', icon: 'mail', label: 'Campagnes' },
  ] },
  { label: 'Analyse', items: [
    { screen: 'stats', icon: 'chart', label: 'Analyse entreprise & site' },
    { screen: 'inbox', icon: 'chart', label: 'Statistiques réseaux' },
  ] },
];

const PLACEHOLDERS: Record<string, { icon: UIName; title: string; sub: string }> = {
  help: { icon: 'help', title: 'Aide & support', sub: '' },
};

export function App() {
  const { screen, show, client } = useEff();
  const { connectedCount, accountFor } = useConnections();
  const { contacts } = useContacts();
  const fbPicture = accountFor('facebook')?.picture;
  const [navOpen, setNavOpen] = useState(false);

  // First connection: open the Configurateur so the real analysis runs.
  useEffect(() => {
    if (!localStorage.getItem('eff_onboarded')) show('config');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the mobile drawer whenever the screen changes, and on Escape.
  useEffect(() => { setNavOpen(false); }, [screen]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const go = (s: ScreenId) => { show(s); setNavOpen(false); };

  return (
    <div className="app">
      <div className={'nav-scrim' + (navOpen ? ' show' : '')} onClick={() => setNavOpen(false)} aria-hidden="true" />

      {/* ===================== SIDEBAR ===================== */}
      <aside className={'side' + (navOpen ? ' open' : '')}>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}assets/logo-green.png`} alt="Efficience" />
          <span className="name">Efficience</span>
        </div>

        {GROUPS.map((g) => (
          <div className="nav-grp" key={g.label}>
            <div className="nav-lbl">{g.label}</div>
            {g.items.map((it) => (
              <button
                key={it.screen}
                type="button"
                className={'nav-i' + (screen === it.screen ? ' active' : '')}
                aria-current={screen === it.screen ? 'page' : undefined}
                onClick={() => go(it.screen)}
              >
                <Icon name={it.icon} />
                {it.label}
                {it.screen === 'connexion' && <span className="count">{connectedCount}</span>}
                {it.screen === 'contacts' && <span className="count">{fr(contacts.length)}</span>}
                {it.screen === 'campagnes' && <span className="badge" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>IA</span>}
              </button>
            ))}
          </div>
        ))}

        <div className="spacer" />

        <div className="nav-grp" style={{ marginTop: 8 }}>
          <button type="button" className={'nav-i' + (screen === 'config' ? ' active' : '')} aria-current={screen === 'config' ? 'page' : undefined} onClick={() => go('config')}>
            <Icon name="rocket" />Configurateur
          </button>
          <button type="button" className={'nav-i' + (screen === 'settings' ? ' active' : '')} aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
            <Icon name="settings" />Réglages
          </button>
          <button type="button" className={'nav-i' + (screen === 'help' ? ' active' : '')} aria-current={screen === 'help' ? 'page' : undefined} onClick={() => go('help')}>
            <Icon name="help" />Aide
          </button>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <div className="main">
        <header className="topbar">
          <button type="button" className="nav-toggle" aria-label="Ouvrir le menu" onClick={() => setNavOpen((v) => !v)}>
            <Icon name="menu" />
          </button>
          <button type="button" className="client-sw" title="Modifier le profil d’entreprise" onClick={() => show('config')}>
            {fbPicture
              ? <img className="ava" src={fbPicture} alt="" style={{ objectFit: 'cover' }} />
              : <div className="ava" style={{ borderRadius: 6 }}>{client.initials}</div>}
            <div className="cs-txt">
              <div className="cs-t">{client.name}</div>
              <div className="cs-s">Client actif</div>
            </div>
            <Icon name="chevdown" />
          </button>
          <GlobalSearch />
          <div className="top-r">
            <button className="btn acc sm" onClick={() => show('studio')}><Icon name="plus" />Créer</button>
            <NotificationBell />
          </div>
        </header>

        <div className="canvas" key={screen}>
          <Suspense fallback={<div className="screen-load"><span className="spin lt" /></div>}>
            {screen === 'dashboard' && <Dashboard />}
            {screen === 'connexion' && <Connexion />}
            {screen === 'contacts' && <Contacts />}
            {screen === 'campagnes' && <Campagnes />}
            {screen === 'studio' && <Studio />}
            {screen === 'stats' && <Analyse />}
            {screen === 'inbox' && <Stats />}
            {screen === 'planning' && <EditorialPlanning />}
            {screen === 'calendar' && <Calendar />}
            {screen === 'settings' && <Settings />}
            {screen === 'config' && <section className="screen show" id="screen-config" />}
            {PLACEHOLDERS[screen] && (
              <Placeholder icon={PLACEHOLDERS[screen].icon} title={PLACEHOLDERS[screen].title} sub={PLACEHOLDERS[screen].sub} />
            )}
          </Suspense>
        </div>

        <footer className="app-foot">
          <span>© {new Date().getFullYear()} Efficience Marketing</span>
          <a href="https://app.efficienceconsulting.com/confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a>
          <a href="https://app.efficienceconsulting.com/conditions.html" target="_blank" rel="noopener">Conditions d’utilisation</a>
        </footer>
      </div>

      {screen === 'config' && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
    </div>
  );
}

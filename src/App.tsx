import { useEffect } from 'react';
import { useEff, type ScreenId } from './state/EffContext';
import { useConnections } from './state/ConnectionsContext';
import { useContacts } from './state/ContactsContext';
import { Icon } from './lib/Icon';
import { fr } from './lib/format';
import { Dashboard } from './screens/Dashboard';
import { Connexion } from './screens/Connexion';
import { Contacts } from './screens/Contacts';
import { Campagnes } from './screens/Campagnes';
import { Studio } from './screens/Studio';
import { Analyse } from './screens/Analyse';
import { Stats } from './screens/Stats';
import { EditorialPlanning } from './screens/EditorialPlanning';
import { Calendar } from './screens/Calendar';
import { Placeholder } from './screens/Placeholder';
import { Onboarding } from './components/Onboarding';
import type { UIName } from './lib/icons';

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
  settings: { icon: 'settings', title: 'Réglages', sub: '' },
  help: { icon: 'help', title: 'Aide & support', sub: '' },
};

export function App() {
  const { screen, show, client } = useEff();
  const { connectedCount } = useConnections();
  const { contacts } = useContacts();

  // First connection: open the Configurateur so the real analysis runs.
  useEffect(() => {
    if (!localStorage.getItem('eff_onboarded')) show('config');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      {/* ===================== SIDEBAR ===================== */}
      <aside className="side">
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
                onClick={() => show(it.screen)}
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

        <div className="plan-card">
          <div className="pc-t">Plan Studio</div>
          <div className="pc-s">14 jours d’essai — 8 restants</div>
          <button className="btn acc sm block">Passer à Pro</button>
        </div>

        <div className="nav-grp" style={{ marginTop: 8 }}>
          <button type="button" className={'nav-i' + (screen === 'config' ? ' active' : '')} aria-current={screen === 'config' ? 'page' : undefined} onClick={() => show('config')}>
            <Icon name="rocket" />Configurateur
          </button>
          <button type="button" className={'nav-i' + (screen === 'settings' ? ' active' : '')} aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => show('settings')}>
            <Icon name="settings" />Réglages
          </button>
          <button type="button" className={'nav-i' + (screen === 'help' ? ' active' : '')} aria-current={screen === 'help' ? 'page' : undefined} onClick={() => show('help')}>
            <Icon name="help" />Aide
          </button>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <div className="main">
        <header className="topbar">
          <button type="button" className="client-sw" title="Modifier le profil d’entreprise" onClick={() => show('config')}>
            <div className="ava" style={{ borderRadius: 6 }}>{client.initials}</div>
            <div>
              <div className="cs-t">{client.name}</div>
              <div className="cs-s">Client actif</div>
            </div>
            <Icon name="chevdown" />
          </button>
          <div className="search">
            <Icon name="search" />Rechercher un post, un client, un mot-clé…<kbd>⌘K</kbd>
          </div>
          <div className="top-r">
            <button className="btn acc sm" onClick={() => show('studio')}><Icon name="plus" />Créer</button>
            <button type="button" className="icon-btn" aria-label="Notifications"><Icon name="bell" /><span className="dot" /></button>
          </div>
        </header>

        <div className="canvas" key={screen}>
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'connexion' && <Connexion />}
          {screen === 'contacts' && <Contacts />}
          {screen === 'campagnes' && <Campagnes />}
          {screen === 'studio' && <Studio />}
          {screen === 'stats' && <Analyse />}
          {screen === 'inbox' && <Stats />}
          {screen === 'planning' && <EditorialPlanning />}
          {screen === 'calendar' && <Calendar />}
          {screen === 'config' && <section className="screen show" id="screen-config" />}
          {PLACEHOLDERS[screen] && (
            <Placeholder icon={PLACEHOLDERS[screen].icon} title={PLACEHOLDERS[screen].title} sub={PLACEHOLDERS[screen].sub} />
          )}
        </div>
      </div>

      {screen === 'config' && <Onboarding />}
    </div>
  );
}

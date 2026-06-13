import { useEff, type ScreenId } from './state/EffContext';
import { Icon } from './lib/Icon';
import { fr } from './lib/format';
import { Dashboard } from './screens/Dashboard';
import { Connexion } from './screens/Connexion';
import { Contacts } from './screens/Contacts';
import { Campagnes } from './screens/Campagnes';
import { Studio } from './screens/Studio';
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
  ] },
  { label: 'Emailing & CRM', items: [
    { screen: 'contacts', icon: 'users', label: 'Base clients' },
    { screen: 'campagnes', icon: 'mail', label: 'Campagnes' },
  ] },
  { label: 'Analyse', items: [
    { screen: 'stats', icon: 'chart', label: 'Statistiques' },
    { screen: 'inbox', icon: 'inbox', label: 'Boîte de réception' },
  ] },
];

const PLACEHOLDERS: Record<string, { icon: UIName; title: string; sub: string }> = {
  planning: { icon: 'calendar', title: 'Planning éditorial', sub: 'Le calendrier glisser-déposer est en cours de design.' },
  stats: { icon: 'chart', title: 'Statistiques', sub: 'Les tableaux de bord analytiques détaillés arrivent bientôt.' },
  inbox: { icon: 'inbox', title: 'Boîte de réception', sub: 'Messages et avis unifiés — bientôt disponible.' },
  settings: { icon: 'settings', title: 'Réglages', sub: '' },
  help: { icon: 'help', title: 'Aide & support', sub: '' },
};

export function App() {
  const { screen, show, connectedCount, crmImported, client } = useEff();

  return (
    <div className="app">
      {/* ===================== SIDEBAR ===================== */}
      <aside className="side">
        <div className="brand">
          <img src="/assets/logo-green.png" alt="Efficience" />
          <span className="name">Efficience</span>
        </div>

        {GROUPS.map((g) => (
          <div className="nav-grp" key={g.label}>
            <div className="nav-lbl">{g.label}</div>
            {g.items.map((it) => (
              <div
                key={it.screen}
                className={'nav-i' + (screen === it.screen ? ' active' : '')}
                onClick={() => show(it.screen)}
              >
                <Icon name={it.icon} />
                {it.label}
                {it.screen === 'connexion' && <span className="count">{connectedCount}</span>}
                {it.screen === 'contacts' && <span className="count">{crmImported ? fr(1248) : '0'}</span>}
                {it.screen === 'campagnes' && <span className="badge" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>IA</span>}
                {it.screen === 'inbox' && <span className="badge">9</span>}
              </div>
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
          <div className={'nav-i' + (screen === 'config' ? ' active' : '')} onClick={() => show('config')}>
            <Icon name="rocket" />Configurateur
          </div>
          <div className={'nav-i' + (screen === 'settings' ? ' active' : '')} onClick={() => show('settings')}>
            <Icon name="settings" />Réglages
          </div>
          <div className={'nav-i' + (screen === 'help' ? ' active' : '')} onClick={() => show('help')}>
            <Icon name="help" />Aide
          </div>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <div className="main">
        <header className="topbar">
          <div className="client-sw">
            <div className="ava" style={{ borderRadius: 6 }}>{client.initials}</div>
            <div>
              <div className="cs-t">{client.name}</div>
              <div className="cs-s">Client actif</div>
            </div>
            <Icon name="chevdown" />
          </div>
          <div className="search">
            <Icon name="search" />Rechercher un post, un client, un mot-clé…<kbd>⌘K</kbd>
          </div>
          <div className="top-r">
            <button className="btn acc sm" onClick={() => show('studio')}><Icon name="plus" />Créer</button>
            <button className="icon-btn"><Icon name="bell" /><span className="dot" /></button>
            <div className="ava" style={{ borderRadius: 6, width: 38, height: 38, background: 'linear-gradient(150deg,#2fd6a1,#10b981)', color: '#04231a' }}>CM</div>
          </div>
        </header>

        <div className="canvas" key={screen}>
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'connexion' && <Connexion />}
          {screen === 'contacts' && <Contacts />}
          {screen === 'campagnes' && <Campagnes />}
          {screen === 'studio' && <Studio />}
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

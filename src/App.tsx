import { lazy, Suspense, useEffect, useState } from "react";
import { useEff, type ScreenId } from "./state/EffContext";
import { useConnections } from "./state/ConnectionsContext";
import { useContacts } from "./state/ContactsContext";
import { useCalendar } from "./state/CalendarContext";
import { Icon } from "./lib/Icon";
import { fr } from "./lib/format";
import { loadProfile } from "./lib/profile";
import { buildSetup } from "./lib/setup";
import { Placeholder } from "./screens/Placeholder";
import { NotificationBell } from "./components/NotificationBell";
import { GlobalSearch } from "./components/GlobalSearch";
import { FlowNav } from "./components/FlowNav";
import type { UIName } from "./lib/icons";

const Dashboard = lazy(() => import("./screens/Dashboard").then((m) => ({ default: m.Dashboard })));
const Connexion = lazy(() => import("./screens/Connexion").then((m) => ({ default: m.Connexion })));
const Contacts = lazy(() => import("./screens/Contacts").then((m) => ({ default: m.Contacts })));
const Campagnes = lazy(() => import("./screens/Campagnes").then((m) => ({ default: m.Campagnes })));
const Studio = lazy(() => import("./screens/Studio").then((m) => ({ default: m.Studio })));
const Analyse = lazy(() => import("./screens/Analyse").then((m) => ({ default: m.Analyse })));
const Stats = lazy(() => import("./screens/Stats").then((m) => ({ default: m.Stats })));
const EditorialPlanning = lazy(() =>
  import("./screens/EditorialPlanning").then((m) => ({ default: m.EditorialPlanning })),
);
const Calendar = lazy(() => import("./screens/Calendar").then((m) => ({ default: m.Calendar })));
const Settings = lazy(() => import("./screens/Settings").then((m) => ({ default: m.Settings })));
const Onboarding = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Onboarding })),
);

interface NavItem {
  screen: ScreenId;
  icon: UIName;
  label: string;
  sub?: string;
}

/* Groupes ordonnés selon le parcours réel, et non par familles abstraites.
   Deux corrections d'ergonomie :
   - « Studio » précédait « Planning » alors que le flux va dans l'autre sens :
     le planning produit les sujets et les envoie au studio (seedStudio).
   - Quatre entrées se ressemblaient à la lecture (Planning/Calendrier,
     Analyse entreprise/Statistiques réseaux) ; un sous-titre dit en trois mots
     ce que chacune fait, au lieu de laisser deviner. */
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Tableau de bord",
    items: [{ screen: "dashboard", icon: "grid", label: "Vue d’ensemble" }],
  },
  {
    label: "Créer & publier",
    items: [
      /* Le Configurateur est l'étape 1 du parcours ; il vivait tout en bas, coupé
       des étapes 2 et 3. Il rejoint le flux tant que la mise en route n'est pas
       terminée, puis retourne en bas avec les réglages (voir SETUP_SCREENS). */
      { screen: "config", icon: "rocket", label: "Configurateur", sub: "Votre entreprise" },
      { screen: "connexion", icon: "link", label: "Connexion des réseaux", sub: "Vos comptes" },
      {
        screen: "planning",
        icon: "calendar",
        label: "Planning éditorial",
        sub: "Les sujets du mois",
      },
      { screen: "studio", icon: "spark", label: "Studio de création", sub: "Rédiger un post" },
      { screen: "calendar", icon: "clock", label: "Calendrier", sub: "Ce qui est programmé" },
    ],
  },
  {
    label: "Clients & campagnes",
    items: [
      { screen: "contacts", icon: "users", label: "Base clients" },
      { screen: "campagnes", icon: "mail", label: "Campagnes" },
    ],
  },
  {
    label: "Mesurer",
    items: [
      { screen: "inbox", icon: "chart", label: "Statistiques réseaux", sub: "Vos performances" },
      {
        screen: "stats",
        icon: "chart",
        label: "Analyse entreprise & site",
        sub: "INSEE & audit du site",
      },
    ],
  },
];

const PLACEHOLDERS: Record<string, { icon: UIName; title: string; sub: string }> = {
  help: {
    icon: "help",
    title: "Aide & support",
    sub: "Le centre d’aide arrive prochainement. En attendant, contactez-nous directement pour toute question.",
  },
};

/* headerLeft / headerRight : emplacements pour le sélecteur d'espace et le menu
   profil, qui vivaient dans une seconde barre au-dessus de celle-ci. Les deux
   barres affichaient le même nom de client via deux sélecteurs différents ;
   elles sont désormais fusionnées en une seule. */
export function App({
  headerLeft,
  headerRight,
}: { headerLeft?: React.ReactNode; headerRight?: React.ReactNode } = {}) {
  const { screen, show } = useEff();
  const { connectedCount } = useConnections();
  const { contacts } = useContacts();
  const { scheduled } = useCalendar();
  const [navOpen, setNavOpen] = useState(false);

  /* Numérotation des étapes de mise en route directement dans la navigation :
     tant que le parcours n'est pas bouclé, les écrans concernés portent leur
     rang (1, 2, 3) et le prochain est mis en avant. Une fois terminé, les
     numéros disparaissent — ils ne servent qu'à démarrer. */
  const setup = buildSetup({
    hasProfile: !!loadProfile(),
    connectedCount,
    scheduledCount: scheduled.length,
    contactsCount: contacts.length,
  });
  const stepByScreen = new Map<ScreenId, { n: number; done: boolean; next: boolean }>();
  if (!setup.complete) {
    setup.steps
      .filter((s) => !s.optional)
      .forEach((s, idx) =>
        stepByScreen.set(s.screen, {
          n: idx + 1,
          done: s.done,
          next: setup.next?.key === s.key,
        }),
      );
  }

  // First connection: open the Configurateur so the real analysis runs.
  useEffect(() => {
    if (!localStorage.getItem("eff_onboarded")) show("config");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the mobile drawer whenever the screen changes, and on Escape.
  useEffect(() => {
    setNavOpen(false);
  }, [screen]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const go = (s: ScreenId) => {
    show(s);
    setNavOpen(false);
  };

  return (
    <div className="app">
      <div
        className={"nav-scrim" + (navOpen ? " show" : "")}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      {/* ===================== SIDEBAR ===================== */}
      <aside className={"side" + (navOpen ? " open" : "")}>
        {GROUPS.map((g) => (
          <div className="nav-grp" key={g.label}>
            <div className="nav-lbl">{g.label}</div>
            {g.items
              .filter((it) => it.screen !== "config" || !setup.complete)
              .map((it) => {
                const st = stepByScreen.get(it.screen);
                return (
                  <button
                    key={it.screen}
                    type="button"
                    className={
                      "nav-i" +
                      (screen === it.screen ? " active" : "") +
                      (it.sub ? " has-sub" : "") +
                      (st?.next ? " step-next" : "")
                    }
                    aria-current={screen === it.screen ? "page" : undefined}
                    onClick={() => go(it.screen)}
                  >
                    {st ? (
                      <span className={"nav-step" + (st.done ? " done" : "")} aria-hidden="true">
                        {st.done ? <Icon name="check" /> : st.n}
                      </span>
                    ) : (
                      <Icon name={it.icon} />
                    )}
                    <span className="nav-txt">
                      <span className="nav-t">{it.label}</span>
                      {it.sub && <span className="nav-s">{it.sub}</span>}
                    </span>
                    {it.screen === "connexion" && <span className="count">{connectedCount}</span>}
                    {it.screen === "contacts" && (
                      <span className="count">{fr(contacts.length)}</span>
                    )}
                    {it.screen === "campagnes" && (
                      <span
                        className="badge"
                        style={{ background: "var(--acc-soft)", color: "var(--acc)" }}
                      >
                        IA
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}

        <div className="spacer" />

        <div className="nav-grp" style={{ marginTop: 8 }}>
          {/* Une fois la mise en route terminée, le Configurateur quitte le flux
              de création pour rejoindre les réglages : il ne sert plus qu'à
              retoucher le profil ponctuellement. */}
          {setup.complete && (
            <button
              type="button"
              className={"nav-i" + (screen === "config" ? " active" : "")}
              aria-current={screen === "config" ? "page" : undefined}
              onClick={() => go("config")}
            >
              <Icon name="rocket" />
              Configurateur
            </button>
          )}
          <button
            type="button"
            className={"nav-i" + (screen === "settings" ? " active" : "")}
            aria-current={screen === "settings" ? "page" : undefined}
            onClick={() => go("settings")}
          >
            <Icon name="settings" />
            Réglages
          </button>
          <button
            type="button"
            className={"nav-i" + (screen === "help" ? " active" : "")}
            aria-current={screen === "help" ? "page" : undefined}
            onClick={() => go("help")}
          >
            <Icon name="help" />
            Aide
          </button>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Ouvrir le menu"
            onClick={() => setNavOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
          <img
            className="topbar-logo"
            src={`${import.meta.env.BASE_URL}assets/logo-green.png`}
            alt="Efficience"
          />
          {headerLeft}
          <GlobalSearch />
          <div className="top-r">
            <button className="btn acc sm" onClick={() => show("studio")}>
              <Icon name="plus" />
              Créer
            </button>
            <NotificationBell />
            {headerRight}
          </div>
        </header>

        {/* Fil de production visible sur les quatre outils de publication :
            la chaîne Planning → Studio → Calendrier → Statistiques existait
            dans le code mais pas à l'écran. Rendu HORS du .canvas (re-monté
            à chaque écran via key) pour que la pastille active puisse
            glisser d'une étape à l'autre au lieu de réapparaître. */}
        {(screen === "planning" ||
          screen === "studio" ||
          screen === "calendar" ||
          screen === "inbox") && <FlowNav current={screen} />}
        <div className="canvas" key={screen}>
          <Suspense
            fallback={
              <div className="screen-load">
                <span className="spin lt" />
              </div>
            }
          >
            {screen === "dashboard" && <Dashboard />}
            {screen === "connexion" && <Connexion />}
            {screen === "contacts" && <Contacts />}
            {screen === "campagnes" && <Campagnes />}
            {screen === "studio" && <Studio />}
            {screen === "stats" && <Analyse />}
            {screen === "inbox" && <Stats />}
            {screen === "planning" && <EditorialPlanning />}
            {screen === "calendar" && <Calendar />}
            {screen === "settings" && <Settings />}
            {screen === "config" && <section className="screen show" id="screen-config" />}
            {PLACEHOLDERS[screen] && (
              <Placeholder
                icon={PLACEHOLDERS[screen].icon}
                title={PLACEHOLDERS[screen].title}
                sub={PLACEHOLDERS[screen].sub}
              />
            )}
          </Suspense>
        </div>

        <footer className="app-foot">
          <span>© {new Date().getFullYear()} Efficience Marketing</span>
          <a
            href="https://app.efficienceconsulting.com/confidentialite.html"
            target="_blank"
            rel="noopener"
          >
            Politique de confidentialité
          </a>
          <a
            href="https://app.efficienceconsulting.com/conditions.html"
            target="_blank"
            rel="noopener"
          >
            Conditions d’utilisation
          </a>
        </footer>
      </div>

      {screen === "config" && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
    </div>
  );
}

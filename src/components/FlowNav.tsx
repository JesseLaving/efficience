import { useEff, type ScreenId } from '../state/EffContext';
import { useCalendar } from '../state/CalendarContext';
import { useDrafts } from '../state/DraftsContext';
import { loadPlan } from '../lib/editorial';
import { FLOW_STEPS } from '../lib/flow';

/* Fil de production — rail segmenté en tête des quatre outils de publication.
   Le parcours réel (Planning → Studio → Calendrier → Statistiques) existait
   déjà dans le code (seedStudio, addToCalendar…) mais restait invisible.

   Le composant vit HORS du conteneur re-monté à chaque écran (App.tsx) :
   c'est ce qui permet à la pastille active de GLISSER d'une étape à l'autre
   au lieu de réapparaître — la continuité spatiale montre le sens du flux.
   Compteurs RÉELS à chaque étape, jamais de chiffre inventé. */

/** Compteur réel de l'étape + son unité (« 12 sujets »). */
interface StepCount {
  count: number;
  unit: string;
}

/**
 * Le rail d'étapes cliquable, avec pastille glissante sous l'étape courante.
 * @param {ScreenId} props.current - L'écran actuellement affiché
 * @returns {JSX.Element} - La barre d'étapes
 */
export function FlowNav({ current }: { current: ScreenId }) {
  const { show } = useEff();
  const { scheduled } = useCalendar();
  const { drafts } = useDrafts();

  const planCount = loadPlan()?.items.length || 0;
  const upcoming = scheduled.filter((p) => p.status === 'scheduled').length;
  const published = scheduled.filter((p) => p.status === 'published').length;

  const countFor = (screen: ScreenId): StepCount => {
    switch (screen) {
      case 'studio':
        return { count: drafts.length, unit: drafts.length > 1 ? 'brouillons' : 'brouillon' };
      case 'calendar':
        return { count: upcoming, unit: 'à venir' };
      case 'inbox':
        return { count: published, unit: published > 1 ? 'publiées' : 'publiée' };
      default:
        return { count: planCount, unit: planCount > 1 ? 'sujets' : 'sujet' };
    }
  };
  const steps = FLOW_STEPS.map((s) => ({ ...s, ...countFor(s.screen) }));
  const activeIndex = Math.max(0, steps.findIndex((s) => s.screen === current));

  return (
    <div className="flow-wrap">
      {/* --flow-steps : le CSS déduit la grille et la largeur de la pastille du
          nombre réel d'étapes, plutôt que d'un « 4 » écrit en dur de son côté. */}
      <nav
        className="flow-nav"
        aria-label="Fil de production"
        style={{ '--flow-steps': steps.length } as React.CSSProperties}
      >
        {/* La pastille est un seul élément déplacé au transform : le survol
            du regard suit le mouvement, pas quatre états qui clignotent. */}
        <span className="flow-pill" aria-hidden="true" style={{ transform: `translateX(${activeIndex * 100}%)` }} />
        {steps.map((s, i) => (
          <button
            key={s.screen}
            type="button"
            className={'flow-step' + (current === s.screen ? ' on' : '')}
            aria-current={current === s.screen ? 'step' : undefined}
            onClick={() => show(s.screen)}
          >
            <span className="fs-n">{i + 1}</span>
            <span className="fs-txt">
              <span className="fs-l">{s.label}</span>
              {/* key = le texte : un compteur qui change rejoue le petit pop. */}
              <span className="fs-c" key={`${s.count} ${s.unit}`}>{s.count} {s.unit}</span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

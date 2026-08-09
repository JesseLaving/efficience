import { useEff, type ScreenId } from '../state/EffContext';
import { useCalendar } from '../state/CalendarContext';
import { useDrafts } from '../state/DraftsContext';
import { loadPlan } from '../lib/editorial';
import { Icon } from '../lib/Icon';
import type { UIName } from '../lib/icons';

/* Fil de production — affiché en tête des quatre outils de publication.
   Le parcours réel (Planning → Studio → Calendrier → Statistiques) existait
   déjà dans le code (seedStudio, addToCalendar…) mais restait invisible :
   chaque écran semblait isolé. Ce bandeau rend la chaîne lisible et
   cliquable, avec les compteurs RÉELS de chaque étape — jamais de chiffre
   inventé, un zéro s'affiche comme zéro. */

interface FlowStep {
  screen: ScreenId;
  icon: UIName;
  label: string;
  /** Compteur réel de l'étape + son unité (« 12 sujets »). */
  count: number;
  unit: string;
}

/**
 * Le bandeau du fil de production, avec l'étape courante en surbrillance.
 * @param {ScreenId} props.current - L'écran actuellement affiché
 * @returns {JSX.Element} - La barre d'étapes cliquable
 */
export function FlowNav({ current }: { current: ScreenId }) {
  const { show } = useEff();
  const { scheduled } = useCalendar();
  const { drafts } = useDrafts();

  const planCount = loadPlan()?.items.length || 0;
  const upcoming = scheduled.filter((p) => p.status === 'scheduled').length;
  const published = scheduled.filter((p) => p.status === 'published').length;

  const steps: FlowStep[] = [
    { screen: 'planning', icon: 'calendar', label: 'Planifier', count: planCount, unit: planCount > 1 ? 'sujets' : 'sujet' },
    { screen: 'studio', icon: 'spark', label: 'Rédiger', count: drafts.length, unit: drafts.length > 1 ? 'brouillons' : 'brouillon' },
    { screen: 'calendar', icon: 'clock', label: 'Programmer', count: upcoming, unit: 'à venir' },
    { screen: 'inbox', icon: 'chart', label: 'Mesurer', count: published, unit: published > 1 ? 'publiées' : 'publiée' },
  ];

  return (
    <nav className="flow-nav" aria-label="Fil de production">
      {steps.map((s, i) => (
        <span key={s.screen} style={{ display: 'contents' }}>
          {i > 0 && <Icon name="arrowright" />}
          <button
            type="button"
            className={'flow-step' + (current === s.screen ? ' on' : '')}
            aria-current={current === s.screen ? 'step' : undefined}
            onClick={() => show(s.screen)}
          >
            <Icon name={s.icon} />
            <span className="fs-l">{s.label}</span>
            <span className="fs-c">{s.count} {s.unit}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}

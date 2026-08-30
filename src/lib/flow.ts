import type { ScreenId } from '../state/EffContext';

/* Étapes du fil de production, dans l'ordre. Source unique : le rail (FlowNav),
   la condition qui l'affiche (App) et la géométrie de la pastille (theme.css,
   via --flow-steps) en dépendent toutes. Ces trois endroits codaient « quatre »
   chacun de leur côté : ajouter une étape en oubliait forcément un, et la
   pastille glissait alors sur une largeur qui n'était plus la bonne. */
export const FLOW_STEPS: { screen: ScreenId; label: string }[] = [
  { screen: 'planning', label: 'Planifier' },
  { screen: 'studio', label: 'Rédiger' },
  { screen: 'calendar', label: 'Programmer' },
  { screen: 'inbox', label: 'Mesurer' },
];

/** Vrai si l'écran fait partie du fil de production (donc affiche le rail). */
export const isFlowScreen = (screen: ScreenId): boolean =>
  FLOW_STEPS.some((s) => s.screen === screen);

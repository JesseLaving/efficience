/* Parcours de prise en main — de la première connexion à la première publication.

   L'onboarding se terminait sur l'écran « Connexion des réseaux » avec une
   bannière, puis le fil s'arrêtait : rien n'indiquait quoi faire ensuite. Et
   un onboarding abandonné ne laissait aucune trace, donc aucun moyen de le
   reprendre.

   Chaque étape est DÉDUITE de l'état réel de l'espace (profil enregistré,
   réseaux connectés, publications programmées, contacts importés) — jamais
   d'un drapeau « vu » qu'on coche à l'affichage. Une étape faite hors parcours
   compte donc quand même, et rien n'est inventé. */
import type { ScreenId } from '../state/EffContext';
import type { UIName } from './icons';

export interface SetupStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  screen: ScreenId;
  icon: UIName;
  /** Étape facultative : elle compte dans la liste mais pas dans « terminé ». */
  optional?: boolean;
}

export interface SetupState {
  steps: SetupStep[];
  doneCount: number;
  requiredCount: number;
  /** Prochaine étape requise à faire, ou null si le parcours est bouclé. */
  next: SetupStep | null;
  complete: boolean;
}

export function buildSetup(input: {
  hasProfile: boolean;
  connectedCount: number;
  scheduledCount: number;
  contactsCount: number;
}): SetupState {
  const steps: SetupStep[] = [
    {
      key: 'profile',
      label: 'Décrire votre entreprise',
      hint: 'Analyse INSEE et audit de votre site pour personnaliser l’app.',
      done: input.hasProfile,
      screen: 'config',
      icon: 'rocket',
    },
    {
      key: 'networks',
      label: 'Connecter un réseau',
      hint: 'Instagram, Facebook, LinkedIn ou Google — au moins un pour publier.',
      done: input.connectedCount > 0,
      screen: 'connexion',
      icon: 'link',
    },
    {
      key: 'schedule',
      label: 'Programmer une publication',
      hint: 'Générez un planning ou composez un post, puis programmez-le.',
      done: input.scheduledCount > 0,
      screen: 'planning',
      icon: 'calendar',
    },
    {
      key: 'contacts',
      label: 'Importer votre base clients',
      hint: 'Pour les campagnes e-mail. À faire quand vous voulez.',
      done: input.contactsCount > 0,
      screen: 'contacts',
      icon: 'users',
      optional: true,
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const doneCount = steps.filter((s) => s.done).length;
  const next = required.find((s) => !s.done) || null;

  return {
    steps,
    doneCount,
    requiredCount: required.length,
    next,
    complete: required.every((s) => s.done),
  };
}

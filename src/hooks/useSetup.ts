import { useMemo } from "react";
import { useConnections } from "../state/ConnectionsContext";
import { useCalendar } from "../state/CalendarContext";
import { useContacts } from "../state/ContactsContext";
import { loadProfile } from "../lib/profile";
import { buildSetup } from "../lib/setup";

/**
 * État de la prise en main (profil, connexions, première publication, contacts).
 *
 * Trois vues en dépendent — la numérotation des étapes dans la navigation, le
 * guide du tableau de bord et la carte « prochaine action » — et chacune
 * rassemblait les mêmes quatre sources de son côté. Une définition unique évite
 * qu'elles ne divergent le jour où « terminé » changera de sens.
 *
 * @returns Les étapes, le nombre d'étapes faites, la prochaine et `complete`.
 */
export function useSetup() {
  const { connectedCount } = useConnections();
  const { scheduled } = useCalendar();
  const { contacts } = useContacts();
  // Lu à chaque rendu (et non mémoïsé) : le profil est enregistré depuis le
  // configurateur alors que la navigation, elle, reste montée.
  const hasProfile = !!loadProfile();

  return useMemo(
    () =>
      buildSetup({
        hasProfile,
        connectedCount,
        scheduledCount: scheduled.length,
        contactsCount: contacts.length,
      }),
    [hasProfile, connectedCount, scheduled.length, contacts.length],
  );
}

import { useCallback, useEffect, useState } from "react";

interface ArmedConfirmOptions {
  /** Délai avant désarmement automatique. */
  timeoutMs?: number;
  /** Zone « intérieure » : un clic en dehors désarme (bouton d'envoi, ligne…). */
  outsideRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Confirmation à deux clics pour une action destructrice ou irréversible.
 *
 * Le premier clic arme, le second exécute. L'armement retombe seul après
 * `timeoutMs` : sans expiration, un bouton armé le reste indéfiniment et un
 * clic bien plus tardif — ou une navigation aller-retour — supprime sans que
 * l'utilisateur ait rien confirmé. Chaque écran réécrivait sa propre version
 * de ce mécanisme, avec des règles de désarmement toutes différentes.
 *
 * @param options - Délai d'expiration et zone de clic « intérieure ».
 * @returns `armed` (clé armée ou null), `confirm` (arme puis valide) et `disarm`.
 */
export function useArmedConfirm(options?: ArmedConfirmOptions) {
  const { timeoutMs = 4000, outsideRef } = options || {};
  const [armed, setArmed] = useState<string | null>(null);

  const disarm = useCallback(() => setArmed(null), []);

  useEffect(() => {
    if (armed === null) return;
    const t = window.setTimeout(() => setArmed(null), timeoutMs);
    const onOutside = (e: MouseEvent) => {
      if (!outsideRef?.current?.contains(e.target as Node)) setArmed(null);
    };
    if (outsideRef) document.addEventListener("mousedown", onOutside);
    return () => {
      window.clearTimeout(t);
      if (outsideRef) document.removeEventListener("mousedown", onOutside);
    };
  }, [armed, timeoutMs, outsideRef]);

  /**
   * Arme `key` au premier appel, la valide au second.
   * @returns `true` seulement quand l'action doit être exécutée maintenant.
   */
  const confirm = useCallback(
    (key: string): boolean => {
      if (armed !== key) {
        setArmed(key);
        return false;
      }
      setArmed(null);
      return true;
    },
    [armed],
  );

  return { armed, confirm, disarm };
}

import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Accessibilité clavier pour les modales en portail (.kmodal / .search-modal) :
 * piège le Tab dans la carte, place le focus initial à l'ouverture, et le
 * restitue à l'élément précédemment actif à la fermeture. La fermeture sur
 * Échap reste gérée par chaque modale (déjà présente) — ce hook ne s'en
 * occupe pas pour éviter les doublons.
 * @param cardRef - Référence vers l'élément racine de la carte modale (piège de focus).
 * @param active - `false` met le hook en sommeil pour une modale montée en
 *   permanence dont l'ouverture est un état (sans ce drapeau, l'appelant devait
 *   passer une référence factice recréée à chaque rendu).
 * @returns Rien — le hook n'a que des effets de bord (focus, écouteurs clavier).
 */
export function useModalA11y(
  cardRef: React.RefObject<HTMLElement | null>,
  active = true,
): void {
  useEffect(() => {
    const card = active ? cardRef.current : null;
    if (!card) return;

    const focusedOnOpen = document.activeElement as HTMLElement | null;
    // Un champ `autoFocus` est focalisé par React au commit, donc avant cet
    // effet : on ne lui vole pas le focus, et on ne le prend pas non plus pour
    // l'élément à restituer à la fermeture (il sera démonté avec la modale).
    const alreadyInside = !!focusedOnOpen && card.contains(focusedOnOpen);
    const previouslyFocused = alreadyInside ? null : focusedOnOpen;

    const getFocusable = (): HTMLElement[] =>
      Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (!alreadyInside) (getFocusable()[0] || card).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const focused = document.activeElement;
      if (e.shiftKey) {
        // `focused === card` : la carte a tabIndex=-1 et prend le focus au clic
        // sur une zone non interactive ; sans ce cas Maj+Tab sortirait du piège.
        if (focused === firstEl || focused === card || !card.contains(focused)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (focused === lastEl || !card.contains(focused)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    card.addEventListener("keydown", onKeyDown);
    return () => {
      card.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [cardRef, active]);
}

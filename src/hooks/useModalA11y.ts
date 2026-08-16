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
 * @returns Rien — le hook n'a que des effets de bord (focus, écouteurs clavier).
 */
export function useModalA11y(cardRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const first = getFocusable()[0];
    (first || card).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === firstEl || !card.contains(active)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (active === lastEl || !card.contains(active)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    card.addEventListener("keydown", onKeyDown);
    return () => {
      card.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [cardRef]);
}

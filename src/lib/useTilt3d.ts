import { useEffect, useRef } from 'react';

/** Mouse-tracked 3D tilt — sets --rx/--ry custom properties that the `.tilt`
 *  CSS class (theme.css) renders as `rotateX/rotateY`. Pairs with a plain
 *  ref + className="tilt", no extra wrapper needed.
 *  Skipped on touch devices (no hover to track) and when the user prefers
 *  reduced motion — the element then just sits flat, never mid-tilt. */
export function useTilt3d<T extends HTMLElement>(strength = 8) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${(px * strength).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-py * strength).toFixed(2)}deg`);
    };
    const onLeave = () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);

  return ref;
}

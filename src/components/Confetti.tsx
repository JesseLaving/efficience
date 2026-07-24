/* Petite salve de confettis, jouée quand une étape de mise en route est
   franchie. Franchir une étape ne produisait rien : l'app se contentait de
   changer d'état en silence, ce qui rend la progression invisible.

   Contraintes tenues :
   - purement décoratif → aria-hidden et pointer-events: none, jamais dans le
     chemin d'un clic ni annoncé aux lecteurs d'écran ;
   - respecte prefers-reduced-motion en ne rendant simplement rien (une
     animation « accélérée » resterait un scintillement inutile) ;
   - se démonte tout seul à la fin, sans laisser de nœud dans le DOM. */
import { useEffect, useState } from 'react';

const COLORS = ['#5b7550', '#7d9c6d', '#095385', '#3f8fc7', '#c9a227', '#b0654a'];
const COUNT = 26;
const DURATION = 1400;

export function Confetti({ onDone }: { onDone?: () => void }) {
  const [gone, setGone] = useState(false);

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) { onDone?.(); return; }
    const t = setTimeout(() => { setGone(true); onDone?.(); }, DURATION);
    return () => clearTimeout(t);
  }, [reduced, onDone]);

  if (reduced || gone) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => {
        // Éventail centré : angle réparti puis légèrement bruité, pour éviter
        // l'effet « peigne » d'une distribution parfaitement régulière.
        const spread = (i / (COUNT - 1)) * 160 - 80;
        const angle = spread + (((i * 37) % 17) - 8);
        const dist = 90 + ((i * 53) % 70);
        const rad = (angle - 90) * (Math.PI / 180);
        return (
          <i
            key={i}
            style={{
              '--x': `${Math.cos(rad) * dist}px`,
              '--y': `${Math.sin(rad) * dist}px`,
              '--r': `${((i * 71) % 720) - 360}deg`,
              '--d': `${(i % 6) * 40}ms`,
              background: COLORS[i % COLORS.length],
              width: i % 3 === 0 ? 5 : 7,
              height: i % 3 === 0 ? 9 : 7,
              borderRadius: i % 4 === 0 ? '50%' : '1px',
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

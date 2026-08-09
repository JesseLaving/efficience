/* Blocs « fantômes » à reflet animé, affichés à l'emplacement exact du contenu
   en cours de génération (versions IA, planning, e-mail, image). Ils réservent
   l'espace : le résultat remplace le squelette sans faire sauter la page —
   perception de rapidité et zéro décalage de mise en page. */

interface SkelProps {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}

/**
 * Un bloc squelette unique (ligne, pastille, vignette…).
 * @param {number|string} props.w - Largeur (px ou %), 100 % par défaut
 * @param {number|string} props.h - Hauteur en px, 12 par défaut
 * @param {number} props.r - Rayon d'arrondi en px, 6 par défaut
 * @returns {JSX.Element} - Le bloc animé, invisible aux lecteurs d'écran
 */
export function Skel({ w = "100%", h = 12, r = 6, style }: SkelProps) {
  return (
    <span
      className="skel"
      aria-hidden="true"
      style={{ display: "block", width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/**
 * Paragraphe fantôme : n lignes, la dernière plus courte comme un vrai texte.
 * @param {number} props.lines - Nombre de lignes, 3 par défaut
 * @returns {JSX.Element} - Les lignes squelettes empilées
 */
export function SkelText({ lines = 3 }: { lines?: number }) {
  return (
    <span style={{ display: "grid", gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skel key={i} h={11} w={i === lines - 1 ? "62%" : "100%"} />
      ))}
    </span>
  );
}

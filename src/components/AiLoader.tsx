import { useEffect, useState } from "react";
import { RawIcon } from "../lib/Icon";
import { UI } from "../lib/icons";

/* Loader dédié aux générations IA et analyses (Studio, Planning éditorial,
   Campagnes, Visuel) — un anneau animé, un fil de statuts qui tourne, une
   barre indéterminée et le temps écoulé RÉEL. Jamais de pourcentage inventé :
   le seul chiffre affiché est le chrono. Au-delà de 18 s, une note rassure
   que la génération continue ; des astuces optionnelles (« billets
   d'attente ») occupent l'attente en apprenant quelque chose d'utile. */
export function AiLoader({
  lead,
  phrases,
  tips,
  interval = 1700,
  dark = false,
  compact = false,
}: {
  lead?: React.ReactNode;
  phrases: string[];
  /** Astuces tournantes affichées sous le fil de statuts (6 s chacune). */
  tips?: string[];
  interval?: number;
  dark?: boolean;
  compact?: boolean;
}) {
  const [i, setI] = useState(0);
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (phrases.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % phrases.length), interval);
    return () => window.clearInterval(id);
  }, [phrases.length, interval]);

  // Chrono réel — affiché à partir de 3 s seulement : sur une réponse rapide,
  // un compteur qui clignote une seconde est plus anxiogène qu'utile.
  useEffect(() => {
    const id = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tip = tips && tips.length ? tips[Math.floor(sec / 6) % tips.length] : null;

  return (
    <div
      className={"ai-loader" + (dark ? " dark" : "") + (compact ? " compact" : "")}
      role="status"
      aria-live="polite"
    >
      <div className="ai-loader-orb">
        <div className="ai-loader-ring" />
      </div>
      <div className="ai-loader-body">
        <div className="ai-loader-top">
          {lead && <div className="ai-loader-lead">{lead}</div>}
          {sec >= 3 && <span className="ai-loader-sec">{sec}&nbsp;s</span>}
        </div>
        <div className="ai-loader-cycle">
          <span key={i}>{phrases[i % phrases.length]}</span>
        </div>
        <div className="ai-loader-track">
          <i />
        </div>
        {sec >= 18 && (
          <div className="ai-loader-wait">
            Un peu plus long que d’habitude — la génération continue.
          </div>
        )}
        {tip && (
          <div className="ai-loader-tip" key={tip}>
            <RawIcon
              svg={UI.sparkles2}
              style={{ width: 12, height: 12, display: "inline-grid", flex: "none", marginTop: 2 }}
            />
            <span>{tip}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Détail des tâches pendant l'analyse d'entreprise et de site.

   Remplace le loader à phrases tournantes, qui faisait défiler trois textes en
   boucle sans lien avec l'avancement réel : on ne savait ni ce qui était fait,
   ni ce qui restait, ni ce qui avait échoué.

   Règle tenue ici : le VERDICT de chaque tâche vient des données réellement
   reçues (une identité trouvée, une page jointe, des scores Lighthouse
   disponibles…), jamais d'un minuteur. Tant que l'appel est en vol, les tâches
   de ce groupe sont annoncées « en cours » sans prétendre savoir laquelle est
   terminée — le serveur ne renvoie ses résultats qu'en une fois. */
import { useEffect, useState } from "react";
import { Icon, RawIcon } from "../lib/Icon";
import { UI } from "../lib/icons";
import { Confetti } from "./Confetti";

export type TaskState = "running" | "ok" | "empty" | "failed";

export interface AnalysisTask {
  label: string;
  state: TaskState;
  /** Précision affichée une fois la tâche résolue (« 5 résultats », « 404 »…). */
  detail?: string | null;
}

export interface AnalysisGroup {
  title: string;
  /** null tant que l'appel est en vol. */
  done: boolean;
  tasks: AnalysisTask[];
}

function TaskRow({ t }: { t: AnalysisTask }) {
  return (
    <li className={"apt apt-" + t.state}>
      <span className="apt-mark" aria-hidden="true">
        {t.state === "running" ? (
          <span className="spin" />
        ) : t.state === "ok" ? (
          <Icon name="check" />
        ) : t.state === "failed" ? (
          <Icon name="close" />
        ) : (
          <span className="apt-dash" />
        )}
      </span>
      <span className="apt-l">{t.label}</span>
      {t.detail && <span className="apt-d">{t.detail}</span>}
    </li>
  );
}

export function AnalysisProgress({ groups, tips }: { groups: AnalysisGroup[]; tips?: string[] }) {
  const all = groups.flatMap((g) => g.tasks);
  const settled = all.filter((t) => t.state !== "running").length;
  const pct = all.length ? Math.round((settled / all.length) * 100) : 0;
  const finished = all.length > 0 && settled === all.length;

  // Bilan tiré des verdicts réels, pour dire ce qui a abouti et ce qui n'a
  // rien donné plutôt que d'annoncer « terminé » sans nuance.
  const ok = all.filter((t) => t.state === "ok").length;
  const failed = all.filter((t) => t.state === "failed").length;
  const empty = all.filter((t) => t.state === "empty").length;

  /* Célébration au passage à l'état terminé, une seule fois : sans mémoriser
     la transition, le moindre re-rendu relancerait la salve. Ajustement
     pendant le rendu plutôt que dans un effet, qui provoquerait un rendu en
     cascade (react-hooks/set-state-in-effect). */
  const [party, setParty] = useState(false);
  const [wasFinished, setWasFinished] = useState(finished);
  if (finished !== wasFinished) {
    if (finished) setParty(true);
    setWasFinished(finished); // repasse à false à la relance
  }

  /* « Billets d'attente » : une astuce toutes les 7 s pendant que les tâches
     tournent — l'attente sert à apprendre ce que l'analyse va alimenter. */
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const tip = !finished && tips && tips.length ? tips[Math.floor(sec / 7) % tips.length] : null;

  return (
    <div className={"ana-progress" + (finished ? " ap-done" : "")} role="status" aria-live="polite">
      {party && <Confetti onDone={() => setParty(false)} />}
      <div className="ap-head">
        {/* L'anneau tournait en boucle même à 100 % : arrivé au bout, il cède
            la place à une pastille de validation. */}
        {finished ? (
          <div className="ap-check">
            <Icon name="check" />
          </div>
        ) : (
          <div className="ap-orb">
            <div className="ap-ring" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{finished ? "Analyse terminée" : "Analyse en cours"}</h3>
          <p>
            {finished
              ? [
                  ok ? `${ok} tâche${ok > 1 ? "s" : ""} aboutie${ok > 1 ? "s" : ""}` : null,
                  empty ? `${empty} sans résultat` : null,
                  failed ? `${failed} en échec` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : `${settled} tâche${settled > 1 ? "s" : ""} sur ${all.length} terminée${settled > 1 ? "s" : ""}`}
          </p>
        </div>
        {finished ? (
          <div className="ap-badge">Terminé</div>
        ) : (
          <div className="ap-pct">
            {pct}
            <span>%</span>
          </div>
        )}
      </div>
      <div className="ap-bar">
        <i style={{ width: pct + "%" }} />
      </div>
      {tip && (
        <div className="ai-loader-tip" key={tip}>
          <RawIcon
            svg={UI.sparkles2}
            style={{ width: 12, height: 12, display: "inline-grid", flex: "none", marginTop: 2 }}
          />
          <span>{tip}</span>
        </div>
      )}

      <div className="ap-groups">
        {groups.map((g) => (
          <div className="ap-group" key={g.title}>
            <div className="ap-gt">
              {g.done ? <Icon name="check" /> : <span className="spin" />}
              {g.title}
            </div>
            <ul className="ap-tasks">
              {g.tasks.map((t) => (
                <TaskRow key={t.label} t={t} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

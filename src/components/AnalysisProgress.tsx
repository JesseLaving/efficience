/* Détail des tâches pendant l'analyse d'entreprise et de site.

   Remplace le loader à phrases tournantes, qui faisait défiler trois textes en
   boucle sans lien avec l'avancement réel : on ne savait ni ce qui était fait,
   ni ce qui restait, ni ce qui avait échoué.

   Règle tenue ici : le VERDICT de chaque tâche vient des données réellement
   reçues (une identité trouvée, une page jointe, des scores Lighthouse
   disponibles…), jamais d'un minuteur. Tant que l'appel est en vol, les tâches
   de ce groupe sont annoncées « en cours » sans prétendre savoir laquelle est
   terminée — le serveur ne renvoie ses résultats qu'en une fois. */
import { Icon } from '../lib/Icon';

export type TaskState = 'running' | 'ok' | 'empty' | 'failed';

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
    <li className={'apt apt-' + t.state}>
      <span className="apt-mark" aria-hidden="true">
        {t.state === 'running' ? <span className="spin" />
          : t.state === 'ok' ? <Icon name="check" />
          : t.state === 'failed' ? <Icon name="close" />
          : <span className="apt-dash" />}
      </span>
      <span className="apt-l">{t.label}</span>
      {t.detail && <span className="apt-d">{t.detail}</span>}
    </li>
  );
}

export function AnalysisProgress({ groups }: { groups: AnalysisGroup[] }) {
  const all = groups.flatMap((g) => g.tasks);
  const settled = all.filter((t) => t.state !== 'running').length;
  const pct = all.length ? Math.round((settled / all.length) * 100) : 0;

  return (
    <div className="ana-progress" role="status" aria-live="polite">
      <div className="ap-head">
        <div className="ap-orb"><div className="ap-ring" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Analyse en cours</h3>
          <p>{settled} tâche{settled > 1 ? 's' : ''} sur {all.length} terminée{settled > 1 ? 's' : ''}</p>
        </div>
        <div className="ap-pct">{pct}<span>%</span></div>
      </div>
      <div className="ap-bar"><i style={{ width: pct + '%' }} /></div>

      <div className="ap-groups">
        {groups.map((g) => (
          <div className="ap-group" key={g.title}>
            <div className="ap-gt">
              {g.done ? <Icon name="check" /> : <span className="spin" />}
              {g.title}
            </div>
            <ul className="ap-tasks">
              {g.tasks.map((t) => <TaskRow key={t.label} t={t} />)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

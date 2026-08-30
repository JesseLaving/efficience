/* Fil conducteur de la prise en main, affiché tant que le parcours n'est pas
   bouclé. Remplace la bannière ponctuelle qui n'apparaissait qu'une fois après
   l'onboarding : ici la progression persiste, se répare toute seule si une
   étape est défaite, et disparaît définitivement une fois terminée. */
import { useEffect, useState } from 'react';
import { useEff } from '../state/EffContext';
import { Icon } from '../lib/Icon';
import { useSetup } from '../hooks/useSetup';
import { Confetti } from './Confetti';

/* Dernier palier de progression déjà célébré, par espace (le localStorage est
   remplacé au changement d'espace, voir AuthWrapper). */
const CELEBRATED = 'eff_setup_celebrated';

export function SetupGuide() {
  const { show } = useEff();

  const setup = useSetup();

  /* Célébration sur la TRANSITION, pas sur l'état. Le palier déjà fêté est
     persisté et non gardé dans un ref : les étapes se valident sur D'AUTRES
     écrans (Configurateur, Connexion, Planning), donc le guide est démonté au
     moment où elles passent. Un compteur en mémoire repartirait de zéro au
     retour sur le tableau de bord et ne fêterait jamais rien. */
  const [seen, setSeen] = useState<number>(() => Number(localStorage.getItem(CELEBRATED) ?? -1));
  const [party, setParty] = useState(false);
  /* La dernière étape fait passer `complete` à true, ce qui masquerait le guide
     avant même d'avoir félicité. On retient donc l'affichage le temps du final. */
  const [finale, setFinale] = useState(false);

  /* Ajustement pendant le rendu plutôt que dans un effet : détecter la
     transition via useEffect + setState provoque un rendu en cascade (et c'est
     ce que signale react-hooks/set-state-in-effect). React ré-exécute
     simplement ce composant avant de peindre. */
  if (setup.doneCount !== seen) {
    // -1 = premier passage : on enregistre le palier sans rien fêter, sinon un
    // espace déjà avancé déclencherait une salve à sa première visite.
    if (seen >= 0 && setup.doneCount > seen) {
      setParty(true);
      if (setup.complete) setFinale(true);
    }
    setSeen(setup.doneCount);
  }

  // La persistance est un effet de bord : elle reste hors du rendu.
  useEffect(() => {
    if (seen >= 0) localStorage.setItem(CELEBRATED, String(seen));
  }, [seen]);

  // Parcours bouclé : le guide s'efface pour de bon, sans bouton à masquer —
  // sauf le temps de l'écran de félicitations.
  if (setup.complete && !finale) return null;

  if (finale) {
    return (
      <div className="setup-guide sg-done">
        {party && <Confetti onDone={() => setParty(false)} />}
        <div className="sg-final">
          <div className="sg-final-ic"><Icon name="check" /></div>
          <div>
            <h3>Tout est prêt</h3>
            <p>Votre espace est configuré. À vous de publier — le guide disparaît d’ici.</p>
          </div>
          <button className="btn acc sm" onClick={() => setFinale(false)}>Parfait</button>
        </div>
      </div>
    );
  }

  const pct = Math.round((setup.steps.filter((s) => s.done).length / setup.steps.length) * 100);

  return (
    <div className="setup-guide">
      {party && <Confetti onDone={() => setParty(false)} />}
      <div className="sg-head">
        <div className="sg-ic"><Icon name="rocket" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Prise en main</h3>
          <p>
            {setup.next
              ? <>Étape suivante : <strong>{setup.next.label.toLowerCase()}</strong>.</>
              : 'Encore une étape facultative pour aller plus loin.'}
          </p>
        </div>
        <div className="sg-count">{setup.doneCount}<span>/{setup.steps.length}</span></div>
      </div>

      <div className="sg-bar"><i style={{ width: pct + '%' }} /></div>

      <ol className="sg-steps">
        {setup.steps.map((s) => {
          const isNext = setup.next?.key === s.key;
          return (
            <li key={s.key} className={'sg-step' + (s.done ? ' done' : '') + (isNext ? ' next' : '')}>
              <span className="sg-mark" aria-hidden="true">
                {s.done ? <Icon name="check" /> : <Icon name={s.icon} />}
              </span>
              <span className="sg-txt">
                <span className="sg-lbl">
                  {s.label}
                  {s.optional && !s.done && <em className="sg-opt">facultatif</em>}
                </span>
                <span className="sg-hint">{s.hint}</span>
              </span>
              {s.done
                ? <span className="sg-ok">Fait</span>
                : (
                  <button
                    className={'btn sm ' + (isNext ? 'acc' : 'outline')}
                    onClick={() => show(s.screen)}
                  >
                    {isNext ? 'Continuer' : 'Ouvrir'}
                  </button>
                )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

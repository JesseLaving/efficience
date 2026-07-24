/* Fil conducteur de la prise en main, affiché tant que le parcours n'est pas
   bouclé. Remplace la bannière ponctuelle qui n'apparaissait qu'une fois après
   l'onboarding : ici la progression persiste, se répare toute seule si une
   étape est défaite, et disparaît définitivement une fois terminée. */
import { useEff } from '../state/EffContext';
import { useConnections } from '../state/ConnectionsContext';
import { useCalendar } from '../state/CalendarContext';
import { useContacts } from '../state/ContactsContext';
import { Icon } from '../lib/Icon';
import { loadProfile } from '../lib/profile';
import { buildSetup } from '../lib/setup';

export function SetupGuide() {
  const { show } = useEff();
  const { connectedCount } = useConnections();
  const { scheduled } = useCalendar();
  const { contacts } = useContacts();

  const setup = buildSetup({
    hasProfile: !!loadProfile(),
    connectedCount,
    scheduledCount: scheduled.length,
    contactsCount: contacts.length,
  });

  // Parcours bouclé : le guide s'efface pour de bon, sans bouton à masquer.
  if (setup.complete) return null;

  const pct = Math.round((setup.steps.filter((s) => s.done).length / setup.steps.length) * 100);

  return (
    <div className="setup-guide">
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

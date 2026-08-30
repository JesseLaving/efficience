/* Prochaine action de la boucle de production, affichée sur le tableau de bord
   UNE FOIS la prise en main terminée (avant, c'est SetupGuide qui guide).

   La carte est déduite de l'état réel de l'espace — plan du mois, brouillons,
   publications programmées — et disparaît quand la machine tourne : s'il y a
   déjà des publications à venir et rien en attente, il n'y a rien à dire. */
import { useMemo } from "react";
import { useEff } from "../state/EffContext";
import { useCalendar } from "../state/CalendarContext";
import { useDrafts } from "../state/DraftsContext";
import { Icon } from "../lib/Icon";
import type { UIName } from "../lib/icons";
import { useSetup } from "../hooks/useSetup";
import { loadPlan } from "../lib/editorial";
import type { ScreenId } from "../state/EffContext";

interface Action {
  icon: UIName;
  title: string;
  hint: string;
  cta: string;
  screen: ScreenId;
}

export function NextAction() {
  const { show } = useEff();
  const { scheduled } = useCalendar();
  const { drafts } = useDrafts();

  // Tant que la prise en main n'est pas bouclée, SetupGuide occupe ce rôle.
  const setup = useSetup();
  /* Le plan est relu une seule fois par montage : il ne peut changer que
     depuis le Planning, écran dont le retour re-monte ce composant. */
  const planCount = useMemo(() => loadPlan()?.items.length || 0, []);
  if (!setup.complete) return null;

  const upcoming = scheduled.filter((p) => p.status === "scheduled").length;

  // Un seul conseil à la fois, dans l'ordre du flux de production.
  const action: Action | null =
    planCount === 0
      ? {
          icon: "calendar",
          title: "Aucun sujet planifié ce mois-ci",
          hint: "Générez le planning éditorial : des sujets prêts à rédiger pour tout le mois.",
          cta: "Générer le planning",
          screen: "planning",
        }
      : drafts.length > 0
        ? {
            icon: "wand",
            title:
              drafts.length > 1
                ? `${drafts.length} brouillons en attente`
                : "1 brouillon en attente",
            hint:
              drafts.length > 1
                ? "Reprenez-les dans le Studio pour les finaliser et les programmer."
                : "Reprenez-le dans le Studio pour le finaliser et le programmer.",
            cta: "Reprendre la rédaction",
            screen: "studio",
          }
        : upcoming === 0
          ? {
              icon: "rocket",
              title: "Aucune publication programmée",
              hint:
                planCount > 1
                  ? `${planCount} sujets du planning attendent d'être rédigés.`
                  : "Un sujet du planning attend d’être rédigé.",
              cta: "Rédiger un post",
              screen: "studio",
            }
          : null;

  if (!action) return null;

  return (
    <div className="next-action">
      <div className="na-ic">
        <Icon name={action.icon} />
      </div>
      <div className="na-txt">
        <div className="na-t">{action.title}</div>
        <div className="na-h">{action.hint}</div>
      </div>
      <button className="btn acc sm" onClick={() => show(action.screen)}>
        {action.cta}
        <Icon name="arrowright" />
      </button>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useEff } from "../state/EffContext";
import { useAuthUser } from "../state/AuthUserContext";
import { useContacts } from "../state/ContactsContext";
import { useSegments } from "../state/SegmentsContext";
import { useCampaigns } from "../state/CampaignsContext";
import { useSpaces } from "../state/SpaceContext";
import { Icon, Brand, RawIcon } from "../lib/Icon";
import { UI, type BrandName } from "../lib/icons";
import { fr } from "../lib/format";
import { showToast } from "../lib/toast";
import {
  segmentInfos,
  SEGMENTS,
  fieldsFor,
  matchCriteria,
  type SegmentInfo,
  type Contact,
} from "../lib/population";
import { getBusiness } from "../lib/business";
import { generateEmail } from "../lib/ai";
import {
  sendCampaignEmail,
  fetchCampaignStats,
  scheduleCampaignEmail,
  cancelScheduledCampaign,
  fetchScheduledCampaigns,
} from "../lib/email";
import { AiLoader } from "../components/AiLoader";
import { Skel, SkelText } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { useArmedConfirm } from "../hooks/useArmedConfirm";
import { toLocalIso } from "../lib/calendar";
import {
  newCampaignId,
  CAMPAIGN_STATUS_LABEL,
  type Campaign,
  type CampaignContent,
} from "../lib/campaigns";

const MAIL_LOGO = `${import.meta.env.BASE_URL}assets/logo-white.png`;

/** Demain 9 h, au format attendu par un champ datetime-local. */
function defaultSchedule(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalIso(d);
}

const fmtSchedule = (ms: number) =>
  new Date(ms).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
const SOCIAL: BrandName[] = ["linkedin", "instagram", "facebook"];
const TONES = ["Direct", "Pédagogique", "Expert", "Chaleureux"];

interface Generated {
  subjects: string[];
  pre: string;
  headline: string;
  body: string[];
  cta: string;
  segName: string;
  pct: number;
}

const num = (txt: string) => {
  const m = (txt || "").match(/(\d{1,2})\s?%/);
  return m ? +m[1] : 20;
};
function family(p: string) {
  p = (p || "").toLowerCase();
  if (/(promo|réduc|reduc|-\d|%|offre|solde|remise|code|deal)/.test(p)) return "promo";
  if (/(nouveau|nouveauté|nouveaute|lancement|découvr|decouvr|arriv)/.test(p)) return "nouveaute";
  if (
    /(revenir|manqué|manque|inactif|réactiv|reactiv|absent|relanc|prospect|sans réponse|recontact)/.test(
      p,
    )
  )
    return "reactivation";
  if (/(fidél|fidel|carte|points|récompense|recompense|merci|recommand|confiance)/.test(p))
    return "fidelite";
  if (
    /(événement|evenement|ouverture|atelier|dégustation|degustation|fête|fete|noël|noel|pâques|paques|portes)/.test(
      p,
    )
  )
    return "evenement";
  return "generic";
}
function serviceNoun(sector: string): string {
  const s = sector.toLowerCase();
  if (/(restau|food|traiteur|boulang|p[âa]tiss|caf[ée]|\bbar\b|pizz|brasserie)/.test(s))
    return "votre prochain repas";
  if (/(sant[ée]|m[ée]decin|kin[ée]|ost[ée]o|dentaire|psy|th[ée]rap)/.test(s))
    return "votre prochain rendez-vous";
  if (/(beaut[ée]|coiff|esth[ée]t|ongle|\bspa\b|barbier)/.test(s)) return "votre prochain soin";
  if (/(immobil|courtier)/.test(s)) return "votre estimation gratuite";
  if (/(artisan|btp|plomb|[ée]lectri|menuisi|peinture|couvreur)/.test(s)) return "votre devis";
  if (/(commerce|boutique|magasin|retail)/.test(s)) return "votre prochain achat";
  if (/(formation|conseil|coach|consult)/.test(s)) return "votre prochaine session";
  return "votre prochaine prestation";
}

function generate(
  prompt: string,
  tone: string,
  segName: string,
  biz: { name: string; sector: string; city: string } = { name: "", sector: "", city: "" },
): Generated {
  const pct = num(prompt);
  const n = biz.name || "Notre équipe";
  const svc = serviceNoun(biz.sector);
  const flavor =
    (
      {
        Direct: "direct",
        Pédagogique: "pédagogique",
        Expert: "rigoureux",
        Chaleureux: "chaleureux",
      } as Record<string, string>
    )[tone] || "direct";
  const T: Record<string, Omit<Generated, "segName" | "pct">> = {
    promo: {
      subjects: [
        `−${pct}% sur ${svc}`,
        `Votre offre exclusive : −${pct}%`,
        `−${pct}% pour vous — offre limitée`,
      ],
      pre: "Une offre claire, sans engagement, pour passer à l’action.",
      headline: `−${pct}% rien que pour vous`,
      body: [
        "Bonjour {prenom},",
        `Parce que vous nous faites confiance, <b>${n}</b> vous réserve <b>−${pct}%</b> sur ${svc} — ce mois-ci uniquement.`,
        `Un accompagnement ${flavor}, concret, pensé pour vous.`,
      ],
      cta: "J’en profite maintenant",
    },
    nouveaute: {
      subjects: [
        "Découvrez notre dernière nouveauté",
        `${n} innove pour vous`,
        "Une nouveauté à ne pas manquer",
      ],
      pre: "Une nouveauté pensée pour vous, disponible dès maintenant.",
      headline: "Notre nouveauté du moment",
      body: [
        "Bonjour {prenom},",
        `Chez <b>${n}</b>, nous ne restons jamais immobiles. Voici ce que nous avons préparé pour vous.`,
        "Vous faites partie des premiers informés — dites-nous ce que vous en pensez.",
      ],
      cta: "Découvrir la nouveauté",
    },
    reactivation: {
      subjects: ["On reprend contact ?", "Toujours là pour vous", "Un point sur votre projet ?"],
      pre: "Quelques semaines sans échange — reprenons le fil.",
      headline: "On refait le point, {prenom} ?",
      body: [
        "Bonjour {prenom},",
        `Ça fait un moment que nous n’avons pas échangé. Chez <b>${n}</b>, votre projet nous tient toujours à cœur.`,
        `Si vous avez un besoin — ou simplement envie de faire le point — je suis disponible${biz.city ? ` à ${biz.city}` : ""} ou en ligne.`,
      ],
      cta: "Reprendre contact",
    },
    fidelite: {
      subjects: [
        "Merci pour votre confiance",
        "Un mot sincère de notre part",
        "Votre fidélité compte pour nous",
      ],
      pre: "Un remerciement sincère, et une porte toujours ouverte.",
      headline: "Merci pour votre confiance",
      body: [
        "Bonjour {prenom},",
        `Votre fidélité est ce qui nous pousse chaque jour à faire mieux chez <b>${n}</b>. Un simple merci s’imposait.`,
        "Si vous êtes satisfait·e, une recommandation à un proche nous aide énormément. Et pour tout nouveau besoin, vous savez où nous trouver.",
      ],
      cta: "Recommander un proche",
    },
    evenement: {
      subjects: [`Invitation de ${n}`, "Save the date — rejoignez-nous", "Vous êtes invité·e"],
      pre: "Un événement à ne pas manquer — bloquez la date.",
      headline: "Vous êtes invité·e",
      body: [
        "Bonjour {prenom},",
        `<b>${n}</b> vous invite à un moment d’échange et de découverte. Les places sont limitées pour garder un cadre convivial.`,
        `Confirmez votre venue en un clic — nous serions ravis de vous accueillir${biz.city ? ` à ${biz.city}` : ""}.`,
      ],
      cta: "Je réserve ma place",
    },
    generic: {
      subjects: [`Des nouvelles de ${n}`, "Un point utile pour vous", "Trois idées pour avancer"],
      pre: "Quelques lignes utiles, sans détour.",
      headline: `Un mot de ${n}`,
      body: [
        "Bonjour {prenom},",
        `Voici quelques nouvelles de la part de <b>${n}</b>, avec notre approche habituelle : du concret et un ton ${flavor}.`,
        "Si un sujet vous parle, répondez à ce mail — on en parle avec plaisir.",
      ],
      cta: "Échanger avec nous",
    },
  };
  const f = T[family(prompt)];
  return { ...f, segName, pct };
}

const SUGGESTS: [string, string][] = [
  ["Offre spéciale", "Proposer une offre promotionnelle à mes contacts ce mois-ci"],
  ["Nouveauté", "Annoncer une nouveauté ou un nouveau service à ma base"],
  ["Relance", "Relancer des contacts inactifs pour reprendre le fil"],
  ["Événement", "Inviter mes contacts à un événement ou un atelier"],
];

/* ---------- typed email body ---------- */
/* Aperçu du corps de l'e-mail. La frappe animée ne joue qu'une fois par
   génération, puis `typed` repasse à null : l'aperçu affiche alors le texte
   courant, si bien qu'une retouche manuelle s'y voit immédiatement. Sans ça,
   l'aperçu restait figé sur le texte initial (et vide en rédaction manuelle).
   Le parent monte ce composant avec key={genId}, donc l'état repart à zéro
   à chaque nouvelle génération. */
function TypedBody({ paras }: { paras: string[] }) {
  const [typed, setTyped] = useState<string | null>("");
  // Texte figé au montage : l'animation rejoue la version d'origine et ignore
  // les frappes en cours, sans quoi elle courrait après le texte édité.
  const source = useRef(paras);

  useEffect(() => {
    const replaced = source.current.map((t) => t.replace("{prenom}", "Prénom"));
    let pi = 0,
      ci = 0;
    const built: string[] = [];
    const cursor = '<span class="typ-cursor"></span>';
    const id = window.setInterval(() => {
      if (pi >= replaced.length) {
        window.clearInterval(id);
        setTyped(null);
        return;
      }
      ci += 3;
      const slice = replaced[pi].slice(0, ci);
      const done = built.map((p) => `<p>${p}</p>`).join("");
      setTyped(done + `<p>${slice}${cursor}</p>`);
      if (ci >= replaced[pi].length) {
        built.push(replaced[pi]);
        pi++;
        ci = 0;
        // Fin : on rend la main au rendu direct pour refléter les retouches.
        if (pi >= replaced.length) {
          window.clearInterval(id);
          setTyped(null);
        }
      }
    }, 16);
    return () => window.clearInterval(id);
  }, []);

  const live = paras.map((t) => `<p>${t.replace("{prenom}", "Prénom")}</p>`).join("");
  return <div className="ep-body-c" dangerouslySetInnerHTML={{ __html: typed ?? live }} />;
}

function StatusPill({ s }: { s: Campaign["status"] }) {
  return (
    <span className={"st-pill " + s}>
      <i />
      {CAMPAIGN_STATUS_LABEL[s]}
    </span>
  );
}

export function Campagnes() {
  const { campaignSeed, clearCampaignSeed, show } = useEff();
  const authUser = useAuthUser();
  /* Adresse qui recevra les réponses : le compte connecté d'abord, puis le
     profil d'espace. Calculée une seule fois ici pour que ce qui est annoncé
     dans l'interface soit exactement ce qui part au serveur. */
  const replyTo = authUser?.email || getBusiness().email || "";
  const { contacts } = useContacts();
  const { savedSegments, groups } = useSegments();
  const { campaigns, addCampaign, updateCampaign } = useCampaigns();
  const { activeSpaceId } = useSpaces();
  /* Ouvertures/clics/désinscriptions par campagne, servis par le webhook Resend.
     Rechargés à chaque retour sur la liste : les événements arrivent en continu
     après l'envoi, pas au moment où on quitte l'écran. */
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({});
  /* Annulation d'un envoi programmé : deux clics, comme partout ailleurs pour
     une action sans retour possible. */
  const { armed: cancellingId, confirm: confirmCancel, disarm: disarmCancel } = useArmedConfirm();
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);

  const cancelSchedule = async (c: Campaign) => {
    if (!c.id || activeSpaceId == null) return;
    if (!confirmCancel(c.id)) return;
    setCancelBusy(c.id);
    const r = await cancelScheduledCampaign(activeSpaceId, c.id);
    setCancelBusy(null);
    if (!r.ok) {
      showToast(UI.close, r.reason || "Impossible d’annuler l’envoi programmé.");
      return;
    }
    /* La campagne redevient un brouillon : le contenu est conservé, seule la
       date d'envoi disparaît — c'est ce qui vient d'être annulé. */
    updateCampaign(c.id, {
      status: "draft",
      when: "Brouillon — envoi annulé",
      scheduledAt: undefined,
    });
    disarmCancel();
    showToast(UI.check, "Envoi programmé annulé. La campagne reste en brouillon.");
  };
  /* Campagne en cours de modification. Non nul → l'enregistrement met à jour
     l'existante au lieu d'en créer une nouvelle. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "builder">("list");
  /* L'écran n'offrait que la rédaction par IA. `manual` distingue les deux
     origines pour n'afficher que ce qui a du sens : pas de « 3 objets
     proposés » ni de « régénérer » sur un texte écrit à la main. */
  const [manual, setManual] = useState(false);
  const [sending, setSending] = useState(false);
  /* Date d'envoi différé. Par défaut demain 9 h : une campagne programmée
     « tout de suite » n'aurait pas de sens, et une heure ouvrable évite
     d'expédier au milieu de la nuit par simple inadvertance. */
  const [schedAt, setSchedAt] = useState(() => defaultSchedule());
  /* Premier clic sur « Envoyer » ne fait qu'armer la confirmation — un envoi
     de masse est irréversible et part vers de vraies adresses. Le second
     clic, dans la fenêtre, déclenche réellement l'envoi ; sinon ça expire. */
  // Fenêtre de confirmation : un clic ailleurs ou 5s d'inactivité désarme
  // l'envoi plutôt que de le laisser prêt à partir indéfiniment.
  const sendBtnWrapRef = useRef<HTMLDivElement>(null);
  const {
    armed: sendArmed,
    confirm: confirmSend,
    disarm: cancelConfirmSend,
  } = useArmedConfirm({ timeoutMs: 5000, outsideRef: sendBtnWrapRef });
  const confirmingSend = sendArmed !== null;
  const fields = useMemo(() => fieldsFor(contacts), [contacts]);

  // Résout un identifiant de segment (fixe, ou préfixé saved:/group: pour un
  // segment enregistré / groupe créé dans Contacts.tsx) vers un prédicat.
  // null = audience introuvable (segment/groupe supprimé depuis) → traité
  // comme "tous les contacts" par les appelants, jamais comme "personne".
  const resolvePred = useMemo(() => {
    const map = new Map<string, (c: Contact) => boolean>();
    for (const s of SEGMENTS) map.set(s.id, s.pred);
    for (const s of savedSegments)
      map.set(`saved:${s.id}`, (c) => matchCriteria(c, s.criteria, fields));
    for (const g of groups) {
      const ids = new Set(g.contactIds);
      map.set(`group:${g.id}`, (c) => ids.has(c.id));
    }
    return (id: string) => map.get(id) || null;
  }, [savedSegments, groups, fields]);

  const segs = useMemo<SegmentInfo[]>(() => {
    const fixed = segmentInfos(contacts);
    const saved = savedSegments.map((s) => ({
      id: `saved:${s.id}`,
      name: s.name,
      desc: "Segment enregistré",
      icon: "sliders",
      count: contacts.filter((c) => matchCriteria(c, s.criteria, fields)).length,
    }));
    const grp = groups.map((g) => {
      const ids = new Set(g.contactIds);
      return {
        id: `group:${g.id}`,
        name: g.name,
        desc: "Groupe",
        icon: "users",
        count: contacts.filter((c) => ids.has(c.id)).length,
      };
    });
    return [...fixed, ...saved, ...grp];
  }, [contacts, savedSegments, groups, fields]);

  // builder state
  const [seg, setSeg] = useState<SegmentInfo>(segs[0]);
  const [tone, setTone] = useState("Chaleureux");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [gen, setGen] = useState<Generated | null>(null);
  const [subject, setSubject] = useState(0);
  const [genId, setGenId] = useState(0);

  // Nombre réel de destinataires atteignables — un e-mail valide et un
  // consentement pas explicitement refusé, pas juste "membre du segment"
  // (c'est ce compte, pas seg.count, que l'envoi utilisera vraiment).
  const sendableCount = useMemo(() => {
    const pred = resolvePred(seg.id);
    return contacts.filter((c) => c.email && c.consent !== false && (!pred || pred(c))).length;
  }, [contacts, seg, resolvePred]);

  const openBuilder = (segId?: string) => {
    setSeg(segs.find((s) => s.id === segId) || segs[0]);
    setGen(null);
    setGenerating(false);
    setSubject(0);
    setEditingId(null);
    setView("builder");
  };

  /* Rouvre une campagne enregistrée dans l'éditeur, contenu compris. Les
     campagnes créées avant la conservation du contenu n'en ont pas : on ouvre
     alors l'éditeur vide plutôt que de prétendre restaurer un texte perdu. */
  const editCampaign = (c: Campaign) => {
    if (!c.id) {
      showToast(UI.close, "Cette campagne est antérieure à l’édition — recréez-la.");
      return;
    }
    setSeg(segs.find((s) => s.id === c.segId) || segs.find((s) => s.name === c.seg) || segs[0]);
    setEditingId(c.id);
    /* Rouvrir une campagne programmée ne doit pas déplacer sa date : on repart
       de l'heure prévue, sauf si elle est passée (le serveur la refuserait). */
    setSchedAt(
      // Gestionnaire de clic, jamais exécuté pendant un rendu : lire l'heure
      // ici est sans effet sur la stabilité du rendu.
      // eslint-disable-next-line react-hooks/purity
      c.scheduledAt && c.scheduledAt > Date.now()
        ? toLocalIso(new Date(c.scheduledAt))
        : defaultSchedule(),
    );
    setGenerating(false);
    setSubject(0);
    setManual(true); // texte existant : on n'affiche pas l'UI de génération
    setGen(
      c.content
        ? {
            subjects: [c.content.subject],
            pre: c.content.pre,
            headline: c.content.headline,
            body: c.content.body,
            cta: c.content.cta,
            segName: c.seg,
            pct: 0,
          }
        : {
            subjects: [""],
            pre: "",
            headline: "",
            body: [""],
            cta: "En savoir plus",
            segName: c.seg,
            pct: 0,
          },
    );
    setGenId((g) => g + 1);
    setView("builder");
    if (!c.content) showToast(UI.close, "Contenu non conservé pour cette campagne — à ressaisir.");
  };

  useEffect(() => {
    if (campaignSeed) {
      openBuilder(campaignSeed.seg);
      clearCampaignSeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignSeed]);

  /* État réel de la file d'envoi. Une campagne programmée part sans le
     navigateur : c'est le serveur qui sait si elle est effectivement sortie,
     et l'écran doit refléter ce qui s'est passé, pas ce qui était prévu. */
  useEffect(() => {
    if (view !== "list" || activeSpaceId == null) return;
    let alive = true;
    fetchScheduledCampaigns(activeSpaceId).then((queue) => {
      if (!alive) return;
      for (const q of queue) {
        const local = campaigns.find((c) => c.id === q.id);
        if (!local || local.status !== "sched") continue;
        if (q.status === "sent") {
          const r = q.result;
          updateCampaign(q.id, {
            status: "sent",
            when: `Envoyée ${fmtSchedule(q.sentAt || q.whenMs)}`,
            sentCount: r?.sent,
            failedCount: r?.failed ?? undefined,
            recipients: r?.total || local.recipients,
            sendError: null,
          });
        } else if (q.status === "failed") {
          updateCampaign(q.id, {
            status: "failed",
            when: `Échec de l’envoi programmé (${fmtSchedule(q.sentAt || q.whenMs)})`,
            sendError: q.result?.reason || null,
          });
        }
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeSpaceId]);

  /* Chargement des statistiques réelles. Relancé au retour sur la liste, car
     les ouvertures et clics continuent d'arriver bien après l'envoi. */
  useEffect(() => {
    if (view !== "list" || activeSpaceId == null) return;
    let alive = true;
    fetchCampaignStats(activeSpaceId).then((s) => {
      if (alive) setStats(s || {});
    });
    return () => {
      alive = false;
    };
  }, [view, activeSpaceId, campaigns.length]);

  /* Rédaction manuelle : on part d'un e-mail vide plutôt que d'un modèle
     pré-rempli, pour ne rien mettre dans la bouche de l'utilisateur. Le reste
     du parcours (aperçu, envoi, programmation) est strictement identique — seul
     le contenu change d'origine. */
  const startManual = () => {
    setManual(true);
    setGen({
      subjects: [""],
      pre: "",
      headline: "",
      body: [""],
      cta: "En savoir plus",
      segName: seg.name,
      pct: 0,
    });
    setSubject(0);
    setGenId((g) => g + 1);
  };

  const doGenerate = async () => {
    const p = prompt.trim() || "Partager une actualité utile à mes contacts cette semaine";
    if (!prompt.trim()) setPrompt(p);
    setManual(false);
    setGenerating(true);
    setGen(null);
    // Vraie IA Claude en priorité ; repli sur le moteur de modèles si la clé manque.
    const b = getBusiness();
    try {
      const res = await generateEmail(p, {
        name: b.name,
        sector: b.sector,
        city: b.city,
        audience: seg.name,
        tone,
      });
      if (res.available && res.email && (res.email.subject || res.email.body)) {
        const e = res.email;
        setGen({
          subjects: [e.subject || generate(p, tone, seg.name).subjects[0]],
          pre: e.preheader || "",
          headline: e.subject || "",
          body: (e.body || "")
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean),
          cta: e.cta || "En savoir plus",
          segName: seg.name,
          pct: num(p),
        });
      } else {
        setGen(generate(p, tone, seg.name, b));
        if (res.reason) showToast(UI.wand, `Modèle utilisé (IA indisponible : ${res.reason})`);
      }
    } catch {
      setGen(generate(p, tone, seg.name, b));
    } finally {
      setGenerating(false);
      setSubject(0);
      setGenId((g) => g + 1);
    }
  };

  // Les ouvertures/clics restent à null : aucun fournisseur ne les mesure
  // encore pour cette version (voir la note dans la liste plus bas) — on ne
  // les invente jamais, contrairement à l'ancien comportement de cet écran.
  /* Un e-mail rédigé à la main peut être laissé vide : on refuse l'envoi plutôt
     que d'expédier un message sans objet ni contenu à toute une base. */
  const emptyReason = (): string | null => {
    if (!gen) return "Aucun e-mail à envoyer.";
    if (!gen.subjects[subject]?.trim()) return "Ajoutez un objet à votre e-mail.";
    if (!gen.body.join("").trim())
      return "Votre message est vide — écrivez au moins un paragraphe.";
    return null;
  };

  /* Contenu tel qu'il sera rouvert plus tard. Il n'était pas conservé : une
     campagne programmée ne gardait que son nom, si bien que l'invitation à
     « revenir l'envoyer » menait à une impasse — le texte n'existait plus. */
  const contentOf = (): CampaignContent => ({
    subject: gen!.subjects[subject],
    pre: gen!.pre,
    headline: gen!.headline,
    body: gen!.body,
    cta: gen!.cta,
  });

  const closeBuilder = () => {
    setView("list");
    setGen(null);
    setPrompt("");
    setManual(false);
    setEditingId(null);
    cancelConfirmSend();
  };

  const finish = async (status: "sent" | "sched") => {
    const blocked = emptyReason();
    if (blocked) {
      showToast(UI.close, blocked);
      return;
    }
    const name = gen!.subjects[subject].replace(/\s*[🥐✨🥖💚🎉]/gu, "").trim();

    if (status === "sched") {
      const whenMs = Date.parse(schedAt);
      if (!Number.isFinite(whenMs) || whenMs <= Date.now()) {
        showToast(UI.close, "Choisissez une date d’envoi dans le futur.");
        return;
      }
      if (activeSpaceId == null) {
        showToast(UI.close, "Espace introuvable — reconnectez-vous.");
        return;
      }
      /* Destinataires résolus MAINTENANT : la base de contacts vit dans le
         navigateur, le serveur ne pourra pas la relire à l'heure dite. Le
         message le dit, plutôt que de laisser croire à une liste vivante. */
      const pred = resolvePred(seg.id);
      const recipients = contacts.filter((c) => c.email && c.consent !== false && (!pred || pred(c)));
      if (!recipients.length) {
        showToast(UI.close, "Aucun destinataire avec une adresse e-mail valide dans ce segment.");
        return;
      }

      const b = getBusiness();
      const edited = editingId ? campaigns.find((c) => c.id === editingId) : undefined;
      // Une campagne déjà envoyée qu'on reprogramme repart sous un nouvel
      // identifiant : réutiliser l'ancien fusionnerait les ouvertures des deux
      // envois en un seul total, ce qui serait faux.
      const reuseId = edited && edited.status !== "sent" ? edited.id : undefined;
      const campaignId = reuseId || newCampaignId();

      setSending(true);
      const res = await scheduleCampaignEmail({
        spaceId: activeSpaceId,
        campaignId,
        whenMs,
        business: { name: b.name, email: replyTo, addressLine: b.addressLine },
        subject: gen!.subjects[subject],
        preheader: gen!.pre,
        headline: gen!.headline || gen!.subjects[subject],
        bodyParagraphs: gen!.body,
        cta: gen!.cta,
        contacts: recipients.map((c) => ({ id: c.id, email: c.email, first: c.first, name: c.name })),
      });
      setSending(false);

      if (!res.ok) {
        // Rien n'est enregistré comme programmé si le serveur n'a pas accepté :
        // afficher « Programmée » sur une campagne qui ne partira jamais serait
        // pire que l'échec lui-même.
        showToast(UI.close, res.reason || "Programmation impossible.");
        return;
      }

      const patch = {
        name,
        seg: seg.name,
        segId: seg.id,
        status: "sched" as const,
        recipients: recipients.length,
        open: null,
        click: null,
        when: `Envoi ${fmtSchedule(whenMs)}`,
        scheduledAt: whenMs,
        content: contentOf(),
      };
      // Réédition d'une campagne existante : on la met à jour au lieu d'en
      // créer un doublon à chaque enregistrement.
      if (reuseId) updateCampaign(reuseId, patch);
      else addCampaign({ id: campaignId, ...patch });
      closeBuilder();
      showToast(
        UI.calendar,
        `Campagne programmée pour le ${fmtSchedule(whenMs)} — ${fr(recipients.length)} destinataires, figés à cet instant.`,
      );
      return;
    }

    const pred = resolvePred(seg.id);
    const recipients = contacts.filter((c) => c.email && c.consent !== false && (!pred || pred(c)));
    if (!recipients.length) {
      showToast(UI.close, "Aucun destinataire avec une adresse e-mail valide dans ce segment.");
      return;
    }
    if (activeSpaceId == null) {
      showToast(UI.close, "Espace introuvable — reconnectez-vous.");
      return;
    }

    setSending(true);
    /* Une campagne déjà dans la file du serveur doit en sortir AVANT l'envoi
       manuel : sans ça, le cron la réexpédierait à toute la liste à l'heure
       initialement prévue. En cas d'échec du retrait, on renonce à l'envoi —
       un envoi manqué se rattrape, un envoi en double, non. */
    const queued = editingId ? campaigns.find((c) => c.id === editingId) : undefined;
    // Sans identifiant (campagne antérieure au suivi), rien ne peut être en
    // file côté serveur : il n'y a donc rien à retirer.
    if (queued?.id && queued.status === "sched" && activeSpaceId != null) {
      const off = await cancelScheduledCampaign(activeSpaceId, queued.id);
      if (!off.ok) {
        setSending(false);
        showToast(UI.close, off.reason || "Impossible de retirer la campagne de la file d’envoi.");
        return;
      }
    }
    const b = getBusiness();
    /* Identifiant créé AVANT l'envoi : c'est lui qui part dans les tags Resend
       et qui est ensuite enregistré avec la campagne, sinon les événements
       reçus par le webhook ne pourraient être rattachés à rien. */
    /* Réutiliser l'identifiant d'une campagne jamais envoyée (programmée ou en
       échec) garde son historique intact. En revanche, réenvoyer une campagne
       DÉJÀ envoyée crée forcément un nouvel identifiant : conserver l'ancien
       fusionnerait les ouvertures des deux envois en un seul total, ce qui
       serait faux. */
    const edited = editingId ? campaigns.find((c) => c.id === editingId) : undefined;
    const reuseId = edited && edited.status !== "sent" ? edited.id : undefined;
    const campaignId = reuseId || newCampaignId();
    const res = await sendCampaignEmail({
      spaceId: activeSpaceId,
      campaignId,
      business: { name: b.name, email: replyTo, addressLine: b.addressLine },
      subject: gen!.subjects[subject],
      preheader: gen!.pre,
      headline: gen!.headline || gen!.subjects[subject],
      bodyParagraphs: gen!.body,
      cta: gen!.cta,
      contacts: recipients.map((c) => ({ id: c.id, email: c.email, first: c.first, name: c.name })),
    });
    setSending(false);

    if (res.ok) {
      const sentN = res.sent || 0,
        failedN = res.failed || 0;
      const record = {
        name,
        seg: seg.name,
        segId: seg.id,
        status: "sent" as const,
        recipients: res.total || recipients.length,
        open: null,
        click: null,
        when: "Envoyée à l’instant",
        sentCount: sentN,
        failedCount: failedN,
        sendError: null,
        content: contentOf(),
      };
      if (reuseId) updateCampaign(reuseId, record);
      else addCampaign({ id: campaignId, ...record });
      closeBuilder();
      showToast(
        UI.rocket,
        failedN
          ? `Envoyée à ${fr(sentN)} contacts (${failedN} échec${failedN > 1 ? "s" : ""})`
          : `Campagne envoyée à ${fr(sentN)} contacts`,
      );
    } else {
      const record = {
        name,
        seg: seg.name,
        segId: seg.id,
        status: "failed" as const,
        recipients: recipients.length,
        open: null,
        click: null,
        when: "Échec de l’envoi",
        sendError: res.reason || null,
        content: contentOf(),
      };
      if (reuseId) updateCampaign(reuseId, record);
      else addCampaign({ id: campaignId, ...record });
      closeBuilder();
      showToast(UI.close, res.reason || "Échec de l’envoi de la campagne.");
    }
  };

  if (view === "builder") {
    return (
      <section className="screen show anim">
        <div className="page-head" style={{ marginBottom: 20 }}>
          <div>
            <div className="eyebrow">
              {editingId
                ? "Modifier la campagne"
                : `Nouvelle campagne · ${manual ? "rédaction manuelle" : "assistée par IA"}`}
            </div>
            <h1>{editingId ? "Modifiez votre e-mail" : "Composez votre e-mail en 3 étapes"}</h1>
          </div>
          <button className="btn outline" onClick={closeBuilder}>
            <Icon name="arrowleft" />
            Retour aux campagnes
          </button>
        </div>

        <div className="cb">
          <div className="cb-panel">
            <div className="cb-steps">
              <div className={"cb-step " + (gen ? "done" : "on")}>
                <span className="num">{gen ? "✓" : "1"}</span>Cible &amp; objectif
              </div>
              <span className="cb-step-sep" />
              <div className={"cb-step " + (gen ? "on" : "")}>
                <span className="num">2</span>
                {manual ? "Rédaction" : "Génération IA"}
              </div>
              <span className="cb-step-sep" />
              <div className="cb-step">
                <span className="num">3</span>Envoi
              </div>
            </div>
            <div className="cb-body">
              {!gen && !generating && (
                <>
                  <div className="field">
                    <label className="field-lbl">Segment ciblé</label>
                    <div className="seg-select">
                      <div className="ss-ic">
                        <Icon name="filter" />
                      </div>
                      <div className="ss-t">
                        <div className="ss-n">{seg.name}</div>
                        <div className="ss-d">{seg.desc || "Base clients"}</div>
                      </div>
                      <div className="ss-c">{fr(seg.count)}</div>
                    </div>
                    <select
                      className="inp"
                      style={{ marginTop: 8 }}
                      value={seg.id}
                      onChange={(e) => setSeg(segs.find((s) => s.id === e.target.value)!)}
                    >
                      {segs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {fr(s.count)} contacts
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-lbl">Ton du message</label>
                    <div className="tone-row">
                      {TONES.map((t) => (
                        <button
                          key={t}
                          className={"tone" + (t === tone ? " on" : "")}
                          onClick={() => setTone(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-lbl">
                      Votre objectif{" "}
                      <span style={{ color: "var(--tx-3)", fontWeight: 400 }}>— en une phrase</span>
                    </label>
                    <textarea
                      className="inp"
                      rows={3}
                      placeholder="Ex : proposer −20% sur la prochaine session de formation"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                      {SUGGESTS.map(([label, full]) => (
                        <button
                          key={label}
                          className="fmt-chip"
                          style={{ cursor: "pointer" }}
                          onClick={() => setPrompt(full)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="cb-manual">
                      <span>Vous préférez écrire vous-même ?</span>
                      <button className="btn outline sm" onClick={startManual}>
                        <Icon name="edit" />
                        Rédiger l’e-mail à la main
                      </button>
                    </div>
                  </div>
                </>
              )}
              {generating && (
                <>
                  <AiLoader
                    lead={
                      <>
                        Rédaction en cours pour le segment <b>{seg.name}</b>
                      </>
                    }
                    phrases={[
                      "Analyse du ton et de l’audience…",
                      "Rédaction de l’objet et de l’accroche…",
                      "Mise en forme du message…",
                    ]}
                    tips={[
                      "Trois objets seront proposés — l’objet fait l’essentiel du taux d’ouverture.",
                      "Le message reste entièrement modifiable avant l’envoi.",
                      "Les réponses arriveront directement sur votre adresse e-mail.",
                    ]}
                  />
                  {/* Squelette de l'e-mail à venir (objets puis corps) : le
                      résultat remplace ces blocs sans faire sauter la page. */}
                  <div aria-hidden="true" style={{ padding: "0 22px 22px" }}>
                    {Array.from({ length: 3 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          border: "1px solid var(--line)",
                          borderRadius: 10,
                          padding: "12px 14px",
                          marginBottom: 8,
                        }}
                      >
                        <Skel w={16} h={16} r={999} />
                        <span style={{ flex: 1, display: "grid", gap: 6 }}>
                          <Skel w="58%" h={11} />
                          <Skel w="34%" h={9} />
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: 16,
                        marginTop: 12,
                      }}
                    >
                      <SkelText lines={5} />
                    </div>
                  </div>
                </>
              )}
              {gen && !generating && (
                <div className="ai-block">
                  {/* Plusieurs objets à comparer : uniquement quand l'IA en a
                      proposé plusieurs. À la main, on écrit le sien. */}
                  {!manual && gen.subjects.length > 1 && (
                    <>
                      <p className="ai-lbl">
                        <RawIcon svg={UI.sparkles2} />
                        {gen.subjects.length} objets proposés — choisissez le vôtre
                      </p>
                      {gen.subjects.map((s, i) => (
                        <div
                          key={i}
                          className={"subj-opt" + (i === subject ? " on" : "")}
                          onClick={() => setSubject(i)}
                        >
                          <div className="so-radio" />
                          <div>
                            <div className="so-t">{s}</div>
                            <div className="so-m">
                              {
                                [
                                  "Recommandé · le plus ouvert",
                                  "Variante directe",
                                  "Variante courte",
                                ][i]
                              }{" "}
                              · {28 + (s.length % 9)} caractères
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Champs éditables : le texte produit par l'IA n'était
                      modifiable nulle part (seul le pré-en-tête l'était), ce qui
                      obligeait à régénérer pour changer un mot. */}
                  <div
                    className="field"
                    style={{ marginTop: !manual && gen.subjects.length > 1 ? 18 : 0 }}
                  >
                    <label className="field-lbl" htmlFor="cb-subject">
                      Objet de l’e-mail
                    </label>
                    <input
                      id="cb-subject"
                      className="inp"
                      placeholder="Ex : Votre offre de rentrée"
                      value={gen.subjects[subject] || ""}
                      onChange={(e) => {
                        const next = [...gen.subjects];
                        next[subject] = e.target.value;
                        setGen({ ...gen, subjects: next });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label className="field-lbl" htmlFor="cb-pre">
                      Texte d’aperçu (pré-en-tête)
                    </label>
                    <input
                      id="cb-pre"
                      className="inp"
                      placeholder="La phrase visible après l’objet dans la boîte de réception"
                      value={gen.pre}
                      onChange={(e) => setGen({ ...gen, pre: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field-lbl" htmlFor="cb-headline">
                      Titre dans le message
                    </label>
                    <input
                      id="cb-headline"
                      className="inp"
                      placeholder="Reprend l’objet si laissé vide"
                      value={gen.headline}
                      onChange={(e) => setGen({ ...gen, headline: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field-lbl" htmlFor="cb-body">
                      Message
                    </label>
                    <textarea
                      id="cb-body"
                      className="inp"
                      rows={9}
                      placeholder={"Bonjour {prenom},\n\nUne ligne vide sépare deux paragraphes."}
                      value={gen.body.join("\n\n")}
                      onChange={(e) => setGen({ ...gen, body: e.target.value.split(/\n{2,}/) })}
                      style={{ resize: "vertical", lineHeight: 1.6 }}
                    />
                    <div style={{ fontSize: 11.5, color: "var(--tx-3)", marginTop: 6 }}>
                      <code>{"{prenom}"}</code> est remplacé par le prénom de chaque destinataire.
                      Une ligne vide crée un paragraphe.
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-lbl" htmlFor="cb-cta">
                      Texte du bouton
                    </label>
                    <input
                      id="cb-cta"
                      className="inp"
                      placeholder="Ex : Découvrir l’offre"
                      value={gen.cta}
                      onChange={(e) => setGen({ ...gen, cta: e.target.value })}
                    />
                  </div>

                  {/* Ce que verra le destinataire : l'en-tête From reste sur le
                      domaine vérifié d'Efficience (obligatoire pour que l'e-mail
                      passe les contrôles SPF/DKIM), mais les réponses arrivent
                      sur l'adresse ci-dessous, également affichée en pied de mail. */}
                  <div className="cb-sender">
                    <Icon name="mail" />
                    <div>
                      <div className="cbs-t">
                        Réponses envoyées à {replyTo || <em>aucune adresse</em>}
                      </div>
                      <div className="cbs-s">
                        {replyTo ? (
                          <>
                            L’expéditeur affiché reste{" "}
                            <b>{getBusiness().name || "votre entreprise"} via Efficience</b> —
                            nécessaire pour la délivrabilité — et cette adresse apparaît en pied de
                            message.
                          </>
                        ) : (
                          <>
                            Renseignez une adresse dans le Configurateur : sans elle, vos
                            destinataires ne pourront pas vous répondre.
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!manual && (
                    <button className="btn ghost sm" style={{ marginTop: 4 }} onClick={doGenerate}>
                      <Icon name="refresh" />
                      Régénérer une autre version
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="cb-foot">
              {!gen && !generating && (
                <>
                  <span className="grow" style={{ fontSize: 12.5, color: "var(--tx-3)" }}>
                    L’IA rédige objet + corps optimisés pour{" "}
                    <b style={{ color: "var(--tx-2)" }}>{fr(seg.count)}</b> destinataires.
                  </span>
                  <button className="btn acc gen-btn" style={{ margin: 0 }} onClick={doGenerate}>
                    <Icon name="wand" />
                    Générer l’e-mail
                  </button>
                </>
              )}
              {generating && (
                <span className="grow" style={{ fontSize: 12.5, color: "var(--tx-3)" }}>
                  Analyse de l’objectif et du segment…
                </span>
              )}
              {gen && !generating && (
                <>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--tx-2)" }}
                  >
                    Envoi le
                    <input
                      type="datetime-local"
                      className="inp"
                      value={schedAt}
                      onChange={(e) => setSchedAt(e.target.value)}
                      style={{ width: 200, padding: "6px 9px", fontSize: 12.5 }}
                      aria-label="Date et heure d’envoi programmé"
                    />
                  </label>
                  <button
                    className="btn outline"
                    disabled={sending}
                    onClick={() => finish("sched")}
                    title="La campagne partira toute seule à cette date, avec les destinataires du segment tels qu’ils sont aujourd’hui"
                  >
                    <Icon name="calendar" />
                    Programmer
                  </button>
                  <span className="grow" />
                  {/* Sans destinataire, l'envoi grisé était un cul-de-sac :
                      on propose l'action qui débloque vraiment (la base). */}
                  {!sendableCount && !sending && (
                    <button className="btn outline" onClick={() => show("contacts")}>
                      <Icon name="users" />
                      Ajouter des contacts
                    </button>
                  )}
                  <div
                    ref={sendBtnWrapRef}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {confirmingSend && (
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        Confirmer l’envoi à {fr(sendableCount)} contacts ?
                      </span>
                    )}
                    <button
                      className="btn acc"
                      disabled={sending || !sendableCount}
                      title={
                        !sendableCount
                          ? "Aucun destinataire avec e-mail valide dans ce segment"
                          : undefined
                      }
                      onClick={() => {
                        if (confirmSend("send")) finish("sent");
                      }}
                    >
                      {sending ? <span className="spin" /> : <Icon name="rocket" />}
                      {sending
                        ? "Envoi en cours…"
                        : confirmingSend
                          ? "Oui, envoyer"
                          : `Envoyer à ${fr(sendableCount)} contacts`}
                    </button>
                    {confirmingSend && (
                      <button className="btn ghost" disabled={sending} onClick={cancelConfirmSend}>
                        Annuler
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="email-prev">
            <div className="ep-bar">
              <div className="ep-dots">
                <i />
                <i />
                <i />
              </div>
              <div className="ep-title">
                <Icon name="eye" />
                Aperçu en direct
              </div>
            </div>
            <div className="ep-scroll">
              {generating ? (
                <div className="ep-empty">
                  <Icon name="wand" />
                  <div className="ee-t">L’IA compose votre e-mail…</div>
                  <p>Objet, accroche et corps adaptés à votre segment.</p>
                </div>
              ) : !gen ? (
                <div className="ep-empty">
                  <Icon name="mail" />
                  <div className="ee-t">Votre e-mail apparaîtra ici</div>
                  <p>
                    Renseignez votre objectif puis lancez la génération pour voir l’aperçu en
                    direct.
                  </p>
                </div>
              ) : (
                <div className="ep-mail">
                  <div className="ep-from">
                    <div className="ava">{getBusiness().initials}</div>
                    <div>
                      <div className="ef-t">{getBusiness().name}</div>
                      <div className="ef-s">{getBusiness().email}</div>
                    </div>
                    <div className="ef-time">09:00</div>
                  </div>
                  <div className="ep-subj-line">{gen.subjects[subject]}</div>
                  <div style={{ fontSize: 12, color: "#999", padding: "4px 20px 0" }}>
                    {gen.pre}
                  </div>
                  <div className="ep-head-band">
                    <img src={MAIL_LOGO} alt="Logo" />
                    <div className="ehb-t">{gen.headline.replace("{prenom}", "Prénom")}</div>
                  </div>
                  <TypedBody key={genId} paras={gen.body} />
                  <div className="ep-cta-wrap">
                    <a className="ep-cta" href="#">
                      {gen.cta}
                    </a>
                  </div>
                  <div className="ep-foot">
                    <div className="ef-social">
                      {SOCIAL.map((s) => (
                        <span key={s}>
                          <Brand name={s} />
                        </span>
                      ))}
                    </div>
                    {getBusiness().name} · {getBusiness().addressLine}
                    <br />
                    Vous recevez cet e-mail car vous êtes client·e. <a href="#">
                      Se désinscrire
                    </a> ·{" "}
                    <a href="#">Préférences</a>
                    <br />
                    <span style={{ opacity: 0.7 }}>Envoyé avec Efficience</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------- list ----------
  /* Statistiques réelles rapportées par Resend (webhook → base), rattachées à
     chaque campagne par son identifiant. Une campagne sans identifiant (créée
     avant le suivi) ou sans événement reste à « — » : l'absence de mesure
     n'est pas une mesure nulle. */
  const sent = campaigns.filter((c) => c.status === "sent");
  const statsOf = (c: Campaign) => (c.id ? stats[c.id] : undefined);
  const tracked = sent.filter((c) => statsOf(c));

  const totalRecipients = tracked.reduce((s, c) => s + (c.sentCount ?? c.recipients), 0);
  const totalOpened = tracked.reduce((s, c) => s + (statsOf(c)?.opened || 0), 0);
  const totalClicked = tracked.reduce((s, c) => s + (statsOf(c)?.clicked || 0), 0);
  const totalUnsub = sent.reduce((s, c) => s + (statsOf(c)?.unsubscribed || 0), 0);
  // Taux global = ouvertures uniques / destinataires réellement servis, et non
  // moyenne des taux par campagne (qui donnerait le même poids à un envoi de
  // 5 contacts et à un envoi de 5 000).
  const avgOpen = totalRecipients ? (totalOpened / totalRecipients) * 100 : null;

  const pct = (n: number, of: number) =>
    of ? ((n / of) * 100).toFixed(1).replace(".", ",") + " %" : "—";

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Emailing · Campagnes IA</div>
          <h1>Des campagnes qui convertissent, sans Brevo</h1>
          <p>
            Décrivez votre objectif en une phrase : l’IA rédige l’e-mail, choisit l’objet le plus
            percutant et l’adresse au bon segment de votre base clients.
          </p>
        </div>
        {/* Plus « IA » dans le libellé : le parcours mène aussi bien à une
            rédaction manuelle qu'à une génération. */}
        <button className="btn acc" onClick={() => openBuilder()}>
          <Icon name="plus" />
          Nouvelle campagne
        </button>
      </div>

      <div className="crm-stats" style={{ marginBottom: 18 }}>
        <div className="crm-stat">
          <div className="cs-l">
            <Icon name="send" />
            Campagnes
          </div>
          <div className="cs-v">{campaigns.length}</div>
          <div className="cs-f">tous statuts</div>
        </div>
        <div className="crm-stat">
          <div className="cs-l">
            <Icon name="mailopen" />
            Taux d’ouverture
          </div>
          <div className="cs-v">
            {avgOpen != null ? avgOpen.toFixed(1).replace(".", ",") + " %" : "—"}
          </div>
          <div className="cs-f">
            {avgOpen != null
              ? `${fr(totalOpened)} sur ${fr(totalRecipients)} destinataires`
              : "aucune campagne suivie pour l’instant"}
          </div>
        </div>
        <div className="crm-stat">
          <div className="cs-l">
            <Icon name="cursor" />
            Clics
          </div>
          <div className="cs-v">{tracked.length ? fr(totalClicked) : "—"}</div>
          <div className="cs-f">
            {tracked.length
              ? `${pct(totalClicked, totalRecipients)} des destinataires`
              : "aucune campagne suivie pour l’instant"}
          </div>
        </div>
        <div className="crm-stat">
          <div className="cs-l">
            <Icon name="shield" />
            Désinscriptions
          </div>
          <div className="cs-v">{sent.length ? fr(totalUnsub) : "—"}</div>
          <div className="cs-f">{sent.length ? "depuis vos campagnes" : "conforme RGPD"}</div>
        </div>
      </div>

      <div className="camp-list">
        {!campaigns.length ? (
          <EmptyState
            icon="mail"
            title="Aucune campagne pour l’instant"
            description="Créez votre première campagne e-mail pour toucher votre base de contacts."
            action={{ label: "Créer une campagne", onClick: () => openBuilder() }}
          />
        ) : (
          campaigns.map((c, i) => (
          <div className="camp-row" key={i}>
            <div className="camp-main">
              <div className={"camp-ic" + (c.status === "sent" ? " sent" : "")}>
                <RawIcon svg={c.status === "sent" ? UI.mailopen : UI.mail} />
              </div>
              <div className="camp-info">
                <div className="camp-name">{c.name}</div>
                <div className="camp-meta">
                  <span className="seg-pill">{c.seg}</span>
                  <span>·</span>
                  <span>{fr(c.recipients)} destinataires</span>
                  <span>·</span>
                  <span>{c.when}</span>
                </div>
              </div>
            </div>
            <div className="camp-stats">
              {statsOf(c) ? (
                (() => {
                  const st = statsOf(c)!;
                  const base = c.sentCount ?? c.recipients;
                  return (
                    <>
                      <div
                        className="camp-metric"
                        title={`${st.opened || 0} destinataire(s) distinct(s)`}
                      >
                        <div className="cm-v">{pct(st.opened || 0, base)}</div>
                        <div className="cm-l">ouvertures</div>
                      </div>
                      <div
                        className="camp-metric"
                        title={`${st.clicked || 0} destinataire(s) distinct(s)`}
                      >
                        <div className="cm-v">{pct(st.clicked || 0, base)}</div>
                        <div className="cm-l">clics</div>
                      </div>
                      {!!st.unsubscribed && (
                        <div className="camp-metric">
                          <div className="cm-v" style={{ color: "var(--warn)" }}>
                            {fr(st.unsubscribed)}
                          </div>
                          <div className="cm-l">désinscrits</div>
                        </div>
                      )}
                    </>
                  );
                })()
              ) : c.status === "sent" && c.sentCount != null ? (
                <>
                  <div className="camp-metric">
                    <div className="cm-v">{fr(c.sentCount)}</div>
                    <div className="cm-l">envoyés</div>
                  </div>
                  {!!c.failedCount && (
                    <div className="camp-metric">
                      <div className="cm-v" style={{ color: "var(--warn)" }}>
                        {fr(c.failedCount)}
                      </div>
                      <div className="cm-l">échecs</div>
                    </div>
                  )}
                </>
              ) : c.status === "failed" ? (
                <div className="camp-metric" title={c.sendError || undefined}>
                  <div className="cm-v" style={{ color: "var(--warn)" }}>
                    0
                  </div>
                  <div className="cm-l">envoyés</div>
                </div>
              ) : (
                <div className="camp-metric">
                  <div className="cm-v" style={{ color: "var(--tx-3)" }}>
                    —
                  </div>
                  <div className="cm-l">en attente</div>
                </div>
              )}
              <StatusPill s={c.status} />
              {/* Toute campagne enregistrée peut être rouverte et modifiée —
                  y compris envoyée : la modifier prépare simplement le
                  prochain envoi, sans réécrire les e-mails déjà partis. */}
              <button
                className="btn ghost sm"
                title={c.status === "sent" ? "Modifier et renvoyer" : "Modifier cette campagne"}
                onClick={() => editCampaign(c)}
              >
                <Icon name="edit" />
                {c.status === "sent" ? "Dupliquer" : "Modifier"}
              </button>
              {/* Une campagne programmée part sans intervention : il faut
                  pouvoir l'arrêter, sinon la seule issue serait de l'envoyer
                  tout de suite ou de la reprogrammer. */}
              {c.status === "sched" && c.id && (
                <button
                  className="btn ghost sm"
                  style={
                    cancellingId === c.id
                      ? { color: "var(--danger)", borderColor: "rgba(179,69,59,.35)" }
                      : undefined
                  }
                  disabled={cancelBusy === c.id}
                  title={
                    cancellingId === c.id
                      ? "Cliquer à nouveau pour confirmer l’annulation"
                      : "Retirer de la file d’envoi"
                  }
                  onClick={() => cancelSchedule(c)}
                >
                  <Icon name="close" />
                  {cancellingId === c.id ? "Confirmer ?" : "Annuler l’envoi"}
                </button>
              )}
            </div>
          </div>
          ))
        )}
      </div>
    </section>
  );
}

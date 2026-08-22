import { useEffect, useMemo, useState } from "react";
import { useEff } from "../state/EffContext";
import { useConnections } from "../state/ConnectionsContext";
import { useCalendar } from "../state/CalendarContext";
import { Icon, Brand, RawIcon } from "../lib/Icon";
import { UI, type BrandName } from "../lib/icons";
import { netName } from "../lib/networks";
import { showToast } from "../lib/toast";
import { getStoredGoogleRefresh } from "../lib/google";
import { getBusiness } from "../lib/business";
import { syncPostsToCalendar } from "../lib/googleCalendar";
import { armAutoPublish, disarmAutoPublish, listServerScheduled } from "../lib/schedule";
import { PublishPanel } from "../components/PublishPanel";
import { useArmedConfirm } from "../hooks/useArmedConfirm";
import { expiresBefore, getTokenExpiry } from "../lib/tokenExpiry";
import { nowLocalIso, toLocalIso, type ScheduledPost } from "../lib/calendar";

const NETS = ["instagram", "facebook", "linkedin", "google"];

/* Minuteries et numéros de séquence du réarmement, par publication. Hors de
   React : ces valeurs ne participent à aucun rendu, et l'écran n'est monté
   qu'une fois à la fois (App remonte le conteneur à chaque navigation). Les
   deux tables sont vidées au démontage. */
const rearmTimers = new Map<string, number>();
const rearmSeq = new Map<string, number>();

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};
const fmtTime = (iso: string) => (iso.split("T")[1] || "").slice(0, 5);
const dayKey = (iso: string) => iso.split("T")[0];

function StatusBadge({ s }: { s: ScheduledPost["status"] }) {
  if (s === "published")
    return (
      <span
        style={{
          fontSize: 11.5,
          color: "var(--acc)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <RawIcon svg={UI.check} style={{ width: 12, height: 12, display: "inline-grid" }} />
        Publié
      </span>
    );
  if (s === "failed") return <span style={{ fontSize: 11.5, color: "var(--warn)" }}>Échec</span>;
  // Succès partiel : publié sur une partie des réseaux seulement — le détail
  // (cibles réussies / échecs) est dans lastResult, affiché sous le post.
  if (s === "partial")
    return <span style={{ fontSize: 11.5, color: "var(--warn)" }}>Publié en partie</span>;
  return (
    <span
      style={{
        fontSize: 11.5,
        color: "var(--tx-3)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <RawIcon svg={UI.clock} style={{ width: 12, height: 12, display: "inline-grid" }} />
      Programmé
    </span>
  );
}

export function Calendar() {
  const { show, editPostInStudio } = useEff();
  const { scheduled, updateCalendar, removeFromCalendar } = useCalendar();
  const {
    isConnected,
    metaToken,
    linkedinToken,
    googleToken,
    googleAccounts,
    metaStats,
    gcalConnected,
    gcalToken,
    gcalCalendarId,
    gcalCalendarName,
    connectGcal,
    disconnectGcal,
    refreshGcalToken,
    createGcalCalendar,
  } = useConnections();
  const [publishing, setPublishing] = useState<ScheduledPost | null>(null);
  /* Relance ciblée : les réseaux à réessayer, ou null pour une publication
     manuelle ordinaire (tous les réseaux du post). */
  const [retryOnly, setRetryOnly] = useState<string[] | null>(null);
  const [arming, setArming] = useState<string | null>(null);
  /* Édition du texte d'une publication programmée : l'heure et les réseaux
     étaient modifiables, mais pas le contenu — il fallait supprimer la
     publication et tout recréer pour corriger une phrase. */
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [creatingCal, setCreatingCal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  /* Suppression à deux clics : le bouton n'était qu'une icône sans
     confirmation — un clic malencontreux effaçait une publication déjà
     armée côté serveur sans aucun retour. */
  const { armed: confirmDeleteId, confirm: confirmDelete } = useArmedConfirm();

  useEffect(
    () => () => {
      for (const t of rearmTimers.values()) window.clearTimeout(t);
      rearmTimers.clear();
      rearmSeq.clear();
    },
    [],
  );

  const createCalendar = async () => {
    setCreatingCal(true);
    const res = await createGcalCalendar(`Éditorial — ${getBusiness().name}`);
    setCreatingCal(false);
    if (res.ok) showToast(UI.check, `Agenda « ${res.summary} » créé`);
    else showToast(UI.close, res.reason || "Échec de la création de l’agenda.");
  };

  const syncCalendar = async () => {
    if (!gcalToken || !gcalCalendarId || !scheduled.length) return;
    setSyncing(true);
    const events = scheduled.map((p) => ({
      id: p.id,
      dateTime: p.dateTime,
      text: p.text,
      networks: p.networks,
      googleEventId: p.googleEventId || undefined,
    }));
    let res = await syncPostsToCalendar(gcalToken, gcalCalendarId, events);
    // Le jeton expire après ~1h — si tout a échoué, un rafraîchissement puis un
    // seul nouvel essai avant de renoncer, comme pour Google Business/YouTube.
    if ((res.results || []).length && (res.results || []).every((r) => !r.ok)) {
      const fresh = await refreshGcalToken();
      if (fresh) res = await syncPostsToCalendar(fresh, gcalCalendarId, events);
    }
    const results = res.results || [];
    results.forEach((r) => {
      if (r.ok && r.googleEventId) updateCalendar(r.id, { googleEventId: r.googleEventId });
    });
    setSyncing(false);
    if (!results.length) {
      showToast(UI.close, res.reason || "Échec de la synchronisation.");
      return;
    }
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    if (okCount)
      showToast(
        UI.check,
        `${okCount} publication${okCount > 1 ? "s" : ""} synchronisée${okCount > 1 ? "s" : ""} avec Google Agenda`,
      );
    if (failCount)
      showToast(UI.close, `${failCount} échec${failCount > 1 ? "s" : ""} de synchronisation`);
  };

  /* À venir : les publications déjà effectuées quittent la liste de
     programmation et rejoignent l'historique en bas de page. */
  const pending = useMemo(() => scheduled.filter((p) => p.status !== "published"), [scheduled]);
  const byDay = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>();
    for (const p of pending) {
      const k = dayKey(p.dateTime);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries());
  }, [pending]);

  /* Historique : publications réellement effectuées — celles publiées via
     l'app (statut « publié ») et celles lues directement sur les réseaux
     connectés (posts Facebook/Instagram réels). Dédoublonnage même jour +
     même début de texte : un post publié via l'app remonte aussi dans les
     stats Meta. */
  const history = useMemo(() => {
    const rows: {
      key: string;
      dateTime: string;
      text: string;
      networks: string[];
      image: string | null;
      permalink: string | null;
      appId: string | null;
    }[] = [];
    for (const p of scheduled) {
      if (p.status !== "published") continue;
      rows.push({
        key: p.id,
        dateTime: p.dateTime,
        text: p.text,
        networks: p.networks,
        image: p.photoUrl || null,
        permalink: null,
        appId: p.id,
      });
    }
    const sigs = new Set(rows.map((r) => dayKey(r.dateTime) + "|" + r.text.trim().slice(0, 80)));
    for (const acc of metaStats || []) {
      for (const mp of acc.posts || []) {
        if (!mp.date) continue;
        const d = new Date(mp.date);
        if (isNaN(d.getTime())) continue;
        const dt = toLocalIso(d);
        const sig = dayKey(dt) + "|" + (mp.caption || "").trim().slice(0, 80);
        if (sigs.has(sig)) continue;
        sigs.add(sig);
        rows.push({
          key: `${acc.network}-${mp.id}`,
          dateTime: dt,
          text: mp.caption || "",
          networks: [acc.network],
          image: mp.image || null,
          permalink: mp.permalink || null,
          appId: null,
        });
      }
    }
    rows.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
    return rows;
  }, [scheduled, metaStats]);

  // Synchronise les statuts depuis le serveur (le cron a pu publier des posts armés).
  useEffect(() => {
    if (!scheduled.some((p) => p.auto)) return;
    let alive = true;
    listServerScheduled().then((d) => {
      if (!alive || !d.ok || !d.posts) return;
      for (const sp of d.posts) {
        const local = scheduled.find((p) => p.id === sp.id);
        if (local && local.auto && sp.status !== "scheduled" && local.status !== sp.status) {
          updateCalendar(local.id, {
            status: sp.status as ScheduledPost["status"],
            lastResult: sp.lastResult || null,
            failedNetworks: sp.failedNetworks || null,
          });
        }
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Réseaux à réessayer après un échec. Sans détail enregistré, un échec
     total se relance en entier ; un succès partiel, lui, ne se relance pas à
     l'aveugle — republier ce qui est déjà passé ferait un doublon public. */
  const retryTargets = (p: ScheduledPost): string[] => {
    if (p.failedNetworks && p.failedNetworks.length) return p.failedNetworks;
    return p.status === "failed" ? p.networks : [];
  };

  /* Un jeton Meta ou LinkedIn qui expire AVANT l'heure prévue condamne la
     publication : le cron partirait avec un accès périmé, et l'échec ne serait
     visible qu'après coup. Mieux vaut le refuser tout de suite, en disant quoi
     faire. */
  const expiredNetworks = (p: ScheduledPost): string[] => {
    const whenMs = Date.parse(p.dateTime);
    if (!Number.isFinite(whenMs)) return [];
    const out: string[] = [];
    if (p.networks.some((n) => n === "instagram" || n === "facebook") && expiresBefore("meta", whenMs))
      out.push("Instagram / Facebook");
    if (p.networks.includes("linkedin") && expiresBefore("linkedin", whenMs)) out.push("LinkedIn");
    return out;
  };

  /* Réarme l'auto-publication côté serveur avec les valeurs à jour (date,
     heure ou réseaux) : armAutoPublish avait figé whenMs/dateTime/networks à
     l'armement initial, si bien qu'une modification locale ne changeait rien
     au cron, qui publiait l'ANCIEN horaire ou l'ANCIENNE liste de réseaux. */
  const armServer = (p: ScheduledPost) => {
    const tokens: Parameters<typeof armAutoPublish>[1] = {};
    if (p.networks.some((n) => n === "instagram" || n === "facebook") && metaToken)
      tokens.meta = metaToken;
    if (p.networks.includes("linkedin") && linkedinToken) tokens.linkedin = linkedinToken;
    if (p.networks.includes("google") && googleToken)
      tokens.google = {
        token: googleToken,
        refresh: getStoredGoogleRefresh(),
        paths: googleAccounts.map((a) => a.path),
      };
    tokens.expiry = { meta: getTokenExpiry("meta"), linkedin: getTokenExpiry("linkedin") };
    return armAutoPublish(
      {
        id: p.id,
        whenMs: Date.parse(p.dateTime),
        dateTime: p.dateTime,
        text: p.text,
        networks: p.networks,
        photoUrl: p.photoUrl || null,
        pillar: p.pillar || null,
      },
      tokens,
    );
  };

  const rearm = async (p: ScheduledPost) => {
    /* Déplacer une publication armée au-delà de l'échéance du jeton la
       condamnerait aussi sûrement que l'armer trop tard : on coupe
       l'auto-publication plutôt que de laisser croire qu'elle partira. */
    const stale = expiredNetworks(p);
    if (stale.length) {
      updateCalendar(p.id, { auto: false });
      await disarmAutoPublish(p.id);
      showToast(
        UI.warning,
        `Auto-publication désactivée : l'accès ${stale.join(" et ")} aura expiré à cette date. Reconnectez, puis réactivez-la.`,
      );
      return;
    }
    const seq = (rearmSeq.get(p.id) || 0) + 1;
    rearmSeq.set(p.id, seq);
    const r = await armServer(p);
    /* Un réarmement plus récent est parti entre-temps : c'est lui qui fait
       foi. Sans ce garde, une réponse arrivée dans le désordre — ou l'échec
       d'une valeur intermédiaire — couperait l'auto-publication alors que la
       valeur finale, elle, s'arme très bien. */
    if (rearmSeq.get(p.id) !== seq) return;
    if (!r.ok) {
      await disarmAutoPublish(p.id);
      updateCalendar(p.id, { auto: false });
      showToast(UI.close, r.reason || "Auto-publication désactivée : réarmement impossible.");
    }
  };

  /* Les champs date/heure émettent un change par frappe (y compris des valeurs
     intermédiaires : taper « 2027 » passe par l'an 0002). Réarmer à chaque
     événement inonderait le serveur et pourrait armer le cron sur une date
     passée, donc publier immédiatement. On attend la fin de la saisie. */
  const scheduleRearm = (p: ScheduledPost) => {
    const pending = rearmTimers.get(p.id);
    if (pending) window.clearTimeout(pending);
    rearmTimers.set(
      p.id,
      window.setTimeout(() => {
        rearmTimers.delete(p.id);
        void rearm(p);
      }, 600),
    );
  };

  const toggleNet = (p: ScheduledPost, net: string) => {
    const has = p.networks.includes(net);
    const networks = has ? p.networks.filter((n) => n !== net) : [...p.networks, net];
    /* Une liste vide est refusée par le serveur, et sur un post armé le
       réarmement échouerait donc en coupant l'auto-publication. */
    if (networks.length === 0) {
      showToast(UI.warning, "Gardez au moins un réseau pour cette publication.");
      return;
    }
    updateCalendar(p.id, { networks });
    if (p.auto) scheduleRearm({ ...p, networks });
  };

  const arm = async (p: ScheduledPost) => {
    const stale = expiredNetworks(p);
    if (stale.length) {
      showToast(
        UI.warning,
        `Accès ${stale.join(" et ")} expiré d'ici là — reconnectez ${stale.length > 1 ? "ces réseaux" : "ce réseau"} depuis l'écran Connexion avant d'activer l'auto-publication.`,
      );
      return;
    }
    setArming(p.id);
    const r = await armServer(p);
    setArming(null);
    if (r.ok) {
      updateCalendar(p.id, { auto: true });
      showToast(UI.check, "Auto-publication activée");
    } else showToast(UI.close, r.reason || "Auto-publication indisponible");
  };
  const disarm = async (p: ScheduledPost) => {
    setArming(p.id);
    await disarmAutoPublish(p.id);
    setArming(null);
    updateCalendar(p.id, { auto: false });
    showToast(UI.check, "Auto-publication désactivée");
  };

  const saveText = async (p: ScheduledPost) => {
    const text = editText.trim();
    if (!text) {
      showToast(UI.close, "Le texte ne peut pas être vide.");
      return;
    }
    updateCalendar(p.id, { text });
    setEditId(null);
    /* L'auto-publication a été armée côté serveur avec l'ANCIEN texte : sans
       désarmement, c'est lui qui partirait à l'heure prévue. On la coupe et on
       invite à la réactiver — jamais de publication d'un texte périmé. */
    if (p.auto) {
      await disarmAutoPublish(p.id);
      updateCalendar(p.id, { auto: false });
      showToast(
        UI.warning,
        "Texte mis à jour — auto-publication désactivée. Réactivez-la pour armer le nouveau texte.",
      );
    } else {
      showToast(UI.check, "Texte mis à jour");
    }
  };

  const confirmDeleteScheduled = async (p: ScheduledPost) => {
    if (!confirmDelete(p.id)) return;
    // Le post est armé côté serveur : sans désarmement préalable, le cron
    // publierait quand même un contenu que l'utilisateur croit supprimé.
    if (p.auto) {
      const r = await disarmAutoPublish(p.id);
      if (!r.ok) {
        showToast(UI.close, r.reason || "Échec du désarmement — publication non supprimée.");
        return;
      }
    }
    removeFromCalendar(p.id);
    showToast(UI.check, "Publication programmée supprimée");
  };

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Calendrier de programmation</div>
          <h1>Vos publications programmées</h1>
          <p>
            Les posts ajoutés depuis le <b style={{ color: "var(--tx-2)" }}>Planning éditorial</b>{" "}
            arrivent ici. Choisissez la date, l’heure et les réseaux, puis publiez en un clic le
            moment venu.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button className="btn outline" onClick={() => show("planning")}>
            <Icon name="calendar" />
            Planning éditorial
          </button>
          {/* Le calendrier vit dans le profil : chaque modification part dans
              l'espace côté serveur (autosave AuthWrapper) et revient à la
              connexion, sur n'importe quel appareil. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              color: "var(--tx-3)",
            }}
          >
            <RawIcon svg={UI.check} style={{ width: 12, height: 12, display: "inline-grid" }} />
            Enregistré automatiquement dans votre espace
          </span>
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderRadius: "var(--r-card)",
          border: "1px solid rgba(143,100,35,.3)",
          background: "rgba(143,100,35,.07)",
          color: "var(--tx-2)",
          fontSize: 12.5,
          marginBottom: 16,
        }}
      >
        <b style={{ color: "var(--acc)" }}>Auto-publier</b> = publication automatique à l’heure
        prévue, même app fermée (moteur serveur). <b>Publier</b> = diffusion immédiate en 1 clic.
        L’auto-publication nécessite l’activation du store serveur (Vercel KV) et du cron — voir la
        doc.
      </div>

      <div className="net-summary" style={{ marginBottom: 16 }}>
        <div className="ns-ic">
          <Icon name="calendar" />
        </div>
        <div>
          <div className="ns-t">Google Agenda</div>
          <div className="ns-s">
            {!gcalConnected
              ? "Créez un agenda Google dédié à votre planning éditorial et synchronisez vos publications programmées."
              : !gcalCalendarId
                ? "Connecté — créez l’agenda dédié pour commencer à synchroniser."
                : `Synchronisé avec « ${gcalCalendarName} ».`}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {!gcalConnected && (
            <button className="btn outline sm" onClick={connectGcal}>
              <Icon name="link" />
              Connecter Google Agenda
            </button>
          )}
          {gcalConnected && !gcalCalendarId && (
            <button className="btn acc sm" disabled={creatingCal} onClick={createCalendar}>
              {creatingCal ? <span className="spin lt" /> : <Icon name="plus" />}Créer l’agenda
            </button>
          )}
          {gcalConnected && gcalCalendarId && (
            <button
              className="btn acc sm"
              disabled={syncing || !scheduled.length}
              onClick={syncCalendar}
              title={!scheduled.length ? "Aucune publication programmée à synchroniser" : undefined}
            >
              {syncing ? <span className="spin lt" /> : <Icon name="refresh" />}Synchroniser
            </button>
          )}
          {gcalConnected && (
            <button
              className="unlink-btn"
              title="Déconnecter Google Agenda"
              aria-label="Déconnecter Google Agenda"
              onClick={disconnectGcal}
            >
              <Icon name="unlink" />
            </button>
          )}
        </div>
      </div>

      {!pending.length ? (
        <div className="net-summary">
          <div className="ns-ic">
            <Icon name="calendar" />
          </div>
          <div>
            <div className="ns-t">Aucune publication programmée</div>
            <div className="ns-s">
              Ouvrez le Planning éditorial et cliquez « Programmer » sur un post.
            </div>
          </div>
          <button
            className="btn acc"
            style={{ marginLeft: "auto" }}
            onClick={() => show("planning")}
          >
            <Icon name="calendar" />
            Aller au planning
          </button>
        </div>
      ) : (
        byDay.map(([day, posts]) => (
          <div className="card" style={{ marginBottom: 16 }} key={day}>
            <div className="card-h">
              <h3 style={{ textTransform: "capitalize" }}>{fmtDay(posts[0].dateTime)}</h3>
              <div className="sub">
                {posts.length} publication{posts.length > 1 ? "s" : ""}
              </div>
            </div>
            <div className="pad" style={{ display: "grid", gap: 12 }}>
              {posts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "14px",
                    borderRadius: "var(--r-btn)",
                    border: "1px solid var(--line)",
                    background: "var(--canvas-soft)",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {p.photoUrl ? (
                      <img
                        src={p.photoUrl}
                        alt=""
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          display: "grid",
                          placeItems: "center",
                          background: "var(--canvas)",
                          color: "var(--tx-3)",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="image" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          type="date"
                          value={dayKey(p.dateTime)}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const dateTime = e.target.value + "T" + fmtTime(p.dateTime);
                            updateCalendar(p.id, { dateTime });
                            if (p.auto) scheduleRearm({ ...p, dateTime });
                          }}
                          className="inp"
                          style={{ width: 145, padding: "5px 8px", fontSize: 13 }}
                          title="Déplacer à une autre date"
                        />
                        <input
                          type="time"
                          value={fmtTime(p.dateTime)}
                          onChange={(e) => {
                            const dateTime = dayKey(p.dateTime) + "T" + (e.target.value || "09:00");
                            updateCalendar(p.id, { dateTime });
                            if (p.auto) scheduleRearm({ ...p, dateTime });
                          }}
                          className="inp"
                          style={{ width: 110, padding: "5px 8px", fontSize: 13 }}
                        />
                        <StatusBadge s={p.status} />
                        {p.pillar && (
                          <span style={{ fontSize: 11, color: "var(--acc)" }}>· {p.pillar}</span>
                        )}
                      </div>
                      {editId === p.id ? (
                        <>
                          <textarea
                            className="inp"
                            rows={5}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            style={{ resize: "vertical", lineHeight: 1.5, fontSize: 13 }}
                          />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className="btn acc sm" onClick={() => saveText(p)}>
                              <Icon name="check" />
                              Enregistrer
                            </button>
                            <button className="btn ghost sm" onClick={() => setEditId(null)}>
                              Annuler
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--tx)",
                            whiteSpace: "pre-wrap",
                            maxHeight: 96,
                            overflow: "hidden",
                            lineHeight: 1.4,
                          }}
                        >
                          {p.text}
                        </div>
                      )}
                      {p.lastResult && (
                        <div style={{ fontSize: 11.5, color: "var(--warn)", marginTop: 6 }}>
                          {p.lastResult}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {NETS.map((net) => {
                      const on = p.networks.includes(net);
                      const conn = isConnected(net);
                      return (
                        <button
                          key={net}
                          onClick={() => toggleNet(p, net)}
                          title={conn ? netName(net) : netName(net) + " (non connecté)"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            padding: "5px 10px",
                            borderRadius: 999,
                            cursor: "pointer",
                            border: "1px solid " + (on ? "var(--acc)" : "var(--line)"),
                            background: on ? "var(--acc-soft)" : "transparent",
                            color: on ? "var(--acc)" : "var(--tx-3)",
                            opacity: conn ? 1 : 0.6,
                          }}
                        >
                          <span style={{ width: 14, height: 14, display: "inline-grid" }}>
                            <Brand name={net as BrandName} />
                          </span>
                          {netName(net)}
                        </button>
                      );
                    })}
                    <span style={{ flex: 1 }} />
                    {/* Le texte d'un post déjà publié est un fait accompli : pas d'édition. */}
                    {p.status !== "published" && editId !== p.id && (
                      <>
                        <button
                          className="btn ghost sm"
                          onClick={() => {
                            setEditId(p.id);
                            setEditText(p.text);
                          }}
                          title="Modification rapide du texte"
                        >
                          <Icon name="edit" />
                          Modifier
                        </button>
                        <button
                          className="btn ghost sm"
                          title="Retravailler ce post dans le Studio : texte, visuel, outils IA — puis « Mettre à jour »"
                          onClick={() =>
                            editPostInStudio({
                              id: p.id,
                              text: p.text,
                              photoUrl: p.photoUrl || null,
                              networks: p.networks,
                              dateTime: p.dateTime,
                            })
                          }
                        >
                          <Icon name="wand" />
                          Studio
                        </button>
                      </>
                    )}
                    {(p.status === "failed" || p.status === "partial") &&
                      retryTargets(p).length > 0 && (
                        <button
                          className="btn ghost sm"
                          onClick={() => {
                            setRetryOnly(retryTargets(p));
                            setPublishing(p);
                          }}
                          title={`Réessayer sur ${retryTargets(p).map(netName).join(", ")} — les réseaux déjà publiés ne sont pas retouchés`}
                        >
                          <Icon name="refresh" />
                          Relancer
                        </button>
                      )}
                    <button
                      className="btn ghost sm"
                      style={
                        confirmDeleteId === p.id
                          ? { color: "var(--danger)", borderColor: "rgba(179,69,59,.35)" }
                          : undefined
                      }
                      onClick={() => confirmDeleteScheduled(p)}
                      title={
                        confirmDeleteId === p.id ? "Cliquer à nouveau pour confirmer" : "Supprimer"
                      }
                      aria-label="Supprimer la publication programmée"
                    >
                      <Icon name="trash" />
                      {confirmDeleteId === p.id ? "Confirmer ?" : ""}
                    </button>
                    {p.auto ? (
                      <button
                        className="btn outline sm"
                        disabled={arming === p.id}
                        onClick={() => disarm(p)}
                        title="Désactiver l'auto-publication"
                      >
                        {arming === p.id ? <span className="spin lt" /> : <Icon name="clock" />}Auto
                        activée
                      </button>
                    ) : (
                      <button
                        className="btn outline sm"
                        disabled={arming === p.id || !p.networks.some((n) => isConnected(n))}
                        onClick={() => arm(p)}
                        title="Publier automatiquement à l'heure prévue"
                      >
                        {arming === p.id ? <span className="spin lt" /> : <Icon name="clock" />}
                        Auto-publier
                      </button>
                    )}
                    <button
                      className="btn acc sm"
                      disabled={!p.networks.length || !p.networks.some((n) => isConnected(n))}
                      onClick={() => setPublishing(p)}
                    >
                      <Icon name="send" />
                      Publier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 4 }}>
          <div className="card-h">
            <h3>Publications effectuées</h3>
            <div className="sub">
              {history.length} publication{history.length > 1 ? "s" : ""} — publiées via l’app ou
              lues sur vos réseaux connectés
            </div>
          </div>
          <div className="pad" style={{ display: "grid", gap: 10 }}>
            {history.map((h) => (
              <div
                key={h.key}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "12px 14px",
                  borderRadius: "var(--r-btn)",
                  border: "1px solid var(--line)",
                  background: "var(--canvas-soft)",
                }}
              >
                {h.image ? (
                  <img
                    src={h.image}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      background: "var(--canvas)",
                      color: "var(--tx-3)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="image" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{ fontSize: 12, color: "var(--tx-3)", textTransform: "capitalize" }}
                    >
                      {fmtDay(h.dateTime)}
                      {fmtTime(h.dateTime) !== "00:00" ? ` · ${fmtTime(h.dateTime)}` : ""}
                    </span>
                    {h.networks.map((n) => (
                      <span
                        key={n}
                        title={netName(n)}
                        style={{
                          width: 14,
                          height: 14,
                          display: "inline-grid",
                          color: "var(--tx-3)",
                        }}
                      >
                        <Brand name={n as BrandName} />
                      </span>
                    ))}
                    <StatusBadge s="published" />
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--tx)",
                      whiteSpace: "pre-wrap",
                      maxHeight: 60,
                      overflow: "hidden",
                      lineHeight: 1.4,
                    }}
                  >
                    {h.text || <span style={{ color: "var(--tx-3)" }}>(sans texte)</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {h.permalink && (
                    <a
                      className="btn ghost sm"
                      href={h.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="link" />
                      Voir
                    </a>
                  )}
                  {h.appId && (
                    <button
                      className="btn ghost sm"
                      title="Retirer de l’historique"
                      onClick={() => removeFromCalendar(h.appId!)}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {publishing && (
        <PublishPanel
          text={publishing.text}
          platforms={retryOnly ?? publishing.networks}
          localMedia={false}
          defaultPhotoUrl={publishing.photoUrl || null}
          onPublished={(okNetworks, attemptedNetworks) => {
            /* Le post programmé devient une publication effectuée : statut
               « publié », daté du moment réel de diffusion. Si l'auto-publication
               était armée côté serveur, on la coupe — sinon le même texte
               repartirait tout seul à l'heure prévue.
               Une cible qui échoue encore reste en attente de relance, plutôt
               que d'être comptée comme publiée. */
            const stillFailing = attemptedNetworks.filter((n) => !okNetworks.includes(n));
            if (stillFailing.length) {
              updateCalendar(publishing.id, {
                status: "partial",
                auto: false,
                failedNetworks: stillFailing,
                lastResult: `Relance : toujours en échec sur ${stillFailing.map(netName).join(", ")}.`,
              });
            } else {
              updateCalendar(publishing.id, {
                status: "published",
                dateTime: nowLocalIso(),
                auto: false,
                failedNetworks: null,
                lastResult: null,
              });
            }
            if (publishing.auto) disarmAutoPublish(publishing.id);
          }}
          onClose={() => {
            setPublishing(null);
            setRetryOnly(null);
          }}
        />
      )}
    </section>
  );
}

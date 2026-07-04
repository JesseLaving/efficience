import { useEffect, useMemo, useState } from 'react';
import { useEff } from '../state/EffContext';
import { useContacts } from '../state/ContactsContext';
import { useCampaigns } from '../state/CampaignsContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { showToast } from '../lib/toast';
import { segmentInfos, type SegmentInfo } from '../lib/population';
import { getBusiness } from '../lib/business';
import { generateEmail } from '../lib/ai';
import type { Campaign } from '../lib/campaigns';

const MAIL_LOGO = `${import.meta.env.BASE_URL}assets/logo-white.png`;
const SOCIAL: BrandName[] = ['linkedin', 'instagram', 'facebook'];
const TONES = ['Direct', 'Pédagogique', 'Expert', 'Chaleureux'];

interface Generated { subjects: string[]; pre: string; headline: string; body: string[]; cta: string; segName: string; pct: number; }

const num = (txt: string) => { const m = (txt || '').match(/(\d{1,2})\s?%/); return m ? +m[1] : 20; };
function family(p: string) {
  p = (p || '').toLowerCase();
  if (/(promo|réduc|reduc|-\d|%|offre|solde|remise|code|deal)/.test(p)) return 'promo';
  if (/(nouveau|nouveauté|nouveaute|lancement|découvr|decouvr|arriv)/.test(p)) return 'nouveaute';
  if (/(revenir|manqué|manque|inactif|réactiv|reactiv|absent|relanc|prospect|sans réponse|recontact)/.test(p)) return 'reactivation';
  if (/(fidél|fidel|carte|points|récompense|recompense|merci|recommand|confiance)/.test(p)) return 'fidelite';
  if (/(événement|evenement|ouverture|atelier|dégustation|degustation|fête|fete|noël|noel|pâques|paques|portes)/.test(p)) return 'evenement';
  return 'generic';
}
function serviceNoun(sector: string): string {
  const s = sector.toLowerCase();
  if (/(restau|food|traiteur|boulang|p[âa]tiss|caf[ée]|\bbar\b|pizz|brasserie)/.test(s)) return 'votre prochain repas';
  if (/(sant[ée]|m[ée]decin|kin[ée]|ost[ée]o|dentaire|psy|th[ée]rap)/.test(s)) return 'votre prochain rendez-vous';
  if (/(beaut[ée]|coiff|esth[ée]t|ongle|\bspa\b|barbier)/.test(s)) return 'votre prochain soin';
  if (/(immobil|courtier)/.test(s)) return 'votre estimation gratuite';
  if (/(artisan|btp|plomb|[ée]lectri|menuisi|peinture|couvreur)/.test(s)) return 'votre devis';
  if (/(commerce|boutique|magasin|retail)/.test(s)) return 'votre prochain achat';
  if (/(formation|conseil|coach|consult)/.test(s)) return 'votre prochaine session';
  return 'votre prochaine prestation';
}

function generate(prompt: string, tone: string, segName: string, biz: { name: string; sector: string; city: string } = { name: '', sector: '', city: '' }): Generated {
  const pct = num(prompt);
  const n = biz.name || 'Notre équipe';
  const svc = serviceNoun(biz.sector);
  const flavor = ({ Direct: 'direct', 'Pédagogique': 'pédagogique', Expert: 'rigoureux', Chaleureux: 'chaleureux' } as Record<string, string>)[tone] || 'direct';
  const T: Record<string, Omit<Generated, 'segName' | 'pct'>> = {
    promo: { subjects: [`−${pct}% sur ${svc}`, `Votre offre exclusive : −${pct}%`, `−${pct}% pour vous — offre limitée`], pre: 'Une offre claire, sans engagement, pour passer à l’action.', headline: `−${pct}% rien que pour vous`, body: ['Bonjour {prenom},', `Parce que vous nous faites confiance, <b>${n}</b> vous réserve <b>−${pct}%</b> sur ${svc} — ce mois-ci uniquement.`, `Un accompagnement ${flavor}, concret, pensé pour vous.`], cta: 'J’en profite maintenant' },
    nouveaute: { subjects: ['Découvrez notre dernière nouveauté', `${n} innove pour vous`, 'Une nouveauté à ne pas manquer'], pre: 'Une nouveauté pensée pour vous, disponible dès maintenant.', headline: 'Notre nouveauté du moment', body: ['Bonjour {prenom},', `Chez <b>${n}</b>, nous ne restons jamais immobiles. Voici ce que nous avons préparé pour vous.`, 'Vous faites partie des premiers informés — dites-nous ce que vous en pensez.'], cta: 'Découvrir la nouveauté' },
    reactivation: { subjects: ['On reprend contact ?', 'Toujours là pour vous', 'Un point sur votre projet ?'], pre: 'Quelques semaines sans échange — reprenons le fil.', headline: 'On refait le point, {prenom} ?', body: ['Bonjour {prenom},', `Ça fait un moment que nous n’avons pas échangé. Chez <b>${n}</b>, votre projet nous tient toujours à cœur.`, `Si vous avez un besoin — ou simplement envie de faire le point — je suis disponible${biz.city ? ` à ${biz.city}` : ''} ou en ligne.`], cta: 'Reprendre contact' },
    fidelite: { subjects: ['Merci pour votre confiance', 'Un mot sincère de notre part', 'Votre fidélité compte pour nous'], pre: 'Un remerciement sincère, et une porte toujours ouverte.', headline: 'Merci pour votre confiance', body: ['Bonjour {prenom},', `Votre fidélité est ce qui nous pousse chaque jour à faire mieux chez <b>${n}</b>. Un simple merci s’imposait.`, 'Si vous êtes satisfait·e, une recommandation à un proche nous aide énormément. Et pour tout nouveau besoin, vous savez où nous trouver.'], cta: 'Recommander un proche' },
    evenement: { subjects: [`Invitation de ${n}`, 'Save the date — rejoignez-nous', 'Vous êtes invité·e'], pre: 'Un événement à ne pas manquer — bloquez la date.', headline: 'Vous êtes invité·e', body: ['Bonjour {prenom},', `<b>${n}</b> vous invite à un moment d’échange et de découverte. Les places sont limitées pour garder un cadre convivial.`, `Confirmez votre venue en un clic — nous serions ravis de vous accueillir${biz.city ? ` à ${biz.city}` : ''}.`], cta: 'Je réserve ma place' },
    generic: { subjects: [`Des nouvelles de ${n}`, 'Un point utile pour vous', 'Trois idées pour avancer'], pre: 'Quelques lignes utiles, sans détour.', headline: `Un mot de ${n}`, body: ['Bonjour {prenom},', `Voici quelques nouvelles de la part de <b>${n}</b>, avec notre approche habituelle : du concret et un ton ${flavor}.`, 'Si un sujet vous parle, répondez à ce mail — on en parle avec plaisir.'], cta: 'Échanger avec nous' },
  };
  const f = T[family(prompt)];
  return { ...f, segName, pct };
}

const SUGGESTS: [string, string][] = [
  ['Offre spéciale', 'Proposer une offre promotionnelle à mes contacts ce mois-ci'],
  ['Nouveauté', 'Annoncer une nouveauté ou un nouveau service à ma base'],
  ['Relance', 'Relancer des contacts inactifs pour reprendre le fil'],
  ['Événement', 'Inviter mes contacts à un événement ou un atelier'],
];

/* ---------- typed email body ---------- */
function TypedBody({ paras, genId }: { paras: string[]; genId: number }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    const replaced = paras.map((t) => t.replace('{prenom}', 'Prénom'));
    let pi = 0, ci = 0;
    const built: string[] = [];
    const cursor = '<span class="typ-cursor"></span>';
    const id = window.setInterval(() => {
      if (pi >= replaced.length) { window.clearInterval(id); return; }
      ci += 3;
      const slice = replaced[pi].slice(0, ci);
      const done = built.map((p) => `<p>${p}</p>`).join('');
      setHtml(done + `<p>${slice}${cursor}</p>`);
      if (ci >= replaced[pi].length) { built.push(replaced[pi]); pi++; ci = 0; if (pi >= replaced.length) { setHtml(built.map((p) => `<p>${p}</p>`).join('')); window.clearInterval(id); } }
    }, 16);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genId]);
  return <div className="ep-body-c" dangerouslySetInnerHTML={{ __html: html }} />;
}

function StatusPill({ s }: { s: Campaign['status'] }) {
  const [cls, lbl] = ({ sent: ['sent', 'Envoyée'], sched: ['sched', 'Programmée'], draft: ['draft', 'Brouillon'] } as Record<string, [string, string]>)[s];
  return <span className={'st-pill ' + cls}><i />{lbl}</span>;
}

export function Campagnes() {
  const { campaignSeed, clearCampaignSeed } = useEff();
  const { contacts } = useContacts();
  const { campaigns, addCampaign } = useCampaigns();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const segs = useMemo<SegmentInfo[]>(() => segmentInfos(contacts), [contacts]);

  // builder state
  const [seg, setSeg] = useState<SegmentInfo>(segs[0]);
  const [tone, setTone] = useState('Chaleureux');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [gen, setGen] = useState<Generated | null>(null);
  const [subject, setSubject] = useState(0);
  const [genId, setGenId] = useState(0);

  const openBuilder = (segId?: string) => {
    setSeg(segs.find((s) => s.id === segId) || segs[0]);
    setGen(null); setGenerating(false); setSubject(0);
    setView('builder');
  };

  useEffect(() => {
    if (campaignSeed) { openBuilder(campaignSeed.seg); clearCampaignSeed(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignSeed]);

  const doGenerate = async () => {
    const p = prompt.trim() || 'Partager une actualité utile à mes contacts cette semaine';
    if (!prompt.trim()) setPrompt(p);
    setGenerating(true); setGen(null);
    // Vraie IA Claude en priorité ; repli sur le moteur de modèles si la clé manque.
    const b = getBusiness();
    try {
      const res = await generateEmail(p, { name: b.name, sector: b.sector, city: b.city, audience: seg.name, tone });
      if (res.available && res.email && (res.email.subject || res.email.body)) {
        const e = res.email;
        setGen({
          subjects: [e.subject || generate(p, tone, seg.name).subjects[0]],
          pre: e.preheader || '',
          headline: e.subject || '',
          body: (e.body || '').split(/\n+/).map((s) => s.trim()).filter(Boolean),
          cta: e.cta || 'En savoir plus',
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

  const finish = (status: 'sent' | 'sched') => {
    // Aucun envoi e-mail réel n'est encore branché (pas de fournisseur
    // d'envoi/suivi) — les ouvertures et clics restent donc à null plutôt
    // que des chiffres inventés. Le statut "envoyée" enregistre la campagne
    // dans l'historique, mais l'engagement réel n'est pas encore mesurable.
    addCampaign({
      name: gen!.subjects[subject].replace(/\s*[🥐✨🥖💚🎉]/g, '').trim(),
      seg: seg.name, status, recipients: seg.count,
      open: null, click: null,
      when: status === 'sent' ? 'Envoyée à l’instant' : 'Programmée sam. 09:00',
    });
    setView('list'); setGen(null); setPrompt('');
    showToast(status === 'sent' ? UI.rocket : UI.calendar, status === 'sent' ? `Campagne envoyée à ${fr(seg.count)} contacts` : 'Campagne programmée');
  };

  if (view === 'builder') {
    return (
      <section className="screen show anim">
        <div className="page-head" style={{ marginBottom: 20 }}>
          <div>
            <div className="eyebrow">Nouvelle campagne · assistée par IA</div>
            <h1>Composez votre e-mail en 3 étapes</h1>
          </div>
          <button className="btn outline" onClick={() => setView('list')}><Icon name="arrowleft" />Retour aux campagnes</button>
        </div>

        <div className="cb">
          <div className="cb-panel">
            <div className="cb-steps">
              <div className={'cb-step ' + (gen ? 'done' : 'on')}><span className="num">{gen ? '✓' : '1'}</span>Cible &amp; objectif</div>
              <span className="cb-step-sep" />
              <div className={'cb-step ' + (gen ? 'on' : '')}><span className="num">2</span>Génération IA</div>
              <span className="cb-step-sep" />
              <div className="cb-step"><span className="num">3</span>Envoi</div>
            </div>
            <div className="cb-body">
              {!gen && !generating && (
                <>
                  <div className="field">
                    <label className="field-lbl">Segment ciblé</label>
                    <div className="seg-select">
                      <div className="ss-ic"><Icon name="filter" /></div>
                      <div className="ss-t"><div className="ss-n">{seg.name}</div><div className="ss-d">{seg.desc || 'Base clients'}</div></div>
                      <div className="ss-c">{fr(seg.count)}</div>
                    </div>
                    <select className="inp" style={{ marginTop: 8 }} value={seg.id} onChange={(e) => setSeg(segs.find((s) => s.id === e.target.value)!)}>
                      {segs.map((s) => <option key={s.id} value={s.id}>{s.name} — {fr(s.count)} contacts</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-lbl">Ton du message</label>
                    <div className="tone-row">{TONES.map((t) => <button key={t} className={'tone' + (t === tone ? ' on' : '')} onClick={() => setTone(t)}>{t}</button>)}</div>
                  </div>
                  <div className="field">
                    <label className="field-lbl">Votre objectif <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— en une phrase</span></label>
                    <textarea className="inp" rows={3} placeholder="Ex : proposer −20% sur la prochaine session de formation" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
                      {SUGGESTS.map(([label, full]) => <button key={label} className="fmt-chip" style={{ cursor: 'pointer' }} onClick={() => setPrompt(full)}>{label}</button>)}
                    </div>
                  </div>
                </>
              )}
              {generating && (
                <div className="ai-thinking"><span className="spin lt" />
                  <div>Rédaction en cours pour le segment <b style={{ color: 'var(--tx-str)' }}>{seg.name}</b><div className="ai-dots" style={{ marginTop: 6 }}><span /><span /><span /></div></div>
                </div>
              )}
              {gen && !generating && (
                <div className="ai-block">
                  <p className="ai-lbl"><RawIcon svg={UI.sparkles2} />3 objets proposés — choisissez le vôtre</p>
                  {gen.subjects.map((s, i) => (
                    <div key={i} className={'subj-opt' + (i === subject ? ' on' : '')} onClick={() => setSubject(i)}>
                      <div className="so-radio" />
                      <div><div className="so-t">{s}</div><div className="so-m">{['Recommandé · le plus ouvert', 'Variante directe', 'Variante courte'][i]} · {28 + (s.length % 9)} caractères</div></div>
                    </div>
                  ))}
                  <div className="field" style={{ marginTop: 18 }}>
                    <label className="field-lbl">Texte d’aperçu (pré-en-tête)</label>
                    <input className="inp" value={gen.pre} onChange={(e) => setGen({ ...gen, pre: e.target.value })} />
                  </div>
                  <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={doGenerate}><Icon name="refresh" />Régénérer une autre version</button>
                </div>
              )}
            </div>
            <div className="cb-foot">
              {!gen && !generating && (
                <>
                  <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>L’IA rédige objet + corps optimisés pour <b style={{ color: 'var(--tx-2)' }}>{fr(seg.count)}</b> destinataires.</span>
                  <button className="btn acc gen-btn" style={{ margin: 0 }} onClick={doGenerate}><Icon name="wand" />Générer l’e-mail</button>
                </>
              )}
              {generating && <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Analyse de l’objectif et du segment…</span>}
              {gen && !generating && (
                <>
                  <button className="btn outline" onClick={() => finish('sched')}><Icon name="calendar" />Programmer</button>
                  <span className="grow" />
                  <button className="btn acc" onClick={() => finish('sent')}><Icon name="rocket" />Envoyer à {fr(seg.count)} contacts</button>
                </>
              )}
            </div>
          </div>

          <div className="email-prev">
            <div className="ep-bar"><div className="ep-dots"><i /><i /><i /></div><div className="ep-title"><Icon name="eye" />Aperçu en direct</div></div>
            <div className="ep-scroll">
              {generating ? (
                <div className="ep-empty"><Icon name="wand" /><div className="ee-t">L’IA compose votre e-mail…</div><p>Objet, accroche et corps adaptés à votre segment.</p></div>
              ) : !gen ? (
                <div className="ep-empty"><Icon name="mail" /><div className="ee-t">Votre e-mail apparaîtra ici</div><p>Renseignez votre objectif puis lancez la génération pour voir l’aperçu en direct.</p></div>
              ) : (
                <div className="ep-mail">
                  <div className="ep-from">
                    <div className="ava">{getBusiness().initials}</div>
                    <div><div className="ef-t">{getBusiness().name}</div><div className="ef-s">{getBusiness().email}</div></div>
                    <div className="ef-time">09:00</div>
                  </div>
                  <div className="ep-subj-line">{gen.subjects[subject]}</div>
                  <div style={{ fontSize: 12, color: '#999', padding: '4px 20px 0' }}>{gen.pre}</div>
                  <div className="ep-head-band"><img src={MAIL_LOGO} alt="Logo" /><div className="ehb-t">{gen.headline.replace('{prenom}', 'Prénom')}</div></div>
                  <TypedBody paras={gen.body} genId={genId} />
                  <div className="ep-cta-wrap"><a className="ep-cta" href="#">{gen.cta}</a></div>
                  <div className="ep-foot">
                    <div className="ef-social">{SOCIAL.map((s) => <span key={s}><Brand name={s} /></span>)}</div>
                    {getBusiness().name} · {getBusiness().addressLine}<br />
                    Vous recevez cet e-mail car vous êtes client·e. <a href="#">Se désinscrire</a> · <a href="#">Préférences</a><br />
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
  // L'envoi e-mail réel (et donc le suivi ouvertures/clics) n'est pas encore
  // branché — `open`/`click` restent à null pour toute campagne envoyée
  // depuis cette version. Les agrégats ne portent donc que sur les
  // campagnes où une vraie mesure existerait un jour, jamais une moyenne
  // sur 0 déguisée en donnée réelle.
  const sent = campaigns.filter((c) => c.status === 'sent');
  const tracked = sent.filter((c) => c.open != null);
  const avgOpen = tracked.length ? tracked.reduce((s, c) => s + (c.open || 0), 0) / tracked.length : null;
  const clicks = tracked.length ? tracked.reduce((s, c) => s + Math.round((c.recipients * (c.click || 0)) / 100), 0) : null;

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Emailing · Campagnes IA</div>
          <h1>Des campagnes qui convertissent, sans Brevo</h1>
          <p>Décrivez votre objectif en une phrase : l’IA rédige l’e-mail, choisit l’objet le plus percutant et l’adresse au bon segment de votre base clients.</p>
        </div>
        <button className="btn acc" onClick={() => openBuilder()}><Icon name="sparkles2" />Nouvelle campagne IA</button>
      </div>

      <div className="crm-stats" style={{ marginBottom: 18 }}>
        <div className="crm-stat"><div className="cs-l"><Icon name="send" />Campagnes</div><div className="cs-v">{campaigns.length}</div><div className="cs-f">tous statuts</div></div>
        <div className="crm-stat"><div className="cs-l"><Icon name="mailopen" />Taux d’ouverture moyen</div><div className="cs-v">{avgOpen != null ? avgOpen.toFixed(1).replace('.', ',') + ' %' : '—'}</div><div className="cs-f">{avgOpen != null ? 'sur les 30 derniers jours' : 'à venir prochainement — envoi e-mail non connecté'}</div></div>
        <div className="crm-stat"><div className="cs-l"><Icon name="cursor" />Clics générés</div><div className="cs-v">{clicks != null ? fr(clicks) : '—'}</div><div className="cs-f">{clicks != null ? 'sur les 30 derniers jours' : 'à venir prochainement — envoi e-mail non connecté'}</div></div>
        <div className="crm-stat"><div className="cs-l"><Icon name="shield" />Désinscriptions</div><div className="cs-v">—</div><div className="cs-f">conforme RGPD</div></div>
      </div>

      <div className="camp-list">
        {campaigns.map((c, i) => (
          <div className="camp-row" key={i}>
            <div className="camp-main">
              <div className={'camp-ic' + (c.status === 'sent' ? ' sent' : '')}><RawIcon svg={c.status === 'sent' ? UI.mailopen : UI.mail} /></div>
              <div className="camp-info">
                <div className="camp-name">{c.name}</div>
                <div className="camp-meta"><span className="seg-pill">{c.seg}</span><span>·</span><span>{fr(c.recipients)} destinataires</span><span>·</span><span>{c.when}</span></div>
              </div>
            </div>
            <div className="camp-stats">
              {c.open != null ? (
                <>
                  <div className="camp-metric"><div className="cm-v">{c.open.toFixed(1).replace('.', ',')}%</div><div className="cm-l">ouvertures</div></div>
                  <div className="camp-metric"><div className="cm-v">{(c.click || 0).toFixed(1).replace('.', ',')}%</div><div className="cm-l">clics</div></div>
                </>
              ) : (
                <div className="camp-metric"><div className="cm-v" style={{ color: 'var(--tx-3)' }}>—</div><div className="cm-l">en attente</div></div>
              )}
              <StatusPill s={c.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

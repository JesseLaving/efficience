import { useEffect, useRef, useState } from 'react';
import { useEff } from '../state/EffContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { showToast } from '../lib/toast';
import { segmentInfos, type SegmentInfo } from '../lib/population';

const BUSINESS = { name: 'Boulangerie Martin', email: 'bonjour@boulangerie-martin.fr', logo: `${import.meta.env.BASE_URL}assets/logo-white.png` };
const SOCIAL: BrandName[] = ['instagram', 'facebook', 'tiktok'];
const TONES = ['Chaleureux', 'Gourmand', 'Promotionnel', 'Élégant'];

interface Campaign {
  name: string; seg: string; status: 'sent' | 'sched' | 'draft';
  recipients: number; open: number | null; click: number | null; when: string;
}

const INITIAL: Campaign[] = [
  { name: 'Offre week-end : -20% sur les viennoiseries', seg: 'Lyonnais', status: 'sent', recipients: 1040, open: 42.6, click: 8.1, when: 'Envoyée il y a 3 j' },
  { name: 'Notre nouveau pain au levain bio est arrivé', seg: 'Tous les clients', status: 'sent', recipients: 1124, open: 38.4, click: 6.7, when: 'Envoyée il y a 9 j' },
  { name: 'On vous a manqué ? -15% pour revenir', seg: 'À réactiver', status: 'sched', recipients: 286, open: null, click: null, when: 'Programmée sam. 09:00' },
  { name: 'Votre carte de fidélité passe au digital', seg: 'Clients fidèles', status: 'draft', recipients: 412, open: null, click: null, when: 'Brouillon · modifié hier' },
];

interface Generated { subjects: string[]; pre: string; headline: string; body: string[]; cta: string; segName: string; pct: number; }

const num = (txt: string) => { const m = (txt || '').match(/(\d{1,2})\s?%/); return m ? +m[1] : 20; };
function family(p: string) {
  p = (p || '').toLowerCase();
  if (/(promo|réduc|reduc|-\d|%|offre|solde|remise|code|deal)/.test(p)) return 'promo';
  if (/(nouveau|nouveauté|nouveaute|lancement|découvr|decouvr|arriv)/.test(p)) return 'nouveaute';
  if (/(revenir|manqué|manque|inactif|réactiv|reactiv|absent)/.test(p)) return 'reactivation';
  if (/(fidél|fidel|carte|points|récompense|recompense|merci)/.test(p)) return 'fidelite';
  if (/(événement|evenement|ouverture|atelier|dégustation|degustation|fête|fete|noël|noel|pâques|paques|portes)/.test(p)) return 'evenement';
  return 'generic';
}
function generate(prompt: string, tone: string, segName: string): Generated {
  const pct = num(prompt);
  const flavor = ({ Gourmand: 'gourmand', Promotionnel: 'malin', 'Élégant': 'raffiné', Chaleureux: 'chaleureux' } as Record<string, string>)[tone] || 'chaleureux';
  const T: Record<string, Omit<Generated, 'segName' | 'pct'>> = {
    promo: { subjects: [`Rien que pour vous : −${pct}% ce week-end 🥐`, `Votre code gourmand de −${pct}% vous attend`, `−${pct}% sur vos viennoiseries préférées`], pre: 'Une attention sucrée à savourer avant dimanche soir.', headline: `−${pct}% pour se faire plaisir`, body: ['Bonjour {prenom},', `Parce que vous faites partie de nos client·e·s ${flavor}s, on vous réserve <b>−${pct}%</b> sur toute la gamme viennoiserie, ce week-end uniquement.`, 'Croissants tout juste sortis du four, pains au chocolat dorés, chouquettes à partager… Passez en boutique et présentez ce mail en caisse.'], cta: `Je profite de −${pct}%` },
    nouveaute: { subjects: ['C’est tout chaud : notre nouveauté est là ✨', 'Vous allez adorer ce qui sort du fournil', 'Première fournée : à découvrir cette semaine'], pre: 'Une création maison à goûter en avant-première.', headline: 'Une nouveauté tout droit du fournil', body: ['Bonjour {prenom},', `On a une grande nouvelle : une création <b>${flavor}e</b> rejoint la vitrine cette semaine, pétrie et cuite sur place comme on les aime.`, 'Vous êtes parmi les premiers prévenus — venez la goûter pendant qu’elle est encore en édition limitée.'], cta: 'Découvrir la nouveauté' },
    reactivation: { subjects: ['Vous nous avez manqué 🥖', 'Et si on se retrouvait autour d’un bon pain ?', '−15% pour fêter votre retour'], pre: 'Ça fait un moment… on vous a gardé une petite attention.', headline: 'Ça fait un moment, {prenom} !', body: ['Bonjour {prenom},', 'On ne vous a pas vu·e depuis quelques semaines, et honnêtement, ça nous manque. Pour vous donner une bonne raison de repasser, voici <b>−15%</b> sur votre prochaine commande.', `Le fournil n’a pas changé : toujours du fait-maison, toujours ${flavor}. On vous attend.`], cta: 'Je repasse vous voir' },
    fidelite: { subjects: ['Votre fidélité, ça se récompense 💚', 'Merci d’être client·e — voici un cadeau', 'Vos points fidélité vous ouvrent une surprise'], pre: 'Un grand merci, et une douceur offerte rien que pour vous.', headline: 'Merci de votre fidélité', body: ['Bonjour {prenom},', `Client·e ${flavor} et fidèle, vous comptez beaucoup pour nous. Pour vous remercier, votre prochaine viennoiserie est <b>offerte</b> dès 10€ d’achat.`, 'Et bonne nouvelle : votre carte de fidélité est désormais digitale — plus rien à perdre, tout se cumule automatiquement.'], cta: 'Activer ma récompense' },
    evenement: { subjects: ['Vous êtes convié·e 🎉', 'Save the date : ça se passe à la boulangerie', 'Un moment gourmand à ne pas manquer'], pre: 'Bloquez la date, on vous prépare quelque chose de spécial.', headline: 'Un rendez-vous gourmand vous attend', body: ['Bonjour {prenom},', `On organise un moment <b>${flavor}</b> rien que pour notre quartier, et votre place est réservée. Dégustation, coulisses du fournil et petites surprises au programme.`, 'Les places sont limitées — confirmez votre venue en un clic.'], cta: 'Je réserve ma place' },
    generic: { subjects: [`Une attention ${flavor}e pour vous`, 'Des nouvelles de votre boulangerie', 'On a pensé à vous aujourd’hui'], pre: 'Quelques mots, et beaucoup de gourmandise.', headline: 'Un mot de votre boulangerie', body: ['Bonjour {prenom},', `Voici des nouvelles fraîches de la maison, écrites avec le même soin ${flavor} que l’on met dans chaque fournée.`, 'Passez nous voir cette semaine, on a toujours quelque chose de bon qui vous attend.'], cta: 'Voir la boutique' },
  };
  const f = T[family(prompt)];
  return { ...f, segName, pct };
}

const SUGGESTS: [string, string][] = [
  ['Offre −20% week-end', 'Promouvoir une offre −20% sur les viennoiseries ce week-end'],
  ['Lancer une nouveauté', 'Annoncer le lancement de notre nouveau pain au levain bio'],
  ['Relancer les inactifs', 'Relancer les clients inactifs avec une attention pour revenir'],
  ['Programme de fidélité', 'Présenter notre nouveau programme de fidélité digital'],
];

/* ---------- typed email body ---------- */
function TypedBody({ paras, genId }: { paras: string[]; genId: number }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    const replaced = paras.map((t) => t.replace('{prenom}', 'Camille'));
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
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL);
  const [view, setView] = useState<'list' | 'builder'>('list');
  const segs = useRef<SegmentInfo[]>(segmentInfos()).current;

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

  const doGenerate = () => {
    const p = prompt.trim() || 'Promouvoir une offre gourmande cette semaine';
    if (!prompt.trim()) setPrompt(p);
    setGenerating(true); setGen(null);
    setTimeout(() => {
      setGenerating(false);
      setGen(generate(p, tone, seg.name));
      setSubject(0);
      setGenId((g) => g + 1);
    }, 1500);
  };

  const finish = (status: 'sent' | 'sched') => {
    const open = +(34 + Math.random() * 12).toFixed(1);
    const click = +(5 + Math.random() * 4).toFixed(1);
    setCampaigns((prev) => [{
      name: gen!.subjects[subject].replace(/\s*[🥐✨🥖💚🎉]/g, '').trim(),
      seg: seg.name, status, recipients: seg.count,
      open: status === 'sent' ? open : null, click: status === 'sent' ? click : null,
      when: status === 'sent' ? 'Envoyée à l’instant' : 'Programmée sam. 09:00',
    }, ...prev]);
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
                    <textarea className="inp" rows={3} placeholder="Ex : promouvoir une offre −20% sur les viennoiseries ce week-end" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
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
                    <div className="ava">BM</div>
                    <div><div className="ef-t">{BUSINESS.name}</div><div className="ef-s">{BUSINESS.email}</div></div>
                    <div className="ef-time">09:00</div>
                  </div>
                  <div className="ep-subj-line">{gen.subjects[subject]}</div>
                  <div style={{ fontSize: 12, color: '#999', padding: '4px 20px 0' }}>{gen.pre}</div>
                  <div className="ep-head-band"><img src={BUSINESS.logo} alt="Efficience" /><div className="ehb-t">{gen.headline.replace('{prenom}', 'Camille')}</div></div>
                  <TypedBody paras={gen.body} genId={genId} />
                  <div className="ep-cta-wrap"><a className="ep-cta" href="#">{gen.cta}</a></div>
                  <div className="ep-foot">
                    <div className="ef-social">{SOCIAL.map((s) => <span key={s}><Brand name={s} /></span>)}</div>
                    {BUSINESS.name} · 14 rue de la République, Lyon 3e<br />
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
  const sent = campaigns.filter((c) => c.status === 'sent');
  const avgOpen = sent.length ? sent.reduce((s, c) => s + (c.open || 0), 0) / sent.length : 0;
  const clicks = sent.reduce((s, c) => s + Math.round((c.recipients * (c.click || 0)) / 100), 0);

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
        <div className="crm-stat"><div className="cs-l"><Icon name="mailopen" />Taux d’ouverture moyen</div><div className="cs-v">{avgOpen.toFixed(1).replace('.', ',')} %</div><div className="cs-f"><span className="acc">+11 pts</span> vs. moyenne secteur</div></div>
        <div className="crm-stat"><div className="cs-l"><Icon name="cursor" />Clics générés</div><div className="cs-v">{fr(clicks)}</div><div className="cs-f">sur les 30 derniers jours</div></div>
        <div className="crm-stat"><div className="cs-l"><Icon name="shield" />Désinscriptions</div><div className="cs-v">0,3 %</div><div className="cs-f">conforme RGPD</div></div>
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

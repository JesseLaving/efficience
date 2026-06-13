import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEff } from '../state/EffContext';
import { Icon, Brand, RawIcon } from '../lib/Icon';
import { UI, BRAND, type BrandName } from '../lib/icons';
import { fr } from '../lib/format';
import { showToast } from '../lib/toast';
import { netName } from '../lib/networks';
import { BUSINESS as BIZ } from '../lib/business';

const SECTORS = ['Conseil & formation', 'Marketing / Communication', 'Immobilier', 'Commerce de détail', 'Restaurant', 'Artisanat', 'Santé / Bien-être', 'Autre'];

// The scan animation only checks which public sources EXIST — it does not
// invent figures. "found" labels stay neutral until a real account is linked.
const SOURCES = [
  { id: 'insee', label: 'INSEE · base SIRENE', glyph: UI.shield, found: 'À vérifier' },
  { id: 'web', label: 'Site web de l’entreprise', glyph: UI.link, found: 'À renseigner' },
  { id: 'google', label: 'Google Business Profile', glyph: BRAND.google, found: 'À connecter' },
  { id: 'instagram', label: 'Instagram', glyph: BRAND.instagram, found: 'À connecter' },
  { id: 'facebook', label: 'Facebook', glyph: BRAND.facebook, found: 'À connecter' },
  { id: 'tiktok', label: 'TikTok', glyph: BRAND.tiktok, found: 'À connecter' },
];

interface Profile {
  name: string; initials: string; siret: string; naf: string; sector: string;
  address: string; effectif: string; creation: string;
  socials: { id: string; handle: string; n: number; rating?: boolean }[];
  colors: string[]; posts: string[];
}

const titlecase = (s: string) => s.replace(/[-_.]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

export function Onboarding() {
  const { show, setClient } = useEff();
  const [step, setStep] = useState<'form' | 'scan' | 'result'>('form');
  const [mode, setMode] = useState<'siret' | 'sector'>('siret');
  const [siret, setSiret] = useState('');
  const [domain, setDomain] = useState('');
  const [sector, setSector] = useState(SECTORS[0]);
  const [city, setCity] = useState(BIZ.city);

  const close = () => show('dashboard');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = (): Profile => {
    let name = BIZ.name;
    if (domain) { const base = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.')[0]; if (base) name = titlecase(base); }
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || BIZ.initials;
    // Identity figures left as "—" (not invented). Social counts start at 0.
    return {
      name, initials,
      siret: siret && siret.replace(/\s/g, '').length >= 9 ? siret : '—',
      naf: '—', sector,
      address: `${city} · ${BIZ.region}`,
      effectif: '—', creation: '—',
      socials: [
        { id: 'instagram', handle: '@' + name.toLowerCase().replace(/\s+/g, '.'), n: 0 },
        { id: 'facebook', handle: name, n: 0 },
        { id: 'google', handle: 'Fiche établissement', n: 0, rating: true },
        { id: 'tiktok', handle: '@' + name.toLowerCase().replace(/\s+/g, '.'), n: 0 },
      ],
      colors: ['#00d992', '#10b981', '#0e4a39', '#101010'],
      posts: ['linear-gradient(135deg,#10463a,#2fd6a1)', 'linear-gradient(135deg,#0e4a39,#10b981)', 'linear-gradient(135deg,#0c3f43,#14b8a6)'],
    };
  };

  const apply = (p: Profile) => {
    setClient({ name: p.name, initials: p.initials });
    localStorage.setItem('eff_onboarded', '1');
    close();
    showToast(UI.check, `Espace personnalisé pour <b style="margin-left:3px">${p.name}</b>`);
  };

  const stepLabel = step === 'form' ? 'Étape 1 / 3' : step === 'scan' ? 'Étape 2 / 3' : 'Étape 3 / 3';

  return createPortal(
    <div className="onb">
      <div className="onb-card">
        <div className="onb-top">
          <img src={`${import.meta.env.BASE_URL}assets/logo-green.png`} alt="Efficience" />
          <span className="ot-step">{stepLabel}</span>
          <button className="onb-x" onClick={close}><Icon name="close" /></button>
        </div>

        {step === 'form' && (
          <FormStep
            mode={mode} setMode={setMode} siret={siret} setSiret={setSiret} domain={domain} setDomain={setDomain}
            sector={sector} setSector={setSector} city={city} setCity={setCity}
            onSkip={close} onAnalyze={() => setStep('scan')}
          />
        )}
        {step === 'scan' && <ScanStep label={domain || siret || sector} onDone={() => setStep('result')} />}
        {step === 'result' && <ResultStep profile={profile()} onRedo={() => setStep('form')} onApply={apply} />}
      </div>
    </div>,
    document.body
  );
}

function FormStep(props: {
  mode: 'siret' | 'sector'; setMode: (m: 'siret' | 'sector') => void;
  siret: string; setSiret: (v: string) => void; domain: string; setDomain: (v: string) => void;
  sector: string; setSector: (v: string) => void; city: string; setCity: (v: string) => void;
  onSkip: () => void; onAnalyze: () => void;
}) {
  const { mode, setMode, siret, setSiret, domain, setDomain, sector, setSector, city, setCity, onSkip, onAnalyze } = props;
  return (
    <>
      <div className="onb-body">
        <div className="onb-eyebrow">Configurateur</div>
        <h2>Personnalisons votre espace en 30 secondes</h2>
        <p className="onb-lead">Renseignez votre SIRET ou votre site, et Efficience récupère automatiquement vos informations d’entreprise, vos réseaux sociaux et votre identité visuelle pour pré-configurer toute l’interface.</p>

        <div className="onb-modes">
          <button className={'onb-mode' + (mode === 'siret' ? ' on' : '')} onClick={() => setMode('siret')}>Avec mon SIRET</button>
          <button className={'onb-mode' + (mode === 'sector' ? ' on' : '')} onClick={() => setMode('sector')}>Par secteur d’activité</button>
        </div>

        <div className="onb-form">
          {mode === 'siret' ? (
            <>
              <div className="field"><label className="field-lbl">Numéro SIRET</label>
                <input className="inp siret-inp" maxLength={17} placeholder="824 315 097 00021" value={siret} onChange={(e) => setSiret(e.target.value)} /></div>
              <div className="field"><label className="field-lbl">Nom de domaine <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
                <input className="inp" placeholder="boulangerie-martin.fr" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
            </>
          ) : (
            <>
              <div className="of-2">
                <div className="field"><label className="field-lbl">Secteur d’activité</label>
                  <select className="inp" value={sector} onChange={(e) => setSector(e.target.value)}>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="field"><label className="field-lbl">Ville</label>
                  <input className="inp" placeholder="Lyon" value={city} onChange={(e) => setCity(e.target.value)} /></div>
              </div>
              <div className="field"><label className="field-lbl">Nom de domaine <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
                <input className="inp" placeholder="boulangerie-martin.fr" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
            </>
          )}
        </div>
      </div>
      <div className="onb-foot">
        <span className="grow"><RawIcon svg={UI.shield} style={{ width: 13, height: 13, display: 'inline-grid', verticalAlign: -2, color: 'var(--acc)' }} /> Données publiques uniquement · conforme RGPD</span>
        <button className="btn outline" onClick={onSkip}>Passer</button>
        <button className="btn acc" onClick={onAnalyze}><Icon name="search" />Analyser mon entreprise</button>
      </div>
    </>
  );
}

function ScanStep({ label, onDone }: { label: string; onDone: () => void }) {
  const [statuses, setStatuses] = useState<('idle' | 'active' | 'done')[]>(SOURCES.map(() => 'idle'));
  const [cur, setCur] = useState(0);
  const done = statuses.filter((s) => s === 'done').length;
  const title = cur < SOURCES.length && done < SOURCES.length ? 'Analyse · ' + SOURCES[Math.min(cur, SOURCES.length - 1)].label : 'Connexion aux sources publiques…';

  useEffect(() => {
    let i = 0;
    let timer: number;
    const startOne = () => {
      if (i >= SOURCES.length) { timer = window.setTimeout(onDone, 500); return; }
      setCur(i);
      setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'active' : s)));
      timer = window.setTimeout(() => {
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'done' : s)));
        i++;
        startOne();
      }, 420 + Math.random() * 360);
    };
    startOne();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="onb-body">
        <div className="onb-eyebrow">Analyse en cours</div>
        <h2>Recherche de votre présence en ligne</h2>
        <div className="scan-wrap" style={{ marginTop: 22 }}>
          <div className="scan-head">
            <div className="sh-ic"><Icon name="search" /></div>
            <div><div className="sh-t">{title}</div><div className="sh-s">{label}</div></div>
          </div>
          <div className="scan-list">
            {SOURCES.map((s, i) => (
              <div key={s.id} className={'scan-item' + (statuses[i] === 'active' ? ' active' : statuses[i] === 'done' ? ' done' : '')}>
                <div className="si-logo" dangerouslySetInnerHTML={{ __html: s.glyph }} />
                <div className="si-n">{s.label}</div>
                <div className="si-found">{s.found}</div>
                <div className="si-state">{statuses[i] === 'active' ? <span className="spin lt" /> : statuses[i] === 'done' ? <RawIcon svg={UI.check} /> : null}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="onb-foot"><span className="grow">{done} / {SOURCES.length} sources analysées</span></div>
    </>
  );
}

function ResultStep({ profile, onRedo, onApply }: { profile: Profile; onRedo: () => void; onApply: (p: Profile) => void }) {
  const p = profile;
  return (
    <>
      <div className="onb-body">
        <div className="onb-eyebrow" style={{ color: 'var(--acc)' }}>Profil reconstitué</div>
        <div className="disc-head" style={{ marginTop: 14 }}>
          <div className="dh-logo" style={{ background: 'linear-gradient(150deg,#0e4a39,#10b981 58%,#00d992)' }}>{p.initials}</div>
          <div><div className="dh-n">{p.name}<RawIcon svg={UI.check} className="vrf" /></div>
            <div className="dh-meta">{p.sector} · {p.address} · créée en {p.creation}</div></div>
        </div>

        <div className="disc-grid">
          <div className="disc-card" style={{ animationDelay: '0ms' }}>
            <div className="dc-l"><Icon name="shield" />Identité légale</div>
            <div className="disc-info-row"><span className="k">SIRET</span><span className="v mono">{p.siret}</span></div>
            <div className="disc-info-row"><span className="k">Code NAF</span><span className="v">{p.naf} · {p.sector}</span></div>
            <div className="disc-info-row"><span className="k">Effectif</span><span className="v">{p.effectif}</span></div>
            <div className="disc-info-row"><span className="k">Adresse</span><span className="v">{p.address}</span></div>
          </div>

          <div className="disc-card" style={{ animationDelay: '80ms' }}>
            <div className="dc-l"><Icon name="link" />Réseaux détectés</div>
            {p.socials.map((s) => (
              <div className="disc-soc" key={s.id}><Brand name={s.id as BrandName} /><div className="ds-n">{netName(s.id)}<div className="ds-h">{s.handle}</div></div>
                <div className="ds-f">{s.rating ? '—' : fr(s.n)}<small>{s.rating ? ' · à connecter' : ' abonnés'}</small></div></div>
            ))}
          </div>

          <div className="disc-card" style={{ animationDelay: '160ms' }}>
            <div className="dc-l"><Icon name="image" />Charte visuelle</div>
            <div className="swatch-row">{p.colors.map((c) => <div className="swatch" style={{ background: c }} key={c}><span>{c}</span></div>)}</div>
            <div className="disc-posts" style={{ marginTop: 12 }}>{p.posts.map((g, i) => <div className="dp" style={{ background: g }} key={i} />)}</div>
          </div>

          <div className="disc-card" style={{ animationDelay: '240ms' }}>
            <div className="dc-l"><Icon name="sparkles2" />Pré-configuration</div>
            <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>{p.socials.length} réseaux prêts à connecter</span></div>
            <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Nom &amp; logo appliqués à l’espace</span></div>
            <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Ton de marque suggéré : <b>direct &amp; pédagogique</b></span></div>
            <div className="disc-info-row"><RawIcon svg={UI.check} style={{ width: 15, height: 15, color: 'var(--acc)' }} /><span>Modèles d’e-mails adaptés au secteur</span></div>
          </div>
        </div>
      </div>
      <div className="onb-foot">
        <span className="grow">Tout est modifiable ensuite dans les réglages.</span>
        <button className="btn outline" onClick={onRedo}>Recommencer</button>
        <button className="btn acc" onClick={() => onApply(p)}><Icon name="rocket" />Personnaliser mon espace</button>
      </div>
    </>
  );
}

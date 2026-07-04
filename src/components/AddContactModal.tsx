import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { createManualContact, type Contact } from '../lib/contacts';

const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* Ajout d'un contact à la main — jusqu'ici la base ne pouvait être remplie
   que par import CSV ou Google Contacts. Panier moyen et dernier achat sont
   volontairement absents en saisie obligatoire : un contact tout juste créé
   n'a pas encore d'historique d'achat réel à afficher (voir la règle
   « jamais de donnée inventée » de population.ts/contacts.ts). La date de
   création est éditable (pas figée à aujourd'hui) pour permettre de saisir
   un client connu de longue date sans mentir sur son ancienneté réelle. */
export function AddContactModal({ onAdd, onClose }: { onAdd: (c: Contact) => void; onClose: () => void }) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [basket, setBasket] = useState('');
  const [consent, setConsent] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [tags, setTags] = useState('');
  const [createdAt, setCreatedAt] = useState(todayIso);
  const [lastContactAt, setLastContactAt] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameValid = first.trim() || last.trim();
  const canSave = emailValid && nameValid;

  const save = () => {
    if (!canSave) return;
    const c = createManualContact({
      first: first.trim(), last: last.trim(), email: email.trim(),
      phone: phone.trim() || undefined, city: city.trim() || undefined,
      company: company.trim() || undefined, jobTitle: jobTitle.trim() || undefined,
      basket: basket.trim() ? Math.round(parseFloat(basket.replace(',', '.')) * 100) / 100 : undefined,
      consent: consent === 'yes' ? true : consent === 'no' ? false : null,
      tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      createdAt: createdAt || undefined, lastContactAt: lastContactAt || undefined,
      notes: notes.trim() || undefined,
    });
    onAdd(c);
    onClose();
  };

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(520px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic"><Icon name="users" /></div>
          <div><h3>Ajouter un contact</h3><div className="km-s">Saisissez un client directement dans votre base</div></div>
          <button className="km-x" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="kmodal-body">
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Prénom</label>
              <input className="inp" autoFocus value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Camille" />
            </div>
            <div className="field">
              <label className="field-lbl">Nom</label>
              <input className="inp" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Durand" />
            </div>
          </div>
          <div className="field">
            <label className="field-lbl">E-mail</label>
            <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="camille.durand@exemple.com"
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save(); }}
            />
            {email.trim() && !emailValid && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>Adresse e-mail invalide.</div>}
          </div>
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Téléphone <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
              <input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
            </div>
            <div className="field">
              <label className="field-lbl">Ville <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
              <input className="inp" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Avignon" />
            </div>
          </div>
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Société <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
              <input className="inp" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Atelier Durand SARL" />
            </div>
            <div className="field">
              <label className="field-lbl">Poste <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
              <input className="inp" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Responsable achats" />
            </div>
          </div>
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Panier moyen <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel, €</span></label>
              <input className="inp" type="number" value={basket} onChange={(e) => setBasket(e.target.value)} placeholder="—" />
            </div>
            <div className="field">
              <label className="field-lbl">Consentement e-mail</label>
              <select className="inp" value={consent} onChange={(e) => setConsent(e.target.value as typeof consent)}>
                <option value="unknown">Non renseigné</option>
                <option value="yes">Accepté</option>
                <option value="no">Refusé</option>
              </select>
            </div>
          </div>
          <div className="km-2">
            <div className="field">
              <label className="field-lbl">Client depuis <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— date de création</span></label>
              <input className="inp" type="date" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-lbl">Dernier contact <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel</span></label>
              <input className="inp" type="date" value={lastContactAt} onChange={(e) => setLastContactAt(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-lbl">Tags <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel, séparés par des virgules</span></label>
            <input className="inp" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP, prospect chaud" />
          </div>
          <div className="field">
            <label className="field-lbl">Notes <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>— optionnel, toute information utile</span></label>
            <textarea className="inp" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Préférences, contexte, historique de la relation…" style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Fusionné automatiquement si l’e-mail existe déjà.</span>
          <button className="btn outline" onClick={onClose}>Annuler</button>
          <button className="btn acc" disabled={!canSave} onClick={save}><RawIcon svg={UI.check} />Ajouter</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

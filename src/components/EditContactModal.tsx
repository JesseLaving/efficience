import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import type { Contact } from '../lib/contacts';

/* Modification d'une fiche contact existante — mêmes champs qu'à la
   création (AddContactModal), pré-remplis. Jusqu'ici il n'existait aucun
   moyen de corriger une donnée après import/saisie (il fallait supprimer et
   ressaisir) ; on patche désormais le contact par id via updateContact. */
export function EditContactModal({ contact, onSave, onDelete, onClose }: {
  contact: Contact;
  onSave: (patch: Partial<Contact>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [first, setFirst] = useState(contact.first);
  const [last, setLast] = useState(contact.last);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone || '');
  const [city, setCity] = useState(contact.city || '');
  const [company, setCompany] = useState(contact.company || '');
  const [jobTitle, setJobTitle] = useState(contact.jobTitle || '');
  const [basket, setBasket] = useState(contact.basket != null ? String(contact.basket) : '');
  const [consent, setConsent] = useState<'unknown' | 'yes' | 'no'>(contact.consent === true ? 'yes' : contact.consent === false ? 'no' : 'unknown');
  const [tags, setTags] = useState((contact.tags || []).join(', '));
  const [createdAt, setCreatedAt] = useState(contact.createdAt || '');
  const [lastContactAt, setLastContactAt] = useState(contact.lastContactAt || '');
  const [notes, setNotes] = useState(contact.notes || '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    const name = (first.trim() + ' ' + last.trim()).trim() || email.trim();
    onSave({
      first: first.trim(), last: last.trim(), name, email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined, city: city.trim() || undefined,
      company: company.trim() || undefined, jobTitle: jobTitle.trim() || undefined,
      basket: basket.trim() ? Math.round(parseFloat(basket.replace(',', '.')) * 100) / 100 : undefined,
      consent: consent === 'yes' ? true : consent === 'no' ? false : null,
      tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      createdAt: createdAt || undefined, lastContactAt: lastContactAt || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kmodal-card" style={{ width: 'min(520px, 100%)' }}>
        <div className="kmodal-top">
          <div className="km-ic"><Icon name="edit" /></div>
          <div><h3>Modifier le contact</h3><div className="km-s">{contact.name}</div></div>
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

          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14, marginTop: 4 }}>
            {!confirmingDelete ? (
              <button className="btn outline sm" style={{ color: 'var(--danger)', borderColor: 'rgba(179,69,59,.35)' }} onClick={() => setConfirmingDelete(true)}>
                <Icon name="trash" />Supprimer ce contact
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Supprimer « {contact.name} » définitivement ?</span>
                <button className="btn acc sm" style={{ background: 'var(--danger)' }} onClick={() => { onDelete(); onClose(); }}>
                  <Icon name="trash" />Oui, supprimer
                </button>
                <button className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>Annuler</button>
              </div>
            )}
          </div>
        </div>
        <div className="kmodal-foot">
          <span className="grow" style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Les modifications s’appliquent immédiatement.</span>
          <button className="btn outline" onClick={onClose}>Annuler</button>
          <button className="btn acc" disabled={!canSave} onClick={save}><RawIcon svg={UI.check} />Enregistrer</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

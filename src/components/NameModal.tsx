import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, RawIcon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { useModalA11y } from '../hooks/useModalA11y';

/* Petite modale générique « nommez ceci » — réutilisée pour l'enregistrement
   d'un segment et la création d'un groupe (voir Contacts.tsx), sur le même
   gabarit visuel que KpiModal (.kmodal). */
export function NameModal({
  title, subtitle, icon = 'sliders', placeholder = 'Nom', confirmLabel = 'Créer', initial = '',
  onConfirm, onClose,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof UI;
  placeholder?: string;
  confirmLabel?: string;
  initial?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const cardRef = useRef<HTMLDivElement>(null);
  useModalA11y(cardRef);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return createPortal(
    <div className="kmodal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="kmodal-card" style={{ width: 'min(420px, 100%)' }} ref={cardRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="name-modal-title"
      >
        <div className="kmodal-top">
          <div className="km-ic"><Icon name={icon} /></div>
          <div><h3 id="name-modal-title">{title}</h3>{subtitle && <div className="km-s">{subtitle}</div>}</div>
          <button className="km-x" type="button" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); confirm(); }}>
          <div className="kmodal-body">
            <div className="field">
              <label className="field-lbl" htmlFor="name-modal-input">Nom</label>
              <input
                id="name-modal-input" className="inp" autoFocus placeholder={placeholder} value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="kmodal-foot">
            <button className="btn outline" type="button" onClick={onClose}>Annuler</button>
            <button className="btn acc" type="submit" disabled={!name.trim()}><RawIcon svg={UI.check} />{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

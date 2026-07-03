import { useEffect, useState } from 'react';
import { Icon } from '../lib/Icon';
import { timeAgo } from '../lib/format';
import { getToastHistory, markToastsRead, subscribeToasts, unreadToastCount, type ToastEntry } from '../lib/toast';

/* Centre de notifications — repose sur l'historique des toasts déjà déclenchés
   partout dans l'app (connexion réseau, publication, import, erreurs…), donc
   aucun site d'appel supplémentaire n'est nécessaire pour que ce soit réel
   plutôt que décoratif. Le point rouge ne s'affiche que s'il y a vraiment
   quelque chose de non lu. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ToastEntry[]>(() => getToastHistory());
  const [unread, setUnread] = useState(() => unreadToastCount());

  useEffect(() => subscribeToasts(() => {
    setItems(getToastHistory());
    setUnread(unreadToastCount());
  }), []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) markToastsRead();
      return next;
    });
    if (!open) setUnread(0);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="icon-btn" aria-label="Notifications" aria-expanded={open} onClick={toggle}>
        <Icon name="bell" />
        {unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">Notifications</div>
          {items.length === 0 ? (
            <div className="notif-empty">Aucune notification pour l’instant.</div>
          ) : (
            <div className="notif-list">
              {items.map((n) => (
                <div className="notif-item" key={n.id}>
                  <span className="notif-ic" dangerouslySetInnerHTML={{ __html: n.icon }} />
                  <div className="notif-body">
                    <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                    <div className="notif-time">{timeAgo(n.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

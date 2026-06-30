import { useState } from 'react';
import { logout } from '../lib/auth';
import './ProfileMenu.css';

interface Props {
  name?: string;
  email?: string;
}

export function ProfileMenu({ name, email }: Props) {
  const [showMenu, setShowMenu] = useState(false);

  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="profile-menu-wrapper">
      <button
        className="profile-avatar"
        onClick={() => setShowMenu(!showMenu)}
        aria-expanded={showMenu}
        title={name || email}
      >
        {initials}
      </button>

      {showMenu && (
        <div className="profile-dropdown">
          <div className="profile-header">
            <div className="profile-avatar-large">{initials}</div>
            <div className="profile-info">
              {name && <div className="profile-name">{name}</div>}
              {email && <div className="profile-email">{email}</div>}
            </div>
          </div>

          <div className="profile-divider" />

          <button className="profile-logout" onClick={() => logout()}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                d="M15 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8m5-5-3-3m3 3-3 3m3-3H9"
              />
            </svg>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

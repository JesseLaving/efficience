import { useEffect, useState } from 'react';
import type { Space } from '../lib/auth';
import { getSpaces, createSpace } from '../lib/auth';
import './SpaceSelector.css';

interface Props {
  selectedSpaceId?: number;
  onSelect: (spaceId: number) => void;
}

export function SpaceSelector({ selectedSpaceId, onSelect }: Props) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, []);

  async function loadSpaces() {
    try {
      const list = await getSpaces();
      setSpaces(list);
      if (!selectedSpaceId && list.length > 0) {
        onSelect(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load spaces:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSpace() {
    if (!newSpaceName.trim()) return;

    try {
      setCreating(true);
      const space = await createSpace(newSpaceName.trim());
      setSpaces([space, ...spaces]);
      onSelect(space.id);
      setNewSpaceName('');
      setShowDropdown(false);
    } catch (e) {
      console.error('Failed to create space:', e);
    } finally {
      setCreating(false);
    }
  }

  const currentSpace = spaces.find(s => s.id === selectedSpaceId);

  if (loading) {
    return <div className="space-selector loading">Chargement...</div>;
  }

  return (
    <div className="space-selector-wrapper">
      <button
        className="space-selector-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-expanded={showDropdown}
      >
        <span className="space-name">
          {currentSpace?.name || 'Sélectionner un espace'}
        </span>
        <svg className="space-chevron" viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="m6 9 6 6 6-6"
          />
        </svg>
      </button>

      {showDropdown && (
        <div className="space-dropdown">
          <div className="space-list">
            {spaces.map(space => (
              <button
                key={space.id}
                className={`space-item ${space.id === selectedSpaceId ? 'active' : ''}`}
                onClick={() => {
                  onSelect(space.id);
                  setShowDropdown(false);
                }}
              >
                <span className="space-item-name">{space.name}</span>
                {space.id === selectedSpaceId && (
                  <svg className="space-checkmark" viewBox="0 0 24 24" width="16" height="16">
                    <path fill="none" stroke="currentColor" strokeWidth="2" d="m6 12 4 4 8-8" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="space-divider" />

          <div className="space-create">
            {!creating && !newSpaceName ? (
              <button
                className="space-create-trigger"
                onClick={() => setNewSpaceName('new')}
              >
                <span>+ Nouvel espace</span>
              </button>
            ) : (
              <div className="space-create-form">
                <input
                  type="text"
                  placeholder="Nom de l'espace"
                  value={newSpaceName === 'new' ? '' : newSpaceName}
                  onChange={e => setNewSpaceName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSpace();
                    if (e.key === 'Escape') setNewSpaceName('');
                  }}
                  autoFocus
                  disabled={creating}
                  className="space-create-input"
                />
                <div className="space-create-actions">
                  <button
                    onClick={handleCreateSpace}
                    disabled={!newSpaceName.trim() || newSpaceName === 'new' || creating}
                    className="space-create-submit"
                  >
                    {creating ? '...' : 'Créer'}
                  </button>
                  <button
                    onClick={() => setNewSpaceName('')}
                    disabled={creating}
                    className="space-create-cancel"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

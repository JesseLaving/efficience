import { useEffect, useState } from 'react';
import { useSpaces } from '../state/SpaceContext';
import { Icon } from '../lib/Icon';
import { UI } from '../lib/icons';
import { showToast } from '../lib/toast';

export function Settings() {
  const { spaces, activeSpaceId, renameSpace, deleteSpace } = useSpaces();
  const active = spaces.find((s) => s.id === activeSpaceId);
  const [name, setName] = useState(active?.name || '');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Resynchronise le champ si l'espace actif change ou finit de charger.
  useEffect(() => { setName(active?.name || ''); }, [active?.name]);

  const save = async () => {
    if (!activeSpaceId || !name.trim() || name.trim() === active?.name) return;
    setSaving(true);
    try {
      await renameSpace(activeSpaceId, name.trim());
      showToast(UI.check, 'Espace renommé');
    } catch (e) {
      showToast(UI.close, `Échec du renommage : ${String((e as Error).message || e)}`);
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!activeSpaceId) return;
    setDeleting(true);
    try {
      await deleteSpace(activeSpaceId);
      // Suppression de l'espace actif : AuthWrapper nettoie le stockage local
      // et recharge la page (voir onActiveSpaceDeleted) — rien d'autre à faire ici.
    } catch (e) {
      showToast(UI.close, `Échec de la suppression : ${String((e as Error).message || e)}`);
      setDeleting(false);
    }
  };

  if (!active) {
    return (
      <section className="screen show anim">
        <div className="page-head">
          <div>
            <div className="eyebrow">Réglages</div>
            <h1>Paramètres de l’espace</h1>
          </div>
        </div>
        <p style={{ color: 'var(--tx-3)' }}>Chargement de l’espace…</p>
      </section>
    );
  }

  return (
    <section className="screen show anim">
      <div className="page-head">
        <div>
          <div className="eyebrow">Réglages</div>
          <h1>Paramètres de l’espace</h1>
          <p>Renommez votre espace actif ou supprimez-le définitivement.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Nom de l’espace</h3></div>
        <div className="pad" style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            <label className="field-lbl">Nom</label>
            <input
              className="inp" value={name} maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            />
          </div>
          <div>
            <button className="btn acc" disabled={saving || !name.trim() || name.trim() === active.name} onClick={save}>
              {saving ? <span className="spin" /> : <Icon name="check" />}Enregistrer
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: 'rgba(179,69,59,.3)' }}>
        <div className="card-h"><h3 style={{ color: 'var(--danger)' }}>Zone sensible</h3></div>
        <div className="pad" style={{ display: 'grid', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--tx-2)', margin: 0 }}>
            Supprimer cet espace efface définitivement toutes ses données : réseaux connectés, base clients, campagnes et calendrier de programmation. Cette action est irréversible.
          </p>
          {!confirmingDelete ? (
            <div>
              <button className="btn outline" style={{ color: 'var(--danger)', borderColor: 'rgba(179,69,59,.35)' }} onClick={() => setConfirmingDelete(true)}>
                <Icon name="trash" />Supprimer cet espace
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Confirmer la suppression de « {active.name} » ?</span>
              <button className="btn acc" style={{ background: 'var(--danger)' }} disabled={deleting} onClick={confirmDelete}>
                {deleting ? <span className="spin" /> : <Icon name="trash" />}Oui, supprimer
              </button>
              <button className="btn ghost" disabled={deleting} onClick={() => setConfirmingDelete(false)}>Annuler</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

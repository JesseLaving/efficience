import { Icon } from '../lib/Icon';
import { UI } from '../lib/icons';

interface Props {
  icon?: keyof typeof UI;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondary?: string;
}

export function EmptyState({ icon = 'sparkles2', title, description, action, secondary }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      padding: '48px 32px', textAlign: 'center', minHeight: 220, justifyContent: 'center',
    }}>
      {icon && (
        <div style={{
          width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center',
          background: 'var(--acc-soft)', border: '1px solid var(--acc-soft2)',
        }}>
          <Icon name={icon as any} style={{ width: 24, height: 24, color: 'var(--acc)' }} />
        </div>
      )}
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: 'var(--tx-str)' }}>
          {title}
        </h3>
        {description && (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.6, maxWidth: 380 }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <button className="btn acc" onClick={action.onClick} style={{ marginTop: 6 }}>
          {action.label}
        </button>
      )}
      {secondary && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--tx-3)', fontStyle: 'italic' }}>
          {secondary}
        </p>
      )}
    </div>
  );
}

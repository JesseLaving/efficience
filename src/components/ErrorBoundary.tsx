import { Component, type ReactNode } from 'react';
import { Icon } from '../lib/Icon';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

/* Filet de sécurité global : sans lui, une exception de rendu n'importe où
   dans l'arbre (un écran, un provider) fait disparaître toute l'app derrière
   une page blanche — la pire expérience possible pour un client. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Erreur non rattrapée :', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{
              width: 54, height: 54, margin: '0 auto 16px', borderRadius: 14, display: 'grid', placeItems: 'center',
              color: 'var(--danger)', background: 'rgba(179,69,59,.1)', border: '1px solid rgba(179,69,59,.3)',
            }}>
              <Icon name="warning" style={{ width: 26, height: 26 }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-str)' }}>Une erreur inattendue est survenue</div>
            <p style={{ color: 'var(--tx-3)', fontSize: 13.5, margin: '8px 0 20px', lineHeight: 1.5 }}>
              Rechargez la page pour continuer. Si le problème persiste, contactez le support.
            </p>
            <button className="btn acc" onClick={() => window.location.reload()}>
              <Icon name="refresh" />Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/screens.css';
import './styles/dashboard.css';
import './styles/emailing.css';
import './styles/create.css';
import './styles/stats.css';
import { EffProvider } from './state/EffContext';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <EffProvider>
    <App />
  </EffProvider>
);

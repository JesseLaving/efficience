import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/screens.css';
import './styles/dashboard.css';
import './styles/emailing.css';
import './styles/create.css';
import './styles/stats.css';
import { EffProvider } from './state/EffContext';
import { ConnectionsProvider } from './state/ConnectionsContext';
import { CalendarProvider } from './state/CalendarContext';
import { BrandProvider } from './state/BrandContext';
import { AuthWrapper } from './components/AuthWrapper';

createRoot(document.getElementById('root')!).render(
  <EffProvider>
    <ConnectionsProvider>
      <CalendarProvider>
        <BrandProvider>
          <AuthWrapper />
        </BrandProvider>
      </CalendarProvider>
    </ConnectionsProvider>
  </EffProvider>
);

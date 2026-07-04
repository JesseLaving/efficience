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
import { ContactsProvider } from './state/ContactsContext';
import { CampaignsProvider } from './state/CampaignsContext';
import { DraftsProvider } from './state/DraftsContext';
import { AuthWrapper } from './components/AuthWrapper';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <EffProvider>
      <ConnectionsProvider>
        <CalendarProvider>
          <BrandProvider>
            <ContactsProvider>
              <CampaignsProvider>
                <DraftsProvider>
                  <AuthWrapper />
                </DraftsProvider>
              </CampaignsProvider>
            </ContactsProvider>
          </BrandProvider>
        </CalendarProvider>
      </ConnectionsProvider>
    </EffProvider>
  </ErrorBoundary>
);

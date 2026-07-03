import { createContext, useCallback, useContext, useState } from 'react';
import { loadCampaigns, saveCampaigns, type Campaign } from '../lib/campaigns';

interface CampaignsCtx {
  campaigns: Campaign[];
  addCampaign: (c: Campaign) => void;
}

const Ctx = createContext<CampaignsCtx | null>(null);

export function CampaignsProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());

  const addCampaign = useCallback((c: Campaign) => {
    setCampaigns((prev) => {
      const next = [c, ...prev];
      saveCampaigns(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ campaigns, addCampaign }}>{children}</Ctx.Provider>;
}

export function useCampaigns(): CampaignsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCampaigns must be used within CampaignsProvider');
  return c;
}

import { createContext, useCallback, useContext, useState } from 'react';
import { loadCampaigns, saveCampaigns, type Campaign } from '../lib/campaigns';

interface CampaignsCtx {
  campaigns: Campaign[];
  addCampaign: (c: Campaign) => void;
  /** Met à jour une campagne existante, repérée par son identifiant. */
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  removeCampaign: (id: string) => void;
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

  const updateCampaign = useCallback((id: string, patch: Partial<Campaign>) => {
    setCampaigns((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      saveCampaigns(next);
      return next;
    });
  }, []);

  const removeCampaign = useCallback((id: string) => {
    setCampaigns((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveCampaigns(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ campaigns, addCampaign, updateCampaign, removeCampaign }}>{children}</Ctx.Provider>;
}

export function useCampaigns(): CampaignsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCampaigns must be used within CampaignsProvider');
  return c;
}

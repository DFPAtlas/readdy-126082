import { createContext, useContext } from 'react';
import type { SitesContextValue } from './SitesContext';

export const SitesContext = createContext<SitesContextValue | null>(null);

export function useSites() {
  const ctx = useContext(SitesContext);
  if (!ctx) throw new Error('useSites must be used within a SitesProvider');
  return ctx;
}

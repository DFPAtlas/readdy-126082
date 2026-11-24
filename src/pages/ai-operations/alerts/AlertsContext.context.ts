import { createContext, useContext } from 'react';
import type { AlertsContextValue } from './AlertsContext';

export const AlertsContext = createContext<AlertsContextValue | null>(null);

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within an AlertsProvider');
  return ctx;
}

import { createContext, useContext } from 'react';
import type { SchedulesContextValue } from './SchedulesContext';

export const SchedulesContext = createContext<SchedulesContextValue | null>(null);

export function useSchedules(): SchedulesContextValue {
  const ctx = useContext(SchedulesContext);
  if (!ctx) throw new Error('useSchedules must be used within a SchedulesProvider');
  return ctx;
}

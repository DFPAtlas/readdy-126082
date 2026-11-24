import { createContext, useContext } from 'react';
import type { RunsContextValue } from './RunsContext';

export const RunsContext = createContext<RunsContextValue | null>(null);

export function useRuns() {
  const ctx = useContext(RunsContext);
  if (!ctx) throw new Error('useRuns must be used within a RunsProvider');
  return ctx;
}

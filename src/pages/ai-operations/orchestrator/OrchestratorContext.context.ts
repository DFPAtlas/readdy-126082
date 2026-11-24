import { createContext, useContext } from 'react';
import type { OrchestratorContextValue } from './OrchestratorContext';

export const OrchestratorContext = createContext<OrchestratorContextValue | null>(null);

export function useOrchestrator(): OrchestratorContextValue {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) throw new Error('useOrchestrator must be used within OrchestratorProvider');
  return ctx;
}

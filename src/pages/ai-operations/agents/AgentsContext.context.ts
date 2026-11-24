import { createContext, useContext } from 'react';
import type { AgentsContextValue } from './AgentsContext';

export const AgentsContext = createContext<AgentsContextValue | null>(null);

export function useAgents() {
  const ctx = useContext(AgentsContext);
  if (!ctx) throw new Error('useAgents must be used within an AgentsProvider');
  return ctx;
}

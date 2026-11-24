import { createContext, useContext } from 'react';
import type { KnowledgeContextValue } from './KnowledgeContext';

export const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function useKnowledge(): KnowledgeContextValue {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be used within a KnowledgeProvider');
  return ctx;
}

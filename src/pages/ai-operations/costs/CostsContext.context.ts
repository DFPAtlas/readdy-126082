import { createContext, useContext } from 'react';
import type { CostsContextValue } from './CostsContext';

export const CostsContext = createContext<CostsContextValue | null>(null);

export function useCosts(): CostsContextValue {
  const ctx = useContext(CostsContext);
  if (!ctx) throw new Error('useCosts must be used within a CostsProvider');
  return ctx;
}

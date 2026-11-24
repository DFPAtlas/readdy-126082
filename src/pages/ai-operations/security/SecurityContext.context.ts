import { createContext, useContext } from 'react';
import type { SecurityContextValue } from './SecurityContext';

export const SecurityContext = createContext<SecurityContextValue | null>(null);

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within a SecurityProvider');
  return ctx;
}

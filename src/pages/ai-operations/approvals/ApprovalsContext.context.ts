import { createContext, useContext } from 'react';
import type { ApprovalsContextValue } from './ApprovalsContext';

export const ApprovalsContext = createContext<ApprovalsContextValue | null>(null);

export function useApprovals() {
  const ctx = useContext(ApprovalsContext);
  if (!ctx) throw new Error('useApprovals must be used within an ApprovalsProvider');
  return ctx;
}

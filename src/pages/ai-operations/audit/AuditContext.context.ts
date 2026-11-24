import { createContext, useContext } from 'react';
import type { AuditContextValue } from './AuditContext';

export const AuditContext = createContext<AuditContextValue | null>(null);

export function useAudit(): AuditContextValue {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within an AuditProvider');
  return ctx;
}

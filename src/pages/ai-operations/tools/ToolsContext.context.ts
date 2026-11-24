import { createContext, useContext } from 'react';
import type { ToolsContextValue } from './ToolsContext';

export const ToolsContext = createContext<ToolsContextValue | null>(null);

export function useTools() {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error('useTools must be used within a ToolsProvider');
  return ctx;
}

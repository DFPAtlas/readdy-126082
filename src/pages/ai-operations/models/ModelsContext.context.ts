import { createContext, useContext } from 'react';
import type { ModelsContextValue } from './ModelsContext';

export const ModelsContext = createContext<ModelsContextValue | null>(null);

export function useModels(): ModelsContextValue {
  const ctx = useContext(ModelsContext);
  if (!ctx) throw new Error('useModels must be used within a ModelsProvider');
  return ctx;
}

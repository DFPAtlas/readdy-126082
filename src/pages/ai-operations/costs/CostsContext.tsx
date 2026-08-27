import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AiBudget } from '@/pages/ai-operations/types';
import { demoBudgets } from '@/mocks/ai-operations-costs';

interface CostsContextValue {
  budgets: AiBudget[];
  addBudget: (budget: AiBudget) => void;
  updateBudget: (id: string, patch: Partial<AiBudget>) => void;
}

const CostsContext = createContext<CostsContextValue | null>(null);

export function CostsProvider({ children }: { children: ReactNode }) {
  const [budgets, setBudgets] = useState<AiBudget[]>(demoBudgets);

  const addBudget = (budget: AiBudget) => {
    setBudgets((prev) => [budget, ...prev]);
  };

  const updateBudget = (id: string, patch: Partial<AiBudget>) => {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  return (
    <CostsContext.Provider value={{ budgets, addBudget, updateBudget }}>
      {children}
    </CostsContext.Provider>
  );
}

export function useCosts(): CostsContextValue {
  const ctx = useContext(CostsContext);
  if (!ctx) throw new Error('useCosts must be used within a CostsProvider');
  return ctx;
}
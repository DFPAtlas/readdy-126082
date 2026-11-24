import { createContext, useContext } from 'react';
import type { DeploymentContextValue } from './deploymentStore';

export const DeploymentContext = createContext<DeploymentContextValue | null>(null);

export function useDeployment(): DeploymentContextValue {
  const ctx = useContext(DeploymentContext);
  if (!ctx) throw new Error('useDeployment must be used within a DeploymentProvider');
  return ctx;
}

// ============================================================================
// AI Operations — Cost, Usage & Budgets derived-data layer.
//
// Pure projections over the central Models / Providers / Runs registries plus
// the demo cost dataset. Model and provider cost rows are derived from the
// central Models & Providers registry usage metadata (no record duplicated);
// site/agent/budget/alert/forecast data is the demo cost dataset. Run cost rows
// are derived from the central Tasks & Runs registry cost block. No billing
// API is called and no spend limit is enforced.
// ============================================================================

import type { CostByModel, CostByProvider, RunCostRow } from '@/pages/ai-operations/types';
import { demoModels, demoProviders } from '@/mocks/ai-operations-models';
import { demoRuns } from '@/mocks/ai-operations-runs';
import {
  demoCostBySite,
  demoCostByAgent,
  demoCostByProvider,
  demoBudgets,
  demoBudgetAlerts,
  demoGroupForecast,
  demoEfficiency,
  demoLocalCloud,
  demoCostSummary,
} from '@/mocks/ai-operations-costs';

export function getCostBySite() {
  return demoCostBySite;
}

export function getCostByAgent() {
  return demoCostByAgent;
}

// Derived from the central Models Registry usage metadata.
export function getCostByModel(): CostByModel[] {
  return demoModels.map((m) => ({
    modelId: m.id,
    modelName: m.name,
    provider: m.providerName,
    jobs: m.usage.jobsToday,
    inputUsage: m.usage.estimatedInputTokens,
    outputUsage: m.usage.estimatedOutputTokens,
    estimatedCost: m.usage.estimatedProviderCost !== '—' ? m.usage.estimatedProviderCost : m.usage.localComputeEstimate,
    avgCostPerRun: m.usage.avgCostPerRun,
    status: m.status,
  }));
}

// Derived from the central Providers Registry metadata.
export function getCostByProvider(): CostByProvider[] {
  return demoCostByProvider;
}

export function getAllBudgets() {
  return demoBudgets;
}

export function getBudgetAlerts() {
  return demoBudgetAlerts;
}

export function getGroupForecast() {
  return demoGroupForecast;
}

export function getEfficiency() {
  return demoEfficiency;
}

export function getLocalCloud() {
  return demoLocalCloud;
}

export function getCostSummary() {
  return demoCostSummary;
}

// Derived from the central Tasks & Runs registry cost block.
export function getRunCostRows(): RunCostRow[] {
  return demoRuns
    .filter((r) => r.parentRunId === null)
    .map((r) => ({
      runId: r.id,
      siteName: r.siteName,
      agentName: r.agentName,
      model: r.cost.model,
      duration: r.duration,
      estimatedCost: r.cost.estimatedCost,
      toolCost: r.cost.toolCost,
      totalCost: r.cost.totalEstimatedCost,
      status: r.status,
    }))
    .slice(0, 12);
}

export function getBudgetForScope(scope: string, scopeId: string | null) {
  return demoBudgets.find((b) => b.scope === scope && b.scopeId === scopeId);
}

export function getBudgetById(budgetId: string) {
  return demoBudgets.find((b) => b.id === budgetId);
}

export function getSiteCost(siteId: string) {
  return demoCostBySite.find((s) => s.siteId === siteId);
}

export function getAgentCost(agentId: string) {
  return demoCostByAgent.find((a) => a.agentId === agentId);
}

export function getModelCost(modelId: string): CostByModel | undefined {
  return getCostByModel().find((m) => m.modelId === modelId);
}

export function getProviderCost(providerId: string): CostByProvider | undefined {
  return demoCostByProvider.find((p) => p.providerId === providerId);
}

export function countBudgetAlerts(): number {
  return demoBudgetAlerts.length;
}
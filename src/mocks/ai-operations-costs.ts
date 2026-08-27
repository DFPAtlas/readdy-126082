// ============================================================================
// AI OPERATIONS — COST, USAGE & BUDGETS — DEMO / PLACEHOLDER DATA.
//
// ⚠️  Every value below is static placeholder metadata used to render the
//     Cost, Usage & Budgets module. NOT PRODUCTION — no real billing API is
//     called, no account is charged, no spend limit is enforced and no model
//     or provider setting is changed. Only safe operational cost metadata is
//     stored here (no billing credentials, provider API keys, Stripe secrets,
//     payment methods or customer financial data).
//
//     "Demo cost data — not production billing."
//
//     Later prompts will replace these records with real usage data and
//     persistent tables (ai_usage_costs, ai_budgets, ai_budget_alerts,
//     ai_cost_forecasts, ai_provider_usage).
// ============================================================================

import type {
  CostBySite,
  CostByAgent,
  CostByProvider,
  AiBudget,
  BudgetAlert,
  CostForecast,
  CostEfficiencyMetric,
  LocalCloudComparison,
} from '@/pages/ai-operations/types';

// --- Group summary (precomputed demo values) ------------------------------------

export const demoCostSummary = {
  costToday: '£19.11',
  costThisMonth: '£380.40',
  estimatedMonthEnd: '£461.20',
  budgetRemaining: '£119.60',
  highestCostSite: 'QuickGuard',
  highestCostAgent: 'Code Agent',
  highestCostModel: 'Claude Sonnet',
  budgetAlerts: 4,
};

// --- Cost by Site ----------------------------------------------------------------

export const demoCostBySite: CostBySite[] = [
  { siteId: 'digital-footprint', siteName: 'Digital Footprint', today: '£2.40', thisMonth: '£48.40', budget: '£60.00', remaining: '£11.60', forecast: '£58.70', budgetStatus: 'healthy' },
  { siteId: 'quickguard', siteName: 'QuickGuard', today: '£4.10', thisMonth: '£86.00', budget: '£100.00', remaining: '£14.00', forecast: '£104.30', budgetStatus: 'warning' },
  { siteId: 'guardianhub', siteName: 'GuardianHub', today: '£3.85', thisMonth: '£74.00', budget: '£80.00', remaining: '£6.00', forecast: '£89.80', budgetStatus: 'critical' },
  { siteId: 'lethub', siteName: 'LetHub', today: '£2.15', thisMonth: '£42.00', budget: '£55.00', remaining: '£13.00', forecast: '£51.00', budgetStatus: 'healthy' },
  { siteId: 'wedora', siteName: 'Wedora', today: '£3.30', thisMonth: '£66.00', budget: '£75.00', remaining: '£9.00', forecast: '£80.10', budgetStatus: 'warning' },
  { siteId: 'the-forge', siteName: 'The Forge', today: '£3.31', thisMonth: '£64.00', budget: '£70.00', remaining: '£6.00', forecast: '£77.70', budgetStatus: 'critical' },
];

// --- Cost by Agent ---------------------------------------------------------------

export const demoCostByAgent: CostByAgent[] = [
  { agentId: 'tf-code', agentName: 'Code Agent', site: 'The Forge', jobs: 96, costToday: '£6.82', monthlyCost: '£136.40', avgCostPerRun: '£0.07', budgetStatus: 'critical' },
  { agentId: 'core-orchestrator', agentName: 'DFP Group Master Orchestrator', site: 'Group-wide', jobs: 44, costToday: '£0.85', monthlyCost: '£17.00', avgCostPerRun: '£0.11', budgetStatus: 'healthy' },
  { agentId: 'core-diagnostics', agentName: 'Diagnostics Agent', site: 'Group-wide', jobs: 52, costToday: '£1.04', monthlyCost: '£20.80', avgCostPerRun: '£0.05', budgetStatus: 'healthy' },
  { agentId: 'qg-match', agentName: 'Guard Matching Agent', site: 'QuickGuard', jobs: 38, costToday: '£1.52', monthlyCost: '£30.40', avgCostPerRun: '£0.04', budgetStatus: 'warning' },
  { agentId: 'wd-photo', agentName: 'Photo Moderation Agent', site: 'Wedora', jobs: 36, costToday: '£1.62', monthlyCost: '£32.40', avgCostPerRun: '£0.05', budgetStatus: 'healthy' },
  { agentId: 'core-support', agentName: 'Support Agent', site: 'Group-wide', jobs: 60, costToday: '£0.60', monthlyCost: '£12.00', avgCostPerRun: '£0.01', budgetStatus: 'healthy' },
  { agentId: 'tf-master', agentName: 'Forge Master Agent', site: 'The Forge', jobs: 12, costToday: '£1.68', monthlyCost: '£33.60', avgCostPerRun: '£0.14', budgetStatus: 'healthy' },
  { agentId: 'gh-checkcall', agentName: 'Check-Call Agent', site: 'GuardianHub', jobs: 41, costToday: '£0.41', monthlyCost: '£8.20', avgCostPerRun: '£0.01', budgetStatus: 'warning' },
  { agentId: 'core-reporting', agentName: 'Reporting Agent', site: 'Group-wide', jobs: 22, costToday: '£0.44', monthlyCost: '£8.80', avgCostPerRun: '£0.02', budgetStatus: 'healthy' },
  { agentId: 'core-billing', agentName: 'Billing Agent', site: 'Group-wide', jobs: 8, costToday: '£0.32', monthlyCost: '£6.40', avgCostPerRun: '£0.04', budgetStatus: 'healthy' },
];

// --- Cost by Provider ------------------------------------------------------------

export const demoCostByProvider: CostByProvider[] = [
  { providerId: 'PROV-ANTHROPIC', providerName: 'Anthropic', models: 4, requests: 73, failures: 0, today: '£11.05', month: '£221.00', forecast: '£268.30' },
  { providerId: 'PROV-OPENAI', providerName: 'OpenAI', models: 4, requests: 41, failures: 2, today: '£6.82', month: '£136.40', forecast: '£165.60' },
  { providerId: 'PROV-OLLAMA', providerName: 'Local Ollama', models: 4, requests: 18, failures: 1, today: '£1.24', month: '£24.80', forecast: '£30.10' },
  { providerId: 'PROV-INTERNAL', providerName: 'Internal / Future Provider', models: 1, requests: 0, failures: 0, today: '£0.00', month: '£0.00', forecast: '£0.00' },
];

// --- Budgets ---------------------------------------------------------------------

export const demoBudgets: AiBudget[] = [
  { id: 'BUD-0001', name: 'Group AI Operations Budget', scope: 'group', scopeId: null, scopeLabel: 'Group-wide', monthlyLimit: '£500.00', dailyLimit: '£20.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£380.40', forecast: '£461.20', remaining: '£119.60', status: 'warning', ownerTeam: 'Group AI Operations', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: 'Covers all sites, agents, models and providers across the group.' },
  { id: 'BUD-0002', name: 'Digital Footprint AI', scope: 'site', scopeId: 'digital-footprint', scopeLabel: 'Digital Footprint', monthlyLimit: '£60.00', dailyLimit: '£2.50', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£48.40', forecast: '£58.70', remaining: '£11.60', status: 'healthy', ownerTeam: 'Digital Footprint Delivery', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: '' },
  { id: 'BUD-0003', name: 'QuickGuard AI', scope: 'site', scopeId: 'quickguard', scopeLabel: 'QuickGuard', monthlyLimit: '£100.00', dailyLimit: '£4.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£86.00', forecast: '£104.30', remaining: '£14.00', status: 'critical', ownerTeam: 'QuickGuard Operations', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: 'Forecast to exceed monthly limit; review before month end.' },
  { id: 'BUD-0004', name: 'GuardianHub AI', scope: 'site', scopeId: 'guardianhub', scopeLabel: 'GuardianHub', monthlyLimit: '£80.00', dailyLimit: '£3.20', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£74.00', forecast: '£89.80', remaining: '£6.00', status: 'critical', ownerTeam: 'GuardianHub Welfare', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: 'Elevated retry spend from check-call batch.' },
  { id: 'BUD-0005', name: 'LetHub AI', scope: 'site', scopeId: 'lethub', scopeLabel: 'LetHub', monthlyLimit: '£55.00', dailyLimit: '£2.20', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£42.00', forecast: '£51.00', remaining: '£13.00', status: 'healthy', ownerTeam: 'LetHub Operations', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: '' },
  { id: 'BUD-0006', name: 'Wedora AI', scope: 'site', scopeId: 'wedora', scopeLabel: 'Wedora', monthlyLimit: '£75.00', dailyLimit: '£3.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£66.00', forecast: '£80.10', remaining: '£9.00', status: 'warning', ownerTeam: 'Wedora Planning', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: '' },
  { id: 'BUD-0007', name: 'The Forge AI', scope: 'site', scopeId: 'the-forge', scopeLabel: 'The Forge', monthlyLimit: '£70.00', dailyLimit: '£2.80', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£64.00', forecast: '£77.70', remaining: '£6.00', status: 'critical', ownerTeam: 'The Forge Engineering', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: 'Code generation spend trending above forecast.' },
  { id: 'BUD-0008', name: 'Claude Sonnet usage', scope: 'model', scopeId: 'MOD-CLAUDE-SONNET', scopeLabel: 'Claude Sonnet', monthlyLimit: '£220.00', dailyLimit: '£10.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£204.00', forecast: '£247.60', remaining: '£16.00', status: 'warning', ownerTeam: 'Group AI Operations', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: '' },
  { id: 'BUD-0009', name: 'GPT-4o usage', scope: 'model', scopeId: 'MOD-GPT4O', scopeLabel: 'GPT-4o', monthlyLimit: '£150.00', dailyLimit: '£7.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£136.40', forecast: '£165.60', remaining: '£13.60', status: 'warning', ownerTeam: 'The Forge Engineering', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: '' },
  { id: 'BUD-0010', name: 'Anthropic provider', scope: 'provider', scopeId: 'PROV-ANTHROPIC', scopeLabel: 'Anthropic', monthlyLimit: '£250.00', dailyLimit: '£11.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£221.00', forecast: '£268.30', remaining: '£29.00', status: 'exceeded', ownerTeam: 'Group AI Operations', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: 'Forecast to exceed provider limit; review model routing.' },
  { id: 'BUD-0011', name: 'OpenAI provider', scope: 'provider', scopeId: 'PROV-OPENAI', scopeLabel: 'OpenAI', monthlyLimit: '£180.00', dailyLimit: '£7.50', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£136.40', forecast: '£165.60', remaining: '£43.60', status: 'healthy', ownerTeam: 'The Forge Engineering', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: '' },
  { id: 'BUD-0012', name: 'Code Agent budget', scope: 'agent', scopeId: 'tf-code', scopeLabel: 'Code Agent', monthlyLimit: '£140.00', dailyLimit: '£6.00', warningThreshold: 70, criticalThreshold: 90, currentSpend: '£136.40', forecast: '£165.60', remaining: '£3.60', status: 'exceeded', ownerTeam: 'The Forge Engineering', environment: 'production', startDate: '2026-08-01', reviewDate: '2026-09-01', notes: 'Cost spike from failed generation retries.' },
];

// --- Budget alerts ---------------------------------------------------------------

export const demoBudgetAlerts: BudgetAlert[] = [
  { id: 'BTA-001', scope: 'site', scopeId: 'quickguard', scopeLabel: 'QuickGuard', title: 'QuickGuard exceeded 80% of monthly budget', severity: 'high', currentSpend: '£86.00', threshold: '80% of £100.00', forecast: '£104.30', suggestedAction: 'Review guard-matching and payroll workloads.', relatedRecordId: 'quickguard', relatedRecordType: 'site' },
  { id: 'BTA-002', scope: 'agent', scopeId: 'tf-code', scopeLabel: 'Code Agent', title: 'Code Agent cost spike', severity: 'critical', currentSpend: '£6.82', threshold: 'Daily £6.00', forecast: '£165.60', suggestedAction: 'Investigate failed generation retries on The Forge.', relatedRecordId: 'tf-code', relatedRecordType: 'agent' },
  { id: 'BTA-003', scope: 'model', scopeId: 'MOD-CLAUDE-SONNET', scopeLabel: 'Claude Sonnet', title: 'Model usage higher than expected', severity: 'medium', currentSpend: '£204.00', threshold: '70% of £220.00', forecast: '£247.60', suggestedAction: 'Review primary-model assignments across agents.', relatedRecordId: 'MOD-CLAUDE-SONNET', relatedRecordType: 'model' },
  { id: 'BTA-004', scope: 'site', scopeId: 'guardianhub', scopeLabel: 'GuardianHub', title: 'Retry costs increasing', severity: 'medium', currentSpend: '£74.00', threshold: 'Normal run rate', forecast: '£89.80', suggestedAction: 'Resolve notification service 503 to stop retries.', relatedRecordId: 'guardianhub', relatedRecordType: 'site' },
  { id: 'BTA-005', scope: 'provider', scopeId: 'PROV-ANTHROPIC', scopeLabel: 'Anthropic', title: 'Provider spend approaching monthly limit', severity: 'high', currentSpend: '£221.00', threshold: '£250.00', forecast: '£268.30', suggestedAction: 'Route eligible workloads to local models.', relatedRecordId: 'PROV-ANTHROPIC', relatedRecordType: 'provider' },
  { id: 'BTA-006', scope: 'site', scopeId: 'the-forge', scopeLabel: 'The Forge', title: 'Forecast to exceed monthly budget', severity: 'high', currentSpend: '£64.00', threshold: '£70.00', forecast: '£77.70', suggestedAction: 'Gate expensive build workloads behind approval.', relatedRecordId: 'the-forge', relatedRecordType: 'site' },
  { id: 'BTA-007', scope: 'site', scopeId: 'wedora', scopeLabel: 'Wedora', title: 'Model usage spike', severity: 'low', currentSpend: '£66.00', threshold: '70% of £75.00', forecast: '£80.10', suggestedAction: 'Monitor vision-moderation spend.', relatedRecordId: 'wedora', relatedRecordType: 'site' },
];

// --- Forecast --------------------------------------------------------------------

export const demoGroupForecast: CostForecast = {
  currentMonthSpend: '£380.40',
  averageDailySpend: '£15.22',
  estimatedMonthEnd: '£461.20',
  budget: '£500.00',
  variance: '-£38.80 (under budget)',
};

// --- Efficiency ------------------------------------------------------------------

export const demoEfficiency: CostEfficiencyMetric[] = [
  { key: 'cost_per_success', label: 'Cost per successful run', value: '£0.04', note: 'Average across completed runs.' },
  { key: 'cost_per_failed', label: 'Cost per failed run', value: '£0.11', note: 'Failed generations cost more on average.' },
  { key: 'retry_cost', label: 'Retry cost (month)', value: '£1.42', note: 'Spend attributed to retried runs.' },
  { key: 'highest_task_type', label: 'Highest-cost task type', value: 'Deployment', note: 'Coding and release workloads.' },
  { key: 'highest_agent', label: 'Highest-cost agent', value: 'Code Agent', note: '£136.40 this month.' },
  { key: 'lowest_model', label: 'Lowest-cost effective model', value: 'Llama 3.1 8B', note: 'Local, ~£0.001 per run.' },
  { key: 'local_share', label: 'Local vs cloud', value: '6% local', note: 'Local compute ≈ 6% of group spend.' },
];

// --- Local vs Cloud --------------------------------------------------------------

export const demoLocalCloud: LocalCloudComparison[] = [
  { scope: 'local', label: 'Local models', jobs: 151, avgDuration: '1.1s', estimatedCost: '£1.24', failureRate: '2.1%' },
  { scope: 'cloud', label: 'Cloud providers', jobs: 894, avgDuration: '1.1s', estimatedCost: '£17.87', failureRate: '0.3%' },
];
// ============================================================================
// AI OPERATIONS — DEMO / PLACEHOLDER DATA (NOT PRODUCTION).
//
// ⚠️  Every value below is static placeholder data used to render the
//     AI Operations Overview dashboard. None of this is connected to live
//     agents, n8n, Supabase, or any production system.
//
//     Later prompts will replace these constants with real data sources.
//     Do NOT treat these numbers as real operational state.
// ============================================================================

// Top KPI cards
export const demoKpiMetrics = [
  { key: 'agents_online', label: 'Agents Online', value: 47, icon: 'ri-robot-2-line', accent: 'bg-accent-500/10 text-accent-400' },
  { key: 'agents_working', label: 'Agents Working', value: 6, icon: 'ri-loader-4-line', accent: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'jobs_today', label: 'Jobs Today', value: 814, icon: 'ri-stack-line', accent: 'bg-accent-500/10 text-accent-400' },
  { key: 'failed_jobs', label: 'Failed Jobs', value: 3, icon: 'ri-error-warning-line', accent: 'bg-red-500/10 text-red-400' },
  { key: 'awaiting_approval', label: 'Awaiting Approval', value: 4, icon: 'ri-shield-check-line', accent: 'bg-amber-500/10 text-amber-400' },
  { key: 'sites_healthy', label: 'Sites Healthy', value: '9 / 10', icon: 'ri-global-line', accent: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'critical_alerts', label: 'Critical Alerts', value: 1, icon: 'ri-alert-line', accent: 'bg-red-500/10 text-red-400' },
  { key: 'ai_spend_today', label: 'AI Spend Today', value: '£12.84', icon: 'ri-money-pound-circle-line', accent: 'bg-primary-500/10 text-primary-400' },
];

// Live agent activity
export const demoAgentActivities = [
  { id: 'act-1', time: '10:42:18', site: 'QuickGuard', agent: 'Guard Matching Agent', action: 'Matching eligible guards to shift.', status: 'running', runId: 'RUN-8F21A' },
  { id: 'act-2', time: '10:41:05', site: 'GuardianHub', agent: 'Diagnostics Agent', action: 'Investigating support incident.', status: 'running', runId: 'RUN-3C9B7' },
  { id: 'act-3', time: '10:39:51', site: 'Digital Footprint', agent: 'Lead Agent', action: 'Processing new business enquiry.', status: 'success', runId: 'RUN-71D2E' },
  { id: 'act-4', time: '10:38:22', site: 'LetHub', agent: 'Compliance Agent', action: 'Reviewing tenancy compliance task.', status: 'queued', runId: 'RUN-B44C9' },
  { id: 'act-5', time: '10:36:47', site: 'The Forge', agent: 'UAT Agent', action: 'Running release validation tests.', status: 'failed', runId: 'RUN-2E0F3' },
];

// Pending approvals now derive from the central approval registry
// (src/mocks/ai-operations-approvals.ts) — see ai-operations/page.tsx.

// System health
export const demoSystemHealth = [
  { key: 'orchestrator', label: 'Agent Orchestrator', status: 'operational', detail: 'v2.4.1' },
  { key: 'n8n', label: 'n8n Automation', status: 'operational', detail: '38 workflows' },
  { key: 'supabase', label: 'Supabase', status: 'operational', detail: 'eu-west-1' },
  { key: 'models', label: 'AI Model Providers', status: 'degraded', detail: '1 provider latency' },
  { key: 'notifications', label: 'Notification Service', status: 'operational', detail: 'All channels' },
  { key: 'monitoring', label: 'Monitoring Service', status: 'operational', detail: 'All checks green' },
];

// Master orchestrator
export const demoOrchestrator = {
  status: 'operational',
  activeJobs: 18,
  queue: 5,
  successRate: '99.4%',
  lastRun: '10:44:02',
};
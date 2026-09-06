// ============================================================================
// AI Operations — Production Readiness demo data (part 2 of 2).
//
// ⚠️ NOT PRODUCTION — planning/demo data only. No live connection, no table
// creation, no agent execution is implied.
// ============================================================================

import type {
  AgentRuntimeItem,
  ModelConnectionPlanItem,
  ToolConnectionPlanItem,
  KnowledgeIngestionStep,
  AnalyticsDataSource,
  SecurityGate,
  RlsRole,
  TestingPhase,
  SiteActivationReadiness,
  ProductionChecklistItem,
  GoNoGoStatus,
  ImplementationPhase,
} from '@/pages/ai-operations/readiness/readinessTypes';

// --- Agent Runtime Readiness ---------------------------------------------------

export const coreAgentRuntime: AgentRuntimeItem[] = [
  {
    id: 'rt-core-orchestrator', agent: 'Master Orchestrator', category: 'Orchestration', siteId: null, siteName: 'Group-wide',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-core-support', agent: 'Support Agent', category: 'Support', siteId: null, siteName: 'Group-wide',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-core-diagnostics', agent: 'Diagnostics Agent', category: 'Diagnostics', siteId: null, siteName: 'Group-wide',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-core-security', agent: 'Security Agent', category: 'Security', siteId: null, siteName: 'Group-wide',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-core-uat', agent: 'UAT Agent', category: 'UAT', siteId: null, siteName: 'Group-wide',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-core-monitoring', agent: 'Monitoring Agent', category: 'Monitoring', siteId: null, siteName: 'Group-wide',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
];

export const siteAgentRuntime: AgentRuntimeItem[] = [
  {
    id: 'rt-site-dfp', agent: 'Digital Footprint Site Agent', category: 'Site Agent', siteId: 'digital-footprint', siteName: 'Digital Footprint',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-site-quickguard', agent: 'QuickGuard Site Agent', category: 'Site Agent', siteId: 'quickguard', siteName: 'QuickGuard',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-site-guardianhub', agent: 'GuardianHub Site Agent', category: 'Site Agent', siteId: 'guardianhub', siteName: 'GuardianHub',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-site-lethub', agent: 'LetHub Site Agent', category: 'Site Agent', siteId: 'lethub', siteName: 'LetHub',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-site-wedora', agent: 'Vowora Site Agent', category: 'Site Agent', siteId: 'wedora', siteName: 'Vowora',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
  {
    id: 'rt-site-forge', agent: 'The Forge Site Agent', category: 'Site Agent', siteId: 'the-forge', siteName: 'The Forge',
    model: 'Not assigned (demo)', tools: 'Not connected', knowledge: 'Not ingested', permissions: 'Demo only', approvalPolicy: 'Demo only', failurePolicy: 'Demo only',
    checks: { identity: true, modelAssigned: false, toolsAssigned: false, knowledgeAssigned: false, permissionsDefined: false, policiesApplied: false, approvalDefined: false, runtimeConfigured: false, testingComplete: false },
  },
];

// --- Model Connection Plan -----------------------------------------------------

export const modelConnections: ModelConnectionPlanItem[] = [
  { provider: 'Local Ollama', connectionRequired: true, credentialLocation: 'Local host (no cloud secret)', modelRegistryMapping: 'ai_models.hosting_type = local', fallbackConfigured: false, securityPolicy: 'On-premise, data stays local', costTracking: true, healthMonitoring: true, status: 'not_started' },
  { provider: 'OpenAI', connectionRequired: true, credentialLocation: 'Supabase Edge Function secret', modelRegistryMapping: 'ai_providers → ai_models', fallbackConfigured: false, securityPolicy: 'Sensitive data restricted', costTracking: true, healthMonitoring: true, status: 'not_started' },
  { provider: 'Anthropic', connectionRequired: true, credentialLocation: 'Supabase Edge Function secret', modelRegistryMapping: 'ai_providers → ai_models', fallbackConfigured: false, securityPolicy: 'Sensitive data restricted', costTracking: true, healthMonitoring: true, status: 'not_started' },
  { provider: 'Future providers', connectionRequired: false, credentialLocation: 'To be defined', modelRegistryMapping: 'ai_providers (extensible)', fallbackConfigured: false, securityPolicy: 'To be defined', costTracking: true, healthMonitoring: true, status: 'not_started' },
];

// --- Tool Connection Plan ------------------------------------------------------

export const toolConnections: ToolConnectionPlanItem[] = [
  { tool: 'Supabase', connectionState: 'Connected (platform)', authenticationType: 'Service role / anon', credentialReference: 'Supabase project settings', allowedOperations: 'Read/write AI Operations tables', restrictedOperations: 'Schema changes, DROP/TRUNCATE', approvalRequired: true, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'n8n', connectionState: 'Not connected', authenticationType: 'Instance API token', credentialReference: 'n8n credentials store', allowedOperations: 'Trigger workflows, read status', restrictedOperations: 'Workflow mutation', approvalRequired: true, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'Stripe', connectionState: 'Not connected', authenticationType: 'Secret key', credentialReference: 'Edge Function secret', allowedOperations: 'Read billing metadata', restrictedOperations: 'Refunds / transfers', approvalRequired: true, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'Email (Resend)', connectionState: 'Not connected', authenticationType: 'API key', credentialReference: 'Backend secret', allowedOperations: 'Send notifications', restrictedOperations: 'Marketing blast', approvalRequired: false, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'GitHub', connectionState: 'Not connected', authenticationType: 'Personal access token', credentialReference: 'Edge Function secret', allowedOperations: 'Read repos, open PRs', restrictedOperations: 'Force push, delete branch', approvalRequired: true, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'Readdy', connectionState: 'Platform-native', authenticationType: 'Platform auth', credentialReference: 'Platform session', allowedOperations: 'Publish/build operations', restrictedOperations: 'Billing mutation', approvalRequired: true, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'Monitoring', connectionState: 'Not connected', authenticationType: 'Provider API', credentialReference: 'Monitoring provider', allowedOperations: 'Read health signals', restrictedOperations: 'None (read-only)', approvalRequired: false, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'Site APIs', connectionState: 'Not connected', authenticationType: 'Per-site API', credentialReference: 'Per-site credentials', allowedOperations: 'Site-specific support actions', restrictedOperations: 'Destructive actions', approvalRequired: true, testRequired: true, productionReadiness: 'not_started' },
  { tool: 'Knowledge Base', connectionState: 'Not connected', authenticationType: 'Supabase RLS', credentialReference: 'Supabase auth', allowedOperations: 'Read/retrieve knowledge', restrictedOperations: 'Write without review', approvalRequired: false, testRequired: true, productionReadiness: 'not_started' },
];

// --- Knowledge Ingestion Plan --------------------------------------------------

export const knowledgeIngestionSteps: KnowledgeIngestionStep[] = [
  { step: 1, name: 'Approve source', description: 'Human approval that a source is trusted and in scope.', status: 'not_started' },
  { step: 2, name: 'Classify', description: 'Assign type, sensitivity and information classification.', status: 'not_started' },
  { step: 3, name: 'Assign scope', description: 'Group / site / agent / team scope.', status: 'not_started' },
  { step: 4, name: 'Assign agents', description: 'Which agents may retrieve this source.', status: 'not_started' },
  { step: 5, name: 'Ingest', description: 'Pull raw content into the pipeline.', status: 'not_started' },
  { step: 6, name: 'Chunk / index', description: 'Segment and index for retrieval.', status: 'not_started' },
  { step: 7, name: 'Embed if required', description: 'Vectorise where retrieval needs embeddings.', status: 'not_started' },
  { step: 8, name: 'Test retrieval', description: 'Validate retrieval quality and relevance.', status: 'not_started' },
  { step: 9, name: 'Security validation', description: 'Confirm classification and access controls hold.', status: 'not_started' },
  { step: 10, name: 'Activate', description: 'Make the source live for assigned agents.', status: 'not_started' },
];

// --- Analytics Plan ------------------------------------------------------------

export const analyticsSources: AnalyticsDataSource[] = [
  { metric: 'Users online (group total)', requiredFields: 'total active users, timestamp, data source, freshness state', source: 'Analytics provider (future)', freshness: 'Live', status: 'not_started' },
  { metric: 'Per-site active users', requiredFields: 'per-site active users, timestamp, data source, freshness state', source: 'Analytics provider (future)', freshness: 'Live', status: 'not_started' },
  { metric: 'Site activity', requiredFields: 'event volume by site, timestamp', source: 'Site analytics', freshness: 'Near real-time', status: 'not_started' },
  { metric: 'Agent activity', requiredFields: 'agent jobs, status, timestamp', source: 'ai_runs', freshness: 'Live', status: 'not_started' },
  { metric: 'Run counts', requiredFields: 'runs by status/site, timestamp', source: 'ai_runs', freshness: 'Live', status: 'not_started' },
  { metric: 'Site health', requiredFields: 'health status by site, timestamp', source: 'Monitoring', freshness: 'Live', status: 'not_started' },
  { metric: 'AI costs', requiredFields: 'usage cost by model/site, timestamp', source: 'ai_usage_costs', freshness: 'Daily', status: 'not_started' },
];

// --- Production Security Gates -------------------------------------------------

export const securityGates: SecurityGate[] = [
  { id: 'sg-01', label: 'Authentication verified', state: 'partial', owner: 'Security Team', note: 'Platform auth exists; AI Ops roles not yet defined.' },
  { id: 'sg-02', label: 'Staff roles defined', state: 'blocked', owner: 'AI Ops Admin' },
  { id: 'sg-03', label: 'RLS implemented', state: 'blocked', owner: 'Security Team' },
  { id: 'sg-04', label: 'Service credentials externalised', state: 'partial', owner: 'Security Team', note: 'No secrets in code; Edge Function secrets pending.' },
  { id: 'sg-05', label: 'Least privilege applied', state: 'blocked', owner: 'Security Team' },
  { id: 'sg-06', label: 'Agent permissions validated', state: 'blocked', owner: 'AI Ops Admin' },
  { id: 'sg-07', label: 'Tool restrictions validated', state: 'blocked', owner: 'AI Ops Admin' },
  { id: 'sg-08', label: 'Approval workflow live', state: 'blocked', owner: 'Approvals Team' },
  { id: 'sg-09', label: 'Separation of duties working', state: 'blocked', owner: 'Security Team' },
  { id: 'sg-10', label: 'Audit persistence live', state: 'blocked', owner: 'Security Team' },
  { id: 'sg-11', label: 'Environment isolation confirmed', state: 'blocked', owner: 'Infrastructure' },
  { id: 'sg-12', label: 'Production kill switch available', state: 'blocked', owner: 'Infrastructure' },
  { id: 'sg-13', label: 'Emergency agent disable available', state: 'blocked', owner: 'AI Ops Admin' },
  { id: 'sg-14', label: 'Secrets absent from prompts/logs', state: 'partial', owner: 'Security Team', note: 'Demo data contains no secrets.' },
];

// --- RLS Readiness -------------------------------------------------------------

export const rlsRoles: RlsRole[] = [
  { role: 'Staff', readScope: 'Own site records', writeScope: 'None (read-only)', approvalPermissions: 'Submit requests', adminPermissions: 'None', state: 'not_started' },
  { role: 'Supervisors', readScope: 'Own site + team records', writeScope: 'Approval decisions', approvalPermissions: 'Approve within site', adminPermissions: 'None', state: 'not_started' },
  { role: 'AI Operations Admins', readScope: 'Group-wide', writeScope: 'Configuration, registries', approvalPermissions: 'Approve high-risk', adminPermissions: 'Full AI Ops admin', state: 'not_started' },
  { role: 'Approvers', readScope: 'Requested actions + evidence', writeScope: 'Approval decisions only', approvalPermissions: 'Approve / reject', adminPermissions: 'None', state: 'not_started' },
  { role: 'Security Team', readScope: 'Policies, audit, alerts', writeScope: 'Policies, exceptions', approvalPermissions: 'Security approvals', adminPermissions: 'Security admin', state: 'not_started' },
  { role: 'Service Processes', readScope: 'Task-scoped records', writeScope: 'Run/step state', approvalPermissions: 'None (automated)', adminPermissions: 'None', state: 'not_started' },
  { role: 'Agents', readScope: 'Assigned scope only', writeScope: 'Run outputs (scoped)', approvalPermissions: 'None', adminPermissions: 'None', state: 'not_started' },
];

// --- Environments --------------------------------------------------------------

export const environments = [
  { id: 'development', name: 'Development', purpose: 'Local agent/config iteration', promotion: '→ Sandbox' },
  { id: 'sandbox', name: 'Sandbox', purpose: 'Isolated agent/tool testing', promotion: '→ Staging' },
  { id: 'staging', name: 'Staging', purpose: 'Production-like validation + UAT', promotion: '→ Production' },
  { id: 'production', name: 'Production', purpose: 'Controlled live operation', promotion: '—' },
];

// --- Testing Plan --------------------------------------------------------------

export const testingPhases: TestingPhase[] = [
  { phase: 1, name: 'Read-only live data', description: 'Agents read real data, take no action.', risk: 'Low', status: 'not_started' },
  { phase: 2, name: 'Live monitoring', description: 'Observe live signals without intervention.', risk: 'Low', status: 'not_started' },
  { phase: 3, name: 'Agent recommendations only', description: 'Agents suggest, humans act.', risk: 'Low', status: 'not_started' },
  { phase: 4, name: 'Human-approved controlled actions', description: 'Actions require human approval.', risk: 'Medium', status: 'not_started' },
  { phase: 5, name: 'Limited automatic GREEN actions', description: 'Low-risk actions automate.', risk: 'Medium', status: 'not_started' },
  { phase: 6, name: 'Broader automation after review', description: 'Expand automation post-review. RED stays human-governed.', risk: 'High', status: 'not_started' },
];

// --- Site Activation Plan ------------------------------------------------------

export const siteActivation: SiteActivationReadiness[] = [
  { siteId: 'digital-footprint', name: 'Digital Footprint', registryReady: true, databaseConnected: false, siteApiConnected: false, agentsConfigured: false, toolsConfigured: false, knowledgeConfigured: false, monitoringConnected: false, uatComplete: false, securityReview: false, productionStatus: 'not_started' },
  { siteId: 'quickguard', name: 'QuickGuard', registryReady: true, databaseConnected: false, siteApiConnected: false, agentsConfigured: false, toolsConfigured: false, knowledgeConfigured: false, monitoringConnected: false, uatComplete: false, securityReview: false, productionStatus: 'not_started' },
  { siteId: 'guardianhub', name: 'GuardianHub', registryReady: true, databaseConnected: false, siteApiConnected: false, agentsConfigured: false, toolsConfigured: false, knowledgeConfigured: false, monitoringConnected: false, uatComplete: false, securityReview: false, productionStatus: 'not_started' },
  { siteId: 'lethub', name: 'LetHub', registryReady: true, databaseConnected: false, siteApiConnected: false, agentsConfigured: false, toolsConfigured: false, knowledgeConfigured: false, monitoringConnected: false, uatComplete: false, securityReview: false, productionStatus: 'not_started' },
  { siteId: 'wedora', name: 'Vowora', registryReady: true, databaseConnected: false, siteApiConnected: false, agentsConfigured: false, toolsConfigured: false, knowledgeConfigured: false, monitoringConnected: false, uatComplete: false, securityReview: false, productionStatus: 'not_started' },
  { siteId: 'the-forge', name: 'The Forge', registryReady: true, databaseConnected: false, siteApiConnected: false, agentsConfigured: false, toolsConfigured: false, knowledgeConfigured: false, monitoringConnected: false, uatComplete: false, securityReview: false, productionStatus: 'not_started' },
];

export const activationOrder = [
  { order: 1, name: 'DFP core platform', note: 'Control plane + persistence + security gates.' },
  { order: 2, name: 'Digital Footprint', note: 'First site on the shared control plane.' },
  { order: 3, name: 'One controlled pilot site', note: 'Single additional site as a contained pilot.' },
  { order: 4, name: 'Remaining sites individually', note: 'Each site activated and verified in turn.' },
];

// --- Production Checklist ------------------------------------------------------

export const checklistItems: ProductionChecklistItem[] = [
  { id: 'pc-01', category: 'Database', item: 'Create AI Operations tables', required: true, owner: 'Infrastructure', status: 'not_started', blocker: true, evidence: 'Migrations', notes: 'ai_sites … ai_budgets' },
  { id: 'pc-02', category: 'Database', item: 'Enable RLS on all AI Ops tables', required: true, owner: 'Security Team', status: 'not_started', blocker: true, evidence: 'RLS policies', notes: 'Per-role scopes' },
  { id: 'pc-03', category: 'Security', item: 'Define staff roles + permissions', required: true, owner: 'Security Team', status: 'not_started', blocker: true, evidence: 'Role matrix', notes: 'Staff → Approver → Admin' },
  { id: 'pc-04', category: 'Security', item: 'Externalise service credentials', required: true, owner: 'Security Team', status: 'not_started', blocker: true, evidence: 'Secrets in Edge Functions', notes: 'No secrets in code' },
  { id: 'pc-05', category: 'Infrastructure', item: 'Provision kill switch + agent disable', required: true, owner: 'Infrastructure', status: 'not_started', blocker: true, evidence: 'Control endpoints', notes: 'Stop new work, preserve audit' },
  { id: 'pc-06', category: 'Agents', item: 'Assign models + tools to agents', required: true, owner: 'AI Ops Admin', status: 'not_started', blocker: true, evidence: 'Assignments', notes: 'Per agent registry' },
  { id: 'pc-07', category: 'Tools', item: 'Connect and validate tool integrations', required: true, owner: 'AI Ops Admin', status: 'not_started', blocker: true, evidence: 'Connection tests', notes: 'n8n, GitHub, site APIs' },
  { id: 'pc-08', category: 'Models', item: 'Configure providers + fallbacks', required: true, owner: 'AI Ops Admin', status: 'not_started', blocker: true, evidence: 'Provider config', notes: 'Ollama / OpenAI / Anthropic' },
  { id: 'pc-09', category: 'Knowledge', item: 'Complete staged ingestion', required: true, owner: 'Knowledge Team', status: 'not_started', blocker: false, evidence: 'Ingestion reports', notes: '10-step pipeline' },
  { id: 'pc-10', category: 'Monitoring', item: 'Connect monitoring + analytics', required: true, owner: 'Infrastructure', status: 'not_started', blocker: false, evidence: 'Dashboards', notes: 'Health + users online' },
  { id: 'pc-11', category: 'Approvals', item: 'Live approval workflow', required: true, owner: 'Approvals Team', status: 'not_started', blocker: true, evidence: 'Approval flow', notes: 'Gate for high-risk' },
  { id: 'pc-12', category: 'Audit', item: 'Audit persistence live', required: true, owner: 'Security Team', status: 'not_started', blocker: true, evidence: 'Append-only log', notes: 'ai_audit_events' },
  { id: 'pc-13', category: 'UAT', item: 'Pilot agent UAT complete', required: true, owner: 'UAT Team', status: 'not_started', blocker: true, evidence: 'UAT results', notes: 'Phases 1–4' },
  { id: 'pc-14', category: 'Notifications', item: 'Notification delivery live', required: true, owner: 'Operations', status: 'not_started', blocker: false, evidence: 'Delivery tests', notes: 'Resend + DFN' },
  { id: 'pc-15', category: 'Cost controls', item: 'Budgets + usage metering live', required: true, owner: 'Finance', status: 'not_started', blocker: false, evidence: 'Budget reports', notes: 'ai_usage_costs' },
  { id: 'pc-16', category: 'Recovery', item: 'Rollback / recovery tested', required: true, owner: 'Infrastructure', status: 'not_started', blocker: true, evidence: 'Recovery drills', notes: 'Restore + rollback' },
];

// --- Go / No-Go ----------------------------------------------------------------

export const goNoGo: GoNoGoStatus = {
  status: 'no_go',
  summary: 'NO-GO — Control Plane Complete, Runtime Not Connected',
  goRequirements: [
    { label: 'All critical security gates PASS', met: false },
    { label: 'Approval workflow live', met: false },
    { label: 'Audit persistence live', met: false },
    { label: 'Production monitoring live', met: false },
    { label: 'Kill switch available', met: false },
    { label: 'Pilot agents tested', met: false },
    { label: 'Rollback / recovery tested', met: false },
    { label: 'UAT complete', met: false },
  ],
};

// --- Implementation Phases -----------------------------------------------------

export const implementationPhases: ImplementationPhase[] = [
  { id: 'phase-a', name: 'Phase A — Supabase persistence', summary: 'Create AI Operations tables + RLS.', deliverables: ['Tables', 'RLS', 'Migrations'], status: 'not_started' },
  { id: 'phase-b', name: 'Phase B — Read-only live data', summary: 'Replace mocks with live read queries.', deliverables: ['Live selectors', 'Fallback removal'], status: 'not_started' },
  { id: 'phase-c', name: 'Phase C — Monitoring & analytics', summary: 'Connect monitoring + analytics feeds.', deliverables: ['Health signals', 'Users online'], status: 'not_started' },
  { id: 'phase-d', name: 'Phase D — Agent runtime + models', summary: 'Provision agent runtime and model connections.', deliverables: ['Runtime', 'Providers', 'Fallbacks'], status: 'not_started' },
  { id: 'phase-e', name: 'Phase E — Tools', summary: 'Connect and validate tool integrations.', deliverables: ['n8n', 'GitHub', 'Site APIs'], status: 'not_started' },
  { id: 'phase-f', name: 'Phase F — Approvals + execution gate', summary: 'Live approval workflow and policy gate.', deliverables: ['Approvals', 'Policy engine'], status: 'not_started' },
  { id: 'phase-g', name: 'Phase G — Pilot agent', summary: 'Run a single controlled pilot agent.', deliverables: ['Pilot', 'UAT'], status: 'not_started' },
  { id: 'phase-h', name: 'Phase H — Controlled production rollout', summary: 'Activate sites in staged order.', deliverables: ['Site activation', 'Go/No-Go'], status: 'not_started' },
];
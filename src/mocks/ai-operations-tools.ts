// ============================================================================
// AI OPERATIONS — TOOLS & CONNECTIONS REGISTRY — DEMO / PLACEHOLDER DATA.
//
// ⚠️  Every value below is static placeholder metadata used to render the
//     central Tools & Connections Registry. NOT PRODUCTION — no connection is
//     actually established, no tool is executed and no API is called. No
//     credentials, tokens, keys or secrets are stored here — only safe
//     connection IDs, reference names and operational metadata that link back
//     to the existing Site, Agent, Run and Approval registries.
//
//     Later prompts will replace these records with real connection data and
//     persistent tables (ai_tool_connections, ai_tool_agent_access,
//     ai_tool_site_usage, ai_tool_permissions, ai_tool_dependencies,
//     ai_tool_health, ai_tool_usage_events).
// ============================================================================

// --- Shared demo blocks ---------------------------------------------------------

const SECURITY_STANDARD = {
  credentialsExternal: true,
  secretsHiddenFromAgents: true,
  environmentIsolation: true,
  leastPrivilege: true,
  approvalForHighRisk: true,
  auditEnabled: true,
  rotationStatus: 'Rotated 90d',
  lastSecurityReview: '2026-08-20',
};

const GREEN_READ = [
  { riskClass: 'green', operations: ['Read operational data', 'Query safe metadata', 'Analyse logs'] },
];

// ============================================================================
// CONNECTION RECORDS
// ============================================================================

export const demoConnections = [
  // ============================================================ 01 — Supabase
  {
    id: 'CON-SUPABASE',
    name: 'Supabase',
    provider: 'Supabase',
    category: 'database',
    description: 'Group-wide database, authentication and storage backend used by every platform.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'critical', configurationState: 'complete',
    accessMode: 'read_write', reference: 'supabase-group-prod', ownerTeam: 'DFP Core Team',
    lastChecked: '1m ago', lastSuccessfulUse: '1m ago', failureCount: 0,
    approvalRequired: true, auditRequired: true,
    notes: 'Central data plane. Red-class actions (RLS, schema, deletes) are always human-approved.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-orchestrator', agentName: 'DFP Group Master Orchestrator', site: 'Group-wide', accessMode: 'read_write', allowedOperations: ['Read tables', 'Query metadata'], restrictedOperations: ['Modify RLS', 'Delete records'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'core-data-health', agentName: 'Data Health Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read tables', 'Run integrity checks'], restrictedOperations: ['Modify schema'], risk: 'medium', approvalRequired: false, status: 'connected' },
      { agentId: 'core-diagnostics', agentName: 'Diagnostics Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read tables', 'Query diagnostics'], restrictedOperations: ['Write production data'], risk: 'medium', approvalRequired: false, status: 'connected' },
      { agentId: 'qg-match', agentName: 'Guard Matching Agent', site: 'QuickGuard', accessMode: 'read', allowedOperations: ['Read guards', 'Read shifts'], restrictedOperations: ['Modify payments'], risk: 'medium', approvalRequired: false, status: 'connected' },
      { agentId: 'tf-database', agentName: 'Database Agent', site: 'The Forge', accessMode: 'read_write', allowedOperations: ['Draft migrations'], restrictedOperations: ['Apply migrations'], risk: 'high', approvalRequired: true, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Core platform data', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Guard and shift data', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care and welfare data', status: 'degraded', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenancy data', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding data', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Build metadata', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read approved tables', 'Query safe operational metadata', 'Run diagnostics'] },
      { riskClass: 'amber', operations: ['Update approved non-critical records', 'Correct approved configuration'] },
      { riskClass: 'red', operations: ['Modify RLS', 'Delete production records', 'Change authentication', 'Access service-role credentials', 'Run migrations'] },
    ],
    permissions: [
      { operation: 'Read tables', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Update non-critical records', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Run migrations', read: true, write: true, execute: true, admin: false, restricted: true, riskClass: 'red' },
      { operation: 'Modify RLS', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
      { operation: 'Delete records', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '1m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '42ms', availability: '99.99%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'n8n', connectionId: 'CON-N8N', relationship: 'required_by', status: 'operational', note: 'Workflows read/write via n8n' },
      { name: 'AI Model Providers', connectionId: 'CON-MODEL', relationship: 'required_by', status: 'operational', note: 'Agents query via model layer' },
    ],
    usageEvents: [
      { time: 'Today · 10:44', agentId: 'core-diagnostics', agentName: 'Diagnostics Agent', site: 'GuardianHub', operation: 'Read check-call table', runId: 'RUN-A1003', result: 'success', duration: '1m 37s' },
      { time: 'Today · 09:50', agentId: 'core-data-health', agentName: 'Data Health Agent', site: 'Group-wide', operation: 'Run integrity check', runId: 'RUN-8B44D', result: 'success', duration: '48s' },
      { time: 'Today · 08:12', agentId: 'core-site-registry', agentName: 'Site Registry Agent', site: 'Group-wide', operation: 'Sync site metadata', runId: 'RUN-2C91D', result: 'success', duration: '22s' },
      { time: 'Yesterday · 22:10', agentId: 'qg-match', agentName: 'Guard Matching Agent', site: 'QuickGuard', operation: 'Read eligible guards', runId: 'RUN-8F21A', result: 'success', duration: '52s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 02 — n8n
  {
    id: 'CON-N8N',
    name: 'n8n',
    provider: 'n8n',
    category: 'automation',
    description: 'Workflow automation platform driving cross-group orchestration and repair actions.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'high', configurationState: 'complete',
    accessMode: 'execute', reference: 'n8n-group-core', ownerTeam: 'DFP Core Team',
    lastChecked: '1m ago', lastSuccessfulUse: '2m ago', failureCount: 1,
    approvalRequired: true, auditRequired: true,
    notes: 'Production workflows are gated; red-class edits require approval.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-orchestrator', agentName: 'DFP Group Master Orchestrator', site: 'Group-wide', accessMode: 'execute', allowedOperations: ['Read workflow status', 'Retry approved workflow'], restrictedOperations: ['Modify workflow', 'Change credentials'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'core-repair', agentName: 'Repair Recommendation Agent', site: 'Group-wide', accessMode: 'execute', allowedOperations: ['Read execution result'], restrictedOperations: ['Modify production workflow'], risk: 'medium', approvalRequired: true, status: 'connected' },
      { agentId: 'tf-master', agentName: 'Forge Master Agent', site: 'The Forge', accessMode: 'execute', allowedOperations: ['Run build workflow'], restrictedOperations: ['Modify workflow'], risk: 'high', approvalRequired: true, status: 'degraded' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Core automation', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Shift automation', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care automation', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenancy automation', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding automation', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Build pipeline', status: 'degraded', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read workflow status', 'Read execution result', 'List workflows'] },
      { riskClass: 'amber', operations: ['Retry approved workflow', 'Restart known-safe workflow'] },
      { riskClass: 'red', operations: ['Modify production workflow', 'Change credentials', 'Delete workflow'] },
    ],
    permissions: [
      { operation: 'Read workflow status', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Retry approved workflow', read: true, write: false, execute: true, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Modify production workflow', read: true, write: true, execute: true, admin: true, restricted: true, riskClass: 'red' },
      { operation: 'Change credentials', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'warning', lastSuccessfulCheck: '1m ago', lastFailure: '11m ago', failureSummary: 'The Forge connector latency spike; retried successfully.', responseTime: '180ms', availability: '99.9%', recommendedAction: 'Monitor Forge connector latency.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'depends_on', status: 'operational', note: 'Reads/writes via Supabase' },
    ],
    usageEvents: [
      { time: 'Today · 10:44', agentId: 'core-repair', agentName: 'Repair Recommendation Agent', site: 'GuardianHub', operation: 'Execute repair workflow', runId: 'RUN-A1006', result: 'success', duration: '1m 02s' },
      { time: 'Today · 10:31', agentId: 'tf-test', agentName: 'Testing Agent', site: 'The Forge', operation: 'Run release validation', runId: 'RUN-4F77B', result: 'failed', duration: '3m 10s' },
      { time: 'Yesterday · 18:02', agentId: 'core-billing', agentName: 'Billing Agent', site: 'Group-wide', operation: 'Reconcile billing batch', runId: 'RUN-9E55D', result: 'success', duration: '1m 20s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 03 — Stripe
  {
    id: 'CON-STRIPE',
    name: 'Stripe',
    provider: 'Stripe',
    category: 'billing',
    description: 'Payment and billing provider for subscriptions, invoices and refunds across the group.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'critical', configurationState: 'complete',
    accessMode: 'read', reference: 'stripe-group-prod', ownerTeam: 'DFP Finance',
    lastChecked: '10m ago', lastSuccessfulUse: '3h ago', failureCount: 0,
    approvalRequired: true, auditRequired: true,
    notes: 'Finance-critical. Refunds and billing changes require human approval.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-billing', agentName: 'Billing Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read invoices', 'Read subscription state'], restrictedOperations: ['Issue refunds', 'Modify billing'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'qg-payment', agentName: 'Payment Agent', site: 'QuickGuard', accessMode: 'read', allowedOperations: ['Read payment records'], restrictedOperations: ['Modify payroll'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'lh-rent', agentName: 'Rent Agent', site: 'LetHub', accessMode: 'read', allowedOperations: ['Read rent ledger'], restrictedOperations: ['Issue refunds'], risk: 'medium', approvalRequired: true, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Client billing', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Guard payments', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care billing', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Rent payments', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding billing', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Studio billing', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read invoices', 'Read subscription state', 'Generate billing reports'] },
      { riskClass: 'amber', operations: ['Update billing metadata', 'Correct approved invoice'] },
      { riskClass: 'red', operations: ['Issue refunds', 'Modify billing plans', 'Change payout config'] },
    ],
    permissions: [
      { operation: 'Read invoices', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Update billing metadata', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Issue refunds', read: true, write: true, execute: true, admin: true, restricted: true, riskClass: 'red' },
      { operation: 'Modify billing plans', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '10m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '120ms', availability: '99.95%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'required_by', status: 'operational', note: 'Billing state cached in Supabase' },
    ],
    usageEvents: [
      { time: 'Yesterday · 18:02', agentId: 'core-billing', agentName: 'Billing Agent', site: 'Group-wide', operation: 'Reconcile billing batch', runId: 'RUN-9E55D', result: 'success', duration: '1m 20s' },
      { time: 'Yesterday · 14:20', agentId: 'qg-payment', agentName: 'Payment Agent', site: 'QuickGuard', operation: 'Reconcile payroll batch', runId: 'RUN-8D22F', result: 'success', duration: '1m 12s' },
      { time: 'Yesterday · 09:40', agentId: 'lh-rent', agentName: 'Rent Agent', site: 'LetHub', operation: 'Reconcile rent ledger', runId: 'RUN-2D55F', result: 'success', duration: '44s' },
    ],
    security: { ...SECURITY_STANDARD, rotationStatus: 'Rotated 30d' },
  },

  // ============================================================ 04 — Resend / Email
  {
    id: 'CON-EMAIL',
    name: 'Resend / Email',
    provider: 'Resend',
    category: 'email',
    description: 'Transactional and notification email delivery for staff and customers.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'high', configurationState: 'complete',
    accessMode: 'write', reference: 'resend-group-prod', ownerTeam: 'DFP Core Team',
    lastChecked: '10m ago', lastSuccessfulUse: '12m ago', failureCount: 1,
    approvalRequired: false, auditRequired: true,
    notes: 'Pre-approved templates only. No unsolicited outreach without approval.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-comms', agentName: 'Communications Agent', site: 'Group-wide', accessMode: 'write', allowedOperations: ['Send approved template'], restrictedOperations: ['Send unsolicited outreach'], risk: 'low', approvalRequired: false, status: 'connected' },
      { agentId: 'wd-comms', agentName: 'Wedding Communications Agent', site: 'Vowora', accessMode: 'write', allowedOperations: ['Send guest update'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'connected' },
      { agentId: 'lh-comms', agentName: 'Communications Agent', site: 'LetHub', accessMode: 'write', allowedOperations: ['Send tenancy notice'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Client notifications', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Guard notifications', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care notifications', status: 'degraded', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenancy notices', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding comms', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Build alerts', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Send approved notifications', 'Read delivery status'] },
      { riskClass: 'amber', operations: ['Send approved communications'] },
      { riskClass: 'red', operations: ['Modify sending domain', 'Change SMTP credentials'] },
    ],
    permissions: [
      { operation: 'Send approved template', read: false, write: true, execute: true, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Read delivery status', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Modify sending domain', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'warning', lastSuccessfulCheck: '10m ago', lastFailure: '4m ago', failureSummary: 'GuardianHub email delivery degraded; retrying.', responseTime: '90ms', availability: '99.8%', recommendedAction: 'Monitor GuardianHub delivery queue.' },
    dependencies: [],
    usageEvents: [
      { time: 'Today · 10:31', agentId: 'core-comms', agentName: 'Communications Agent', site: 'Group-wide', operation: 'Queue notification batch', runId: 'RUN-5E11B', result: 'success', duration: '18s' },
      { time: 'Today · 09:22', agentId: 'wd-comms', agentName: 'Wedding Communications Agent', site: 'Vowora', operation: 'Send guest update', runId: 'RUN-2A55C', result: 'success', duration: '21s' },
      { time: 'Today · 09:02', agentId: 'lh-comms', agentName: 'Communications Agent', site: 'LetHub', operation: 'Send tenancy notice', runId: 'RUN-3E66A', result: 'success', duration: '22s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 05 — GitHub
  {
    id: 'CON-GITHUB',
    name: 'GitHub',
    provider: 'GitHub',
    category: 'repository',
    description: 'Source control and CI for every group platform repository.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'high', configurationState: 'complete',
    accessMode: 'read_write', reference: 'github-group-org', ownerTeam: 'DFP Core Team',
    lastChecked: '5m ago', lastSuccessfulUse: '11m ago', failureCount: 0,
    approvalRequired: true, auditRequired: true,
    notes: 'Deploy branches and merges to production require release approval.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'tf-code', agentName: 'Code Agent', site: 'The Forge', accessMode: 'read_write', allowedOperations: ['Read repository', 'Open PR'], restrictedOperations: ['Merge to production'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'tf-master', agentName: 'Forge Master Agent', site: 'The Forge', accessMode: 'read', allowedOperations: ['Read repository'], restrictedOperations: ['Merge to production'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'tf-publishing', agentName: 'Publishing Agent', site: 'The Forge', accessMode: 'execute', allowedOperations: ['Trigger deploy'], restrictedOperations: ['Direct push'], risk: 'high', approvalRequired: true, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform repo', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'App repo', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Core repo', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'App repo', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'App repo', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Studio repo', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read repository', 'Read PR status', 'List branches'] },
      { riskClass: 'amber', operations: ['Open pull request', 'Update non-production branch'] },
      { riskClass: 'red', operations: ['Merge to production', 'Delete branch', 'Modify branch protection'] },
    ],
    permissions: [
      { operation: 'Read repository', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Open pull request', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Merge to production', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
      { operation: 'Modify branch protection', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '5m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '200ms', availability: '99.99%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'n8n', connectionId: 'CON-N8N', relationship: 'required_by', status: 'operational', note: 'CI triggers via n8n' },
    ],
    usageEvents: [
      { time: 'Today · 10:20', agentId: 'tf-code', agentName: 'Code Agent', site: 'The Forge', operation: 'Open PR', runId: 'RUN-7C11E', result: 'success', duration: '2m 30s' },
      { time: 'Today · 09:40', agentId: 'tf-publishing', agentName: 'Publishing Agent', site: 'The Forge', operation: 'Trigger deploy', runId: 'RUN-8F22B', result: 'success', duration: '2m 30s' },
      { time: 'Yesterday · 16:10', agentId: 'tf-code', agentName: 'Code Agent', site: 'The Forge', operation: 'Read repository', runId: 'RUN-5A88C', result: 'success', duration: '8s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 06 — Readdy
  {
    id: 'CON-READDY',
    name: 'Readdy',
    provider: 'Readdy',
    category: 'website_builder',
    description: 'AI website generation and publishing platform powering client builds.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'medium', configurationState: 'complete',
    accessMode: 'read', reference: 'readdy-group', ownerTeam: 'DFP Core Team',
    lastChecked: '2m ago', lastSuccessfulUse: '4m ago', failureCount: 0,
    approvalRequired: false, auditRequired: true,
    notes: 'Publishing is gated behind release approval in The Forge.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'tf-publishing', agentName: 'Publishing Agent', site: 'The Forge', accessMode: 'execute', allowedOperations: ['Publish approved site'], restrictedOperations: ['—'], risk: 'high', approvalRequired: true, status: 'connected' },
      { agentId: 'tf-page', agentName: 'Page Designer Agent', site: 'The Forge', accessMode: 'read_write', allowedOperations: ['Generate page layout'], restrictedOperations: ['—'], risk: 'medium', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform build', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Generation backend', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read project metadata', 'Generate page layout'] },
      { riskClass: 'amber', operations: ['Publish to staging'] },
      { riskClass: 'red', operations: ['Publish to production', 'Delete project'] },
    ],
    permissions: [
      { operation: 'Read project metadata', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Generate page layout', read: true, write: true, execute: true, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Publish to production', read: true, write: true, execute: true, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '2m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '250ms', availability: '99.9%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'depends_on', status: 'operational', note: 'Project state in Supabase' },
    ],
    usageEvents: [
      { time: 'Today · 09:22', agentId: 'tf-page', agentName: 'Page Designer Agent', site: 'The Forge', operation: 'Generate page layout', runId: 'RUN-6B99D', result: 'success', duration: '1m 40s' },
      { time: 'Yesterday · 15:30', agentId: 'tf-publishing', agentName: 'Publishing Agent', site: 'The Forge', operation: 'Publish to staging', runId: 'RUN-9B33D', result: 'success', duration: '2m 30s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 07 — AI Model Providers
  {
    id: 'CON-MODEL',
    name: 'AI Model Providers',
    provider: 'Anthropic / OpenAI',
    category: 'ai_model',
    description: 'Model inference layer powering every agent across the group.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'critical', configurationState: 'complete',
    accessMode: 'execute', reference: 'model-gateway-group', ownerTeam: 'DFP Core Team',
    lastChecked: '1m ago', lastSuccessfulUse: '1m ago', failureCount: 0,
    approvalRequired: false, auditRequired: true,
    notes: 'Usage metered per agent; no model-provider keys exposed to agents.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-orchestrator', agentName: 'DFP Group Master Orchestrator', site: 'Group-wide', accessMode: 'execute', allowedOperations: ['Run inference'], restrictedOperations: ['—'], risk: 'high', approvalRequired: false, status: 'connected' },
      { agentId: 'tf-code', agentName: 'Code Agent', site: 'The Forge', accessMode: 'execute', allowedOperations: ['Run inference'], restrictedOperations: ['—'], risk: 'high', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Agent inference', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Code generation', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Run inference', 'Read usage metrics'] },
      { riskClass: 'amber', operations: ['Switch fallback model'] },
      { riskClass: 'red', operations: ['Modify provider credentials', 'Change routing policy'] },
    ],
    permissions: [
      { operation: 'Run inference', read: false, write: false, execute: true, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Read usage metrics', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Modify provider credentials', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '1m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '1.2s', availability: '99.9%', recommendedAction: 'None — healthy.' },
    dependencies: [],
    usageEvents: [
      { time: 'Today · 10:44', agentId: 'core-diagnostics', agentName: 'Diagnostics Agent', site: 'GuardianHub', operation: 'Run inference', runId: 'RUN-A1003', result: 'success', duration: '1m 37s' },
      { time: 'Today · 10:31', agentId: 'tf-code', agentName: 'Code Agent', site: 'The Forge', operation: 'Run inference', runId: 'RUN-4F77B', result: 'failed', duration: '2m 30s' },
    ],
    security: { ...SECURITY_STANDARD, rotationStatus: 'Rotated 14d' },
  },

  // ============================================================ 08 — Monitoring Service
  {
    id: 'CON-MONITORING',
    name: 'Monitoring Service',
    provider: 'Monitoring',
    category: 'monitoring',
    description: 'Observability and alerting for platform health and agent telemetry.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'high', configurationState: 'complete',
    accessMode: 'read', reference: 'monitoring-group', ownerTeam: 'DFP Core Team',
    lastChecked: '1m ago', lastSuccessfulUse: '1m ago', failureCount: 0,
    approvalRequired: false, auditRequired: true,
    notes: 'Read-only telemetry; no corrective action by agents.',
    createdAt: '2025-04-01', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-monitoring', agentName: 'Monitoring Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read metrics', 'Raise alert'], restrictedOperations: ['Take corrective action'], risk: 'low', approvalRequired: false, status: 'connected' },
      { agentId: 'core-diagnostics', agentName: 'Diagnostics Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read metrics'], restrictedOperations: ['—'], risk: 'medium', approvalRequired: false, status: 'connected' },
      { agentId: 'gh-welfare', agentName: 'Welfare Agent', site: 'GuardianHub', accessMode: 'read', allowedOperations: ['Read welfare signals'], restrictedOperations: ['—'], risk: 'high', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform health', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Shift telemetry', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Welfare telemetry', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenancy telemetry', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Event telemetry', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Build telemetry', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read metrics', 'Raise alert', 'Generate reports'] },
      { riskClass: 'amber', operations: ['Acknowledge alert'] },
      { riskClass: 'red', operations: ['Modify alert rules', 'Suppress production alerts'] },
    ],
    permissions: [
      { operation: 'Read metrics', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Raise alert', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Modify alert rules', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '1m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '30ms', availability: '99.99%', recommendedAction: 'None — healthy.' },
    dependencies: [],
    usageEvents: [
      { time: 'Today · 10:44', agentId: 'core-monitoring', agentName: 'Monitoring Agent', site: 'Group-wide', operation: 'Read live metrics', runId: 'RUN-4F09C', result: 'success', duration: '8s' },
      { time: 'Today · 09:58', agentId: 'core-diagnostics', agentName: 'Diagnostics Agent', site: 'GuardianHub', operation: 'Read alert history', runId: 'RUN-A1003', result: 'success', duration: '1m 37s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 09 — Notification Service
  {
    id: 'CON-NOTIFY',
    name: 'Notification Service',
    provider: 'Notifications',
    category: 'notifications',
    description: 'In-app and push notification delivery for staff and customers.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'medium', configurationState: 'complete',
    accessMode: 'write', reference: 'notify-group', ownerTeam: 'DFP Core Team',
    lastChecked: '2m ago', lastSuccessfulUse: '2m ago', failureCount: 0,
    approvalRequired: false, auditRequired: true,
    notes: 'Pre-approved notification templates only.',
    createdAt: '2025-04-01', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-comms', agentName: 'Communications Agent', site: 'Group-wide', accessMode: 'write', allowedOperations: ['Send notification'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Client notifications', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Guard notifications', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care notifications', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Guest notifications', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Send approved notification', 'Read delivery status'] },
      { riskClass: 'amber', operations: ['Send batch notification'] },
      { riskClass: 'red', operations: ['Modify notification templates', 'Change delivery config'] },
    ],
    permissions: [
      { operation: 'Send approved notification', read: false, write: true, execute: true, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Send batch notification', read: false, write: true, execute: true, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Modify notification templates', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '2m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '50ms', availability: '99.9%', recommendedAction: 'None — healthy.' },
    dependencies: [],
    usageEvents: [
      { time: 'Today · 10:31', agentId: 'core-comms', agentName: 'Communications Agent', site: 'Group-wide', operation: 'Send notification', runId: 'RUN-5E11B', result: 'success', duration: '18s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 10 — Authentication
  {
    id: 'CON-AUTH',
    name: 'Authentication',
    provider: 'Supabase Auth',
    category: 'authentication',
    description: 'Identity and session management across group platforms.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'critical', configurationState: 'complete',
    accessMode: 'restricted', reference: 'auth-group', ownerTeam: 'DFP Security',
    lastChecked: '1m ago', lastSuccessfulUse: '1m ago', failureCount: 0,
    approvalRequired: true, auditRequired: true,
    notes: 'Identity-critical. Auth and permission changes require security review.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-security', agentName: 'Security Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read auth events'], restrictedOperations: ['Change authentication', 'Modify permissions'], risk: 'critical', approvalRequired: true, status: 'connected' },
      { agentId: 'tf-auth', agentName: 'Authentication Agent', site: 'The Forge', accessMode: 'read_write', allowedOperations: ['Review auth flow'], restrictedOperations: ['Modify auth config'], risk: 'critical', approvalRequired: true, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform auth', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Guard auth', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care auth', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenant auth', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Guest auth', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Studio auth', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read auth events', 'Verify sessions'] },
      { riskClass: 'amber', operations: ['Reset approved session'] },
      { riskClass: 'red', operations: ['Change authentication', 'Modify permissions', 'Revoke access controls'] },
    ],
    permissions: [
      { operation: 'Read auth events', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Reset approved session', read: true, write: true, execute: true, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Change authentication', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
      { operation: 'Modify permissions', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '1m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '60ms', availability: '99.99%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'depends_on', status: 'operational', note: 'Auth backed by Supabase' },
    ],
    usageEvents: [
      { time: 'Today · 10:20', agentId: 'core-security', agentName: 'Security Agent', site: 'Group-wide', operation: 'Read auth events', runId: 'RUN-1A77F', result: 'success', duration: '2m 11s' },
      { time: 'Today · 09:30', agentId: 'tf-auth', agentName: 'Authentication Agent', site: 'The Forge', operation: 'Review auth flow', runId: 'RUN-1F44B', result: 'success', duration: '2m 05s' },
    ],
    security: { ...SECURITY_STANDARD, rotationStatus: 'Rotated 14d' },
  },

  // ============================================================ 11 — Knowledge Base
  {
    id: 'CON-KB',
    name: 'Knowledge Base',
    provider: 'Knowledge',
    category: 'knowledge_base',
    description: 'Curated support and operational knowledge used by support agents.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'low', configurationState: 'complete',
    accessMode: 'read', reference: 'kb-group', ownerTeam: 'DFP Core Team',
    lastChecked: '5m ago', lastSuccessfulUse: '8m ago', failureCount: 0,
    approvalRequired: false, auditRequired: false,
    notes: 'Read + recommend only; content edits are human-curated.',
    createdAt: '2025-05-01', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-knowledge', agentName: 'Knowledge Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Retrieve articles'], restrictedOperations: ['Publish article'], risk: 'low', approvalRequired: false, status: 'connected' },
      { agentId: 'core-support', agentName: 'Support Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Retrieve articles'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Support KB', status: 'connected', critical: false },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Guard KB', status: 'connected', critical: false },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care KB', status: 'connected', critical: false },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenancy KB', status: 'connected', critical: false },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding KB', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Retrieve articles', 'Recommend article'] },
      { riskClass: 'amber', operations: ['Draft article'] },
      { riskClass: 'red', operations: ['Publish article', 'Delete article'] },
    ],
    permissions: [
      { operation: 'Retrieve articles', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Draft article', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Publish article', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '5m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '40ms', availability: '99.9%', recommendedAction: 'None — healthy.' },
    dependencies: [],
    usageEvents: [
      { time: 'Today · 10:05', agentId: 'core-knowledge', agentName: 'Knowledge Agent', site: 'Group-wide', operation: 'Index new article', runId: 'RUN-0B88A', result: 'success', duration: '26s' },
      { time: 'Today · 09:41', agentId: 'core-support', agentName: 'Support Agent', site: 'Group-wide', operation: 'Retrieve article', runId: 'RUN-5E11B', result: 'success', duration: '41s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 12 — Site API
  {
    id: 'CON-SITE-API',
    name: 'Site API',
    provider: 'Site API',
    category: 'site_api',
    description: 'Internal platform APIs used by agents for read/write operational actions.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'high', configurationState: 'complete',
    accessMode: 'read_write', reference: 'site-api-group', ownerTeam: 'DFP Core Team',
    lastChecked: '2m ago', lastSuccessfulUse: '2m ago', failureCount: 0,
    approvalRequired: true, auditRequired: true,
    notes: 'Scoped per-site APIs; destructive actions require approval.',
    createdAt: '2025-02-01', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-support', agentName: 'Support Agent', site: 'Group-wide', accessMode: 'read_write', allowedOperations: ['Read ticket', 'Update non-critical record'], restrictedOperations: ['Delete records'], risk: 'medium', approvalRequired: true, status: 'connected' },
      { agentId: 'qg-match', agentName: 'Guard Matching Agent', site: 'QuickGuard', accessMode: 'read_write', allowedOperations: ['Produce match recommendation'], restrictedOperations: ['Confirm assignment'], risk: 'medium', approvalRequired: true, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform API', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Shift API', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Care API', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Tenancy API', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding API', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Build API', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read records', 'Read operational metadata'] },
      { riskClass: 'amber', operations: ['Update non-critical records', 'Retry failed job'] },
      { riskClass: 'red', operations: ['Delete production records', 'Change permissions'] },
    ],
    permissions: [
      { operation: 'Read records', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Update non-critical records', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Delete production records', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '2m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '70ms', availability: '99.9%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'depends_on', status: 'operational', note: 'API reads/writes via Supabase' },
    ],
    usageEvents: [
      { time: 'Today · 10:41', agentId: 'core-support', agentName: 'Support Agent', site: 'Group-wide', operation: 'Read ticket', runId: 'RUN-5E11B', result: 'success', duration: '41s' },
      { time: 'Today · 10:40', agentId: 'qg-match', agentName: 'Guard Matching Agent', site: 'QuickGuard', operation: 'Produce match recommendation', runId: 'RUN-8F21A', result: 'success', duration: '52s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 13 — Storage
  {
    id: 'CON-STORAGE',
    name: 'Storage',
    provider: 'Supabase Storage',
    category: 'storage',
    description: 'File and asset storage for uploads, evidence and media across platforms.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'medium', configurationState: 'complete',
    accessMode: 'read_write', reference: 'storage-group', ownerTeam: 'DFP Core Team',
    lastChecked: '3m ago', lastSuccessfulUse: '10m ago', failureCount: 0,
    approvalRequired: false, auditRequired: true,
    notes: 'Uploads constrained to safe buckets; no public secret storage.',
    createdAt: '2025-03-10', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'wd-photo', agentName: 'Photo Moderation Agent', site: 'Vowora', accessMode: 'read_write', allowedOperations: ['Read uploaded media'], restrictedOperations: ['—'], risk: 'medium', approvalRequired: false, status: 'connected' },
      { agentId: 'tf-asset', agentName: 'Asset Agent', site: 'The Forge', accessMode: 'read_write', allowedOperations: ['Store generated asset'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Client files', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Wedding media', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Generated assets', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read uploaded files', 'Store generated asset'] },
      { riskClass: 'amber', operations: ['Update non-critical asset'] },
      { riskClass: 'red', operations: ['Delete production files', 'Modify bucket policy'] },
    ],
    permissions: [
      { operation: 'Read uploaded files', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Store generated asset', read: true, write: true, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Delete production files', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '3m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '80ms', availability: '99.9%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'depends_on', status: 'operational', note: 'Storage backed by Supabase' },
    ],
    usageEvents: [
      { time: 'Today · 10:02', agentId: 'wd-photo', agentName: 'Photo Moderation Agent', site: 'Vowora', operation: 'Read uploaded media', runId: 'RUN-3E66A', result: 'success', duration: '32s' },
      { time: 'Today · 09:40', agentId: 'tf-asset', agentName: 'Asset Agent', site: 'The Forge', operation: 'Store generated asset', runId: 'RUN-3B66D', result: 'success', duration: '48s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 14 — Search
  {
    id: 'CON-SEARCH',
    name: 'Search',
    provider: 'Search',
    category: 'search',
    description: 'Full-text search index for records, articles and customers.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'degraded', criticality: 'medium', configurationState: 'partial',
    accessMode: 'read', reference: 'search-group', ownerTeam: 'DFP Core Team',
    lastChecked: '6m ago', lastSuccessfulUse: '2h ago', failureCount: 2,
    approvalRequired: false, auditRequired: false,
    notes: 'Index lag under investigation on GuardianHub customer search.',
    createdAt: '2025-06-01', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-support', agentName: 'Support Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Search records'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'degraded' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Customer search', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Customer search', status: 'degraded', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'Property search', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Search records', 'Read index status'] },
      { riskClass: 'amber', operations: ['Rebuild non-critical index'] },
      { riskClass: 'red', operations: ['Modify index schema', 'Drop production index'] },
    ],
    permissions: [
      { operation: 'Search records', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Rebuild non-critical index', read: true, write: true, execute: true, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Modify index schema', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'warning', lastSuccessfulCheck: '6m ago', lastFailure: '2h ago', failureSummary: 'GuardianHub customer search index lag.', responseTime: '400ms', availability: '99.5%', recommendedAction: 'Rebuild GuardianHub index after approval.' },
    dependencies: [
      { name: 'Supabase', connectionId: 'CON-SUPABASE', relationship: 'depends_on', status: 'degraded', note: 'Index over Supabase records' },
    ],
    usageEvents: [
      { time: 'Yesterday · 22:10', agentId: 'core-support', agentName: 'Support Agent', site: 'GuardianHub', operation: 'Search customer record', runId: 'RUN-5E11B', result: 'failed', duration: '41s' },
      { time: 'Yesterday · 18:02', agentId: 'core-support', agentName: 'Support Agent', site: 'Digital Footprint', operation: 'Search customer record', runId: 'RUN-5E11B', result: 'success', duration: '12s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 15 — Analytics
  {
    id: 'CON-ANALYTICS',
    name: 'Analytics',
    provider: 'Analytics',
    category: 'analytics',
    description: 'Product and operational analytics for reporting and insights.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'not_configured', criticality: 'medium', configurationState: 'missing',
    accessMode: 'read', reference: 'analytics-group', ownerTeam: 'DFP Core Team',
    lastChecked: '9m ago', lastSuccessfulUse: 'Never', failureCount: 0,
    approvalRequired: false, auditRequired: false,
    notes: 'Analytics pipeline not yet configured — awaiting ingestion setup.',
    createdAt: '2025-06-01', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'core-reporting', agentName: 'Reporting Agent', site: 'Group-wide', accessMode: 'read', allowedOperations: ['Read analytics'], restrictedOperations: ['—'], risk: 'low', approvalRequired: false, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform analytics', status: 'connected', critical: false },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'Shift analytics', status: 'connected', critical: false },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'Event analytics', status: 'connected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read analytics', 'Generate reports'] },
      { riskClass: 'amber', operations: ['Export analytics dataset'] },
      { riskClass: 'red', operations: ['Modify analytics pipeline'] },
    ],
    permissions: [
      { operation: 'Read analytics', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Export analytics dataset', read: true, write: false, execute: true, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Modify analytics pipeline', read: true, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'unknown', lastSuccessfulCheck: '—', lastFailure: '—', failureSummary: 'Not yet configured.', responseTime: '—', availability: '—', recommendedAction: 'Complete analytics ingestion setup.' },
    dependencies: [],
    usageEvents: [
      { time: 'Today · 09:58', agentId: 'core-reporting', agentName: 'Reporting Agent', site: 'Group-wide', operation: 'Compile daily report', runId: 'RUN-3F66C', result: 'success', duration: '44s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 16 — Hosting (Vercel)
  {
    id: 'CON-INFRA',
    name: 'Hosting (Vercel)',
    provider: 'Vercel',
    category: 'infrastructure',
    description: 'Production hosting and edge deployment for every group platform.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'connected', criticality: 'critical', configurationState: 'complete',
    accessMode: 'execute', reference: 'vercel-group', ownerTeam: 'DFP Core Team',
    lastChecked: '3m ago', lastSuccessfulUse: '3m ago', failureCount: 0,
    approvalRequired: true, auditRequired: true,
    notes: 'Production deploys gated behind release approval.',
    createdAt: '2025-01-14', updatedAt: '2026-08-25',
    agentAccess: [
      { agentId: 'tf-publishing', agentName: 'Publishing Agent', site: 'The Forge', accessMode: 'execute', allowedOperations: ['Trigger deploy'], restrictedOperations: ['Direct rollback'], risk: 'high', approvalRequired: true, status: 'connected' },
    ],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Platform hosting', status: 'connected', critical: true },
      { siteId: 'quickguard', siteName: 'QuickGuard', environment: 'production', purpose: 'App hosting', status: 'connected', critical: true },
      { siteId: 'guardianhub', siteName: 'GuardianHub', environment: 'production', purpose: 'Core hosting', status: 'connected', critical: true },
      { siteId: 'lethub', siteName: 'LetHub', environment: 'production', purpose: 'App hosting', status: 'connected', critical: true },
      { siteId: 'wedora', siteName: 'Vowora', environment: 'production', purpose: 'App hosting', status: 'connected', critical: true },
      { siteId: 'the-forge', siteName: 'The Forge', environment: 'production', purpose: 'Studio hosting', status: 'connected', critical: true },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read deployment status'] },
      { riskClass: 'amber', operations: ['Deploy to staging'] },
      { riskClass: 'red', operations: ['Deploy to production', 'Rollback production'] },
    ],
    permissions: [
      { operation: 'Read deployment status', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Deploy to staging', read: true, write: false, execute: true, admin: false, restricted: false, riskClass: 'amber' },
      { operation: 'Deploy to production', read: true, write: false, execute: true, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'healthy', lastSuccessfulCheck: '3m ago', lastFailure: '—', failureSummary: 'No recent failures.', responseTime: '180ms', availability: '99.99%', recommendedAction: 'None — healthy.' },
    dependencies: [
      { name: 'GitHub', connectionId: 'CON-GITHUB', relationship: 'depends_on', status: 'operational', note: 'Deploys from GitHub branches' },
    ],
    usageEvents: [
      { time: 'Yesterday · 15:30', agentId: 'tf-publishing', agentName: 'Publishing Agent', site: 'The Forge', operation: 'Deploy to staging', runId: 'RUN-9B33D', result: 'success', duration: '2m 30s' },
    ],
    security: SECURITY_STANDARD,
  },

  // ============================================================ 17 — Legacy Reporting (disconnected)
  {
    id: 'CON-LEGACY',
    name: 'Legacy Reporting Service',
    provider: 'Legacy Reporting',
    category: 'other',
    description: 'Deprecated legacy reporting pipeline retained in the registry for audit reference.',
    scope: 'Group-wide', siteId: null, environment: 'production',
    status: 'disconnected', criticality: 'low', configurationState: 'partial',
    accessMode: 'read', reference: 'legacy-reporting', ownerTeam: 'DFP Core Team',
    lastChecked: '2d ago', lastSuccessfulUse: '14d ago', failureCount: 3,
    approvalRequired: false, auditRequired: true,
    notes: 'Retired in favour of the Analytics connection. No agents currently use this service.',
    createdAt: '2024-09-01', updatedAt: '2026-08-01',
    agentAccess: [],
    siteUsage: [
      { siteId: 'digital-footprint', siteName: 'Digital Footprint', environment: 'production', purpose: 'Historical reports', status: 'disconnected', critical: false },
    ],
    operationGroups: [
      { riskClass: 'green', operations: ['Read historical report'] },
      { riskClass: 'red', operations: ['Modify retired pipeline'] },
    ],
    permissions: [
      { operation: 'Read historical report', read: true, write: false, execute: false, admin: false, restricted: false, riskClass: 'green' },
      { operation: 'Modify retired pipeline', read: false, write: true, execute: false, admin: true, restricted: true, riskClass: 'red' },
    ],
    health: { state: 'unknown', lastSuccessfulCheck: '2d ago', lastFailure: '14d ago', failureSummary: 'Service retired; connection removed.', responseTime: '—', availability: '—', recommendedAction: 'Confirm retirement and archive record.' },
    dependencies: [],
    usageEvents: [
      { time: '14d ago', agentId: 'core-reporting', agentName: 'Reporting Agent', site: 'Digital Footprint', operation: 'Read historical report', runId: 'RUN-3F66C', result: 'success', duration: '44s' },
    ],
    security: SECURITY_STANDARD,
  },
];
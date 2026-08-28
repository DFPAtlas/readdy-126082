// ============================================================================
// AI Operations — status → visual tone + label mappings.
//
// Centralises the presentation of status values so components stay consistent
// and future live data can reuse the same mapping.
// ============================================================================

import type {
  SiteAiStatus,
  AiStatus,
  Environment,
  BusinessType,
  Criticality,
  ConnectionStatus,
  CapabilityState,
  DependencyStatus,
  AgentStatus,
  ActivityStatus,
  RiskLevel,
  HealthStatus,
  AgentHealth,
  AgentType,
  AgentCategory,
  AgentAutonomy,
  ToolAccessMode,
  AccessLevel,
  RiskClass,
  RunStatus,
  RunPriority,
  TaskType,
  TriggerSource,
  RunStepStatus,
  ApprovalStatus,
  ApprovalDecisionType,
  RequestType,
  ApprovalExpiryState,
  GateState,
  Severity,
  ActivitySourceType,
  CapacityState,
  OrchestrationStatus,
  OrchestrationStage,
  OrchestrationStageState,
  PermissionGateState,
  ToolCategory,
  ToolConnectionStatus,
  ConnectionHealth,
  ConfigurationState,
  ProviderType,
  ModelStatus,
  ModelPurpose,
  CapabilitySupport,
  ModelRole,
  HostingType,
  KnowledgeSourceType,
  KnowledgeScope,
  KnowledgeSourceStatus,
  InformationClassification,
  ReviewState,
  MemoryType,
  PermissionState,
  QualityCheckState,
  PolicyCategory,
  PolicyStatus,
  PolicyEffect,
  EnforcementStage,
  PolicyLayerState,
  ExceptionStatus,
  EvaluationResult,
  AlertType,
  AlertStatus,
  EscalationLevel,
  RecurrenceState,
  AuditEventType,
  AuditOutcome,
  EvidenceType,
  EvidenceStatus,
  ActorType,
  BudgetStatus,
  BudgetScope,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationRuleStatus,
  AcknowledgementState,
  AutomationType,
  ScheduleStatus,
} from '@/pages/ai-operations/types';

export type StatusTone = 'emerald' | 'amber' | 'red' | 'accent' | 'secondary';

export interface StatusDisplay {
  tone: StatusTone;
  label: string;
}

export const SITE_STATUS: Record<SiteAiStatus, StatusDisplay> = {
  healthy: { tone: 'emerald', label: 'Healthy' },
  warning: { tone: 'amber', label: 'Warning' },
  critical: { tone: 'red', label: 'Critical' },
  offline: { tone: 'secondary', label: 'Offline' },
  maintenance: { tone: 'accent', label: 'Maintenance' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const AI_STATUS: Record<AiStatus, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  partial: { tone: 'amber', label: 'Partial' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  not_configured: { tone: 'secondary', label: 'Not Configured' },
  error: { tone: 'red', label: 'Error' },
};

export const CONNECTION_STATUS: Record<ConnectionStatus, StatusDisplay> = {
  connected: { tone: 'emerald', label: 'Connected' },
  degraded: { tone: 'amber', label: 'Degraded' },
  disconnected: { tone: 'red', label: 'Disconnected' },
  not_configured: { tone: 'secondary', label: 'Not Configured' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const CAPABILITY_STATE: Record<CapabilityState, StatusDisplay> = {
  enabled: { tone: 'emerald', label: 'Enabled' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  planned: { tone: 'accent', label: 'Planned' },
};

export const DEPENDENCY_STATUS: Record<DependencyStatus, StatusDisplay> = {
  operational: { tone: 'emerald', label: 'Operational' },
  degraded: { tone: 'amber', label: 'Degraded' },
  down: { tone: 'red', label: 'Down' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const AGENT_STATUS: Record<AgentStatus, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  idle: { tone: 'secondary', label: 'Idle' },
  working: { tone: 'accent', label: 'Working' },
  paused: { tone: 'amber', label: 'Paused' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  error: { tone: 'red', label: 'Error' },
  degraded: { tone: 'amber', label: 'Degraded' },
  not_configured: { tone: 'secondary', label: 'Not Configured' },
};

export const ACTIVITY_STATUS: Record<ActivityStatus, StatusDisplay> = {
  success: { tone: 'emerald', label: 'Success' },
  running: { tone: 'accent', label: 'Running' },
  failed: { tone: 'red', label: 'Failed' },
  queued: { tone: 'secondary', label: 'Queued' },
};

export const RISK_LEVEL: Record<RiskLevel, StatusDisplay> = {
  low: { tone: 'emerald', label: 'Low' },
  medium: { tone: 'amber', label: 'Medium' },
  high: { tone: 'red', label: 'High' },
  critical: { tone: 'red', label: 'Critical' },
};

export const HEALTH_STATUS: Record<HealthStatus, StatusDisplay> = {
  operational: { tone: 'emerald', label: 'Operational' },
  degraded: { tone: 'amber', label: 'Degraded' },
  offline: { tone: 'red', label: 'Offline' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

// --- Label-only maps (no tone required) ----------------------------------------

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  production: 'Production',
  staging: 'Staging',
  sandbox: 'Sandbox',
  development: 'Development',
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  platform: 'Platform',
  saas: 'SaaS',
  service: 'Service',
  website: 'Website',
  product: 'Product',
};

// --- Stable option orders for selects / filters --------------------------------

export const OPERATIONAL_STATUS_OPTIONS: SiteAiStatus[] = ['healthy', 'warning', 'critical', 'offline', 'maintenance', 'unknown'];

export const AI_STATUS_OPTIONS: AiStatus[] = ['active', 'partial', 'disabled', 'not_configured', 'error'];

export const ENVIRONMENT_OPTIONS: Environment[] = ['production', 'staging', 'sandbox', 'development'];

export const BUSINESS_TYPE_OPTIONS: BusinessType[] = ['platform', 'saas', 'service', 'website', 'product'];

export const CRITICALITY_OPTIONS: Criticality[] = ['low', 'medium', 'high', 'critical'];

// --- Central Agent Registry -----------------------------------------------------

export const AGENT_HEALTH: Record<AgentHealth, StatusDisplay> = {
  healthy: { tone: 'emerald', label: 'Healthy' },
  warning: { tone: 'amber', label: 'Warning' },
  critical: { tone: 'red', label: 'Critical' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  core: 'Core / Shared',
  site_specific: 'Site Specific',
};

export const AGENT_CATEGORY_LABELS: Record<AgentCategory, string> = {
  orchestration: 'Orchestration',
  support: 'Support',
  diagnostics: 'Diagnostics',
  security: 'Security',
  monitoring: 'Monitoring',
  data: 'Data',
  uat: 'UAT',
  repair: 'Repair',
  communications: 'Communications',
  billing: 'Billing',
  crm: 'CRM / Leads',
  compliance: 'Compliance',
  operations: 'Operations',
  matching: 'Matching',
  planning: 'Planning',
  testing: 'Testing',
  development: 'Development',
  reporting: 'Reporting',
  infrastructure: 'Infrastructure',
  other: 'Other',
};

export const AGENT_AUTONOMY_LABELS: Record<AgentAutonomy, string> = {
  observe_only: 'Observe Only',
  recommend_only: 'Recommend Only',
  limited_automatic: 'Limited Automatic',
  human_approval_required: 'Human Approval Required',
  autonomous: 'Autonomous',
};

export const ACCESS_MODE_LABELS: Record<ToolAccessMode, string> = {
  read: 'Read',
  write: 'Write',
  execute: 'Execute',
  read_write: 'Read + Write',
  restricted: 'Restricted',
};

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'None',
  read: 'Read',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  read_write: 'Read + Write',
  restricted: 'Restricted',
};

export const RISK_CLASS: Record<RiskClass, StatusDisplay> = {
  green: { tone: 'emerald', label: 'Green' },
  amber: { tone: 'amber', label: 'Amber' },
  red: { tone: 'red', label: 'Red' },
};

export const AGENT_STATUS_OPTIONS: AgentStatus[] = [
  'active',
  'idle',
  'working',
  'paused',
  'disabled',
  'error',
  'degraded',
  'not_configured',
];

export const AGENT_HEALTH_OPTIONS: AgentHealth[] = ['healthy', 'warning', 'critical', 'unknown'];

export const AGENT_TYPE_OPTIONS: AgentType[] = ['core', 'site_specific'];

export const AGENT_CATEGORY_OPTIONS: AgentCategory[] = [
  'orchestration',
  'support',
  'diagnostics',
  'security',
  'monitoring',
  'data',
  'uat',
  'repair',
  'communications',
  'billing',
  'crm',
  'compliance',
  'operations',
  'matching',
  'planning',
  'testing',
  'development',
  'reporting',
  'infrastructure',
  'other',
];

export const AGENT_AUTONOMY_OPTIONS: AgentAutonomy[] = [
  'observe_only',
  'recommend_only',
  'limited_automatic',
  'human_approval_required',
  'autonomous',
];

// --- Tasks & Runs ---------------------------------------------------------------

export const RUN_STATUS: Record<RunStatus, StatusDisplay> = {
  draft: { tone: 'secondary', label: 'Draft' },
  requested: { tone: 'secondary', label: 'Requested' },
  queued: { tone: 'secondary', label: 'Queued' },
  waiting: { tone: 'secondary', label: 'Waiting' },
  working: { tone: 'accent', label: 'Working' },
  awaiting_approval: { tone: 'amber', label: 'Awaiting Approval' },
  paused: { tone: 'amber', label: 'Paused' },
  completed: { tone: 'emerald', label: 'Completed' },
  partially_completed: { tone: 'amber', label: 'Partially Completed' },
  failed: { tone: 'red', label: 'Failed' },
  cancelled: { tone: 'secondary', label: 'Cancelled' },
  timed_out: { tone: 'amber', label: 'Timed Out' },
  blocked: { tone: 'red', label: 'Blocked' },
  retry_scheduled: { tone: 'amber', label: 'Retry Scheduled' },
};

export const RUN_PRIORITY: Record<RunPriority, StatusDisplay> = {
  low: { tone: 'emerald', label: 'Low' },
  normal: { tone: 'secondary', label: 'Normal' },
  high: { tone: 'amber', label: 'High' },
  urgent: { tone: 'red', label: 'Urgent' },
  critical: { tone: 'red', label: 'Critical' },
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  support: 'Support',
  diagnostics: 'Diagnostics',
  monitoring: 'Monitoring',
  security: 'Security',
  uat: 'UAT',
  repair_recommendation: 'Repair Recommendation',
  data_health: 'Data Health',
  communications: 'Communications',
  billing: 'Billing',
  lead_processing: 'Lead Processing',
  compliance: 'Compliance',
  matching: 'Matching',
  workflow: 'Workflow',
  reporting: 'Reporting',
  deployment: 'Deployment',
  backup: 'Backup',
  user_requested: 'User Requested',
  system: 'System',
  other: 'Other',
};

export const TRIGGER_SOURCE_LABELS: Record<TriggerSource, string> = {
  user: 'User',
  agent: 'Agent',
  scheduled: 'Scheduled',
  event: 'Event',
  support_ticket: 'Support Ticket',
  monitoring_alert: 'Monitoring Alert',
  api: 'API',
  n8n: 'n8n',
  system: 'System',
  approval: 'Approval',
  uat: 'UAT',
  manual: 'Manual',
};

export const RUN_STEP_STATUS: Record<RunStepStatus, StatusDisplay> = {
  pending: { tone: 'secondary', label: 'Pending' },
  working: { tone: 'accent', label: 'Working' },
  completed: { tone: 'emerald', label: 'Completed' },
  failed: { tone: 'red', label: 'Failed' },
  skipped: { tone: 'secondary', label: 'Skipped' },
  awaiting_approval: { tone: 'amber', label: 'Awaiting Approval' },
};

export const RUN_STATUS_OPTIONS: RunStatus[] = [
  'draft',
  'requested',
  'queued',
  'waiting',
  'working',
  'awaiting_approval',
  'paused',
  'completed',
  'partially_completed',
  'failed',
  'cancelled',
  'timed_out',
  'blocked',
  'retry_scheduled',
];

export const RUN_PRIORITY_OPTIONS: RunPriority[] = ['low', 'normal', 'high', 'urgent', 'critical'];

export const TASK_TYPE_OPTIONS: TaskType[] = [
  'support',
  'diagnostics',
  'monitoring',
  'security',
  'uat',
  'repair_recommendation',
  'data_health',
  'communications',
  'billing',
  'lead_processing',
  'compliance',
  'matching',
  'workflow',
  'reporting',
  'deployment',
  'backup',
  'user_requested',
  'system',
  'other',
];

export const TRIGGER_SOURCE_OPTIONS: TriggerSource[] = [
  'user',
  'agent',
  'scheduled',
  'event',
  'support_ticket',
  'monitoring_alert',
  'api',
  'n8n',
  'system',
  'approval',
  'uat',
  'manual',
];

// --- Human Approvals & Governance ----------------------------------------------

export const APPROVAL_STATUS: Record<ApprovalStatus, StatusDisplay> = {
  draft: { tone: 'secondary', label: 'Draft' },
  pending: { tone: 'amber', label: 'Pending' },
  under_review: { tone: 'accent', label: 'Under Review' },
  more_info_required: { tone: 'amber', label: 'More Information Required' },
  approved: { tone: 'emerald', label: 'Approved' },
  approved_with_conditions: { tone: 'accent', label: 'Approved With Conditions' },
  rejected: { tone: 'red', label: 'Rejected' },
  cancelled: { tone: 'secondary', label: 'Cancelled' },
  expired: { tone: 'secondary', label: 'Expired' },
  executing: { tone: 'accent', label: 'Executing' },
  verification_required: { tone: 'amber', label: 'Verification Required' },
  uat_required: { tone: 'amber', label: 'UAT Required' },
  completed: { tone: 'emerald', label: 'Completed' },
  failed: { tone: 'red', label: 'Failed' },
};

export const APPROVAL_DECISION_LABELS: Record<ApprovalDecisionType, string> = {
  approve: 'Approve',
  approve_with_conditions: 'Approve With Conditions',
  reject: 'Reject',
  request_changes: 'Request Changes',
  request_more_information: 'Request More Information',
  cancel: 'Cancel',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  support: 'Support',
  diagnostics: 'Diagnostics',
  repair: 'Repair Recommendation',
  security: 'Security',
  billing: 'Billing',
  deployment: 'Deployment',
  compliance: 'Compliance',
  uat: 'UAT',
  manual: 'Manual',
  other: 'Other',
};

export const EXPIRY_STATE: Record<ApprovalExpiryState, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  expiring_soon: { tone: 'amber', label: 'Expiring Soon' },
  expired: { tone: 'red', label: 'Expired' },
  no_expiry: { tone: 'secondary', label: 'No Expiry' },
};

export const GATE_STATE: Record<GateState, StatusDisplay> = {
  pass: { tone: 'emerald', label: 'Pass' },
  blocked: { tone: 'red', label: 'Blocked' },
  not_required: { tone: 'secondary', label: 'Not Required' },
};

export const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = [
  'draft',
  'pending',
  'under_review',
  'more_info_required',
  'approved',
  'approved_with_conditions',
  'rejected',
  'cancelled',
  'expired',
  'executing',
  'verification_required',
  'uat_required',
  'completed',
  'failed',
];

export const REQUEST_TYPE_OPTIONS: RequestType[] = [
  'support',
  'diagnostics',
  'repair',
  'security',
  'billing',
  'deployment',
  'compliance',
  'uat',
  'manual',
  'other',
];

export const EXPIRY_STATE_OPTIONS: ApprovalExpiryState[] = ['active', 'expiring_soon', 'expired', 'no_expiry'];

// --- Live Operations / Mission Control -----------------------------------------

export const SEVERITY: Record<Severity, StatusDisplay> = {
  info: { tone: 'secondary', label: 'Info' },
  low: { tone: 'emerald', label: 'Low' },
  medium: { tone: 'amber', label: 'Medium' },
  high: { tone: 'red', label: 'High' },
  critical: { tone: 'red', label: 'Critical' },
};

export const CAPACITY_STATE: Record<CapacityState, StatusDisplay> = {
  available: { tone: 'emerald', label: 'Available' },
  busy: { tone: 'accent', label: 'Busy' },
  high_load: { tone: 'amber', label: 'High Load' },
  at_capacity: { tone: 'red', label: 'At Capacity' },
  paused: { tone: 'amber', label: 'Paused' },
  offline: { tone: 'secondary', label: 'Offline' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const ACTIVITY_SOURCE_LABELS: Record<ActivitySourceType, string> = {
  agent: 'Agent',
  run: 'Run',
  approval: 'Approval',
  site: 'Site',
  monitoring: 'Monitoring',
  uat: 'UAT',
  system: 'System',
};

// --- Group Master Orchestrator --------------------------------------------------

export const ORCHESTRATION_STATUS: Record<OrchestrationStatus, StatusDisplay> = {
  received: { tone: 'secondary', label: 'Received' },
  analysing: { tone: 'accent', label: 'Analysing' },
  planning: { tone: 'accent', label: 'Planning' },
  selecting_agent: { tone: 'accent', label: 'Selecting Agent' },
  awaiting_capacity: { tone: 'amber', label: 'Awaiting Capacity' },
  routed: { tone: 'emerald', label: 'Routed' },
  executing: { tone: 'accent', label: 'Executing' },
  awaiting_approval: { tone: 'amber', label: 'Awaiting Approval' },
  verifying: { tone: 'accent', label: 'Verifying' },
  uat: { tone: 'accent', label: 'UAT' },
  completed: { tone: 'emerald', label: 'Completed' },
  failed: { tone: 'red', label: 'Failed' },
  blocked: { tone: 'red', label: 'Blocked' },
  escalated: { tone: 'amber', label: 'Escalated' },
  cancelled: { tone: 'secondary', label: 'Cancelled' },
};

export const ORCHESTRATION_STAGE: Record<OrchestrationStage, string> = {
  receive: 'Receive',
  classify: 'Classify',
  identify_site: 'Identify Site',
  assess_risk: 'Assess Risk',
  select_agent: 'Select Agent',
  plan: 'Plan',
  check_permissions: 'Check Permissions',
  approval_gate: 'Approval Gate',
  execute: 'Execute',
  verify: 'Verify',
  uat: 'UAT',
  audit: 'Audit',
  complete: 'Complete',
};

export const ORCHESTRATION_STAGE_STATE: Record<OrchestrationStageState, StatusDisplay> = {
  completed: { tone: 'emerald', label: 'Completed' },
  current: { tone: 'accent', label: 'Current' },
  blocked: { tone: 'red', label: 'Blocked' },
  not_required: { tone: 'secondary', label: 'Not Required' },
  pending: { tone: 'secondary', label: 'Pending' },
};

export const PERMISSION_GATE_STATE: Record<PermissionGateState, StatusDisplay> = {
  pass: { tone: 'emerald', label: 'Pass' },
  blocked: { tone: 'red', label: 'Blocked' },
  approval_required: { tone: 'amber', label: 'Approval Required' },
  not_required: { tone: 'secondary', label: 'Not Required' },
};

export const ORCHESTRATION_STATUS_OPTIONS: OrchestrationStatus[] = [
  'received',
  'analysing',
  'planning',
  'selecting_agent',
  'awaiting_capacity',
  'routed',
  'executing',
  'awaiting_approval',
  'verifying',
  'uat',
  'completed',
  'failed',
  'blocked',
  'escalated',
  'cancelled',
];

export const ORCHESTRATION_STAGE_OPTIONS: OrchestrationStage[] = [
  'receive',
  'classify',
  'identify_site',
  'assess_risk',
  'select_agent',
  'plan',
  'check_permissions',
  'approval_gate',
  'execute',
  'verify',
  'uat',
  'audit',
  'complete',
];

// --- Tools & Connections Registry ----------------------------------------------

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  database: 'Database',
  automation: 'Automation',
  ai_model: 'AI Model',
  email: 'Email',
  billing: 'Billing',
  repository: 'Repository',
  website_builder: 'Website Builder',
  site_api: 'Site API',
  authentication: 'Authentication',
  monitoring: 'Monitoring',
  notifications: 'Notifications',
  storage: 'Storage',
  knowledge_base: 'Knowledge Base',
  search: 'Search',
  analytics: 'Analytics',
  infrastructure: 'Infrastructure',
  other: 'Other',
};

export const TOOL_CONNECTION_STATUS: Record<ToolConnectionStatus, StatusDisplay> = {
  connected: { tone: 'emerald', label: 'Connected' },
  degraded: { tone: 'amber', label: 'Degraded' },
  disconnected: { tone: 'red', label: 'Disconnected' },
  not_configured: { tone: 'secondary', label: 'Not Configured' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  error: { tone: 'red', label: 'Error' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const CONNECTION_HEALTH: Record<ConnectionHealth, StatusDisplay> = {
  healthy: { tone: 'emerald', label: 'Healthy' },
  warning: { tone: 'amber', label: 'Warning' },
  critical: { tone: 'red', label: 'Critical' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const CONFIGURATION_STATE: Record<ConfigurationState, StatusDisplay> = {
  complete: { tone: 'emerald', label: 'Complete' },
  partial: { tone: 'amber', label: 'Partial' },
  missing: { tone: 'red', label: 'Missing' },
  invalid: { tone: 'red', label: 'Invalid' },
  not_required: { tone: 'secondary', label: 'Not Required' },
};

export const TOOL_CATEGORY_OPTIONS: ToolCategory[] = [
  'database',
  'automation',
  'ai_model',
  'email',
  'billing',
  'repository',
  'website_builder',
  'site_api',
  'authentication',
  'monitoring',
  'notifications',
  'storage',
  'knowledge_base',
  'search',
  'analytics',
  'infrastructure',
  'other',
];

export const TOOL_CONNECTION_STATUS_OPTIONS: ToolConnectionStatus[] = [
  'connected',
  'degraded',
  'disconnected',
  'not_configured',
  'disabled',
  'error',
  'unknown',
];

export const CONNECTION_HEALTH_OPTIONS: ConnectionHealth[] = ['healthy', 'warning', 'critical', 'unknown'];

export const CONFIGURATION_STATE_OPTIONS: ConfigurationState[] = ['complete', 'partial', 'missing', 'invalid', 'not_required'];

// --- Models & AI Providers Registry ----------------------------------------------

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  local: 'Local',
  cloud: 'Cloud',
  hybrid: 'Hybrid',
  internal: 'Internal',
};

export const MODEL_STATUS: Record<ModelStatus, StatusDisplay> = {
  available: { tone: 'emerald', label: 'Available' },
  degraded: { tone: 'amber', label: 'Degraded' },
  unavailable: { tone: 'red', label: 'Unavailable' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  not_configured: { tone: 'secondary', label: 'Not Configured' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const MODEL_PURPOSE_LABELS: Record<ModelPurpose, string> = {
  general: 'General',
  reasoning: 'Reasoning',
  coding: 'Coding',
  diagnostics: 'Diagnostics',
  support: 'Support',
  classification: 'Classification',
  planning: 'Planning',
  vision: 'Vision',
  document_analysis: 'Document Analysis',
  embeddings: 'Embeddings',
  summarisation: 'Summarisation',
  communications: 'Communications',
  testing: 'Testing',
  other: 'Other',
};

export const CAPABILITY_SUPPORT: Record<CapabilitySupport, StatusDisplay> = {
  supported: { tone: 'emerald', label: 'Supported' },
  unsupported: { tone: 'secondary', label: 'Unsupported' },
  unknown: { tone: 'amber', label: 'Unknown' },
};

export const MODEL_ROLE_LABELS: Record<ModelRole, string> = {
  primary: 'Primary',
  fallback: 'Fallback',
  specialist: 'Specialist',
  embedding: 'Embedding',
  vision: 'Vision',
  classification: 'Classification',
};

export const HOSTING_TYPE_LABELS: Record<HostingType, string> = {
  local: 'Local',
  cloud: 'Cloud',
};

export const PROVIDER_TYPE_OPTIONS: ProviderType[] = ['local', 'cloud', 'hybrid', 'internal'];

export const MODEL_STATUS_OPTIONS: ModelStatus[] = ['available', 'degraded', 'unavailable', 'disabled', 'not_configured', 'unknown'];

export const MODEL_PURPOSE_OPTIONS: ModelPurpose[] = [
  'general',
  'reasoning',
  'coding',
  'diagnostics',
  'support',
  'classification',
  'planning',
  'vision',
  'document_analysis',
  'embeddings',
  'summarisation',
  'communications',
  'testing',
  'other',
];

export const MODEL_ROLE_OPTIONS: ModelRole[] = ['primary', 'fallback', 'specialist', 'embedding', 'vision', 'classification'];

export const HOSTING_TYPE_OPTIONS: HostingType[] = ['local', 'cloud'];

// --- Knowledge & Memory Registry ----------------------------------------------

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  documentation: 'Documentation',
  sop: 'SOP',
  policy: 'Policy',
  faq: 'FAQ',
  support_knowledge: 'Support Knowledge',
  uat: 'UAT',
  technical: 'Technical',
  product: 'Product',
  incident_history: 'Incident History',
  troubleshooting: 'Troubleshooting',
  business_rules: 'Business Rules',
  training: 'Training',
  website_content: 'Website Content',
  database_reference: 'Database Reference',
  api_documentation: 'API Documentation',
  agent_instructions: 'Agent Instructions',
  other: 'Other',
};

export const KNOWLEDGE_SCOPE_LABELS: Record<KnowledgeScope, string> = {
  group: 'Group-wide',
  site: 'Site-specific',
  agent: 'Agent-specific',
  team: 'Team-specific',
};

export const KNOWLEDGE_STATUS: Record<KnowledgeSourceStatus, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  draft: { tone: 'secondary', label: 'Draft' },
  review_required: { tone: 'amber', label: 'Review Required' },
  stale: { tone: 'amber', label: 'Stale' },
  archived: { tone: 'secondary', label: 'Archived' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  restricted: { tone: 'red', label: 'Restricted' },
  error: { tone: 'red', label: 'Error' },
};

export const INFORMATION_CLASSIFICATION: Record<InformationClassification, StatusDisplay> = {
  public: { tone: 'emerald', label: 'Public' },
  internal: { tone: 'secondary', label: 'Internal' },
  confidential: { tone: 'amber', label: 'Confidential' },
  restricted: { tone: 'red', label: 'Restricted' },
};

export const REVIEW_STATE: Record<ReviewState, StatusDisplay> = {
  current: { tone: 'emerald', label: 'Current' },
  due_soon: { tone: 'amber', label: 'Due Soon' },
  overdue: { tone: 'red', label: 'Overdue' },
  not_required: { tone: 'secondary', label: 'Not Required' },
};

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  long_term: 'Long-Term Knowledge',
  operational: 'Operational Memory',
  session: 'Session Context',
  agent: 'Agent Memory',
};

export const PERMISSION_STATE: Record<PermissionState, StatusDisplay> = {
  allowed: { tone: 'emerald', label: 'Allowed' },
  restricted: { tone: 'amber', label: 'Restricted' },
  approval_required: { tone: 'accent', label: 'Approval Required' },
  denied: { tone: 'red', label: 'Denied' },
};

export const QUALITY_CHECK_STATE: Record<QualityCheckState, StatusDisplay> = {
  pass: { tone: 'emerald', label: 'Pass' },
  warning: { tone: 'amber', label: 'Warning' },
  fail: { tone: 'red', label: 'Fail' },
  unknown: { tone: 'secondary', label: 'Unknown' },
};

export const KNOWLEDGE_SOURCE_TYPE_OPTIONS: KnowledgeSourceType[] = [
  'documentation',
  'sop',
  'policy',
  'faq',
  'support_knowledge',
  'uat',
  'technical',
  'product',
  'incident_history',
  'troubleshooting',
  'business_rules',
  'training',
  'website_content',
  'database_reference',
  'api_documentation',
  'agent_instructions',
  'other',
];

export const KNOWLEDGE_SCOPE_OPTIONS: KnowledgeScope[] = ['group', 'site', 'agent', 'team'];

export const KNOWLEDGE_STATUS_OPTIONS: KnowledgeSourceStatus[] = [
  'active',
  'draft',
  'review_required',
  'stale',
  'archived',
  'disabled',
  'restricted',
  'error',
];

export const INFORMATION_CLASSIFICATION_OPTIONS: InformationClassification[] = ['public', 'internal', 'confidential', 'restricted'];

export const REVIEW_STATE_OPTIONS: ReviewState[] = ['current', 'due_soon', 'overdue', 'not_required'];

export const PERMISSION_STATE_OPTIONS: PermissionState[] = ['allowed', 'restricted', 'approval_required', 'denied'];

export const QUALITY_CHECK_STATE_OPTIONS: QualityCheckState[] = ['pass', 'warning', 'fail', 'unknown'];

// --- Security & Policy Engine ---------------------------------------------------

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  agent_access: 'Agent Access',
  data_access: 'Data Access',
  tool_access: 'Tool Access',
  model_usage: 'Model Usage',
  knowledge_access: 'Knowledge Access',
  action_permission: 'Action Permission',
  environment: 'Environment',
  approval: 'Approval',
  security: 'Security',
  privacy: 'Privacy',
  compliance: 'Compliance',
  cost: 'Cost',
  deployment: 'Deployment',
  audit: 'Audit',
  retention: 'Retention',
  other: 'Other',
};

export const POLICY_STATUS: Record<PolicyStatus, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  draft: { tone: 'secondary', label: 'Draft' },
  review_required: { tone: 'amber', label: 'Review Required' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  superseded: { tone: 'secondary', label: 'Superseded' },
  expired: { tone: 'secondary', label: 'Expired' },
};

export const POLICY_EFFECT: Record<PolicyEffect, StatusDisplay> = {
  allow: { tone: 'emerald', label: 'Allow' },
  allow_with_conditions: { tone: 'accent', label: 'Allow With Conditions' },
  require_approval: { tone: 'amber', label: 'Require Approval' },
  restrict: { tone: 'amber', label: 'Restrict' },
  deny: { tone: 'red', label: 'Deny' },
  audit_only: { tone: 'secondary', label: 'Audit Only' },
};

export const ENFORCEMENT_STAGE_LABELS: Record<EnforcementStage, string> = {
  pre_execution: 'Pre-Execution',
  execution_gate: 'Execution Gate',
  runtime: 'Runtime',
  audit: 'Audit',
};

export const POLICY_LAYER_STATE: Record<PolicyLayerState, StatusDisplay> = {
  pass: { tone: 'emerald', label: 'Pass' },
  warning: { tone: 'amber', label: 'Warning' },
  approval_required: { tone: 'accent', label: 'Approval Required' },
  blocked: { tone: 'red', label: 'Blocked' },
  not_required: { tone: 'secondary', label: 'Not Required' },
};

export const EXCEPTION_STATUS: Record<ExceptionStatus, StatusDisplay> = {
  pending: { tone: 'amber', label: 'Pending' },
  approved: { tone: 'emerald', label: 'Approved' },
  rejected: { tone: 'red', label: 'Rejected' },
  expired: { tone: 'secondary', label: 'Expired' },
  revoked: { tone: 'red', label: 'Revoked' },
};

export const EVALUATION_RESULT: Record<EvaluationResult, StatusDisplay> = {
  allow: { tone: 'emerald', label: 'Allow' },
  allow_with_conditions: { tone: 'accent', label: 'Allow With Conditions' },
  require_approval: { tone: 'amber', label: 'Approval Required' },
  restrict: { tone: 'amber', label: 'Restrict' },
  deny: { tone: 'red', label: 'Deny' },
};

export const POLICY_CATEGORY_OPTIONS: PolicyCategory[] = [
  'agent_access',
  'data_access',
  'tool_access',
  'model_usage',
  'knowledge_access',
  'action_permission',
  'environment',
  'approval',
  'security',
  'privacy',
  'compliance',
  'cost',
  'deployment',
  'audit',
  'retention',
  'other',
];

export const POLICY_STATUS_OPTIONS: PolicyStatus[] = ['active', 'draft', 'review_required', 'disabled', 'superseded', 'expired'];

export const POLICY_EFFECT_OPTIONS: PolicyEffect[] = ['allow', 'allow_with_conditions', 'require_approval', 'restrict', 'deny', 'audit_only'];

export const ENFORCEMENT_STAGE_OPTIONS: EnforcementStage[] = ['pre_execution', 'execution_gate', 'runtime', 'audit'];

export const EXCEPTION_STATUS_OPTIONS: ExceptionStatus[] = ['pending', 'approved', 'rejected', 'expired', 'revoked'];

// --- Alerts & Incident Operations ---------------------------------------------

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  site_health: 'Site Health',
  agent_failure: 'Agent Failure',
  run_failure: 'Run Failure',
  orchestration: 'Orchestration',
  tool_connection: 'Tool / Connection',
  model_provider: 'Model Provider',
  security: 'Security',
  policy_violation: 'Policy Violation',
  approval: 'Approval',
  uat: 'UAT',
  monitoring: 'Monitoring',
  data_health: 'Data Health',
  billing: 'Billing',
  integration: 'Integration',
  other: 'Other',
};

export const ALERT_STATUS: Record<AlertStatus, StatusDisplay> = {
  new: { tone: 'accent', label: 'New' },
  acknowledged: { tone: 'secondary', label: 'Acknowledged' },
  investigating: { tone: 'amber', label: 'Investigating' },
  waiting: { tone: 'secondary', label: 'Waiting' },
  awaiting_approval: { tone: 'amber', label: 'Awaiting Approval' },
  escalated: { tone: 'red', label: 'Escalated' },
  monitoring: { tone: 'accent', label: 'Monitoring' },
  resolved: { tone: 'emerald', label: 'Resolved' },
  closed: { tone: 'secondary', label: 'Closed' },
  suppressed: { tone: 'secondary', label: 'Suppressed' },
};

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevel, string> = {
  team_review: 'Team Review',
  technical_escalation: 'Technical Escalation',
  security_escalation: 'Security Escalation',
  management_escalation: 'Management Escalation',
  critical_incident: 'Critical Incident',
};

export const RECURRENCE_STATE: Record<RecurrenceState, StatusDisplay> = {
  new: { tone: 'accent', label: 'New' },
  repeating: { tone: 'amber', label: 'Repeating' },
  increasing: { tone: 'red', label: 'Increasing' },
  stable: { tone: 'emerald', label: 'Stable' },
  resolved_pattern: { tone: 'secondary', label: 'Resolved Pattern' },
};

export const ALERT_TYPE_OPTIONS: AlertType[] = [
  'site_health',
  'agent_failure',
  'run_failure',
  'orchestration',
  'tool_connection',
  'model_provider',
  'security',
  'policy_violation',
  'approval',
  'uat',
  'monitoring',
  'data_health',
  'billing',
  'integration',
  'other',
];

export const ALERT_STATUS_OPTIONS: AlertStatus[] = [
  'new',
  'acknowledged',
  'investigating',
  'waiting',
  'awaiting_approval',
  'escalated',
  'monitoring',
  'resolved',
  'closed',
  'suppressed',
];

export const ESCALATION_LEVEL_OPTIONS: EscalationLevel[] = [
  'team_review',
  'technical_escalation',
  'security_escalation',
  'management_escalation',
  'critical_incident',
];

export const RECURRENCE_STATE_OPTIONS: RecurrenceState[] = ['new', 'repeating', 'increasing', 'stable', 'resolved_pattern'];

// --- Audit & Evidence Trail ---------------------------------------------------

export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  agent_action: 'Agent Action',
  run_event: 'Run Event',
  orchestration_decision: 'Orchestration Decision',
  approval_decision: 'Approval Decision',
  policy_evaluation: 'Policy Evaluation',
  policy_violation: 'Policy Violation',
  tool_access: 'Tool Access',
  model_use: 'Model Use',
  knowledge_access: 'Knowledge Access',
  alert_incident: 'Alert / Incident',
  uat_result: 'UAT Result',
  verification: 'Verification',
  configuration_change: 'Configuration Change',
  human_override: 'Human Override',
  security_event: 'Security Event',
  other: 'Other',
};

export const AUDIT_OUTCOME: Record<AuditOutcome, StatusDisplay> = {
  success: { tone: 'emerald', label: 'Success' },
  failed: { tone: 'red', label: 'Failed' },
  blocked: { tone: 'red', label: 'Blocked' },
  approved: { tone: 'emerald', label: 'Approved' },
  rejected: { tone: 'red', label: 'Rejected' },
  warning: { tone: 'amber', label: 'Warning' },
  partial: { tone: 'amber', label: 'Partial' },
  informational: { tone: 'secondary', label: 'Informational' },
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  diagnostic: 'Diagnostic',
  verification: 'Verification',
  uat: 'UAT',
  approval: 'Approval',
  incident: 'Incident',
  monitoring: 'Monitoring',
  report: 'Report',
  screenshot_reference: 'Screenshot Reference',
  configuration_snapshot: 'Configuration Snapshot',
  other: 'Other',
};

export const EVIDENCE_STATUS: Record<EvidenceStatus, StatusDisplay> = {
  available: { tone: 'emerald', label: 'Available' },
  missing: { tone: 'red', label: 'Missing' },
  pending: { tone: 'amber', label: 'Pending' },
  invalid: { tone: 'red', label: 'Invalid' },
  expired: { tone: 'secondary', label: 'Expired' },
  not_required: { tone: 'secondary', label: 'Not Required' },
};

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  agent: 'Agent',
  human: 'Human',
  system: 'System',
  orchestrator: 'Orchestrator',
};

export const AUDIT_EVENT_TYPE_OPTIONS: AuditEventType[] = [
  'agent_action',
  'run_event',
  'orchestration_decision',
  'approval_decision',
  'policy_evaluation',
  'policy_violation',
  'tool_access',
  'model_use',
  'knowledge_access',
  'alert_incident',
  'uat_result',
  'verification',
  'configuration_change',
  'human_override',
  'security_event',
  'other',
];

export const AUDIT_OUTCOME_OPTIONS: AuditOutcome[] = [
  'success',
  'failed',
  'blocked',
  'approved',
  'rejected',
  'warning',
  'partial',
  'informational',
];

export const EVIDENCE_TYPE_OPTIONS: EvidenceType[] = [
  'diagnostic',
  'verification',
  'uat',
  'approval',
  'incident',
  'monitoring',
  'report',
  'screenshot_reference',
  'configuration_snapshot',
  'other',
];

export const EVIDENCE_STATUS_OPTIONS: EvidenceStatus[] = ['available', 'missing', 'pending', 'invalid', 'expired', 'not_required'];

// --- Cost, Usage & Budgets ----------------------------------------------------

export const BUDGET_STATUS: Record<BudgetStatus, StatusDisplay> = {
  healthy: { tone: 'emerald', label: 'Healthy' },
  warning: { tone: 'amber', label: 'Warning' },
  critical: { tone: 'red', label: 'Critical' },
  exceeded: { tone: 'red', label: 'Exceeded' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  not_configured: { tone: 'secondary', label: 'Not Configured' },
};

export const BUDGET_SCOPE_LABELS: Record<BudgetScope, string> = {
  group: 'Group-wide',
  site: 'Site',
  agent: 'Agent',
  model: 'Model',
  provider: 'Provider',
  environment: 'Environment',
};

export const BUDGET_STATUS_OPTIONS: BudgetStatus[] = ['healthy', 'warning', 'critical', 'exceeded', 'disabled', 'not_configured'];

export const BUDGET_SCOPE_OPTIONS: BudgetScope[] = ['group', 'site', 'agent', 'model', 'provider', 'environment'];

export const COST_DIMENSIONS: string[] = [
  'Group',
  'Site',
  'Agent',
  'Model',
  'Provider',
  'Run',
  'Orchestration',
  'Tool',
  'Task Type',
  'Environment',
];

// --- Notifications & Escalations ---------------------------------------------

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  dfp_command: 'DFP Command',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  webhook: 'Webhook',
  phone: 'Phone / Call',
  other: 'Other',
};

export const NOTIFICATION_PRIORITY: Record<NotificationPriority, StatusDisplay> = {
  informational: { tone: 'secondary', label: 'Informational' },
  normal: { tone: 'secondary', label: 'Normal' },
  high: { tone: 'amber', label: 'High' },
  urgent: { tone: 'red', label: 'Urgent' },
  critical: { tone: 'red', label: 'Critical' },
};

export const NOTIFICATION_STATUS: Record<NotificationStatus, StatusDisplay> = {
  queued: { tone: 'secondary', label: 'Queued' },
  sent: { tone: 'accent', label: 'Sent' },
  delivered: { tone: 'emerald', label: 'Delivered' },
  acknowledged: { tone: 'emerald', label: 'Acknowledged' },
  failed: { tone: 'red', label: 'Failed' },
  escalated: { tone: 'red', label: 'Escalated' },
  suppressed: { tone: 'secondary', label: 'Suppressed' },
  expired: { tone: 'secondary', label: 'Expired' },
  cancelled: { tone: 'secondary', label: 'Cancelled' },
};

export const NOTIFICATION_RULE_STATUS: Record<NotificationRuleStatus, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  draft: { tone: 'secondary', label: 'Draft' },
  review_required: { tone: 'amber', label: 'Review Required' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  expired: { tone: 'secondary', label: 'Expired' },
};

export const ACKNOWLEDGEMENT_STATE: Record<AcknowledgementState, StatusDisplay> = {
  not_required: { tone: 'secondary', label: 'Not Required' },
  awaiting: { tone: 'amber', label: 'Awaiting' },
  acknowledged: { tone: 'emerald', label: 'Acknowledged' },
  missed: { tone: 'red', label: 'Missed' },
  expired: { tone: 'secondary', label: 'Expired' },
};

export const NOTIFICATION_CHANNEL_OPTIONS: NotificationChannel[] = [
  'dfp_command',
  'email',
  'sms',
  'push',
  'slack',
  'teams',
  'webhook',
  'phone',
  'other',
];

export const NOTIFICATION_PRIORITY_OPTIONS: NotificationPriority[] = [
  'informational',
  'normal',
  'high',
  'urgent',
  'critical',
];

export const NOTIFICATION_STATUS_OPTIONS: NotificationStatus[] = [
  'queued',
  'sent',
  'delivered',
  'acknowledged',
  'failed',
  'escalated',
  'suppressed',
  'expired',
  'cancelled',
];

export const NOTIFICATION_RULE_STATUS_OPTIONS: NotificationRuleStatus[] = [
  'active',
  'draft',
  'review_required',
  'disabled',
  'expired',
];

export const ACKNOWLEDGEMENT_STATE_OPTIONS: AcknowledgementState[] = [
  'not_required',
  'awaiting',
  'acknowledged',
  'missed',
  'expired',
];

export const ESCALATION_ENGINE_LEVELS = [
  { level: 0, label: 'Initial Notification' },
  { level: 1, label: 'Team Escalation' },
  { level: 2, label: 'Technical / Security Escalation' },
  { level: 3, label: 'Management Escalation' },
  { level: 4, label: 'Critical Incident' },
];

// --- Scheduling & Automation ---------------------------------------------------

export const AUTOMATION_TYPE_LABELS: Record<AutomationType, string> = {
  scheduled: 'Scheduled',
  recurring: 'Recurring',
  one_time: 'One-Time',
  event_triggered: 'Event Triggered',
  condition_triggered: 'Condition Triggered',
  manual: 'Manual',
  maintenance: 'Maintenance',
};

export const SCHEDULE_STATUS: Record<ScheduleStatus, StatusDisplay> = {
  active: { tone: 'emerald', label: 'Active' },
  paused: { tone: 'amber', label: 'Paused' },
  draft: { tone: 'secondary', label: 'Draft' },
  running: { tone: 'accent', label: 'Running' },
  failed: { tone: 'red', label: 'Failed' },
  disabled: { tone: 'secondary', label: 'Disabled' },
  review_required: { tone: 'amber', label: 'Review Required' },
  expired: { tone: 'secondary', label: 'Expired' },
};

export const AUTOMATION_TYPE_OPTIONS: AutomationType[] = [
  'scheduled',
  'recurring',
  'one_time',
  'event_triggered',
  'condition_triggered',
  'manual',
  'maintenance',
];

export const SCHEDULE_STATUS_OPTIONS: ScheduleStatus[] = [
  'active',
  'paused',
  'draft',
  'running',
  'failed',
  'disabled',
  'review_required',
  'expired',
];
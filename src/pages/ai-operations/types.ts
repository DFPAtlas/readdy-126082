// ============================================================================
// AI Operations — shared type definitions.
//
// These interfaces describe the shape of the data the Overview dashboard and
// the Group Site Registry render. All values are currently supplied by
// demo/placeholder data (see src/mocks/ai-operations.ts and
// src/mocks/ai-operations-sites.ts) and will be replaced by live data in
// later prompts without changing the component structure.
// ============================================================================

// --- Status / enum-like unions -------------------------------------------------

export type SiteAiStatus = 'healthy' | 'warning' | 'critical' | 'offline' | 'maintenance' | 'unknown';

export type AiStatus = 'active' | 'partial' | 'disabled' | 'not_configured' | 'error';

export type Environment = 'production' | 'staging' | 'sandbox' | 'development';

export type BusinessType = 'platform' | 'saas' | 'service' | 'website' | 'product';

export type Criticality = 'low' | 'medium' | 'high' | 'critical';

export type ConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'not_configured' | 'unknown';

export type CapabilityState = 'enabled' | 'disabled' | 'planned';

export type DependencyStatus = 'operational' | 'degraded' | 'down' | 'unknown';

export type AgentStatus = 'active' | 'idle' | 'working' | 'paused' | 'disabled' | 'error' | 'degraded' | 'not_configured';

export type ActivityStatus = 'success' | 'running' | 'failed' | 'queued';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type HealthStatus = 'operational' | 'degraded' | 'offline' | 'unknown';

// --- Central Agent Registry -----------------------------------------------------

export type AgentHealth = 'healthy' | 'warning' | 'critical' | 'unknown';

export type AgentType = 'core' | 'site_specific';

export type AgentCategory =
  | 'orchestration'
  | 'support'
  | 'diagnostics'
  | 'security'
  | 'monitoring'
  | 'data'
  | 'uat'
  | 'repair'
  | 'communications'
  | 'billing'
  | 'crm'
  | 'compliance'
  | 'operations'
  | 'matching'
  | 'planning'
  | 'testing'
  | 'development'
  | 'reporting'
  | 'infrastructure'
  | 'other';

export type AgentAutonomy = 'observe_only' | 'recommend_only' | 'limited_automatic' | 'human_approval_required' | 'autonomous';

export type ToolAccessMode = 'read' | 'write' | 'execute' | 'read_write' | 'restricted';

export type AccessLevel = 'none' | 'read' | 'create' | 'update' | 'delete' | 'read_write' | 'restricted';

export type RiskClass = 'green' | 'amber' | 'red';

export interface AgentModelConfiguration {
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider: string;
  fallbackModel: string;
  purpose: string;
  configStatus: string;
  promptRef: string;
  lastConfigUpdate: string;
}

export interface AgentTool {
  name: string;
  type: string;
  accessMode: ToolAccessMode;
  status: ConnectionStatus;
  environment: Environment;
  scope: string;
  lastChecked: string;
}

export interface AgentDataPermission {
  resource: string;
  scope: string;
  accessLevel: AccessLevel;
  environment: Environment;
  reason: string;
  approvalRequired: boolean;
}

export interface AgentActionPermission {
  action: string;
  riskClass: RiskClass;
  allowed: boolean;
  humanApprovalRequired: boolean;
  notes: string;
}

export interface AgentApprovalPolicy {
  approvalRequired: boolean;
  minApprovers: number;
  approvalTeam: string;
  maxPermittedRisk: RiskLevel;
  autoExpiry: string;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
}

export interface AgentDependency {
  name: string;
  status: DependencyStatus;
  critical: boolean;
  lastChecked: string;
}

export interface AgentRunSummary {
  id: string;
  started: string;
  duration: string;
  task: string;
  status: ActivityStatus;
  risk: RiskLevel;
  estimatedCost: string;
  resultSummary: string;
}

export interface AgentEvent {
  timestamp: string;
  event: string;
  actor: string;
  summary: string;
}

export interface AgentRegistryRecord {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  category: AgentCategory;
  /** Site id for site-specific agents, or null for group-wide core/shared agents. */
  assignedSite: string | null;
  /** Human-readable scope label, e.g. "Group-wide" or a site name. */
  scope: string;
  environment: Environment;
  status: AgentStatus;
  health: AgentHealth;
  risk: RiskLevel;
  autonomy: AgentAutonomy;
  currentTask: string;
  currentRunId: string;
  queueCount: number;
  lastRun: string;
  lastSuccessfulRun: string;
  successRate: string;
  jobsToday: number;
  failedJobsToday: number;
  avgRunDuration: string;
  avgEstimatedCost: string;
  ownerTeam: string;
  escalationTeam: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  model: AgentModelConfiguration;
  tools: AgentTool[];
  dataPermissions: AgentDataPermission[];
  actionPermissions: AgentActionPermission[];
  approvalPolicy: AgentApprovalPolicy;
  dependencies: AgentDependency[];
  runs: AgentRunSummary[];
  events: AgentEvent[];
}

// --- Overview dashboard --------------------------------------------------------

export interface KpiMetric {
  key: string;
  label: string;
  value: string | number;
  icon: string;
  /** Full tailwind classes for the icon bubble (tinted background + text). */
  accent: string;
}

export interface SiteAiStatusRow {
  id: string;
  name: string;
  status: SiteAiStatus;
  activeAgents: number;
  currentJobs: number;
  failedJobs: number;
  alerts: number;
  lastActivity: string;
}

export interface AgentActivity {
  id: string;
  time: string;
  site: string;
  agent: string;
  action: string;
  status: ActivityStatus;
  runId: string;
}

export interface ApprovalRequest {
  id: string;
  site: string;
  agent: string;
  action: string;
  risk: RiskLevel;
  dateTime: string;
}

export interface SystemHealthRow {
  key: string;
  label: string;
  status: HealthStatus;
  detail?: string;
}

export interface OrchestratorStatus {
  status: HealthStatus;
  activeJobs: number;
  queue: number;
  successRate: string;
  lastRun: string;
}

// --- Group Site Registry -------------------------------------------------------

export interface SiteConnection {
  /** Provider name, e.g. Supabase, n8n, GitHub, Readdy, Stripe, Resend. */
  provider: string;
  /** Safe reference/identifier only — never a credential. */
  reference: string;
  status: ConnectionStatus;
  environment: Environment;
  lastChecked: string;
  configurationState: string;
}

export interface SiteCapability {
  key: string;
  label: string;
  state: CapabilityState;
}

export interface SiteDependency {
  name: string;
  type: string;
  status: DependencyStatus;
  critical: boolean;
  lastChecked: string;
}

export interface SiteOwnership {
  businessOwner: string;
  technicalOwner: string;
  supportTeam: string;
  escalationTeam: string;
  defaultSeverity: string;
  supportQueue: string;
}

export interface SiteAgentSummary {
  id: string;
  name: string;
  category: string;
  status: AgentStatus;
  risk: RiskLevel;
  currentTask: string;
  lastRun: string;
  successRate: string;
}

export interface SiteRegistryRecord {
  id: string;
  name: string;
  productName: string;
  domain: string;
  description: string;
  businessType: BusinessType;
  environment: Environment;
  operationalStatus: SiteAiStatus;
  aiStatus: AiStatus;
  criticality: Criticality;
  ownerTeam: string;
  repository: string;
  readdyProject: string;
  supabaseProject: string;
  n8nConnection: string;
  billingProvider: string;
  emailProvider: string;
  authProvider: string;
  hosting: string;
  lastHealthCheck: string;
  lastAgentActivity: string;
  activeAgentCount: number;
  currentJobs: number;
  failedJobs: number;
  pendingApprovals: number;
  openAlerts: number;
  openTickets: number;
  uatStatus: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  connections: SiteConnection[];
  capabilities: SiteCapability[];
  dependencies: SiteDependency[];
  ownership: SiteOwnership;
  agents: SiteAgentSummary[];
}

// --- Tasks & Runs ---------------------------------------------------------------

export type RunStatus =
  | 'draft'
  | 'requested'
  | 'queued'
  | 'waiting'
  | 'working'
  | 'awaiting_approval'
  | 'paused'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'blocked'
  | 'retry_scheduled';

export type RunPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export type TaskType =
  | 'support'
  | 'diagnostics'
  | 'monitoring'
  | 'security'
  | 'uat'
  | 'repair_recommendation'
  | 'data_health'
  | 'communications'
  | 'billing'
  | 'lead_processing'
  | 'compliance'
  | 'matching'
  | 'workflow'
  | 'reporting'
  | 'deployment'
  | 'backup'
  | 'user_requested'
  | 'system'
  | 'other';

export type TriggerSource =
  | 'user'
  | 'agent'
  | 'scheduled'
  | 'event'
  | 'support_ticket'
  | 'monitoring_alert'
  | 'api'
  | 'n8n'
  | 'system'
  | 'approval'
  | 'uat'
  | 'manual';

export type RunStepStatus = 'pending' | 'working' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval';

export interface RunStep {
  stepNumber: number;
  name: string;
  agent: string;
  status: RunStepStatus;
  started: string;
  finished: string;
  duration: string;
  inputSummary: string;
  outputSummary: string;
  errorSummary?: string;
  risk: RiskLevel;
  approvalRequired: boolean;
}

export interface RunChainNode {
  agent: string;
  status: ActivityStatus;
  runId: string;
  duration: string;
  outcome: string;
}

export interface RunInputSummary {
  type: string;
  source: string;
  summary: string;
  dataClassification: string;
  size: string;
  timestamp: string;
}

export interface RunResultSummary {
  outcome: string;
  summary: string;
  recordsAffected: string;
  confidence?: string;
  artifactRef?: string;
  nextAction: string;
}

export interface RunFailure {
  errorType: string;
  errorCode: string;
  summary: string;
  failedStep: string;
  retryable: boolean;
  retryCount: number;
  recommendedAction: string;
  escalationRequired: boolean;
}

export interface RunRetryPolicy {
  retryAllowed: boolean;
  retryCount: number;
  maxAttempts: number;
  nextRetry: string;
  retryReason: string;
  backoffStrategy: string;
  requiresApproval: boolean;
}

export interface RunCost {
  model: string;
  provider: string;
  estimatedTokens: string;
  estimatedCost: string;
  actualCost: string;
  toolCost: string;
  totalEstimatedCost: string;
}

export interface RunApprovalLink {
  approvalRequired: boolean;
  approvalId: string | null;
  approvalState: string;
  requestedTime: string;
  risk: RiskLevel;
  approverTeam: string;
}

export interface RunUatLink {
  uatRequired: boolean;
  uatStatus: string;
  testPlanRef: string;
  testsPassed: number;
  testsFailed: number;
}

export interface RunAuditMetadata {
  auditRequired: boolean;
  auditStatus: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  completionEvidence: boolean;
  verificationEvidence: boolean;
}

export interface AiTaskRun {
  id: string;
  parentTaskId: string | null;
  parentRunId: string | null;
  rootRunId: string | null;
  correlationId: string;
  taskName: string;
  taskDescription: string;
  taskType: TaskType;
  requestedBy: string;
  triggerSource: TriggerSource;
  /** 'group' for core/shared work, otherwise a site id. */
  siteId: string;
  /** Display name, e.g. "Group-wide" or a site name. */
  siteName: string;
  agentId: string;
  agentName: string;
  environment: Environment;
  status: RunStatus;
  priority: RunPriority;
  risk: RiskLevel;
  autonomy: AgentAutonomy;
  queuePosition: number | null;
  startedTime: string;
  completedTime: string;
  duration: string;
  createdTime: string;
  updatedTime: string;
  attempts: number;
  maxAttempts: number;
  retryCount: number;
  estimatedCost: string;
  actualCost: string;
  model: string;
  provider: string;
  inputSummary: string;
  resultSummary: string;
  errorSummary: string;
  approvalRequired: boolean;
  approvalId: string | null;
  uatRequired: boolean;
  verificationRequired: boolean;
  auditRequired: boolean;
  currentStep: number;
  totalSteps: number;
  tags: string[];
  notes: string;
  steps: RunStep[];
  chain: RunChainNode[];
  input: RunInputSummary;
  result: RunResultSummary;
  failure: RunFailure | null;
  retry: RunRetryPolicy;
  cost: RunCost;
  approval: RunApprovalLink;
  uat: RunUatLink;
  audit: RunAuditMetadata;
}

// --- Human Approvals & Governance ----------------------------------------------

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'approved_with_conditions'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'executing'
  | 'verification_required'
  | 'uat_required'
  | 'completed'
  | 'failed';

export type ApprovalDecisionType =
  | 'approve'
  | 'approve_with_conditions'
  | 'reject'
  | 'request_changes'
  | 'request_more_information'
  | 'cancel';

export type RequestType =
  | 'support'
  | 'diagnostics'
  | 'repair'
  | 'security'
  | 'billing'
  | 'deployment'
  | 'compliance'
  | 'uat'
  | 'manual'
  | 'other';

export type ApprovalExpiryState = 'active' | 'expiring_soon' | 'expired' | 'no_expiry';

export type GateState = 'pass' | 'blocked' | 'not_required';

export interface ApprovalRecommendation {
  recommendation: string;
  confidence: string;
  reasoningSummary: string;
  expectedOutcome: string;
  alternativeConsidered: string;
  whyApprovalRequired: string;
  riskIfApproved: string;
  riskIfRejected: string;
  riskIfDelayed: string;
}

export interface ApprovalEvidence {
  type: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  referenceId: string;
  confidence: string;
}

export interface ApprovalImpact {
  systemsAffected: string;
  sitesAffected: string;
  usersAffected: string;
  recordsAffected: string;
  serviceInterruptionExpected: boolean;
  estimatedDowntime: string;
  customerImpact: string;
  financialImpact: string;
  securityImpact: string;
  complianceImpact: string;
  reversibility: string;
}

export interface ApprovalRollbackPlan {
  available: boolean;
  method: string;
  estimatedTime: string;
  backupRef: string;
  owner: string;
  validation: string;
}

export interface ApprovalRequirement {
  requiredTeam: string;
  requiredRole: string;
  minApprovers: number;
  currentApprovals: number;
  maxPermittedRisk: RiskLevel;
  separationOfDutiesRequired: boolean;
  expiry: string;
  uatRequired: boolean;
  verificationRequired: boolean;
  auditRequired: boolean;
}

export interface ApprovalSeparationOfDuties {
  requestingAgent: string;
  recommendingAgent: string;
  approverTeam: string;
  executingAgent: string;
  verifyingAgent: string;
  uatAgent: string;
}

export interface ApprovalHistoryEvent {
  timestamp: string;
  actor: string;
  action: string;
  comment: string;
  previousStatus: string;
  newStatus: string;
}

export interface ExecutionGateCheck {
  name: string;
  state: GateState;
  note: string;
}

export interface ApprovalDecision {
  type: ApprovalDecisionType | null;
  reason: string;
  timestamp: string;
  actor: string;
  conditions: string;
}

export interface AiApproval {
  id: string;
  title: string;
  description: string;
  /** 'group' for core/shared work, otherwise a site id. */
  siteId: string;
  siteName: string;
  agentId: string;
  agentName: string;
  runId: string | null;
  parentRunId: string | null;
  taskId: string | null;
  requestType: RequestType;
  requestedAction: string;
  actionCategory: string;
  riskClass: RiskClass;
  severity: RiskLevel;
  environment: Environment;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  approvalTeam: string;
  requiredRole: string;
  minApprovers: number;
  approvalCount: number;
  expiryTime: string;
  expiryState: ApprovalExpiryState;
  businessJustification: string;
  aiReasoning: string;
  evidenceSummary: string;
  expectedResult: string;
  potentialImpact: string;
  affectedSystems: string[];
  affectedRecords: string;
  rollbackAvailable: boolean;
  rollbackSummary: string;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
  decision: ApprovalDecision;
  notes: string;
  createdAt: string;
  updatedAt: string;
  recommendation: ApprovalRecommendation;
  evidence: ApprovalEvidence[];
  impact: ApprovalImpact;
  rollback: ApprovalRollbackPlan;
  requirement: ApprovalRequirement;
  separation: ApprovalSeparationOfDuties;
  history: ApprovalHistoryEvent[];
  executionGate: ExecutionGateCheck[];
}

// --- Live Operations / Mission Control -----------------------------------------

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type ActivitySourceType = 'agent' | 'run' | 'approval' | 'site' | 'monitoring' | 'uat' | 'system';

export type CapacityState = 'available' | 'busy' | 'high_load' | 'at_capacity' | 'paused' | 'offline';

export interface LiveActivityEvent {
  id: string;
  timestamp: string;
  site: string;
  sourceType: ActivitySourceType;
  actor: string;
  event: string;
  status: string;
  severity: Severity;
  referenceType: 'agent' | 'run' | 'approval' | 'site' | null;
  referenceId: string | null;
}

export interface OperationsAlert {
  id: string;
  site: string;
  siteName: string;
  source: string;
  message: string;
  severity: Severity;
  detectedAt: string;
  state: string;
  recommendedAction: string;
  referenceType: 'agent' | 'run' | 'approval' | 'site' | null;
  referenceId: string | null;
}

export interface AgentWorkload {
  agentId: string;
  agentName: string;
  site: string;
  activeTasks: number;
  queueSize: number;
  jobsToday: number;
  successRate: string;
  avgDuration: string;
  status: AgentStatus;
  capacity: CapacityState;
}

export interface SiteWorkload {
  siteId: string;
  siteName: string;
  activeAgents: number;
  jobsToday: number;
  running: number;
  queued: number;
  failed: number;
  approvals: number;
  alerts: number;
  estimatedCostToday: string;
}

export interface ProviderHealth {
  provider: string;
  status: HealthStatus;
  activeRequests: number;
  failedRequests: number;
  avgResponseTime: string;
  estimatedCostToday: string;
  lastActivity: string;
}

export interface MissionControlItem {
  siteId: string;
  siteName: string;
  agentId: string;
  agentName: string;
  task: string;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  risk: RiskLevel;
  runId: string;
}

export interface MultiAgentWorkflow {
  id: string;
  title: string;
  site: string;
  status: ActivityStatus;
  chain: RunChainNode[];
}

export interface SiteHealthCard {
  id: string;
  name: string;
  operationalStatus: SiteAiStatus;
  aiStatus: AiStatus;
  activeAgents: number;
  activeRuns: number;
  queuedRuns: number;
  failedRuns: number;
  pendingApprovals: number;
  alerts: number;
  lastActivity: string;
}

export interface LiveOrchestratorStatus {
  status: HealthStatus;
  activeTasks: number;
  queueDepth: number;
  tasksRoutedToday: number;
  failedRoutingAttempts: number;
  avgRoutingTime: string;
  workflowCount: number;
  lastRoutingEvent: string;
}

// --- Group Master Orchestrator --------------------------------------------------

export type OrchestrationStatus =
  | 'received'
  | 'analysing'
  | 'planning'
  | 'selecting_agent'
  | 'awaiting_capacity'
  | 'routed'
  | 'executing'
  | 'awaiting_approval'
  | 'verifying'
  | 'uat'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'escalated'
  | 'cancelled';

export type OrchestrationStage =
  | 'receive'
  | 'classify'
  | 'identify_site'
  | 'assess_risk'
  | 'select_agent'
  | 'plan'
  | 'check_permissions'
  | 'approval_gate'
  | 'execute'
  | 'verify'
  | 'uat'
  | 'audit'
  | 'complete';

export type OrchestrationStageState = 'completed' | 'current' | 'blocked' | 'not_required' | 'pending';

export type PermissionGateState = 'pass' | 'blocked' | 'approval_required' | 'not_required';

export interface AgentCandidate {
  agentId: string;
  agentName: string;
  eligibility: string;
  score: number;
  health: AgentHealth;
  capacity: CapacityState;
  capabilityMatch: string;
  permissionMatch: string;
  reason: string;
  selected: boolean;
}

export interface ExecutionPlanStep {
  number: number;
  agentId: string;
  agentName: string;
  action: string;
  tool: string;
  risk: RiskLevel;
  approvalRequired: boolean;
  status: RunStepStatus;
  runId: string | null;
}

export interface PermissionGateCheck {
  name: string;
  state: PermissionGateState;
  note: string;
}

export interface FailureStrategy {
  policy: string;
  failedStep: string;
  retryCount: number;
  fallback: string;
  nextAction: string;
}

export interface RequiredTool {
  tool: string;
  agentId: string;
  agentName: string;
  accessMode: ToolAccessMode;
  status: ConnectionStatus;
  scope: string;
  environment: Environment;
  critical: boolean;
}

export interface OrchestrationClassification {
  requestSummary: string;
  trigger: TriggerSource;
  detectedIntent: string;
  detectedSite: string;
  confidence: string;
  taskType: TaskType;
  priority: RunPriority;
  risk: RiskLevel;
  environment: Environment;
}

export interface OrchestrationSiteResolution {
  selectedSite: string;
  confidence: string;
  alternatives: string[];
  operationalStatus: SiteAiStatus;
  aiStatus: AiStatus;
  capabilityMatch: string;
}

export interface OrchestrationAgentSelection {
  name: string;
  scope: string;
  category: AgentCategory;
  status: AgentStatus;
  health: AgentHealth;
  autonomy: AgentAutonomy;
  workload: string;
  queue: number;
  capabilityMatch: string;
  permissionMatch: string;
  tools: string[];
  selectionScore: number;
  selectionReason: string;
}

export interface OrchestrationRiskAssessment {
  overallRisk: RiskLevel;
  riskClass: RiskClass;
  dataImpact: string;
  customerImpact: string;
  financialImpact: string;
  securityImpact: string;
  complianceImpact: string;
  reversibility: string;
  approvalRequired: boolean;
}

export interface OrchestrationApprovalGate {
  approvalId: string | null;
  status: ApprovalStatus;
  risk: RiskLevel;
  requiredTeam: string;
  minApprovers: number;
  currentApprovals: number;
  expiry: string;
  blocking: boolean;
}

export interface OrchestrationCapacity {
  primaryAgent: string;
  capacity: CapacityState;
  activeTasks: number;
  queue: number;
  availability: string;
  fallbackAgent: string;
  fallbackReason: string;
  estimatedWait: string;
}

export interface OrchestrationVerification {
  required: boolean;
  agent: string;
  checks: string;
  expectedOutcome: string;
  evidence: string;
}

export interface OrchestrationUat {
  required: boolean;
  agent: string;
  testRef: string;
  tests: number;
  requiredPassState: string;
  status: string;
}

export interface OrchestrationAudit {
  required: boolean;
  runRefs: string[];
  approvalRef: string;
  evidenceRequired: string;
  completionRequired: boolean;
}

export interface OrchestratorEvent {
  timestamp: string;
  event: string;
  actor: string;
  summary: string;
}

export interface AiOrchestration {
  id: string;
  correlationId: string;
  title: string;
  description: string;
  triggerSource: TriggerSource;
  requestedBy: string;
  /** 'group' for core/shared work, otherwise a site id. */
  siteId: string;
  siteName: string;
  detectedIntent: string;
  taskType: TaskType;
  priority: RunPriority;
  risk: RiskLevel;
  riskClass: RiskClass;
  environment: Environment;
  status: OrchestrationStatus;
  currentStage: OrchestrationStage;
  primaryAgentId: string;
  primaryAgentName: string;
  supportingAgentIds: string[];
  candidateAgentIds: string[];
  rootRunId: string | null;
  approvalId: string | null;
  approvalRequired: boolean;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
  estimatedCost: string;
  resultSummary: string;
  failureSummary: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt: string;
  stages: { stage: OrchestrationStage; state: OrchestrationStageState }[];
  classification: OrchestrationClassification;
  siteResolution: OrchestrationSiteResolution;
  agentSelection: OrchestrationAgentSelection;
  candidates: AgentCandidate[];
  plan: ExecutionPlanStep[];
  workflow: RunChainNode[];
  permissionGate: PermissionGateCheck[];
  riskAssessment: OrchestrationRiskAssessment;
  approvalGate: OrchestrationApprovalGate;
  capacity: OrchestrationCapacity;
  failureStrategy: FailureStrategy;
  tools: RequiredTool[];
  verification: OrchestrationVerification;
  uat: OrchestrationUat;
  audit: OrchestrationAudit;
  events: OrchestratorEvent[];
}

export interface RoutingSimulationResult {
  detectedSite: string;
  recommendedAgentId: string;
  recommendedAgentName: string;
  candidates: AgentCandidate[];
  approvalRequired: boolean;
  workflow: string[];
  tools: string[];
  estimatedCost: string;
}

// --- Tools & Connections Registry ----------------------------------------------

export type ToolCategory =
  | 'database'
  | 'automation'
  | 'ai_model'
  | 'email'
  | 'billing'
  | 'repository'
  | 'website_builder'
  | 'site_api'
  | 'authentication'
  | 'monitoring'
  | 'notifications'
  | 'storage'
  | 'knowledge_base'
  | 'search'
  | 'analytics'
  | 'infrastructure'
  | 'other';

export type ToolConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'not_configured' | 'disabled' | 'error' | 'unknown';

export type ConnectionHealth = 'healthy' | 'warning' | 'critical' | 'unknown';

export type ConfigurationState = 'complete' | 'partial' | 'missing' | 'invalid' | 'not_required';

export interface ToolAgentAccess {
  agentId: string;
  agentName: string;
  site: string;
  accessMode: ToolAccessMode;
  allowedOperations: string[];
  restrictedOperations: string[];
  risk: RiskLevel;
  approvalRequired: boolean;
  status: ToolConnectionStatus;
}

export interface ToolSiteUsage {
  siteId: string;
  siteName: string;
  environment: Environment;
  purpose: string;
  status: ConnectionStatus;
  critical: boolean;
}

export interface ToolOperationGroup {
  riskClass: RiskClass;
  operations: string[];
}

export interface ToolOperationPermission {
  operation: string;
  read: boolean;
  write: boolean;
  execute: boolean;
  admin: boolean;
  restricted: boolean;
  riskClass: RiskClass;
}

export interface ToolHealthDiagnostics {
  state: ConnectionHealth;
  lastSuccessfulCheck: string;
  lastFailure: string;
  failureSummary: string;
  responseTime: string;
  availability: string;
  recommendedAction: string;
}

export interface ToolDependency {
  name: string;
  connectionId: string | null;
  relationship: 'depends_on' | 'required_by';
  status: DependencyStatus;
  note: string;
}

export interface ToolUsageEvent {
  time: string;
  agentId: string;
  agentName: string;
  site: string;
  operation: string;
  runId: string | null;
  result: ActivityStatus;
  duration: string;
}

export interface ToolSecurityControls {
  credentialsExternal: boolean;
  secretsHiddenFromAgents: boolean;
  environmentIsolation: boolean;
  leastPrivilege: boolean;
  approvalForHighRisk: boolean;
  auditEnabled: boolean;
  rotationStatus: string;
  lastSecurityReview: string;
}

export interface ToolConnection {
  id: string;
  name: string;
  provider: string;
  category: ToolCategory;
  description: string;
  scope: string;
  siteId: string | null;
  environment: Environment;
  status: ToolConnectionStatus;
  criticality: Criticality;
  configurationState: ConfigurationState;
  accessMode: ToolAccessMode;
  reference: string;
  /** Safe credential-reference label only — the value is never stored/displayed. */
  authenticationType?: string;
  allowedOperations?: string[];
  restrictedOperations?: string[];
  ownerTeam: string;
  lastChecked: string;
  lastSuccessfulUse: string;
  failureCount: number;
  approvalRequired: boolean;
  auditRequired: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  agentAccess: ToolAgentAccess[];
  siteUsage: ToolSiteUsage[];
  operationGroups: ToolOperationGroup[];
  permissions: ToolOperationPermission[];
  health: ToolHealthDiagnostics;
  dependencies: ToolDependency[];
  usageEvents: ToolUsageEvent[];
  security: ToolSecurityControls;
}

// --- Models & AI Providers Registry ---------------------------------------------

export type ProviderType = 'local' | 'cloud' | 'hybrid' | 'internal';

export type ModelStatus = 'available' | 'degraded' | 'unavailable' | 'disabled' | 'not_configured' | 'unknown';

export type ModelPurpose =
  | 'general'
  | 'reasoning'
  | 'coding'
  | 'diagnostics'
  | 'support'
  | 'classification'
  | 'planning'
  | 'vision'
  | 'document_analysis'
  | 'embeddings'
  | 'summarisation'
  | 'communications'
  | 'testing'
  | 'other';

export type CapabilitySupport = 'supported' | 'unsupported' | 'unknown';

export type HostingType = 'local' | 'cloud';

export type ModelRole = 'primary' | 'fallback' | 'specialist' | 'embedding' | 'vision' | 'classification';

export interface ModelCapabilitySet {
  text: CapabilitySupport;
  reasoning: CapabilitySupport;
  coding: CapabilitySupport;
  vision: CapabilitySupport;
  tools: CapabilitySupport;
  structuredOutput: CapabilitySupport;
  embeddings: CapabilitySupport;
  longContext: CapabilitySupport;
}

export interface ModelLimits {
  contextWindow: string;
  maxOutput: string;
  rate: string;
  concurrency: string;
  localResource: string | null;
}

export interface ModelAssignment {
  agentId: string;
  agentName: string;
  site: string;
  category: string;
  role: ModelRole;
  status: AgentStatus;
}

export interface ModelFallbackPolicy {
  primaryModelId: string | null;
  primaryModel: string;
  fallbackModelId: string | null;
  fallbackModel: string;
  trigger: string;
  providerChange: boolean;
  costChange: string;
  capabilityDifference: string;
}

export interface ModelUsageMetrics {
  jobsToday: number;
  estimatedInputTokens: string;
  estimatedOutputTokens: string;
  estimatedProviderCost: string;
  localComputeEstimate: string;
  avgCostPerRun: string;
  avgResponseTime: string;
  failureRate: string;
}

export interface ModelUsageEvent {
  time: string;
  agentId: string;
  agentName: string;
  site: string;
  runId: string | null;
  task: string;
  result: ActivityStatus;
  duration: string;
  estimatedCost: string;
}

export interface ModelHealth {
  status: ModelStatus;
  lastChecked: string;
  responseHealth: string;
  capacityState: CapacityState;
  recentFailures: number;
  failureSummary: string;
  recommendedAction: string;
}

export interface ModelSecurityControls {
  localProcessingAvailable: boolean;
  externalProviderInvolved: boolean;
  credentialsHidden: boolean;
  environmentSeparation: boolean;
  sensitiveDataRestricted: boolean;
  approvalForRestricted: boolean;
  loggingPolicyRef: string;
}

export interface LocalModelMeta {
  hostRef: string;
  runtime: string;
  modelName: string;
  loaded: boolean;
  capacity: string;
  queue: number;
  estimatedMemory: string;
  availability: string;
}

export interface AiModel {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  description: string;
  family: string;
  purpose: ModelPurpose;
  hostingLocation: string;
  environment: Environment;
  status: ModelStatus;
  health: ConnectionHealth;
  enabled: boolean;
  hostingType: HostingType;
  contextWindow: string;
  maxOutput: string;
  visionSupport: boolean;
  toolSupport: boolean;
  structuredOutputSupport: boolean;
  embeddingSupport: boolean;
  speed: string;
  quality: string;
  cost: string;
  inputCost: string;
  outputCost: string;
  localComputeCost: string;
  jobsToday: number;
  failuresToday: number;
  avgResponseTime: string;
  fallbackModelId: string | null;
  fallbackModel: string;
  configurationState: ConfigurationState;
  lastChecked: string;
  notes: string;
  /** Live registry metadata — model risk classification (from ai_operations_models). */
  riskLevel?: RiskLevel;
  /** Live registry metadata — data/residency policy label. */
  dataPolicy?: string;
  capabilities: ModelCapabilitySet;
  limits: ModelLimits;
  fallback: ModelFallbackPolicy;
  usage: ModelUsageMetrics;
  usageEvents: ModelUsageEvent[];
  healthMeta: ModelHealth;
  security: ModelSecurityControls;
  localMeta: LocalModelMeta | null;
}

export interface AiProvider {
  id: string;
  name: string;
  type: ProviderType;
  status: ModelStatus;
  description: string;
  availableModels: string;
  activeRequests: number;
  failures: number;
  avgResponseTime: string;
  estimatedCostToday: string;
  lastActivity: string;
  connectionId: string | null;
  /** Live registry metadata — safe credential-reference label only. */
  credentialReference?: string;
  /** Live registry metadata — safe endpoint-reference label only. */
  endpointReference?: string;
  /** Live registry metadata — owner team label. */
  ownerTeam?: string;
  isActive?: boolean;
}

export interface ModelRoutingPolicy {
  rank: number;
  criterion: string;
  description: string;
  priority: 'security' | 'capability' | 'governance' | 'operational' | 'cost';
}

// --- Knowledge & Memory Registry ----------------------------------------------

export type KnowledgeSourceType =
  | 'documentation'
  | 'sop'
  | 'policy'
  | 'faq'
  | 'support_knowledge'
  | 'uat'
  | 'technical'
  | 'product'
  | 'incident_history'
  | 'troubleshooting'
  | 'business_rules'
  | 'training'
  | 'website_content'
  | 'database_reference'
  | 'api_documentation'
  | 'agent_instructions'
  | 'other';

export type KnowledgeScope = 'group' | 'site' | 'agent' | 'team';

export type KnowledgeSourceStatus =
  | 'active'
  | 'draft'
  | 'review_required'
  | 'stale'
  | 'archived'
  | 'disabled'
  | 'restricted'
  | 'error';

export type InformationClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export type ReviewState = 'current' | 'due_soon' | 'overdue' | 'not_required';

export type MemoryType = 'long_term' | 'operational' | 'session' | 'agent';

export type PermissionState = 'allowed' | 'restricted' | 'approval_required' | 'denied';

export type QualityCheckState = 'pass' | 'warning' | 'fail' | 'unknown';

export type AccessState = 'allowed' | 'restricted' | 'approval_required' | 'denied';

export interface KnowledgePermission {
  permission: string;
  state: PermissionState;
  note: string;
}

export interface KnowledgeAgentAccess {
  agentId: string;
  agentName: string;
  site: string;
  accessState: AccessState;
  purpose: string;
  retrievalAllowed: boolean;
  summarisationAllowed: boolean;
  modificationAllowed: boolean;
  approvalRequired: boolean;
}

export interface KnowledgeRelationship {
  relationType: string;
  title: string;
  sourceId: string | null;
}

export interface KnowledgeUsageEvent {
  time: string;
  agentId: string;
  agentName: string;
  site: string;
  runId: string | null;
  purpose: string;
  result: ActivityStatus;
  reference: string;
}

export interface KnowledgeReviewEvent {
  date: string;
  actor: string;
  action: string;
  version: string;
  summary: string;
  statusChange: string;
}

export interface KnowledgeQualityCheck {
  name: string;
  state: QualityCheckState;
  note: string;
}

export interface KnowledgeGovernance {
  trustedSource: boolean;
  owner: string;
  reviewRequired: boolean;
  reviewFrequency: string;
  lastReviewer: string;
  versionControl: string;
  expiryDate: string;
  auditRequired: boolean;
}

export interface IncidentMemory {
  incidentId: string;
  site: string;
  problem: string;
  rootCauseSummary: string;
  resolution: string;
  verificationResult: string;
  uatResult: string;
  relatedRunId: string | null;
  dateResolved: string;
}

export interface KnowledgeIndexMetadata {
  vectorReady: boolean;
  indexed: boolean;
  indexProvider: string;
  embeddingModelId: string | null;
  embeddingModel: string;
  lastIndexed: string;
  chunkCount: number;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  description: string;
  type: KnowledgeSourceType;
  scope: KnowledgeScope;
  /** Site id for site-specific knowledge, otherwise null for group-wide. */
  siteId: string | null;
  /** Human-readable scope label, e.g. "Group-wide" or a site name. */
  siteName: string;
  assignedAgentIds: string[];
  ownerTeam: string;
  status: KnowledgeSourceStatus;
  classification: InformationClassification;
  sensitivity: string;
  version: string;
  reference: string;
  contentFormat: string;
  reviewState: ReviewState;
  lastReviewed: string;
  nextReview: string;
  createdAt: string;
  updatedAt: string;
  trustedSource: boolean;
  aiUsageAllowed: boolean;
  retrievalAllowed: boolean;
  summarisationAllowed: boolean;
  modificationAllowed: boolean;
  vectorReady: boolean;
  indexingState: string;
  notes: string;
  keywords: string[];
  tags: string[];
  topics: string[];
  permissions: KnowledgePermission[];
  agentAccess: KnowledgeAgentAccess[];
  governance: KnowledgeGovernance;
  aiUsageRules: string[];
  relationships: KnowledgeRelationship[];
  usageEvents: KnowledgeUsageEvent[];
  reviewHistory: KnowledgeReviewEvent[];
  quality: KnowledgeQualityCheck[];
  index: KnowledgeIndexMetadata;
  incidentMemory: IncidentMemory | null;
}

// --- Security & Policy Engine ---------------------------------------------------

export type PolicyCategory =
  | 'agent_access'
  | 'data_access'
  | 'tool_access'
  | 'model_usage'
  | 'knowledge_access'
  | 'action_permission'
  | 'environment'
  | 'approval'
  | 'security'
  | 'privacy'
  | 'compliance'
  | 'cost'
  | 'deployment'
  | 'audit'
  | 'retention'
  | 'other';

export type PolicyStatus = 'active' | 'draft' | 'review_required' | 'disabled' | 'superseded' | 'expired';

export type PolicyEffect = 'allow' | 'allow_with_conditions' | 'require_approval' | 'restrict' | 'deny' | 'audit_only';

export type EnforcementStage = 'pre_execution' | 'execution_gate' | 'runtime' | 'audit';

export type PolicyLayerState = 'pass' | 'warning' | 'approval_required' | 'blocked' | 'not_required';

export type ExceptionStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';

export type EvaluationResult = 'allow' | 'allow_with_conditions' | 'require_approval' | 'restrict' | 'deny';

export interface PolicyCondition {
  when: string;
  then: string;
}

export interface PolicyTarget {
  type: 'site' | 'agent' | 'tool' | 'model' | 'knowledge' | 'environment' | 'risk_class';
  id: string;
  label: string;
}

export interface PolicyDecision {
  result: EvaluationResult;
  explanation: string;
}

export interface PolicyException {
  id: string;
  reason: string;
  scope: string;
  requestedByTeam: string;
  approvedByTeam: string;
  start: string;
  expiry: string;
  status: ExceptionStatus;
}

export interface PolicyHistoryEvent {
  timestamp: string;
  version: string;
  actor: string;
  change: string;
  previousStatus: string;
  newStatus: string;
}

export interface PolicyViolation {
  id: string;
  time: string;
  siteId: string;
  siteName: string;
  agentId: string;
  agentName: string;
  policyId: string;
  policyName: string;
  attemptedAction: string;
  severity: RiskLevel;
  result: string;
  relatedRunId: string | null;
  status: string;
}

export interface PolicyEvaluation {
  matchedPolicies: string[];
  result: EvaluationResult;
  approvalRequired: boolean;
  blockingPolicies: string[];
  requiredControls: string[];
  auditRequired: boolean;
}

export interface AiSecurityPolicy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  status: PolicyStatus;
  effect: PolicyEffect;
  priority: RiskLevel;
  scope: string;
  siteId: string | null;
  siteName: string;
  agentIds: string[];
  toolIds: string[];
  modelIds: string[];
  knowledgeIds: string[];
  environment: Environment;
  riskClass: RiskClass;
  actionType: string;
  approvalRequired: boolean;
  minApprovers: number;
  enforcementStage: EnforcementStage;
  exceptionAllowed: boolean;
  auditRequired: boolean;
  ownerTeam: string;
  version: string;
  effectiveDate: string;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  conditions: PolicyCondition[];
  decision: PolicyDecision;
  exceptions: PolicyException[];
  history: PolicyHistoryEvent[];
}

// --- Alerts & Incident Operations ----------------------------------------------

export type AlertType =
  | 'site_health'
  | 'agent_failure'
  | 'run_failure'
  | 'orchestration'
  | 'tool_connection'
  | 'model_provider'
  | 'security'
  | 'policy_violation'
  | 'approval'
  | 'uat'
  | 'monitoring'
  | 'data_health'
  | 'billing'
  | 'integration'
  | 'other';

export type AlertStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'waiting'
  | 'awaiting_approval'
  | 'escalated'
  | 'monitoring'
  | 'resolved'
  | 'closed'
  | 'suppressed';

export type EscalationLevel =
  | 'team_review'
  | 'technical_escalation'
  | 'security_escalation'
  | 'management_escalation'
  | 'critical_incident';

export type RecurrenceState = 'new' | 'repeating' | 'increasing' | 'stable' | 'resolved_pattern';

export interface IncidentTimelineEvent {
  timestamp: string;
  actor: string;
  event: string;
  summary: string;
}

export interface IncidentImpact {
  usersAffected: string;
  sitesAffected: string;
  serviceImpact: string;
  financialImpact: string;
  securityImpact: string;
  complianceImpact: string;
  customerImpact: string;
}

export interface IncidentResolution {
  status: string;
  summary: string;
  rootCause: string;
  fixReference: string;
  verificationResult: string;
  uatResult: string;
  closedByTeam: string;
  closedAt: string;
}

export interface IncidentEscalation {
  level: EscalationLevel;
  assignedTeam: string;
  reason: string;
  escalatedAt: string;
  nextEscalation: string;
}

export interface IncidentRecurrence {
  recurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
  relatedIncidentIds: string[];
  knownIssueRef: string;
  trendState: RecurrenceState;
}

export interface AlertSourceHealth {
  source: string;
  status: HealthStatus;
  alertsToday: number;
  lastAlert: string;
}

export interface AlertDiagnostics {
  suspectedCause: string;
  affectedComponent: string;
  relatedFailures: string;
  confidence: string;
  knownIssueMatch: string;
  recommendedInvestigation: string;
}

export interface AlertKnownIssue {
  knowledgeId: string | null;
  note: string;
  previousRootCause: string;
  previousResolution: string;
  previousVerification: string;
}

export interface AlertGovernance {
  policyId: string | null;
  policyName: string;
  risk: RiskClass;
  approvalRequired: boolean;
  minApprovers: number;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
}

export interface AiAlert {
  id: string;
  incidentId: string;
  title: string;
  description: string;
  type: AlertType;
  severity: Severity;
  status: AlertStatus;
  /** 'group' for group-wide, otherwise a site id. */
  siteId: string;
  siteName: string;
  agentId: string | null;
  agentName: string;
  runId: string | null;
  orchestrationId: string | null;
  approvalId: string | null;
  toolId: string | null;
  modelId: string | null;
  policyId: string | null;
  knowledgeId: string | null;
  triggerSource: string;
  detectedAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  assignedTeam: string;
  escalationTeam: string;
  impact: string;
  affectedService: string;
  repeating: boolean;
  suggestedAction: string;
  resolutionSummary: string;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
  tags: string[];
  notes: string;
  timeline: IncidentTimelineEvent[];
  diagnostics: AlertDiagnostics;
  knownIssue: AlertKnownIssue;
  impactAssessment: IncidentImpact;
  governance: AlertGovernance;
  resolution: IncidentResolution;
  escalation: IncidentEscalation;
  recurrence: IncidentRecurrence;
}

// --- Audit & Evidence Trail -----------------------------------------------------

export type AuditEventType =
  | 'agent_action'
  | 'run_event'
  | 'orchestration_decision'
  | 'approval_decision'
  | 'policy_evaluation'
  | 'policy_violation'
  | 'tool_access'
  | 'model_use'
  | 'knowledge_access'
  | 'alert_incident'
  | 'uat_result'
  | 'verification'
  | 'configuration_change'
  | 'human_override'
  | 'security_event'
  | 'other';

export type AuditOutcome =
  | 'success'
  | 'failed'
  | 'blocked'
  | 'approved'
  | 'rejected'
  | 'warning'
  | 'partial'
  | 'informational';

export type EvidenceType =
  | 'diagnostic'
  | 'verification'
  | 'uat'
  | 'approval'
  | 'incident'
  | 'monitoring'
  | 'report'
  | 'screenshot_reference'
  | 'configuration_snapshot'
  | 'other';

export type EvidenceStatus = 'available' | 'missing' | 'pending' | 'invalid' | 'expired' | 'not_required';

export type AuditIntegrityState = 'pass' | 'warning' | 'fail' | 'unknown';

export type ActorType = 'agent' | 'human' | 'system' | 'orchestrator';

export interface AuditVerification {
  required: boolean;
  status: string;
  agent: string;
  checksPerformed: string[];
  result: string;
  evidenceAvailable: boolean;
  failureSummary: string;
}

export interface AuditUatEvidence {
  required: boolean;
  reference: string;
  testsPassed: number;
  testsFailed: number;
  blockingFailures: boolean;
  finalStatus: string;
}

export interface AuditGovernance {
  policyEvaluated: string;
  riskClassification: RiskClass;
  approvalRequired: boolean;
  approvalDecision: string;
  decisionActor: string;
  separationOfDuties: boolean;
  overrideUsed: boolean;
  reason: string;
}

export interface AuditEvidence {
  id: string;
  type: EvidenceType;
  title: string;
  source: string;
  timestamp: string;
  integrityState: AuditIntegrityState;
  required: boolean;
  status: EvidenceStatus;
  relatedRecordId: string | null;
}

export interface AuditIntegrityCheck {
  name: string;
  state: AuditIntegrityState;
  note: string;
}

export interface AuditReviewItem {
  auditId: string;
  reason: string;
  severity: Severity;
  risk: RiskClass;
}

export interface HumanOverrideAudit {
  overrideId: string;
  actor: string;
  originalDecision: string;
  overrideDecision: string;
  reason: string;
  risk: RiskClass;
  approvalReference: string;
  timestamp: string;
  result: string;
}

export interface ComplianceReadinessCheck {
  name: string;
  state: AuditIntegrityState;
  note: string;
}

export interface AiAuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  action: string;
  outcome: AuditOutcome;
  severity: Severity;
  /** 'group' for group-wide, otherwise a site id. */
  siteId: string;
  siteName: string;
  agentId: string | null;
  agentName: string;
  runId: string | null;
  orchestrationId: string | null;
  approvalId: string | null;
  alertId: string | null;
  policyId: string | null;
  toolId: string | null;
  modelId: string | null;
  knowledgeId: string | null;
  uatReference: string;
  actorType: ActorType;
  actorTeam: string;
  triggerSource: string;
  risk: RiskClass;
  environment: Environment;
  beforeState: string;
  afterState: string;
  decisionReason: string;
  evidenceIds: string[];
  verification: AuditVerification;
  uat: AuditUatEvidence;
  governance: AuditGovernance;
  correlationId: string;
  integrityState: AuditIntegrityState;
  reviewRequired: boolean;
  notes: string;
}

// --- Cost, Usage & Budgets ------------------------------------------------------

export type BudgetStatus = 'healthy' | 'warning' | 'critical' | 'exceeded' | 'disabled' | 'not_configured';

export type BudgetScope = 'group' | 'site' | 'agent' | 'model' | 'provider' | 'environment';

export interface CostBySite {
  siteId: string;
  siteName: string;
  today: string;
  thisMonth: string;
  budget: string;
  remaining: string;
  forecast: string;
  budgetStatus: BudgetStatus;
}

export interface CostByAgent {
  agentId: string;
  agentName: string;
  site: string;
  jobs: number;
  costToday: string;
  monthlyCost: string;
  avgCostPerRun: string;
  budgetStatus: BudgetStatus;
}

export interface CostByModel {
  modelId: string;
  modelName: string;
  provider: string;
  jobs: number;
  inputUsage: string;
  outputUsage: string;
  estimatedCost: string;
  avgCostPerRun: string;
  status: ModelStatus;
}

export interface CostByProvider {
  providerId: string;
  providerName: string;
  models: number;
  requests: number;
  failures: number;
  today: string;
  month: string;
  forecast: string;
}

export interface AiBudget {
  id: string;
  name: string;
  scope: BudgetScope;
  scopeId: string | null;
  scopeLabel: string;
  monthlyLimit: string;
  dailyLimit: string;
  warningThreshold: number;
  criticalThreshold: number;
  currentSpend: string;
  forecast: string;
  remaining: string;
  status: BudgetStatus;
  ownerTeam: string;
  environment: Environment;
  startDate: string;
  reviewDate: string;
  notes: string;
}

export interface BudgetAlert {
  id: string;
  scope: BudgetScope;
  scopeId: string | null;
  scopeLabel: string;
  title: string;
  severity: Severity;
  currentSpend: string;
  threshold: string;
  forecast: string;
  suggestedAction: string;
  relatedRecordId: string | null;
  relatedRecordType: 'site' | 'agent' | 'model' | 'provider' | 'alert' | null;
}

export interface CostForecast {
  currentMonthSpend: string;
  averageDailySpend: string;
  estimatedMonthEnd: string;
  budget: string;
  variance: string;
}

export interface CostEfficiencyMetric {
  key: string;
  label: string;
  value: string;
  note: string;
}

export interface LocalCloudComparison {
  scope: 'local' | 'cloud';
  label: string;
  jobs: number;
  avgDuration: string;
  estimatedCost: string;
  failureRate: string;
}

export interface RunCostRow {
  runId: string;
  siteName: string;
  agentName: string;
  model: string;
  duration: string;
  estimatedCost: string;
  toolCost: string;
  totalCost: string;
  status: RunStatus;
}

// --- Notifications & Escalations -----------------------------------------------

export type NotificationChannel =
  | 'dfp_command'
  | 'email'
  | 'sms'
  | 'push'
  | 'slack'
  | 'teams'
  | 'webhook'
  | 'phone'
  | 'other';

export type NotificationPriority = 'informational' | 'normal' | 'high' | 'urgent' | 'critical';

export type NotificationStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'acknowledged'
  | 'failed'
  | 'escalated'
  | 'suppressed'
  | 'expired'
  | 'cancelled';

export type NotificationRuleStatus = 'active' | 'draft' | 'review_required' | 'disabled' | 'expired';

export type AcknowledgementState = 'not_required' | 'awaiting' | 'acknowledged' | 'missed' | 'expired';

export interface EscalationStep {
  /** 0 = initial notification, 1–4 = escalation levels. */
  level: number;
  team: string;
  delay: string;
  trigger: string;
  channel: NotificationChannel;
  acknowledgementRequired: boolean;
}

export interface NotificationSuppression {
  duplicateWindow: string;
  suppressionCondition: string;
  quietHours: string;
  maintenanceHandling: string;
  repeatHandling: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  status: NotificationRuleStatus;
  eventSource: string;
  eventType: string;
  /** 'group' for group-wide, otherwise a site id. */
  siteId: string | null;
  siteName: string;
  agentId: string | null;
  severityThreshold: Severity;
  riskThreshold: RiskClass;
  environment: Environment;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  initialTeam: string;
  escalationTeam: string;
  acknowledgementRequired: boolean;
  acknowledgementDeadline: string;
  escalationDelay: string;
  maxEscalationLevel: number;
  repeatInterval: string;
  quietHoursBehaviour: string;
  deduplicationEnabled: boolean;
  auditRequired: boolean;
  ownerTeam: string;
  lastReviewed: string;
  nextReview: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  policyIds: string[];
  suppression: NotificationSuppression;
  escalationPath: EscalationStep[];
}

export interface NotificationEvent {
  id: string;
  time: string;
  source: string;
  siteId: string;
  siteName: string;
  event: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  recipientTeam: string;
  status: NotificationStatus;
  relatedRecordType:
    | 'alert'
    | 'approval'
    | 'run'
    | 'policy'
    | 'orchestration'
    | 'budget'
    | 'agent'
    | 'site'
    | 'model'
    | null;
  relatedRecordId: string | null;
  acknowledgement: AcknowledgementState;
  acknowledgementDeadline: string;
  acknowledgedByTeam: string;
  acknowledgedAt: string;
  escalationLevel: number;
  ruleId: string | null;
}

export interface NotificationTestResult {
  matchedRuleId: string | null;
  ruleName: string;
  matched: boolean;
  priority: NotificationPriority | null;
  recipientTeam: string;
  channels: NotificationChannel[];
  acknowledgementRequired: boolean;
  escalationPath: EscalationStep[];
}

// --- Scheduling & Automation ---------------------------------------------------

export type AutomationType =
  | 'scheduled'
  | 'recurring'
  | 'one_time'
  | 'event_triggered'
  | 'condition_triggered'
  | 'manual'
  | 'maintenance';

export type ScheduleStatus =
  | 'active'
  | 'paused'
  | 'draft'
  | 'running'
  | 'failed'
  | 'disabled'
  | 'review_required'
  | 'expired';

export type ScheduleTriggerType = 'time' | 'recurrence' | 'event' | 'condition' | 'manual';

export interface ScheduleTrigger {
  triggerType: ScheduleTriggerType;
  expressionSummary: string;
  recurrence: string;
  eventSource: string;
  condition: string;
  manual: string;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: string;
  backoffStrategy: string;
  failureEscalation: string;
  fallbackAgent: string;
  disableAfterRepeatedFailure: boolean;
  createIncidentAfterThreshold: boolean;
}

export interface ScheduleRunHistory {
  runId: string;
  started: string;
  duration: string;
  result: ActivityStatus;
  cost: string;
  verification: string;
}

export interface AiSchedule {
  id: string;
  name: string;
  description: string;
  automationType: AutomationType;
  /** 'group' for group-wide, otherwise a site id. */
  siteId: string;
  siteName: string;
  agentId: string;
  agentName: string;
  taskType: TaskType;
  environment: Environment;
  status: ScheduleStatus;
  priority: RunPriority;
  risk: RiskLevel;
  triggerType: string;
  expressionSummary: string;
  timezone: string;
  frequency: string;
  startDate: string;
  endDate: string;
  nextRun: string;
  lastRun: string;
  lastRunStatus: ActivityStatus | null;
  lastRunId: string | null;
  failureCount: number;
  retry: RetryPolicy;
  approvalRequired: boolean;
  quietHoursBehaviour: string;
  maintenanceWindowBehaviour: string;
  notificationRuleId: string | null;
  ownerTeam: string;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  trigger: ScheduleTrigger;
  taskSummary: string;
  expectedOutcome: string;
  requiredTools: string[];
  requiredKnowledge: string[];
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
  policyIds: string[];
  runHistory: ScheduleRunHistory[];
  avgRunCost: string;
  estimatedMonthlyExecutions: number;
  estimatedMonthlyCost: string;
}

export interface EventAutomationRule {
  id: string;
  name: string;
  eventSource: string;
  condition: string;
  agentId: string;
  agentName: string;
  siteId: string;
  siteName: string;
  resultingTask: string;
  approvalRequired: boolean;
  status: ScheduleStatus;
}

export interface MaintenanceWindow {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  start: string;
  end: string;
  recurrence: string;
  pauseAutomation: boolean;
  allowCriticalAutomation: boolean;
  ownerTeam: string;
}

export interface QuietHoursPolicy {
  id: string;
  siteId: string;
  siteName: string;
  start: string;
  end: string;
  suppressNonCritical: boolean;
  delayNormalAutomation: boolean;
  criticalBypass: boolean;
}
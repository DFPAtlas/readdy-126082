// ============================================================================
// AI Operations — Production Readiness audit types.
//
// These describe the planning/audit data rendered by the Production Readiness
// page. All values are demo/planning only — no live connection, no table
// creation, no agent execution is implied by this data.
// ============================================================================

export type ReadinessStatus =
  | 'complete'
  | 'ready'
  | 'partial'
  | 'required'
  | 'blocked'
  | 'not_started'
  | 'not_applicable';

export interface ProductionReadinessModule {
  id: string;
  module: string;
  route: string;
  frontend: ReadinessStatus;
  dataContract: ReadinessStatus;
  database: ReadinessStatus;
  integration: ReadinessStatus;
  security: ReadinessStatus;
  liveData: ReadinessStatus;
  execution: ReadinessStatus;
  overall: ReadinessStatus;
  notes?: string;
}

export interface ProductionDependency {
  id: string;
  name: string;
  requiredFor: string;
  kind: 'database' | 'integration' | 'security' | 'runtime' | 'data';
  status: ReadinessStatus;
  note?: string;
}

export interface MockDataAuditItem {
  mockSource: string;
  module: string;
  productionReplacement: string;
  migrationPriority: 'p0' | 'p1' | 'p2' | 'p3';
  canRemainAsFallback: boolean;
  requiredTablesApi: string;
  status: ReadinessStatus;
}

export interface DatabasePlanItem {
  id: string;
  table: string;
  domain: string;
  purpose: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  dependencies: string;
  rlsRequired: boolean;
  auditRequired: boolean;
  state: ReadinessStatus;
}

export interface IntegrationPlanItem {
  id: string;
  name: string;
  layer: string;
  requirement: string;
  credentialLocation: string;
  status: ReadinessStatus;
  note?: string;
}

export interface N8nWorkflowPlan {
  id: string;
  name: string;
  purpose: string;
  trigger: string;
  input: string;
  output: string;
  risk: string;
  approvalRequired: boolean;
  implementationStatus: ReadinessStatus;
}

export interface AgentRuntimeItem {
  id: string;
  agent: string;
  category: string;
  siteId: string | null;
  siteName: string;
  model: string;
  tools: string;
  knowledge: string;
  permissions: string;
  approvalPolicy: string;
  failurePolicy: string;
  checks: {
    identity: boolean;
    modelAssigned: boolean;
    toolsAssigned: boolean;
    knowledgeAssigned: boolean;
    permissionsDefined: boolean;
    policiesApplied: boolean;
    approvalDefined: boolean;
    runtimeConfigured: boolean;
    testingComplete: boolean;
  };
}

export interface ModelConnectionPlanItem {
  provider: string;
  connectionRequired: boolean;
  credentialLocation: string;
  modelRegistryMapping: string;
  fallbackConfigured: boolean;
  securityPolicy: string;
  costTracking: boolean;
  healthMonitoring: boolean;
  status: ReadinessStatus;
}

export interface ToolConnectionPlanItem {
  tool: string;
  connectionState: string;
  authenticationType: string;
  credentialReference: string;
  allowedOperations: string;
  restrictedOperations: string;
  approvalRequired: boolean;
  testRequired: boolean;
  productionReadiness: ReadinessStatus;
}

export interface KnowledgeIngestionStep {
  step: number;
  name: string;
  description: string;
  status: ReadinessStatus;
}

export interface AnalyticsDataSource {
  metric: string;
  requiredFields: string;
  source: string;
  freshness: string;
  status: ReadinessStatus;
}

export interface SecurityGate {
  id: string;
  label: string;
  state: 'pass' | 'blocked' | 'partial';
  owner: string;
  note?: string;
}

export interface RlsRole {
  role: string;
  readScope: string;
  writeScope: string;
  approvalPermissions: string;
  adminPermissions: string;
  state: ReadinessStatus;
}

export interface TestingPhase {
  phase: number;
  name: string;
  description: string;
  risk: string;
  status: ReadinessStatus;
}

export interface SiteActivationReadiness {
  siteId: string;
  name: string;
  registryReady: boolean;
  databaseConnected: boolean;
  siteApiConnected: boolean;
  agentsConfigured: boolean;
  toolsConfigured: boolean;
  knowledgeConfigured: boolean;
  monitoringConnected: boolean;
  uatComplete: boolean;
  securityReview: boolean;
  productionStatus: ReadinessStatus;
}

export interface ProductionChecklistItem {
  id: string;
  category: string;
  item: string;
  required: boolean;
  owner: string;
  status: ReadinessStatus;
  blocker: boolean;
  evidence: string;
  notes: string;
}

export interface GoNoGoStatus {
  status: 'go' | 'no_go' | 'partial_go';
  summary: string;
  goRequirements: { label: string; met: boolean }[];
}

export interface ImplementationPhase {
  id: string;
  name: string;
  summary: string;
  deliverables: string[];
  status: ReadinessStatus;
}
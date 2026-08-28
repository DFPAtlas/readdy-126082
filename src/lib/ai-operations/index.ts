// ============================================================================
// AI Operations — Supabase data-access layer (Phase 2 core foundation).
//
// Read-only access functions for the six core AI Operations tables. These are
// intentionally kept separate from the existing demo/mock contexts so the
// frontend can migrate to live data incrementally without touching the demo
// architecture yet.
//
// Safety guarantees:
//   * No credentials or raw SQL errors are surfaced to callers.
//   * Every function returns a structured { data, error } result and never
//     throws, so importing this module can never crash the app.
//   * If Supabase is unreachable / unconfigured, a friendly error is returned.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type {
  AiSiteRow,
  AiAgentRow,
  AiTaskRow,
  AiRunRow,
  AiRunStepRow,
  AiApprovalRow,
  AiOpsResult,
  AiAuditEventRow,
  AiAuditEvidenceRow,
  AiApprovalHistoryRow,
  AiSecurityPolicyRow,
  AiPolicyEvaluationRow,
  AiToolConnectionRow,
  AiToolAgentAccessRow,
  AiModelProviderRow,
  AiOperationsModelRow,
  AiAgentModelAssignmentRow,
  AiKnowledgeSourceRow,
  AiKnowledgePermissionRow,
  AiIncidentMemoryRow,
  AiAlertRow,
  AiIncidentRow,
  AiIncidentAlertRow,
  AiIncidentTimelineRow,
  AiNotificationRuleRow,
  AiEscalationPolicyRow,
  AiEscalationLevelRow,
  AiNotificationEventRow,
  AiQuietHoursPolicyRow,
  AiScheduleRow,
  AiEventAutomationRuleRow,
  AiMaintenanceWindowRow,
  AiScheduleHistoryRow,
  AiOrchestrationRow,
  AiOrchestrationStepRow,
  AiOrchestrationCandidateRow,
  AiOrchestrationDecisionRow,
  AiBudgetRow,
  AiUsageCostRow,
  AiBudgetEventRow,
} from '@/lib/ai-operations/types';

// --- Error sanitisation -------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';

    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to access this record.';
    }
    if (/network|fetch|failed to fetch|ECONN|ENOTFOUND/i.test(msg)) {
      return 'Unable to reach the database. Please try again.';
    }
    if (/relation .* does not exist|column .* does not exist/i.test(msg)) {
      return 'The AI Operations data model is not ready yet.';
    }
  }
  // Fall back to a generic message so raw SQL/connection details are never
  // leaked to the UI.
  return 'Unable to load AI Operations data.';
}

// --- Generic query runner -----------------------------------------------------

async function runQuery<T>(
  builder: Promise<{ data: T | null; error: unknown }>,
): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) {
      return { data: null, error: sanitiseError(error) };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Sites --------------------------------------------------------------------

export function getAiSites(): Promise<AiOpsResult<AiSiteRow[]>> {
  return runQuery<AiSiteRow[]>(
    supabase.from('ai_sites').select('*').order('name', { ascending: true }),
  );
}

export function getAiSiteById(id: string): Promise<AiOpsResult<AiSiteRow>> {
  return runQuery<AiSiteRow>(supabase.from('ai_sites').select('*').eq('id', id).maybeSingle());
}

// Input shape for creating/updating a site. `site_key` is the stable
// application identifier (used by routes and relationships) — it is distinct
// from the database `id` (internal UUID primary key). No secrets are accepted.
export interface AiSiteUpsertInput {
  site_key: string;
  name: string;
  product_name?: string | null;
  domain?: string | null;
  description?: string | null;
  business_type?: string | null;
  environment?: string;
  operational_status?: string;
  ai_status?: string;
  criticality?: string | null;
  owner_team?: string | null;
  repository_reference?: string | null;
  readdy_reference?: string | null;
  supabase_reference?: string | null;
  n8n_reference?: string | null;
  billing_provider?: string | null;
  email_provider?: string | null;
  authentication_provider?: string | null;
  hosting_provider?: string | null;
  notes?: string | null;
}

export function createAiSite(input: AiSiteUpsertInput): Promise<AiOpsResult<AiSiteRow>> {
  return runQuery<AiSiteRow>(
    supabase.from('ai_sites').insert(input).select().single(),
  );
}

export function updateAiSite(
  siteKey: string,
  input: Partial<AiSiteUpsertInput>,
): Promise<AiOpsResult<AiSiteRow>> {
  return runQuery<AiSiteRow>(
    supabase.from('ai_sites').update(input).eq('site_key', siteKey).select().single(),
  );
}

// --- Agents -------------------------------------------------------------------

export function getAiAgents(): Promise<AiOpsResult<AiAgentRow[]>> {
  return runQuery<AiAgentRow[]>(
    supabase.from('ai_operations_agents').select('*').order('name', { ascending: true }),
  );
}

export function getAiAgentById(id: string): Promise<AiOpsResult<AiAgentRow>> {
  return runQuery<AiAgentRow>(
    supabase.from('ai_operations_agents').select('*').eq('id', id).maybeSingle(),
  );
}

// Input shape for creating/updating an agent. `agent_key` is the stable
// application identifier (used by routes) — distinct from the database `id`
// (internal UUID primary key). `site_id` is the resolved `ai_sites.id` UUID
// (or null for group/shared agents); `site_key` → UUID resolution happens in
// the caller via the live Sites registry, never here. No secrets accepted.
export interface AiAgentUpsertInput {
  agent_key: string;
  name: string;
  description?: string | null;
  agent_type?: string | null;
  category?: string | null;
  site_id?: string | null;
  environment?: string;
  status?: string;
  health?: string;
  risk_level?: string | null;
  autonomy_level?: string | null;
  owner_team?: string | null;
  escalation_team?: string | null;
  primary_model_reference?: string | null;
  fallback_model_reference?: string | null;
  prompt_version_reference?: string | null;
  current_task?: string | null;
  queue_count?: number;
  success_rate?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

export function createAiAgent(input: AiAgentUpsertInput): Promise<AiOpsResult<AiAgentRow>> {
  return runQuery<AiAgentRow>(
    supabase.from('ai_operations_agents').insert(input).select().single(),
  );
}

export function updateAiAgent(
  agentKey: string,
  input: Partial<AiAgentUpsertInput>,
): Promise<AiOpsResult<AiAgentRow>> {
  return runQuery<AiAgentRow>(
    supabase.from('ai_operations_agents').update(input).eq('agent_key', agentKey).select().single(),
  );
}

// --- Tasks --------------------------------------------------------------------

export function getAiTasks(): Promise<AiOpsResult<AiTaskRow[]>> {
  return runQuery<AiTaskRow[]>(
    supabase.from('ai_tasks').select('*').order('created_at', { ascending: false }),
  );
}

export function getAiTaskById(id: string): Promise<AiOpsResult<AiTaskRow>> {
  return runQuery<AiTaskRow>(supabase.from('ai_tasks').select('*').eq('id', id).maybeSingle());
}

// Input shape for creating/updating a task. `task_key` is the stable application
// identifier (distinct from the internal UUID `id`). `site_id` is the resolved
// `ai_sites.id` UUID (or null for group-wide tasks); resolution happens in the
// caller. No secrets are accepted.
export interface AiTaskUpsertInput {
  task_key: string;
  name: string;
  description?: string | null;
  task_type?: string | null;
  site_id?: string | null;
  requested_by?: string | null;
  trigger_source?: string | null;
  priority?: string | null;
  risk_level?: string | null;
  environment?: string;
  status?: string;
  approval_required?: boolean;
  verification_required?: boolean;
  uat_required?: boolean;
  audit_required?: boolean;
  notes?: string | null;
}

export function createAiTask(input: AiTaskUpsertInput): Promise<AiOpsResult<AiTaskRow>> {
  return runQuery<AiTaskRow>(
    supabase.from('ai_tasks').insert(input).select().single(),
  );
}

export function updateAiTask(
  taskKey: string,
  input: Partial<AiTaskUpsertInput>,
): Promise<AiOpsResult<AiTaskRow>> {
  return runQuery<AiTaskRow>(
    supabase.from('ai_tasks').update(input).eq('task_key', taskKey).select().single(),
  );
}

// --- Runs ---------------------------------------------------------------------

export function getAiRuns(): Promise<AiOpsResult<AiRunRow[]>> {
  return runQuery<AiRunRow[]>(
    supabase.from('ai_runs').select('*').order('created_at', { ascending: false }),
  );
}

export function getAiRunById(id: string): Promise<AiOpsResult<AiRunRow>> {
  return runQuery<AiRunRow>(supabase.from('ai_runs').select('*').eq('id', id).maybeSingle());
}

export function getAiRunByKey(runKey: string): Promise<AiOpsResult<AiRunRow>> {
  return runQuery<AiRunRow>(
    supabase.from('ai_runs').select('*').eq('run_key', runKey).maybeSingle(),
  );
}

export function getAiRunSteps(runId: string): Promise<AiOpsResult<AiRunStepRow[]>> {
  return runQuery<AiRunStepRow[]>(
    supabase.from('ai_run_steps').select('*').eq('run_id', runId).order('step_number', { ascending: true }),
  );
}

export function getAiRunStepsByRunId(runId: string): Promise<AiOpsResult<AiRunStepRow[]>> {
  return getAiRunSteps(runId);
}

export function getAllAiRunSteps(): Promise<AiOpsResult<AiRunStepRow[]>> {
  return runQuery<AiRunStepRow[]>(
    supabase.from('ai_run_steps').select('*').order('step_number', { ascending: true }),
  );
}

// Input shape for creating/updating a run. `run_key` is the stable application
// identifier (distinct from the internal UUID `id`). `task_id`, `site_id` and
// `agent_id` are resolved UUIDs — resolution happens in the caller, never here.
// `approval_id` is intentionally omitted (approvals are migrated separately).
// No secrets are accepted.
export interface AiRunUpsertInput {
  run_key: string;
  task_id?: string | null;
  parent_run_id?: string | null;
  root_run_id?: string | null;
  correlation_id?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  status?: string;
  priority?: string | null;
  risk_level?: string | null;
  environment?: string;
  queue_position?: number | null;
  current_step?: number | null;
  total_steps?: number | null;
  attempts?: number;
  max_attempts?: number | null;
  retry_count?: number;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_summary?: string | null;
  result_summary?: string | null;
  approval_required?: boolean;
  verification_required?: boolean;
  uat_required?: boolean;
  audit_required?: boolean;
}

export function createAiRun(input: AiRunUpsertInput): Promise<AiOpsResult<AiRunRow>> {
  return runQuery<AiRunRow>(
    supabase.from('ai_runs').insert(input).select().single(),
  );
}

export function updateAiRun(
  runKey: string,
  input: Partial<AiRunUpsertInput>,
): Promise<AiOpsResult<AiRunRow>> {
  return runQuery<AiRunRow>(
    supabase.from('ai_runs').update(input).eq('run_key', runKey).select().single(),
  );
}

// --- Approvals ----------------------------------------------------------------

export function getAiApprovals(): Promise<AiOpsResult<AiApprovalRow[]>> {
  return runQuery<AiApprovalRow[]>(
    supabase.from('ai_approvals').select('*').order('requested_at', { ascending: false }),
  );
}

export function getAiApprovalById(id: string): Promise<AiOpsResult<AiApprovalRow>> {
  return runQuery<AiApprovalRow>(
    supabase.from('ai_approvals').select('*').eq('id', id).maybeSingle(),
  );
}

export function getAiApprovalByKey(approvalKey: string): Promise<AiOpsResult<AiApprovalRow>> {
  return runQuery<AiApprovalRow>(
    supabase.from('ai_approvals').select('*').eq('approval_key', approvalKey).maybeSingle(),
  );
}

// Input shape for creating/updating an approval. `approval_key` is the stable
// application identifier (used by routes) — distinct from the database `id`
// (internal UUID primary key). `site_id`/`agent_id`/`run_id` are resolved UUIDs;
// resolution happens in the caller via the live registries, never here.
// `conditions` is stored as a JSONB array of strings (mirrors the seed format).
// No secrets are accepted.
export interface AiApprovalUpsertInput {
  approval_key: string;
  title?: string | null;
  description?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  requested_action?: string | null;
  request_type?: string | null;
  risk_class?: string | null;
  severity?: string | null;
  environment?: string;
  status?: string;
  requested_by?: string | null;
  required_team?: string | null;
  minimum_approvers?: number;
  current_approval_count?: number;
  business_justification?: string | null;
  reasoning_summary?: string | null;
  expected_result?: string | null;
  potential_impact?: string | null;
  rollback_available?: boolean;
  rollback_summary?: string | null;
  verification_required?: boolean;
  uat_required?: boolean;
  audit_required?: boolean;
  decision?: string | null;
  decision_reason?: string | null;
  decision_actor?: string | null;
  decision_at?: string | null;
  conditions?: string[] | null;
  notes?: string | null;
}

export function createAiApproval(input: AiApprovalUpsertInput): Promise<AiOpsResult<AiApprovalRow>> {
  return runQuery<AiApprovalRow>(
    supabase.from('ai_approvals').insert(input).select().single(),
  );
}

export function updateAiApproval(
  approvalKey: string,
  input: Partial<AiApprovalUpsertInput>,
): Promise<AiOpsResult<AiApprovalRow>> {
  return runQuery<AiApprovalRow>(
    supabase.from('ai_approvals').update(input).eq('approval_key', approvalKey).select().single(),
  );
}

// Governance decision input — records ONLY metadata (status/decision fields).
// Never executes a run, calls an agent, triggers n8n, or changes production data.
export interface AiApprovalDecisionInput {
  decision: string;
  decision_reason: string;
  decision_actor: string;
  status: string;
  current_approval_count: number;
  conditions: string[] | null;
}

export function recordAiApprovalDecision(
  approvalKey: string,
  input: AiApprovalDecisionInput,
): Promise<AiOpsResult<AiApprovalRow>> {
  return updateAiApproval(approvalKey, {
    status: input.status,
    decision: input.decision,
    decision_reason: input.decision_reason,
    decision_actor: input.decision_actor,
    decision_at: new Date().toISOString(),
    current_approval_count: input.current_approval_count,
    conditions: input.conditions,
  });
}

// --- Audit & Evidence ---------------------------------------------------------

export function getAiAuditEvents(): Promise<AiOpsResult<AiAuditEventRow[]>> {
  return runQuery<AiAuditEventRow[]>(
    supabase.from('ai_audit_events').select('*').order('occurred_at', { ascending: false }),
  );
}

export function getAiAuditEventByKey(auditKey: string): Promise<AiOpsResult<AiAuditEventRow>> {
  return runQuery<AiAuditEventRow>(
    supabase.from('ai_audit_events').select('*').eq('audit_key', auditKey).maybeSingle(),
  );
}

export function getAiAuditEvidence(): Promise<AiOpsResult<AiAuditEvidenceRow[]>> {
  return runQuery<AiAuditEvidenceRow[]>(
    supabase.from('ai_audit_evidence').select('*').order('captured_at', { ascending: false }),
  );
}

export function getAiAuditEvidenceByEvent(auditEventId: string): Promise<AiOpsResult<AiAuditEvidenceRow[]>> {
  return runQuery<AiAuditEvidenceRow[]>(
    supabase.from('ai_audit_evidence').select('*').eq('audit_event_id', auditEventId),
  );
}

// Input shape for creating an audit event. `audit_key` is the stable application
// identifier; site/agent/run/approval UUIDs are resolved by the caller and never
// exposed here. Append-oriented — no update/delete functions are provided. No
// secrets are accepted (summaries only).
export interface AiAuditEventInput {
  audit_key: string;
  occurred_at?: string | null;
  event_type?: string | null;
  action?: string | null;
  outcome?: string | null;
  severity?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  approval_id?: string | null;
  actor_type?: string | null;
  actor_reference?: string | null;
  trigger_source?: string | null;
  risk_level?: string | null;
  environment?: string | null;
  correlation_id?: string | null;
  before_summary?: string | null;
  after_summary?: string | null;
  decision_reason?: string | null;
  verification_state?: string | null;
  uat_state?: string | null;
  integrity_state?: string | null;
  review_required?: boolean;
  notes?: string | null;
}

export function createAiAuditEvent(input: AiAuditEventInput): Promise<AiOpsResult<AiAuditEventRow>> {
  return runQuery<AiAuditEventRow>(
    supabase.from('ai_audit_events').insert(input).select().single(),
  );
}

// Evidence metadata/reference only — never binary files or raw screenshots.
export interface AiAuditEvidenceInput {
  evidence_key: string;
  audit_event_id?: string | null;
  evidence_type?: string | null;
  title?: string | null;
  source?: string | null;
  reference_id?: string | null;
  status?: string | null;
  integrity_state?: string | null;
  required?: boolean;
  summary?: string | null;
  captured_at?: string | null;
}

export function createAiAuditEvidence(input: AiAuditEvidenceInput): Promise<AiOpsResult<AiAuditEvidenceRow>> {
  return runQuery<AiAuditEvidenceRow>(
    supabase.from('ai_audit_evidence').insert(input).select().single(),
  );
}

// --- Approval History ---------------------------------------------------------

export function getAiApprovalHistory(approvalId: string): Promise<AiOpsResult<AiApprovalHistoryRow[]>> {
  return runQuery<AiApprovalHistoryRow[]>(
    supabase.from('ai_approval_history').select('*').eq('approval_id', approvalId).order('created_at', { ascending: false }),
  );
}

export function getAllAiApprovalHistory(): Promise<AiOpsResult<AiApprovalHistoryRow[]>> {
  return runQuery<AiApprovalHistoryRow[]>(
    supabase.from('ai_approval_history').select('*').order('created_at', { ascending: false }),
  );
}

// Append-only history input. `approval_id` is the resolved ai_approvals.id UUID.
// No update/delete functions are provided — history is never overwritten.
export interface AiApprovalHistoryInput {
  approval_id: string;
  event_type?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  decision?: string | null;
  actor_reference?: string | null;
  actor_role?: string | null;
  reason?: string | null;
  conditions?: string[] | null;
  approval_count_before?: number | null;
  approval_count_after?: number | null;
}

export function appendAiApprovalHistory(input: AiApprovalHistoryInput): Promise<AiOpsResult<AiApprovalHistoryRow>> {
  return runQuery<AiApprovalHistoryRow>(
    supabase.from('ai_approval_history').insert(input).select().single(),
  );
}

// --- Security & Policy Engine --------------------------------------------------

export function getAiSecurityPolicies(): Promise<AiOpsResult<AiSecurityPolicyRow[]>> {
  return runQuery<AiSecurityPolicyRow[]>(
    supabase.from('ai_security_policies').select('*').order('name', { ascending: true }),
  );
}

export function getAiSecurityPolicyByKey(policyKey: string): Promise<AiOpsResult<AiSecurityPolicyRow>> {
  return runQuery<AiSecurityPolicyRow>(
    supabase.from('ai_security_policies').select('*').eq('policy_key', policyKey).maybeSingle(),
  );
}

// Input shape for creating/updating a security policy. `policy_key` is the
// stable application identifier (used by routes) — distinct from the internal
// UUID `id`. `site_id`/`agent_id` are resolved UUIDs (resolution happens in the
// caller, never here). `requirements` is a JSONB-safe object (e.g. min
// approvers). No secrets are accepted.
export interface AiSecurityPolicyUpsertInput {
  policy_key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  effect?: string | null;
  scope?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  subject_type?: string | null;
  subject_reference?: string | null;
  action_pattern?: string | null;
  risk_level?: string | null;
  environment?: string | null;
  priority?: string | null;
  status?: string | null;
  condition_summary?: string | null;
  requirements?: Record<string, unknown> | null;
  approval_required?: boolean;
  audit_required?: boolean;
  owner_team?: string | null;
  version?: string | null;
  effective_from?: string | null;
  expires_at?: string | null;
  next_review_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiSecurityPolicy(
  input: AiSecurityPolicyUpsertInput,
): Promise<AiOpsResult<AiSecurityPolicyRow>> {
  return runQuery<AiSecurityPolicyRow>(
    supabase.from('ai_security_policies').insert(input).select().single(),
  );
}

export function updateAiSecurityPolicy(
  policyKey: string,
  input: Partial<AiSecurityPolicyUpsertInput>,
): Promise<AiOpsResult<AiSecurityPolicyRow>> {
  return runQuery<AiSecurityPolicyRow>(
    supabase.from('ai_security_policies').update(input).eq('policy_key', policyKey).select().single(),
  );
}

export function getAiPolicyEvaluations(): Promise<AiOpsResult<AiPolicyEvaluationRow[]>> {
  return runQuery<AiPolicyEvaluationRow[]>(
    supabase.from('ai_policy_evaluations').select('*').order('occurred_at', { ascending: false }),
  );
}

export function getAiPolicyEvaluationsByPolicy(policyId: string): Promise<AiOpsResult<AiPolicyEvaluationRow[]>> {
  return runQuery<AiPolicyEvaluationRow[]>(
    supabase.from('ai_policy_evaluations').select('*').eq('policy_id', policyId).order('occurred_at', { ascending: false }),
  );
}

// Append-only evaluation input. `policy_id`/`site_id`/`agent_id`/`run_id`/
// `approval_id` are resolved UUIDs (resolution happens in the caller). Records
// governance evidence only — never executes anything. No secrets.
export interface AiPolicyEvaluationInput {
  evaluation_key: string;
  occurred_at?: string | null;
  policy_id?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  approval_id?: string | null;
  subject_type?: string | null;
  subject_reference?: string | null;
  requested_action?: string | null;
  requested_risk?: string | null;
  environment?: string | null;
  result?: string | null;
  effect?: string | null;
  matched?: boolean;
  approval_required?: boolean;
  reason?: string | null;
  condition_summary?: string | null;
  correlation_id?: string | null;
  actor_type?: string | null;
  actor_reference?: string | null;
}

export function createAiPolicyEvaluation(
  input: AiPolicyEvaluationInput,
): Promise<AiOpsResult<AiPolicyEvaluationRow>> {
  return runQuery<AiPolicyEvaluationRow>(
    supabase.from('ai_policy_evaluations').insert(input).select().single(),
  );
}

// --- Tools & Connections (Phase 2 Prompt 08) ------------------------------------

export function getAiToolConnections(): Promise<AiOpsResult<AiToolConnectionRow[]>> {
  return runQuery<AiToolConnectionRow[]>(
    supabase.from('ai_tool_connections').select('*').order('name', { ascending: true }),
  );
}

export function getAiToolConnectionByKey(connectionKey: string): Promise<AiOpsResult<AiToolConnectionRow>> {
  return runQuery<AiToolConnectionRow>(
    supabase.from('ai_tool_connections').select('*').eq('connection_key', connectionKey).maybeSingle(),
  );
}

// Input shape for creating/updating a connection. `connection_key` is the stable
// application identifier (used by routes) — distinct from the internal UUID `id`.
// `site_id` is a resolved `ai_sites.id` UUID (or null for group-wide).
// `allowed_operations`/`restricted_operations` are safe operation-name arrays.
// `credential_reference`/`authentication_type` are labels only — NEVER values.
export interface AiToolConnectionUpsertInput {
  connection_key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  provider?: string | null;
  scope?: string | null;
  site_id?: string | null;
  connection_type?: string | null;
  environment?: string | null;
  status?: string | null;
  health?: string | null;
  risk_level?: string | null;
  authentication_type?: string | null;
  credential_reference?: string | null;
  endpoint_reference?: string | null;
  allowed_operations?: string[] | null;
  restricted_operations?: string[] | null;
  approval_required?: boolean;
  audit_required?: boolean;
  owner_team?: string | null;
  technical_owner?: string | null;
  configuration_state?: string | null;
  notes?: string | null;
}

export function createAiToolConnection(
  input: AiToolConnectionUpsertInput,
): Promise<AiOpsResult<AiToolConnectionRow>> {
  return runQuery<AiToolConnectionRow>(
    supabase.from('ai_tool_connections').insert(input).select().single(),
  );
}

export function updateAiToolConnection(
  connectionKey: string,
  input: Partial<AiToolConnectionUpsertInput>,
): Promise<AiOpsResult<AiToolConnectionRow>> {
  return runQuery<AiToolConnectionRow>(
    supabase.from('ai_tool_connections').update(input).eq('connection_key', connectionKey).select().single(),
  );
}

// --- Agent Tool Access ----------------------------------------------------------

export function getAiToolAgentAccess(): Promise<AiOpsResult<AiToolAgentAccessRow[]>> {
  return runQuery<AiToolAgentAccessRow[]>(
    supabase.from('ai_tool_agent_access').select('*').order('created_at', { ascending: true }),
  );
}

export function getAiToolAccessByConnection(connectionId: string): Promise<AiOpsResult<AiToolAgentAccessRow[]>> {
  return runQuery<AiToolAgentAccessRow[]>(
    supabase.from('ai_tool_agent_access').select('*').eq('connection_id', connectionId),
  );
}

export function getAiToolAccessByAgent(agentId: string): Promise<AiOpsResult<AiToolAgentAccessRow[]>> {
  return runQuery<AiToolAgentAccessRow[]>(
    supabase.from('ai_tool_agent_access').select('*').eq('agent_id', agentId),
  );
}

// Input shape for granting/updating agent→tool access. `connection_id`/`agent_id`
// are resolved UUIDs (resolution happens in the caller, never here). `reason`/
// `granted_by` are safe actor metadata. No secrets. Access is revoked via
// `is_active = false` — there is no physical delete.
export interface AiToolAgentAccessInput {
  connection_id: string;
  agent_id: string;
  access_level?: string | null;
  allowed_operations?: string[] | null;
  restricted_operations?: string[] | null;
  approval_required?: boolean;
  risk_limit?: string | null;
  environment?: string | null;
  reason?: string | null;
  granted_by?: string | null;
  is_active?: boolean;
}

export function createAiToolAgentAccess(
  input: AiToolAgentAccessInput,
): Promise<AiOpsResult<AiToolAgentAccessRow>> {
  return runQuery<AiToolAgentAccessRow>(
    supabase.from('ai_tool_agent_access').insert(input).select().single(),
  );
}

export function updateAiToolAgentAccess(
  connectionId: string,
  agentId: string,
  input: Partial<AiToolAgentAccessInput>,
): Promise<AiOpsResult<AiToolAgentAccessRow>> {
  return runQuery<AiToolAgentAccessRow>(
    supabase
      .from('ai_tool_agent_access')
      .update(input)
      .eq('connection_id', connectionId)
      .eq('agent_id', agentId)
      .select()
      .single(),
  );
}

// --- Models & AI Providers (Phase 2 Prompt 09) ----------------------------------

// --- AI Model Providers ---------------------------------------------------------

export function getAiModelProviders(): Promise<AiOpsResult<AiModelProviderRow[]>> {
  return runQuery<AiModelProviderRow[]>(
    supabase.from('ai_model_providers').select('*').order('name', { ascending: true }),
  );
}

export function getAiModelProviderByKey(providerKey: string): Promise<AiOpsResult<AiModelProviderRow>> {
  return runQuery<AiModelProviderRow>(
    supabase.from('ai_model_providers').select('*').eq('provider_key', providerKey).maybeSingle(),
  );
}

// Provider metadata input. `credential_reference`/`endpoint_reference` are
// safe labels only — never values. No secrets accepted.
export interface AiModelProviderUpsertInput {
  provider_key: string;
  name: string;
  description?: string | null;
  provider_type?: string | null;
  hosting_type?: string | null;
  environment?: string | null;
  status?: string | null;
  health?: string | null;
  credential_reference?: string | null;
  endpoint_reference?: string | null;
  region?: string | null;
  data_residency?: string | null;
  supports_chat?: boolean;
  supports_reasoning?: boolean;
  supports_vision?: boolean;
  supports_embeddings?: boolean;
  supports_tools?: boolean;
  supports_streaming?: boolean;
  cost_tracking_enabled?: boolean;
  health_monitoring_enabled?: boolean;
  owner_team?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiModelProvider(
  input: AiModelProviderUpsertInput,
): Promise<AiOpsResult<AiModelProviderRow>> {
  return runQuery<AiModelProviderRow>(
    supabase.from('ai_model_providers').insert(input).select().single(),
  );
}

export function updateAiModelProvider(
  providerKey: string,
  input: Partial<AiModelProviderUpsertInput>,
): Promise<AiOpsResult<AiModelProviderRow>> {
  return runQuery<AiModelProviderRow>(
    supabase.from('ai_model_providers').update(input).eq('provider_key', providerKey).select().single(),
  );
}

// --- AI Operations Models --------------------------------------------------------

export function getAiOperationsModels(): Promise<AiOpsResult<AiOperationsModelRow[]>> {
  return runQuery<AiOperationsModelRow[]>(
    supabase.from('ai_operations_models').select('*').order('name', { ascending: true }),
  );
}

export function getAiOperationsModelByKey(modelKey: string): Promise<AiOpsResult<AiOperationsModelRow>> {
  return runQuery<AiOperationsModelRow>(
    supabase.from('ai_operations_models').select('*').eq('model_key', modelKey).maybeSingle(),
  );
}

// Model registry metadata input. `model_key` is the stable identifier (used by
// routes); `provider_id` is the resolved `ai_model_providers.id` UUID (resolved
// by the caller). No secrets accepted.
export interface AiOperationsModelUpsertInput {
  model_key: string;
  provider_id: string;
  name: string;
  display_name?: string | null;
  model_reference?: string | null;
  description?: string | null;
  model_type?: string | null;
  hosting_type?: string | null;
  environment?: string | null;
  status?: string | null;
  health?: string | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  supports_reasoning?: boolean;
  supports_vision?: boolean;
  supports_embeddings?: boolean;
  supports_tools?: boolean;
  supports_code?: boolean;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
  currency?: string | null;
  latency_class?: string | null;
  quality_tier?: string | null;
  risk_level?: string | null;
  data_policy?: string | null;
  fallback_priority?: number | null;
  is_default?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiOperationsModel(
  input: AiOperationsModelUpsertInput,
): Promise<AiOpsResult<AiOperationsModelRow>> {
  return runQuery<AiOperationsModelRow>(
    supabase.from('ai_operations_models').insert(input).select().single(),
  );
}

export function updateAiOperationsModel(
  modelKey: string,
  input: Partial<AiOperationsModelUpsertInput>,
): Promise<AiOpsResult<AiOperationsModelRow>> {
  return runQuery<AiOperationsModelRow>(
    supabase.from('ai_operations_models').update(input).eq('model_key', modelKey).select().single(),
  );
}

// --- Agent → Model Assignments ---------------------------------------------------

export function getAiAgentModelAssignments(): Promise<AiOpsResult<AiAgentModelAssignmentRow[]>> {
  return runQuery<AiAgentModelAssignmentRow[]>(
    supabase.from('ai_agent_model_assignments').select('*').order('created_at', { ascending: true }),
  );
}

export function getAiModelAssignmentsByAgent(agentId: string): Promise<AiOpsResult<AiAgentModelAssignmentRow[]>> {
  return runQuery<AiAgentModelAssignmentRow[]>(
    supabase.from('ai_agent_model_assignments').select('*').eq('agent_id', agentId),
  );
}

export function getAiModelAssignmentsByModel(modelId: string): Promise<AiOpsResult<AiAgentModelAssignmentRow[]>> {
  return runQuery<AiAgentModelAssignmentRow[]>(
    supabase.from('ai_agent_model_assignments').select('*').eq('model_id', modelId),
  );
}

// Assignment input. `agent_id`/`model_id` are resolved UUIDs (resolved by the
// caller). `assignment_type` is one of primary/fallback/specialist/embedding/
// vision/coding. Configuration metadata only — no model is called.
export interface AiAgentModelAssignmentInput {
  agent_id: string;
  model_id: string;
  assignment_type: string;
  priority?: number | null;
  environment?: string | null;
  max_cost_per_run?: number | null;
  allowed_risk_level?: string | null;
  fallback_enabled?: boolean;
  reason?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  is_active?: boolean;
}

export function createAiAgentModelAssignment(
  input: AiAgentModelAssignmentInput,
): Promise<AiOpsResult<AiAgentModelAssignmentRow>> {
  return runQuery<AiAgentModelAssignmentRow>(
    supabase.from('ai_agent_model_assignments').insert(input).select().single(),
  );
}

export function updateAiAgentModelAssignment(
  agentId: string,
  modelId: string,
  assignmentType: string,
  input: Partial<AiAgentModelAssignmentInput>,
): Promise<AiOpsResult<AiAgentModelAssignmentRow>> {
  return runQuery<AiAgentModelAssignmentRow>(
    supabase
      .from('ai_agent_model_assignments')
      .update(input)
      .eq('agent_id', agentId)
      .eq('model_id', modelId)
      .eq('assignment_type', assignmentType)
      .select()
      .single(),
  );
}

// --- Knowledge & Memory (Phase 2 Prompt 10) --------------------------------------

// --- Knowledge Sources -----------------------------------------------------------

export function getAiKnowledgeSources(): Promise<AiOpsResult<AiKnowledgeSourceRow[]>> {
  return runQuery<AiKnowledgeSourceRow[]>(
    supabase.from('ai_knowledge_sources').select('*').order('name', { ascending: true }),
  );
}

export function getAiKnowledgeSourceByKey(knowledgeKey: string): Promise<AiOpsResult<AiKnowledgeSourceRow>> {
  return runQuery<AiKnowledgeSourceRow>(
    supabase.from('ai_knowledge_sources').select('*').eq('knowledge_key', knowledgeKey).maybeSingle(),
  );
}

// Knowledge source metadata input. `knowledge_key` is the stable identifier
// (used by routes); `site_id` is the resolved `ai_sites.id` UUID (resolved by
// the caller). `source_reference`/`location_reference`/`embedding_model_reference`
// are safe labels only — never values or document bodies. No ingestion occurs.
export interface AiKnowledgeSourceUpsertInput {
  knowledge_key: string;
  name: string;
  description?: string | null;
  source_type?: string | null;
  knowledge_type?: string | null;
  scope?: string | null;
  site_id?: string | null;
  environment?: string | null;
  status?: string | null;
  health?: string | null;
  classification?: string | null;
  sensitivity?: string | null;
  source_reference?: string | null;
  location_reference?: string | null;
  owner_team?: string | null;
  authority_level?: string | null;
  trust_level?: string | null;
  ingestion_state?: string | null;
  indexing_state?: string | null;
  embedding_state?: string | null;
  embedding_model_reference?: string | null;
  last_ingested_at?: string | null;
  last_verified_at?: string | null;
  review_required?: boolean;
  retention_policy?: string | null;
  audit_required?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiKnowledgeSource(
  input: AiKnowledgeSourceUpsertInput,
): Promise<AiOpsResult<AiKnowledgeSourceRow>> {
  return runQuery<AiKnowledgeSourceRow>(
    supabase.from('ai_knowledge_sources').insert(input).select().single(),
  );
}

export function updateAiKnowledgeSource(
  knowledgeKey: string,
  input: Partial<AiKnowledgeSourceUpsertInput>,
): Promise<AiOpsResult<AiKnowledgeSourceRow>> {
  return runQuery<AiKnowledgeSourceRow>(
    supabase.from('ai_knowledge_sources').update(input).eq('knowledge_key', knowledgeKey).select().single(),
  );
}

// --- Knowledge Permissions -------------------------------------------------------

export function getAiKnowledgePermissions(): Promise<AiOpsResult<AiKnowledgePermissionRow[]>> {
  return runQuery<AiKnowledgePermissionRow[]>(
    supabase.from('ai_knowledge_permissions').select('*').order('created_at', { ascending: true }),
  );
}

export function getAiKnowledgePermissionsBySource(sourceId: string): Promise<AiOpsResult<AiKnowledgePermissionRow[]>> {
  return runQuery<AiKnowledgePermissionRow[]>(
    supabase.from('ai_knowledge_permissions').select('*').eq('knowledge_source_id', sourceId),
  );
}

export function getAiKnowledgePermissionsByAgent(agentId: string): Promise<AiOpsResult<AiKnowledgePermissionRow[]>> {
  return runQuery<AiKnowledgePermissionRow[]>(
    supabase.from('ai_knowledge_permissions').select('*').eq('agent_id', agentId),
  );
}

// Permission input. `knowledge_source_id`/`agent_id` are resolved UUIDs
// (resolved by the caller). Configuration metadata only — runtime retrieval is
// not connected. Revoked via is_active=false, never a physical delete.
export interface AiKnowledgePermissionInput {
  knowledge_source_id: string;
  agent_id: string;
  access_level?: string | null;
  purpose?: string | null;
  environment?: string | null;
  can_read?: boolean;
  can_retrieve?: boolean;
  can_reference?: boolean;
  can_update_metadata?: boolean;
  approval_required?: boolean;
  risk_limit?: string | null;
  granted_by?: string | null;
  granted_at?: string | null;
  reviewed_at?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiKnowledgePermission(
  input: AiKnowledgePermissionInput,
): Promise<AiOpsResult<AiKnowledgePermissionRow>> {
  return runQuery<AiKnowledgePermissionRow>(
    supabase.from('ai_knowledge_permissions').insert(input).select().single(),
  );
}

export function updateAiKnowledgePermission(
  sourceId: string,
  agentId: string,
  input: Partial<AiKnowledgePermissionInput>,
): Promise<AiOpsResult<AiKnowledgePermissionRow>> {
  return runQuery<AiKnowledgePermissionRow>(
    supabase
      .from('ai_knowledge_permissions')
      .update(input)
      .eq('knowledge_source_id', sourceId)
      .eq('agent_id', agentId)
      .select()
      .single(),
  );
}

// --- Incident Memory --------------------------------------------------------------

export function getAiIncidentMemory(): Promise<AiOpsResult<AiIncidentMemoryRow[]>> {
  return runQuery<AiIncidentMemoryRow[]>(
    supabase.from('ai_incident_memory').select('*').order('first_seen_at', { ascending: false }),
  );
}

export function getAiIncidentMemoryByKey(memoryKey: string): Promise<AiOpsResult<AiIncidentMemoryRow>> {
  return runQuery<AiIncidentMemoryRow>(
    supabase.from('ai_incident_memory').select('*').eq('memory_key', memoryKey).maybeSingle(),
  );
}

// Incident memory input. Sanitised summaries only — no raw logs or private
// customer content. `site_id`/`related_knowledge_source_id` are resolved UUIDs
// (resolved by the caller). `symptoms` is a JSONB-safe array of strings.
export interface AiIncidentMemoryInput {
  memory_key: string;
  title?: string | null;
  summary?: string | null;
  site_id?: string | null;
  related_knowledge_source_id?: string | null;
  incident_type?: string | null;
  symptoms?: string[] | null;
  known_cause?: string | null;
  resolution_summary?: string | null;
  prevention_summary?: string | null;
  severity?: string | null;
  environment?: string | null;
  confidence?: string | null;
  verification_state?: string | null;
  status?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  recurrence_count?: number;
  approved_for_reuse?: boolean;
  owner_team?: string | null;
  review_required?: boolean;
  is_active?: boolean;
}

export function createAiIncidentMemory(
  input: AiIncidentMemoryInput,
): Promise<AiOpsResult<AiIncidentMemoryRow>> {
  return runQuery<AiIncidentMemoryRow>(
    supabase.from('ai_incident_memory').insert(input).select().single(),
  );
}

export function updateAiIncidentMemory(
  memoryKey: string,
  input: Partial<AiIncidentMemoryInput>,
): Promise<AiOpsResult<AiIncidentMemoryRow>> {
  return runQuery<AiIncidentMemoryRow>(
    supabase.from('ai_incident_memory').update(input).eq('memory_key', memoryKey).select().single(),
  );
}

// --- Alerts & Incident Operations (Phase 2 Prompt 11) ---------------------------

// --- Alerts --------------------------------------------------------------------

export function getAiAlerts(): Promise<AiOpsResult<AiAlertRow[]>> {
  return runQuery<AiAlertRow[]>(
    supabase.from('ai_alerts').select('*').order('last_seen_at', { ascending: false }),
  );
}

export function getAiAlertByKey(alertKey: string): Promise<AiOpsResult<AiAlertRow>> {
  return runQuery<AiAlertRow>(
    supabase.from('ai_alerts').select('*').eq('alert_key', alertKey).maybeSingle(),
  );
}

// Alert metadata input. `alert_key` is the stable application identifier (used
// by routes). `site_id`/`agent_id`/`run_id`/`approval_id`/`policy_id`/
// `connection_id`/`model_id` are resolved UUIDs (resolved by the caller).
// Observation/governance metadata only — never triggers monitoring, remediation
// or notifications. No secrets.
export interface AiAlertUpsertInput {
  alert_key: string;
  title: string;
  summary?: string | null;
  alert_type?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  approval_id?: string | null;
  policy_id?: string | null;
  connection_id?: string | null;
  model_id?: string | null;
  severity?: string | null;
  priority?: string | null;
  status?: string | null;
  health_impact?: string | null;
  risk_level?: string | null;
  environment?: string;
  correlation_id?: string | null;
  occurrence_count?: number;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolution_summary?: string | null;
  requires_incident?: boolean;
  requires_approval?: boolean;
  review_required?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiAlert(input: AiAlertUpsertInput): Promise<AiOpsResult<AiAlertRow>> {
  return runQuery<AiAlertRow>(
    supabase.from('ai_alerts').insert(input).select().single(),
  );
}

export function updateAiAlert(
  alertKey: string,
  input: Partial<AiAlertUpsertInput>,
): Promise<AiOpsResult<AiAlertRow>> {
  return runQuery<AiAlertRow>(
    supabase.from('ai_alerts').update(input).eq('alert_key', alertKey).select().single(),
  );
}

// --- Incidents -----------------------------------------------------------------

export function getAiIncidents(): Promise<AiOpsResult<AiIncidentRow[]>> {
  return runQuery<AiIncidentRow[]>(
    supabase.from('ai_incidents').select('*').order('started_at', { ascending: false }),
  );
}

export function getAiIncidentByKey(incidentKey: string): Promise<AiOpsResult<AiIncidentRow>> {
  return runQuery<AiIncidentRow>(
    supabase.from('ai_incidents').select('*').eq('incident_key', incidentKey).maybeSingle(),
  );
}

// Incident metadata input. `incident_key` is the stable application identifier.
// `site_id` is the resolved `ai_sites.id` UUID (resolved by the caller).
// `known_issue_memory_key` is a safe stable text reference (set only where a
// deterministic reference exists). No remediation, notifications or execution.
export interface AiIncidentUpsertInput {
  incident_key: string;
  title: string;
  summary?: string | null;
  site_id?: string | null;
  severity?: string | null;
  priority?: string | null;
  status?: string | null;
  incident_type?: string | null;
  environment?: string;
  lead_team?: string | null;
  owner_reference?: string | null;
  correlation_id?: string | null;
  impact_summary?: string | null;
  diagnostics_summary?: string | null;
  suspected_cause?: string | null;
  confirmed_cause?: string | null;
  response_plan?: string | null;
  resolution_summary?: string | null;
  prevention_summary?: string | null;
  known_issue_memory_key?: string | null;
  approval_required?: boolean;
  security_review_required?: boolean;
  uat_required?: boolean;
  started_at?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiIncident(input: AiIncidentUpsertInput): Promise<AiOpsResult<AiIncidentRow>> {
  return runQuery<AiIncidentRow>(
    supabase.from('ai_incidents').insert(input).select().single(),
  );
}

export function updateAiIncident(
  incidentKey: string,
  input: Partial<AiIncidentUpsertInput>,
): Promise<AiOpsResult<AiIncidentRow>> {
  return runQuery<AiIncidentRow>(
    supabase.from('ai_incidents').update(input).eq('incident_key', incidentKey).select().single(),
  );
}

// --- Incident ↔ Alert links -----------------------------------------------------

export function getAiIncidentAlerts(): Promise<AiOpsResult<AiIncidentAlertRow[]>> {
  return runQuery<AiIncidentAlertRow[]>(
    supabase.from('ai_incident_alerts').select('*').order('created_at', { ascending: true }),
  );
}

// Link input. `incident_id`/`alert_id` are resolved UUIDs (resolved by the
// caller). Append-only — no update/delete functions are provided.
export interface AiIncidentAlertLinkInput {
  incident_id: string;
  alert_id: string;
  relationship_type?: string;
}

export function linkAiAlertToIncident(
  input: AiIncidentAlertLinkInput,
): Promise<AiOpsResult<AiIncidentAlertRow>> {
  return runQuery<AiIncidentAlertRow>(
    supabase.from('ai_incident_alerts').insert(input).select().single(),
  );
}

// --- Incident Timeline ----------------------------------------------------------

export function getAiIncidentTimeline(incidentId: string): Promise<AiOpsResult<AiIncidentTimelineRow[]>> {
  return runQuery<AiIncidentTimelineRow[]>(
    supabase.from('ai_incident_timeline').select('*').eq('incident_id', incidentId).order('created_at', { ascending: true }),
  );
}

export function getAllAiIncidentTimeline(): Promise<AiOpsResult<AiIncidentTimelineRow[]>> {
  return runQuery<AiIncidentTimelineRow[]>(
    supabase.from('ai_incident_timeline').select('*').order('created_at', { ascending: true }),
  );
}

// Append-only timeline input. `incident_id` is the resolved `ai_incidents.id`
// UUID. No update/delete functions are provided — history is never overwritten.
export interface AiIncidentTimelineInput {
  incident_id: string;
  event_type?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  actor_reference?: string | null;
  actor_role?: string | null;
  summary?: string | null;
}

export function appendAiIncidentTimeline(
  input: AiIncidentTimelineInput,
): Promise<AiOpsResult<AiIncidentTimelineRow>> {
  return runQuery<AiIncidentTimelineRow>(
    supabase.from('ai_incident_timeline').insert(input).select().single(),
  );
}

// --- Notifications & Escalations (Phase 2 Prompt 12) ---------------------------

// --- Notification Rules ---------------------------------------------------------

export function getAiNotificationRules(): Promise<AiOpsResult<AiNotificationRuleRow[]>> {
  return runQuery<AiNotificationRuleRow[]>(
    supabase.from('ai_notification_rules').select('*').order('name', { ascending: true }),
  );
}

export function getAiNotificationRuleByKey(ruleKey: string): Promise<AiOpsResult<AiNotificationRuleRow>> {
  return runQuery<AiNotificationRuleRow>(
    supabase.from('ai_notification_rules').select('*').eq('rule_key', ruleKey).maybeSingle(),
  );
}

// Notification rule metadata input. `rule_key` is the stable identifier (used
// by routes). `site_id` is the resolved ai_sites.id UUID (resolved by the
// caller). `channels` is a safe array of channel strings. No delivery occurs —
// saving a rule never sends a message. No secrets.
export interface AiNotificationRuleUpsertInput {
  rule_key: string;
  name: string;
  description?: string | null;
  event_type?: string | null;
  scope?: string | null;
  site_id?: string | null;
  severity_minimum?: string | null;
  priority_minimum?: string | null;
  environment?: string;
  status?: string | null;
  channels?: string[] | null;
  recipient_scope?: string | null;
  recipient_reference?: string | null;
  acknowledgement_required?: boolean;
  acknowledgement_timeout_minutes?: number | null;
  escalation_enabled?: boolean;
  escalation_policy_key?: string | null;
  quiet_hours_policy_key?: string | null;
  dedupe_window_minutes?: number | null;
  suppression_enabled?: boolean;
  approval_required?: boolean;
  audit_required?: boolean;
  owner_team?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiNotificationRule(
  input: AiNotificationRuleUpsertInput,
): Promise<AiOpsResult<AiNotificationRuleRow>> {
  return runQuery<AiNotificationRuleRow>(
    supabase.from('ai_notification_rules').insert(input).select().single(),
  );
}

export function updateAiNotificationRule(
  ruleKey: string,
  input: Partial<AiNotificationRuleUpsertInput>,
): Promise<AiOpsResult<AiNotificationRuleRow>> {
  return runQuery<AiNotificationRuleRow>(
    supabase.from('ai_notification_rules').update(input).eq('rule_key', ruleKey).select().single(),
  );
}

// --- Escalation Policies & Levels ----------------------------------------------

export function getAiEscalationPolicies(): Promise<AiOpsResult<AiEscalationPolicyRow[]>> {
  return runQuery<AiEscalationPolicyRow[]>(
    supabase.from('ai_escalation_policies').select('*').order('name', { ascending: true }),
  );
}

export function getAiEscalationLevels(): Promise<AiOpsResult<AiEscalationLevelRow[]>> {
  return runQuery<AiEscalationLevelRow[]>(
    supabase.from('ai_escalation_levels').select('*').order('level_number', { ascending: true }),
  );
}

// --- Notification Events --------------------------------------------------------

export function getAiNotificationEvents(): Promise<AiOpsResult<AiNotificationEventRow[]>> {
  return runQuery<AiNotificationEventRow[]>(
    supabase.from('ai_notification_events').select('*').order('created_at', { ascending: false }),
  );
}

export function getAiNotificationEventByKey(eventKey: string): Promise<AiOpsResult<AiNotificationEventRow>> {
  return runQuery<AiNotificationEventRow>(
    supabase.from('ai_notification_events').select('*').eq('event_key', eventKey).maybeSingle(),
  );
}

// Notification event input (append-oriented). `rule_id`/`alert_id`/`incident_id`/
// `approval_id`/`run_id`/`site_id` are resolved UUIDs (resolved by the caller).
// No delivery occurs — this records configuration/operational history only.
export interface AiNotificationEventInput {
  event_key: string;
  rule_id?: string | null;
  escalation_policy_id?: string | null;
  alert_id?: string | null;
  incident_id?: string | null;
  approval_id?: string | null;
  run_id?: string | null;
  site_id?: string | null;
  event_type?: string | null;
  severity?: string | null;
  priority?: string | null;
  environment?: string;
  channel?: string | null;
  recipient_scope?: string | null;
  recipient_reference?: string | null;
  status?: string | null;
  delivery_state?: string | null;
  acknowledgement_state?: string | null;
  escalation_level?: number | null;
  dedupe_key?: string | null;
  suppressed?: boolean;
  suppression_reason?: string | null;
  correlation_id?: string | null;
  summary?: string | null;
}

export function createAiNotificationEvent(
  input: AiNotificationEventInput,
): Promise<AiOpsResult<AiNotificationEventRow>> {
  return runQuery<AiNotificationEventRow>(
    supabase.from('ai_notification_events').insert(input).select().single(),
  );
}

// Acknowledgement metadata only — updates acknowledgement_state / acknowledged_by
// / acknowledged_at. Never triggers external actions or delivery.
export function acknowledgeAiNotificationEvent(
  eventKey: string,
  actor: string,
): Promise<AiOpsResult<AiNotificationEventRow>> {
  return runQuery<AiNotificationEventRow>(
    supabase
      .from('ai_notification_events')
      .update({
        acknowledgement_state: 'acknowledged',
        acknowledged_by: actor,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('event_key', eventKey)
      .select()
      .single(),
  );
}

// --- Quiet Hours Policies --------------------------------------------------------

export function getAiQuietHoursPolicies(): Promise<AiOpsResult<AiQuietHoursPolicyRow[]>> {
  return runQuery<AiQuietHoursPolicyRow[]>(
    supabase.from('ai_quiet_hours_policies').select('*').order('name', { ascending: true }),
  );
}

// --- Scheduling & Automation (Phase 2 Prompt 13) ------------------------------

// --- Schedules -----------------------------------------------------------------

export function getAiSchedules(): Promise<AiOpsResult<AiScheduleRow[]>> {
  return runQuery<AiScheduleRow[]>(
    supabase.from('ai_schedules').select('*').order('name', { ascending: true }),
  );
}

export function getAiScheduleByKey(scheduleKey: string): Promise<AiOpsResult<AiScheduleRow>> {
  return runQuery<AiScheduleRow>(
    supabase.from('ai_schedules').select('*').eq('schedule_key', scheduleKey).maybeSingle(),
  );
}

// Schedule metadata input. `schedule_key` is the stable identifier (used by
// routes). `site_id`/`agent_id`/`notification_rule_id` are resolved UUIDs
// (resolved by the caller). Saving a schedule NEVER registers a scheduler, runs
// a cron job, executes an agent or creates a run. No secrets accepted.
export interface AiScheduleUpsertInput {
  schedule_key: string;
  name: string;
  description?: string | null;
  automation_type?: string | null;
  trigger_type?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  notification_rule_id?: string | null;
  target_type?: string | null;
  target_reference?: string | null;
  schedule_expression?: string | null;
  recurrence_summary?: string | null;
  timezone?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  environment?: string;
  status?: string | null;
  risk_level?: string | null;
  priority?: string | null;
  approval_required?: boolean;
  audit_required?: boolean;
  quiet_hours_policy_key?: string | null;
  maintenance_behavior?: string | null;
  retry_policy?: Record<string, unknown> | null;
  configuration?: Record<string, unknown> | null;
  owner_team?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiSchedule(input: AiScheduleUpsertInput): Promise<AiOpsResult<AiScheduleRow>> {
  return runQuery<AiScheduleRow>(
    supabase.from('ai_schedules').insert(input).select().single(),
  );
}

export function updateAiSchedule(
  scheduleKey: string,
  input: Partial<AiScheduleUpsertInput>,
): Promise<AiOpsResult<AiScheduleRow>> {
  return runQuery<AiScheduleRow>(
    supabase.from('ai_schedules').update(input).eq('schedule_key', scheduleKey).select().single(),
  );
}

// --- Event Automation Rules ----------------------------------------------------

export function getAiEventAutomationRules(): Promise<AiOpsResult<AiEventAutomationRuleRow[]>> {
  return runQuery<AiEventAutomationRuleRow[]>(
    supabase.from('ai_event_automation_rules').select('*').order('name', { ascending: true }),
  );
}

export function getAiEventAutomationRuleByKey(
  eventRuleKey: string,
): Promise<AiOpsResult<AiEventAutomationRuleRow>> {
  return runQuery<AiEventAutomationRuleRow>(
    supabase.from('ai_event_automation_rules').select('*').eq('event_rule_key', eventRuleKey).maybeSingle(),
  );
}

// Event rule metadata input. `event_rule_key` is the stable identifier.
// `site_id`/`agent_id`/`notification_rule_id` are resolved UUIDs. Saving a rule
// NEVER listens for events or creates automatic runs/alerts/notifications.
export interface AiEventAutomationRuleUpsertInput {
  event_rule_key: string;
  name: string;
  description?: string | null;
  event_type?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  notification_rule_id?: string | null;
  action_type?: string | null;
  action_reference?: string | null;
  conditions?: Record<string, unknown> | null;
  dedupe_window_minutes?: number | null;
  cooldown_minutes?: number | null;
  environment?: string;
  status?: string | null;
  risk_level?: string | null;
  approval_required?: boolean;
  audit_required?: boolean;
  owner_team?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiEventAutomationRule(
  input: AiEventAutomationRuleUpsertInput,
): Promise<AiOpsResult<AiEventAutomationRuleRow>> {
  return runQuery<AiEventAutomationRuleRow>(
    supabase.from('ai_event_automation_rules').insert(input).select().single(),
  );
}

export function updateAiEventAutomationRule(
  eventRuleKey: string,
  input: Partial<AiEventAutomationRuleUpsertInput>,
): Promise<AiOpsResult<AiEventAutomationRuleRow>> {
  return runQuery<AiEventAutomationRuleRow>(
    supabase.from('ai_event_automation_rules').update(input).eq('event_rule_key', eventRuleKey).select().single(),
  );
}

// --- Maintenance Windows -------------------------------------------------------

export function getAiMaintenanceWindows(): Promise<AiOpsResult<AiMaintenanceWindowRow[]>> {
  return runQuery<AiMaintenanceWindowRow[]>(
    supabase.from('ai_maintenance_windows').select('*').order('starts_at', { ascending: true }),
  );
}

export function getAiMaintenanceWindowByKey(
  windowKey: string,
): Promise<AiOpsResult<AiMaintenanceWindowRow>> {
  return runQuery<AiMaintenanceWindowRow>(
    supabase.from('ai_maintenance_windows').select('*').eq('window_key', windowKey).maybeSingle(),
  );
}

// Maintenance-window metadata input. `window_key` is the stable identifier.
// `site_id` is a resolved UUID. Saving a window NEVER suppresses schedules,
// notifications, agents or alerts. `affected_references` is a safe label array.
export interface AiMaintenanceWindowUpsertInput {
  window_key: string;
  name: string;
  description?: string | null;
  scope?: string | null;
  site_id?: string | null;
  timezone?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string | null;
  suppress_schedules?: boolean;
  suppress_notifications?: boolean;
  affected_references?: string[] | null;
  reason?: string | null;
  owner_team?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiMaintenanceWindow(
  input: AiMaintenanceWindowUpsertInput,
): Promise<AiOpsResult<AiMaintenanceWindowRow>> {
  return runQuery<AiMaintenanceWindowRow>(
    supabase.from('ai_maintenance_windows').insert(input).select().single(),
  );
}

export function updateAiMaintenanceWindow(
  windowKey: string,
  input: Partial<AiMaintenanceWindowUpsertInput>,
): Promise<AiOpsResult<AiMaintenanceWindowRow>> {
  return runQuery<AiMaintenanceWindowRow>(
    supabase.from('ai_maintenance_windows').update(input).eq('window_key', windowKey).select().single(),
  );
}

// --- Schedule History ----------------------------------------------------------

export function getAiScheduleHistory(
  scheduleId?: string,
): Promise<AiOpsResult<AiScheduleHistoryRow[]>> {
  const query = supabase.from('ai_schedule_history').select('*');
  const scoped = scheduleId ? query.eq('schedule_id', scheduleId) : query;
  return runQuery<AiScheduleHistoryRow[]>(scoped.order('observed_at', { ascending: true }));
}

// Append-only history input. `schedule_id`/`event_rule_id` are resolved UUIDs
// (resolved by the caller). Historical metadata only — never proof of execution.
// No update/delete functions are provided.
export interface AiScheduleHistoryInput {
  schedule_id?: string | null;
  event_rule_id?: string | null;
  event_type?: string | null;
  planned_for?: string | null;
  observed_at?: string | null;
  status?: string | null;
  actor_reference?: string | null;
  summary?: string | null;
  correlation_id?: string | null;
}

export function appendAiScheduleHistory(
  input: AiScheduleHistoryInput,
): Promise<AiOpsResult<AiScheduleHistoryRow>> {
  return runQuery<AiScheduleHistoryRow>(
    supabase.from('ai_schedule_history').insert(input).select().single(),
  );
}

// --- Master Orchestrator (Phase 2 Prompt 14) ----------------------------------

// --- Orchestrations ------------------------------------------------------------

export function getAiOrchestrations(): Promise<AiOpsResult<AiOrchestrationRow[]>> {
  return runQuery<AiOrchestrationRow[]>(
    supabase.from('ai_orchestrations').select('*').order('requested_at', { ascending: false }),
  );
}

export function getAiOrchestrationByKey(
  orchestrationKey: string,
): Promise<AiOpsResult<AiOrchestrationRow>> {
  return runQuery<AiOrchestrationRow>(
    supabase.from('ai_orchestrations').select('*').eq('orchestration_key', orchestrationKey).maybeSingle(),
  );
}

// Orchestration request metadata input. `orchestration_key` is the stable
// identifier (used by routes). `site_id`/`selected_agent_id`/`approval_id`/
// `run_id` are resolved UUIDs (resolved by the caller). Saving a request NEVER
// creates a run, executes an agent, calls a tool/model, or triggers n8n.
// `execution_allowed` must remain false. No secrets accepted.
export interface AiOrchestrationUpsertInput {
  orchestration_key: string;
  title: string;
  description?: string | null;
  request_type?: string | null;
  request_source?: string | null;
  requested_action?: string | null;
  site_id?: string | null;
  environment?: string;
  priority?: string | null;
  risk_level?: string | null;
  status?: string | null;
  classification?: string | null;
  classification_confidence?: string | null;
  selected_agent_id?: string | null;
  approval_id?: string | null;
  run_id?: string | null;
  policy_result?: string | null;
  permission_result?: string | null;
  approval_required?: boolean;
  verification_required?: boolean;
  uat_required?: boolean;
  audit_required?: boolean;
  execution_allowed?: boolean;
  blocked_reason?: string | null;
  correlation_id?: string | null;
  failure_strategy?: string | null;
  fallback_strategy?: string | null;
  result_summary?: string | null;
  requested_by?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiOrchestration(
  input: AiOrchestrationUpsertInput,
): Promise<AiOpsResult<AiOrchestrationRow>> {
  return runQuery<AiOrchestrationRow>(
    supabase.from('ai_orchestrations').insert(input).select().single(),
  );
}

export function updateAiOrchestration(
  orchestrationKey: string,
  input: Partial<AiOrchestrationUpsertInput>,
): Promise<AiOpsResult<AiOrchestrationRow>> {
  return runQuery<AiOrchestrationRow>(
    supabase.from('ai_orchestrations').update(input).eq('orchestration_key', orchestrationKey).select().single(),
  );
}

// --- Orchestration Steps -------------------------------------------------------

export function getAiOrchestrationSteps(
  orchestrationId: string,
): Promise<AiOpsResult<AiOrchestrationStepRow[]>> {
  return runQuery<AiOrchestrationStepRow[]>(
    supabase.from('ai_orchestration_steps').select('*').eq('orchestration_id', orchestrationId).order('step_number', { ascending: true }),
  );
}

export function getAllAiOrchestrationSteps(): Promise<AiOpsResult<AiOrchestrationStepRow[]>> {
  return runQuery<AiOrchestrationStepRow[]>(
    supabase.from('ai_orchestration_steps').select('*').order('step_number', { ascending: true }),
  );
}

// Planned step input. `orchestration_id`/`agent_id` are resolved UUIDs
// (resolved by the caller). `tool_references`/`knowledge_references` are safe
// string arrays. Planned workflow metadata only — no run is created.
export interface AiOrchestrationStepInput {
  orchestration_id: string;
  step_number: number;
  name?: string | null;
  step_type?: string | null;
  agent_id?: string | null;
  status?: string | null;
  risk_level?: string | null;
  approval_required?: boolean;
  tool_references?: string[] | null;
  knowledge_references?: string[] | null;
  model_reference?: string | null;
  input_summary?: string | null;
  expected_output?: string | null;
  result_summary?: string | null;
}

export function createAiOrchestrationStep(
  input: AiOrchestrationStepInput,
): Promise<AiOpsResult<AiOrchestrationStepRow>> {
  return runQuery<AiOrchestrationStepRow>(
    supabase.from('ai_orchestration_steps').insert(input).select().single(),
  );
}

// --- Candidate Scoring ---------------------------------------------------------

export function getAiOrchestrationCandidates(
  orchestrationId: string,
): Promise<AiOpsResult<AiOrchestrationCandidateRow[]>> {
  return runQuery<AiOrchestrationCandidateRow[]>(
    supabase.from('ai_orchestration_candidates').select('*').eq('orchestration_id', orchestrationId).order('rank', { ascending: true }),
  );
}

// Candidate scoring input. `orchestration_id`/`agent_id` are resolved UUIDs.
// Registry eligibility scoring metadata only — runtime availability is not
// implied. No secrets.
export interface AiOrchestrationCandidateInput {
  orchestration_id: string;
  agent_id: string;
  rank?: number;
  score?: number | null;
  capability_score?: number | null;
  availability_score?: number | null;
  policy_score?: number | null;
  tool_score?: number | null;
  knowledge_score?: number | null;
  model_score?: number | null;
  risk_score?: number | null;
  eligible?: boolean;
  rejection_reason?: string | null;
  selection_reason?: string | null;
}

export function createAiOrchestrationCandidate(
  input: AiOrchestrationCandidateInput,
): Promise<AiOpsResult<AiOrchestrationCandidateRow>> {
  return runQuery<AiOrchestrationCandidateRow>(
    supabase.from('ai_orchestration_candidates').insert(input).select().single(),
  );
}

// --- Routing Decisions (append-oriented) ---------------------------------------

export function getAiOrchestrationDecisions(
  orchestrationId: string,
): Promise<AiOpsResult<AiOrchestrationDecisionRow[]>> {
  return runQuery<AiOrchestrationDecisionRow[]>(
    supabase.from('ai_orchestration_decisions').select('*').eq('orchestration_id', orchestrationId).order('created_at', { ascending: true }),
  );
}

export function getAllAiOrchestrationDecisions(): Promise<AiOpsResult<AiOrchestrationDecisionRow[]>> {
  return runQuery<AiOrchestrationDecisionRow[]>(
    supabase.from('ai_orchestration_decisions').select('*').order('created_at', { ascending: true }),
  );
}

// Append-only decision input. `orchestration_id` is the resolved UUID. Records
// display-safe business/governance reasoning only — never overwritten. No
// secrets or hidden chain-of-thought.
export interface AiOrchestrationDecisionInput {
  orchestration_id: string;
  decision_type?: string | null;
  decision?: string | null;
  reason?: string | null;
  actor_type?: string | null;
  actor_reference?: string | null;
  policy_reference?: string | null;
  agent_reference?: string | null;
  previous_state?: string | null;
  new_state?: string | null;
}

export function appendAiOrchestrationDecision(
  input: AiOrchestrationDecisionInput,
): Promise<AiOpsResult<AiOrchestrationDecisionRow>> {
  return runQuery<AiOrchestrationDecisionRow>(
    supabase.from('ai_orchestration_decisions').insert(input).select().single(),
  );
}

// --- Cost, Usage & Budgets (Phase 2 Prompt 15) --------------------------------

// --- Budgets ------------------------------------------------------------------

export function getAiBudgets(): Promise<AiOpsResult<AiBudgetRow[]>> {
  return runQuery<AiBudgetRow[]>(
    supabase.from('ai_budgets').select('*').order('created_at', { ascending: true }),
  );
}

export function getAiBudgetByKey(budgetKey: string): Promise<AiOpsResult<AiBudgetRow>> {
  return runQuery<AiBudgetRow>(
    supabase.from('ai_budgets').select('*').eq('budget_key', budgetKey).maybeSingle(),
  );
}

// Budget configuration input. `budget_key` is the stable identifier.
// `site_id`/`agent_id`/`model_id`/`provider_id` are resolved UUIDs (resolved by
// the caller, never here). `currency` is a safe ISO code. Budget values are
// configuration/reporting metadata only — never enforced against runtime. No
// billing credentials.
export interface AiBudgetUpsertInput {
  budget_key: string;
  name: string;
  description?: string | null;
  scope_type?: string;
  scope_reference?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  model_id?: string | null;
  provider_id?: string | null;
  environment?: string;
  period_type?: string;
  currency?: string;
  budget_amount?: number | null;
  warning_threshold_percent?: number | null;
  critical_threshold_percent?: number | null;
  current_usage_amount?: number;
  forecast_amount?: number | null;
  status?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  owner_team?: string | null;
  approval_required?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export function createAiBudget(input: AiBudgetUpsertInput): Promise<AiOpsResult<AiBudgetRow>> {
  return runQuery<AiBudgetRow>(
    supabase.from('ai_budgets').insert(input).select().single(),
  );
}

export function updateAiBudget(
  budgetKey: string,
  input: Partial<AiBudgetUpsertInput>,
): Promise<AiOpsResult<AiBudgetRow>> {
  return runQuery<AiBudgetRow>(
    supabase.from('ai_budgets').update(input).eq('budget_key', budgetKey).select().single(),
  );
}

// --- Usage costs --------------------------------------------------------------

export function getAiUsageCosts(): Promise<AiOpsResult<AiUsageCostRow[]>> {
  return runQuery<AiUsageCostRow[]>(
    supabase.from('ai_usage_costs').select('*').order('occurred_at', { ascending: false }),
  );
}

export function getAiUsageCostsBySite(siteId: string): Promise<AiOpsResult<AiUsageCostRow[]>> {
  return runQuery<AiUsageCostRow[]>(
    supabase.from('ai_usage_costs').select('*').eq('site_id', siteId).order('occurred_at', { ascending: false }),
  );
}

export function getAiUsageCostsByAgent(agentId: string): Promise<AiOpsResult<AiUsageCostRow[]>> {
  return runQuery<AiUsageCostRow[]>(
    supabase.from('ai_usage_costs').select('*').eq('agent_id', agentId).order('occurred_at', { ascending: false }),
  );
}

export function getAiUsageCostsByModel(modelId: string): Promise<AiOpsResult<AiUsageCostRow[]>> {
  return runQuery<AiUsageCostRow[]>(
    supabase.from('ai_usage_costs').select('*').eq('model_id', modelId).order('occurred_at', { ascending: false }),
  );
}

export function getAiUsageCostsByProvider(providerId: string): Promise<AiOpsResult<AiUsageCostRow[]>> {
  return runQuery<AiUsageCostRow[]>(
    supabase.from('ai_usage_costs').select('*').eq('provider_id', providerId).order('occurred_at', { ascending: false }),
  );
}

// Append-only usage/cost input. Optional FKs are resolved UUIDs (resolved by
// the caller). `is_estimate`/`cost_source` must be set honestly for migrated
// baselines. No provider billing is called.
export interface AiUsageCostInput {
  usage_key: string;
  occurred_at?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  model_id?: string | null;
  provider_id?: string | null;
  usage_type?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
  input_units?: number | null;
  output_units?: number | null;
  total_units?: number | null;
  unit_type?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  currency?: string;
  cost_source?: string | null;
  environment?: string;
  correlation_id?: string | null;
  is_estimate?: boolean;
  metadata?: Record<string, unknown> | null;
}

export function createAiUsageCost(input: AiUsageCostInput): Promise<AiOpsResult<AiUsageCostRow>> {
  return runQuery<AiUsageCostRow>(
    supabase.from('ai_usage_costs').insert(input).select().single(),
  );
}

// --- Budget events ------------------------------------------------------------

export function getAiBudgetEvents(): Promise<AiOpsResult<AiBudgetEventRow[]>> {
  return runQuery<AiBudgetEventRow[]>(
    supabase.from('ai_budget_events').select('*').order('created_at', { ascending: false }),
  );
}

export function getAiBudgetEventsByBudget(budgetId: string): Promise<AiOpsResult<AiBudgetEventRow[]>> {
  return runQuery<AiBudgetEventRow[]>(
    supabase.from('ai_budget_events').select('*').eq('budget_id', budgetId).order('created_at', { ascending: false }),
  );
}

// Append-only governance event input. `budget_id` is the resolved ai_budgets.id
// UUID. No external notification is sent from these records.
export interface AiBudgetEventInput {
  event_key: string;
  budget_id?: string | null;
  event_type: string;
  threshold_percent?: number | null;
  observed_amount?: number | null;
  budget_amount?: number | null;
  forecast_amount?: number | null;
  status?: string;
  severity?: string;
  acknowledged?: boolean;
  summary?: string | null;
}

export function createAiBudgetEvent(input: AiBudgetEventInput): Promise<AiOpsResult<AiBudgetEventRow>> {
  return runQuery<AiBudgetEventRow>(
    supabase.from('ai_budget_events').insert(input).select().single(),
  );
}

// Acknowledgement metadata only — sets acknowledged/acknowledged_by/
// acknowledged_at. Never triggers external actions. No notifications.
export function acknowledgeAiBudgetEvent(
  eventKey: string,
  actor: string,
): Promise<AiOpsResult<AiBudgetEventRow>> {
  return runQuery<AiBudgetEventRow>(
    supabase
      .from('ai_budget_events')
      .update({
        acknowledged: true,
        acknowledged_by: actor,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('event_key', eventKey)
      .select()
      .single(),
  );
}

// --- Re-exports for convenience ----------------------------------------------

export type {
  AiSiteRow,
  AiAgentRow,
  AiTaskRow,
  AiRunRow,
  AiRunStepRow,
  AiApprovalRow,
  AiAuditEventRow,
  AiAuditEvidenceRow,
  AiApprovalHistoryRow,
  AiOpsResult,
  AiSecurityPolicyRow,
  AiPolicyEvaluationRow,
  AiToolConnectionRow,
  AiToolAgentAccessRow,
  AiModelProviderRow,
  AiOperationsModelRow,
  AiAgentModelAssignmentRow,
  AiKnowledgeSourceRow,
  AiKnowledgePermissionRow,
  AiIncidentMemoryRow,
  AiAlertRow,
  AiIncidentRow,
  AiIncidentAlertRow,
  AiIncidentTimelineRow,
  AiNotificationRuleRow,
  AiEscalationPolicyRow,
  AiEscalationLevelRow,
  AiNotificationEventRow,
  AiQuietHoursPolicyRow,
  AiScheduleRow,
  AiEventAutomationRuleRow,
  AiMaintenanceWindowRow,
  AiScheduleHistoryRow,
  AiOrchestrationRow,
  AiOrchestrationStepRow,
  AiOrchestrationCandidateRow,
  AiOrchestrationDecisionRow,
  AiBudgetRow,
  AiUsageCostRow,
  AiBudgetEventRow,
} from '@/lib/ai-operations/types';
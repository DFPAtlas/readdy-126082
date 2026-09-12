// ============================================================================
// AI Operations — Supabase persistence row types (Phase 2 core foundation).
//
// These mirror the six core tables created in the Phase 2 Prompt 01 migration:
//   ai_sites, ai_operations_agents, ai_tasks, ai_runs, ai_run_steps,
//   ai_approvals.
//
// Values are kept as free-form strings (matching the existing frontend status
// unions) rather than database enums, so the two stay compatible as the
// platform evolves. No secrets are represented in these shapes.
// ============================================================================

export interface AiSiteRow {
  id: string;
  site_key: string;
  name: string;
  product_name: string | null;
  domain: string | null;
  description: string | null;
  business_type: string | null;
  environment: string;
  operational_status: string;
  ai_status: string;
  criticality: string | null;
  owner_team: string | null;
  repository_reference: string | null;
  readdy_reference: string | null;
  supabase_reference: string | null;
  n8n_reference: string | null;
  billing_provider: string | null;
  email_provider: string | null;
  authentication_provider: string | null;
  hosting_provider: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiAgentRow {
  id: string;
  agent_key: string;
  name: string;
  description: string | null;
  agent_type: string | null;
  category: string | null;
  site_id: string | null;
  environment: string;
  status: string;
  health: string;
  risk_level: string | null;
  autonomy_level: string | null;
  owner_team: string | null;
  escalation_team: string | null;
  primary_model_reference: string | null;
  fallback_model_reference: string | null;
  prompt_version_reference: string | null;
  current_task: string | null;
  current_run_id: string | null;
  queue_count: number;
  success_rate: number | null;
  notes: string | null;
  parent_agent_id: string | null;
  workflow_id: string | null;
  runtime_reference: string | null;
  responsibility: string | null;
  setup_stage: string | null;
  last_validated_at: string | null;
  last_validation_result: string | null;
  deployment_status: string;
  approval_required: boolean;
  data_scope: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiTaskRow {
  id: string;
  task_key: string;
  name: string;
  description: string | null;
  task_type: string | null;
  site_id: string | null;
  requested_by: string | null;
  trigger_source: string | null;
  priority: string | null;
  risk_level: string | null;
  environment: string;
  status: string;
  approval_required: boolean;
  verification_required: boolean;
  uat_required: boolean;
  audit_required: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiRunRow {
  id: string;
  run_key: string;
  task_id: string | null;
  parent_run_id: string | null;
  root_run_id: string | null;
  correlation_id: string | null;
  site_id: string | null;
  agent_id: string | null;
  status: string;
  priority: string | null;
  risk_level: string | null;
  environment: string;
  queue_position: number | null;
  current_step: number | null;
  total_steps: number | null;
  attempts: number;
  max_attempts: number | null;
  retry_count: number;
  estimated_cost: number | null;
  actual_cost: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_summary: string | null;
  result_summary: string | null;
  approval_required: boolean;
  approval_id: string | null;
  verification_required: boolean;
  uat_required: boolean;
  audit_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiRunStepRow {
  id: string;
  run_id: string;
  step_number: number;
  name: string | null;
  agent_id: string | null;
  status: string;
  risk_level: string | null;
  approval_required: boolean;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  input_summary: string | null;
  output_summary: string | null;
  error_summary: string | null;
  created_at: string;
}

export interface AiApprovalRow {
  id: string;
  approval_key: string;
  title: string | null;
  description: string | null;
  site_id: string | null;
  agent_id: string | null;
  run_id: string | null;
  requested_action: string | null;
  request_type: string | null;
  risk_class: string | null;
  severity: string | null;
  environment: string;
  status: string;
  requested_by: string | null;
  requested_at: string;
  required_team: string | null;
  minimum_approvers: number;
  current_approval_count: number;
  expires_at: string | null;
  business_justification: string | null;
  reasoning_summary: string | null;
  expected_result: string | null;
  potential_impact: string | null;
  rollback_available: boolean;
  rollback_summary: string | null;
  verification_required: boolean;
  uat_required: boolean;
  audit_required: boolean;
  decision: string | null;
  decision_reason: string | null;
  decision_actor: string | null;
  decision_at: string | null;
  conditions: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// A structured result returned by every access function. `data` is populated
// on success, `error` is a sanitised, user-safe message on failure.
export interface AiOpsResult<T> {
  data: T | null;
  error: string | null;
}

// --- Audit & Evidence + Approval History (Phase 2 Prompt 06) ------------------

export interface AiAuditEventRow {
  id: string;
  audit_key: string;
  occurred_at: string | null;
  event_type: string | null;
  action: string | null;
  outcome: string | null;
  severity: string | null;
  site_id: string | null;
  agent_id: string | null;
  run_id: string | null;
  approval_id: string | null;
  actor_type: string | null;
  actor_reference: string | null;
  trigger_source: string | null;
  risk_level: string | null;
  environment: string | null;
  correlation_id: string | null;
  before_summary: string | null;
  after_summary: string | null;
  decision_reason: string | null;
  verification_state: string | null;
  uat_state: string | null;
  integrity_state: string | null;
  review_required: boolean;
  notes: string | null;
  created_at: string;
}

export interface AiAuditEvidenceRow {
  id: string;
  evidence_key: string;
  audit_event_id: string | null;
  evidence_type: string | null;
  title: string | null;
  source: string | null;
  reference_id: string | null;
  status: string | null;
  integrity_state: string | null;
  required: boolean;
  summary: string | null;
  captured_at: string | null;
  created_at: string;
}

export interface AiApprovalHistoryRow {
  id: string;
  approval_id: string;
  event_type: string | null;
  previous_status: string | null;
  new_status: string | null;
  decision: string | null;
  actor_reference: string | null;
  actor_role: string | null;
  reason: string | null;
  conditions: unknown;
  approval_count_before: number | null;
  approval_count_after: number | null;
  created_at: string;
}

// --- Security & Policy Engine (Phase 2 Prompt 07) ------------------------------

export interface AiSecurityPolicyRow {
  id: string;
  policy_key: string;
  name: string;
  description: string | null;
  category: string | null;
  effect: string | null;
  scope: string | null;
  site_id: string | null;
  agent_id: string | null;
  subject_type: string | null;
  subject_reference: string | null;
  action_pattern: string | null;
  risk_level: string | null;
  environment: string | null;
  priority: string | null;
  status: string | null;
  condition_summary: string | null;
  requirements: unknown;
  approval_required: boolean;
  audit_required: boolean;
  owner_team: string | null;
  version: string | null;
  effective_from: string | null;
  expires_at: string | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiPolicyEvaluationRow {
  id: string;
  evaluation_key: string;
  occurred_at: string | null;
  policy_id: string;
  site_id: string | null;
  agent_id: string | null;
  run_id: string | null;
  approval_id: string | null;
  subject_type: string | null;
  subject_reference: string | null;
  requested_action: string | null;
  requested_risk: string | null;
  environment: string | null;
  result: string | null;
  effect: string | null;
  matched: boolean;
  approval_required: boolean;
  reason: string | null;
  condition_summary: string | null;
  correlation_id: string | null;
  actor_type: string | null;
  actor_reference: string | null;
  created_at: string;
}

// --- Tools & Connections (Phase 2 Prompt 08) -----------------------------------

export interface AiToolConnectionRow {
  id: string;
  connection_key: string;
  name: string;
  description: string | null;
  category: string | null;
  provider: string | null;
  scope: string | null;
  site_id: string | null;
  connection_type: string | null;
  environment: string | null;
  status: string | null;
  health: string | null;
  risk_level: string | null;
  authentication_type: string | null;
  credential_reference: string | null;
  endpoint_reference: string | null;
  allowed_operations: unknown;
  restricted_operations: unknown;
  approval_required: boolean;
  audit_required: boolean;
  owner_team: string | null;
  technical_owner: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_summary: string | null;
  configuration_state: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiToolAgentAccessRow {
  id: string;
  connection_id: string;
  agent_id: string;
  access_level: string | null;
  allowed_operations: unknown;
  restricted_operations: unknown;
  approval_required: boolean;
  risk_limit: string | null;
  environment: string | null;
  reason: string | null;
  granted_by: string | null;
  granted_at: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Models & AI Providers (Phase 2 Prompt 09) ----------------------------------

// Provider catalogue row. `credential_reference` / `endpoint_reference` are
// safe labels only — never values. No secrets are represented.
export interface AiModelProviderRow {
  id: string;
  provider_key: string;
  name: string;
  description: string | null;
  provider_type: string | null;
  hosting_type: string | null;
  environment: string | null;
  status: string | null;
  health: string | null;
  credential_reference: string | null;
  endpoint_reference: string | null;
  region: string | null;
  data_residency: string | null;
  supports_chat: boolean;
  supports_reasoning: boolean;
  supports_vision: boolean;
  supports_embeddings: boolean;
  supports_tools: boolean;
  supports_streaming: boolean;
  cost_tracking_enabled: boolean;
  health_monitoring_enabled: boolean;
  owner_team: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// AI Operations model registry row (dedicated table — no relationship to the
// unrelated `ai_models`). `model_key` is the stable application identifier;
// `provider_id` is the resolved `ai_model_providers.id` UUID.
export interface AiOperationsModelRow {
  id: string;
  model_key: string;
  provider_id: string;
  name: string;
  display_name: string | null;
  model_reference: string | null;
  description: string | null;
  model_type: string | null;
  hosting_type: string | null;
  environment: string | null;
  status: string | null;
  health: string | null;
  context_window: number | null;
  max_output_tokens: number | null;
  supports_reasoning: boolean;
  supports_vision: boolean;
  supports_embeddings: boolean;
  supports_tools: boolean;
  supports_code: boolean;
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
  currency: string | null;
  latency_class: string | null;
  quality_tier: string | null;
  risk_level: string | null;
  data_policy: string | null;
  fallback_priority: number | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Agent → model assignment row. `agent_id`/`model_id` are resolved UUIDs.
// Append-oriented — revoked via is_active=false, never deleted.
export interface AiAgentModelAssignmentRow {
  id: string;
  agent_id: string;
  model_id: string;
  assignment_type: string;
  priority: number | null;
  environment: string | null;
  max_cost_per_run: number | null;
  allowed_risk_level: string | null;
  fallback_enabled: boolean;
  reason: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  reviewed_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Knowledge & Memory (Phase 2 Prompt 10) -------------------------------------

// Knowledge source catalogue row. `knowledge_key` is the stable application
// identifier (used by routes). `source_reference` / `location_reference` are
// safe labels only — never document bodies or credentials. Registry + planning
// metadata only; no ingestion/indexing/embedding runtime is implied.
export interface AiKnowledgeSourceRow {
  id: string;
  knowledge_key: string;
  name: string;
  description: string | null;
  source_type: string | null;
  knowledge_type: string | null;
  scope: string | null;
  site_id: string | null;
  environment: string | null;
  status: string | null;
  health: string | null;
  classification: string | null;
  sensitivity: string | null;
  source_reference: string | null;
  location_reference: string | null;
  owner_team: string | null;
  authority_level: string | null;
  trust_level: string | null;
  ingestion_state: string | null;
  indexing_state: string | null;
  embedding_state: string | null;
  embedding_model_reference: string | null;
  last_ingested_at: string | null;
  last_verified_at: string | null;
  review_required: boolean;
  retention_policy: string | null;
  audit_required: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Agent → knowledge permission row. Append-oriented — revoked via
// is_active=false, never deleted. No secrets.
export interface AiKnowledgePermissionRow {
  id: string;
  knowledge_source_id: string;
  agent_id: string;
  access_level: string | null;
  purpose: string | null;
  environment: string | null;
  can_read: boolean;
  can_retrieve: boolean;
  can_reference: boolean;
  can_update_metadata: boolean;
  approval_required: boolean;
  risk_limit: string | null;
  granted_by: string | null;
  granted_at: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Incident / known-issue memory row. Sanitised summaries only — no raw private
// incident logs or customer content. `memory_key` is the stable identifier.
export interface AiIncidentMemoryRow {
  id: string;
  memory_key: string;
  title: string | null;
  summary: string | null;
  site_id: string | null;
  related_knowledge_source_id: string | null;
  incident_type: string | null;
  symptoms: unknown;
  known_cause: string | null;
  resolution_summary: string | null;
  prevention_summary: string | null;
  severity: string | null;
  environment: string | null;
  confidence: string | null;
  verification_state: string | null;
  status: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  recurrence_count: number;
  approved_for_reuse: boolean;
  owner_team: string | null;
  review_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Alerts & Incident Operations (Phase 2 Prompt 11) ---------------------------

// Operational alert registry row. `alert_key` is the stable application
// identifier (used by routes). `site_id`/`agent_id`/`run_id`/`approval_id`/
// `policy_id`/`connection_id`/`model_id` are resolved UUIDs (ON DELETE SET
// NULL). Observation/governance records only — no monitoring input, no
// automated remediation. No secrets, no raw logs.
export interface AiAlertRow {
  id: string;
  alert_key: string;
  title: string;
  summary: string | null;
  alert_type: string | null;
  source_type: string | null;
  source_reference: string | null;
  site_id: string | null;
  agent_id: string | null;
  run_id: string | null;
  approval_id: string | null;
  policy_id: string | null;
  connection_id: string | null;
  model_id: string | null;
  severity: string | null;
  priority: string | null;
  status: string | null;
  health_impact: string | null;
  risk_level: string | null;
  environment: string;
  correlation_id: string | null;
  occurrence_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  requires_incident: boolean;
  requires_approval: boolean;
  review_required: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Incident case row. `incident_key` is the stable application identifier.
// `known_issue_memory_key` is a safe stable text reference into
// ai_incident_memory (set only where a deterministic reference exists).
// Sanitised summaries only — no raw private logs.
export interface AiIncidentRow {
  id: string;
  incident_key: string;
  title: string;
  summary: string | null;
  site_id: string | null;
  severity: string | null;
  priority: string | null;
  status: string | null;
  incident_type: string | null;
  environment: string;
  lead_team: string | null;
  owner_reference: string | null;
  correlation_id: string | null;
  impact_summary: string | null;
  diagnostics_summary: string | null;
  suspected_cause: string | null;
  confirmed_cause: string | null;
  response_plan: string | null;
  resolution_summary: string | null;
  prevention_summary: string | null;
  known_issue_memory_key: string | null;
  approval_required: boolean;
  security_review_required: boolean;
  uat_required: boolean;
  started_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Incident ↔ alert mapping row. INSERT-only; FKs ON DELETE RESTRICT.
export interface AiIncidentAlertRow {
  id: string;
  incident_id: string;
  alert_id: string;
  relationship_type: string;
  created_at: string;
}

// Append-oriented incident timeline row. INSERT-only; history is never
// overwritten or deleted.
export interface AiIncidentTimelineRow {
  id: string;
  incident_id: string;
  event_type: string | null;
  previous_status: string | null;
  new_status: string | null;
  actor_reference: string | null;
  actor_role: string | null;
  summary: string | null;
  created_at: string;
}

// --- Notifications & Escalations (Phase 2 Prompt 12) ---------------------------

// Notification rule row. `rule_key` is the stable application identifier (used
// by routes). `channels` is a JSONB array of channel strings. `site_id` is a
// resolved ai_sites.id UUID (or null for group-wide). `escalation_policy_key`
// / `quiet_hours_policy_key` are stable text references into the dedicated
// escalation/quiet-hours tables. No delivery occurs — channels/recipients are
// configuration metadata only. No secrets or private contact details.
export interface AiNotificationRuleRow {
  id: string;
  rule_key: string;
  name: string;
  description: string | null;
  event_type: string | null;
  scope: string | null;
  site_id: string | null;
  severity_minimum: string | null;
  priority_minimum: string | null;
  environment: string;
  status: string | null;
  channels: unknown;
  recipient_scope: string | null;
  recipient_reference: string | null;
  acknowledgement_required: boolean;
  acknowledgement_timeout_minutes: number | null;
  escalation_enabled: boolean;
  escalation_policy_key: string | null;
  quiet_hours_policy_key: string | null;
  dedupe_window_minutes: number | null;
  suppression_enabled: boolean;
  approval_required: boolean;
  audit_required: boolean;
  owner_team: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Escalation policy row. `policy_key` is the stable identifier. Configuration
// metadata only — no escalation timer/runtime executes.
export interface AiEscalationPolicyRow {
  id: string;
  policy_key: string;
  name: string;
  description: string | null;
  scope: string | null;
  site_id: string | null;
  environment: string;
  status: string;
  max_level: number;
  acknowledgement_required: boolean;
  reset_on_acknowledge: boolean;
  owner_team: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Ordered escalation level row. FK ON DELETE RESTRICT. `channels` is a JSONB
// array. Configuration metadata only — no timer/runtime executes.
export interface AiEscalationLevelRow {
  id: string;
  escalation_policy_id: string;
  level_number: number;
  name: string | null;
  delay_minutes: number;
  recipient_scope: string | null;
  recipient_reference: string | null;
  channels: unknown;
  severity_override: string | null;
  requires_acknowledgement: boolean;
  created_at: string;
  updated_at: string;
}

// Notification event row (append-oriented operational history). `event_key` is
// the stable identifier. `delivery_state = 'demo_migrated'` marks the baseline
// — no external delivery is claimed. Optional FKs (rule/policy/alert/incident/
// approval/run/site) resolve to live rows where the key exists.
export interface AiNotificationEventRow {
  id: string;
  event_key: string;
  rule_id: string | null;
  escalation_policy_id: string | null;
  alert_id: string | null;
  incident_id: string | null;
  approval_id: string | null;
  run_id: string | null;
  site_id: string | null;
  event_type: string | null;
  severity: string | null;
  priority: string | null;
  environment: string;
  channel: string | null;
  recipient_scope: string | null;
  recipient_reference: string | null;
  status: string | null;
  delivery_state: string | null;
  acknowledgement_state: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  escalation_level: number | null;
  dedupe_key: string | null;
  suppressed: boolean;
  suppression_reason: string | null;
  correlation_id: string | null;
  summary: string | null;
  created_at: string;
}

// Quiet-hours policy row. `policy_key` is the stable identifier. Configuration
// metadata only — no scheduling runtime executes.
export interface AiQuietHoursPolicyRow {
  id: string;
  policy_key: string;
  name: string;
  scope: string | null;
  site_id: string | null;
  timezone: string;
  start_time: string | null;
  end_time: string | null;
  days: unknown;
  critical_bypass: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Scheduling & Automation (Phase 2 Prompt 13) -------------------------------

// Scheduled automation registry row. `schedule_key` is the stable application
// identifier (used by routes). `site_id`/`agent_id`/`notification_rule_id` are
// resolved UUIDs (ON DELETE SET NULL). `schedule_expression`, `retry_policy`
// and `configuration` are planning/configuration metadata only — the record is
// NEVER registered with a scheduler, and no cron/n8n/agent/run/notification
// execution is implied. No secrets.
export interface AiScheduleRow {
  id: string;
  schedule_key: string;
  name: string;
  description: string | null;
  automation_type: string | null;
  trigger_type: string | null;
  site_id: string | null;
  agent_id: string | null;
  notification_rule_id: string | null;
  target_type: string | null;
  target_reference: string | null;
  schedule_expression: string | null;
  recurrence_summary: string | null;
  timezone: string | null;
  start_at: string | null;
  end_at: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  environment: string;
  status: string | null;
  risk_level: string | null;
  priority: string | null;
  approval_required: boolean;
  audit_required: boolean;
  quiet_hours_policy_key: string | null;
  maintenance_behavior: string | null;
  retry_policy: unknown;
  configuration: unknown;
  owner_team: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Event-triggered automation rule row. `event_rule_key` is the stable
// identifier. `conditions` is a JSONB-safe object. Configuration metadata only
// — the rule is never an active runtime trigger. No secrets.
export interface AiEventAutomationRuleRow {
  id: string;
  event_rule_key: string;
  name: string;
  description: string | null;
  event_type: string | null;
  source_type: string | null;
  source_reference: string | null;
  site_id: string | null;
  agent_id: string | null;
  notification_rule_id: string | null;
  action_type: string | null;
  action_reference: string | null;
  conditions: unknown;
  dedupe_window_minutes: number | null;
  cooldown_minutes: number | null;
  environment: string;
  status: string | null;
  risk_level: string | null;
  approval_required: boolean;
  audit_required: boolean;
  owner_team: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Maintenance/suppression-window row. `window_key` is the stable identifier.
// Configuration metadata only — windows do NOT actually suppress schedules,
// notifications, agents or alerts. `affected_references` is a safe JSONB array
// of labels.
export interface AiMaintenanceWindowRow {
  id: string;
  window_key: string;
  name: string;
  description: string | null;
  scope: string | null;
  site_id: string | null;
  timezone: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  suppress_schedules: boolean;
  suppress_notifications: boolean;
  affected_references: unknown;
  reason: string | null;
  owner_team: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Append-oriented schedule/configuration history row. Historical metadata only
// — it is NOT proof that an automation executed. No UPDATE/DELETE.
export interface AiScheduleHistoryRow {
  id: string;
  schedule_id: string | null;
  event_rule_id: string | null;
  event_type: string | null;
  planned_for: string | null;
  observed_at: string;
  status: string | null;
  actor_reference: string | null;
  summary: string | null;
  correlation_id: string | null;
  created_at: string;
}

// --- Master Orchestrator (Phase 2 Prompt 14) ----------------------------------

// Top-level orchestration request / routing-plan row. `orchestration_key` is
// the stable application identifier (used by routes). `site_id` /
// `selected_agent_id` / `approval_id` / `run_id` are resolved UUIDs (ON DELETE
// SET NULL). Planning/governance metadata only — `execution_allowed` is FALSE
// for all migrated records and is NOT an Execute switch. No secrets.
export interface AiOrchestrationRow {
  id: string;
  orchestration_key: string;
  title: string;
  description: string | null;
  request_type: string | null;
  request_source: string | null;
  requested_action: string | null;
  site_id: string | null;
  environment: string;
  priority: string | null;
  risk_level: string | null;
  status: string | null;
  classification: string | null;
  classification_confidence: string | null;
  selected_agent_id: string | null;
  approval_id: string | null;
  run_id: string | null;
  policy_result: string | null;
  permission_result: string | null;
  approval_required: boolean;
  verification_required: boolean;
  uat_required: boolean;
  audit_required: boolean;
  execution_allowed: boolean;
  blocked_reason: string | null;
  correlation_id: string | null;
  failure_strategy: string | null;
  fallback_strategy: string | null;
  result_summary: string | null;
  requested_by: string | null;
  requested_at: string | null;
  completed_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Ordered orchestration plan step row. `orchestration_id` FK ON DELETE RESTRICT.
// `agent_id` resolved UUID (ON DELETE SET NULL). `tool_references` /
// `knowledge_references` are JSONB-safe arrays. Planned workflow metadata only.
export interface AiOrchestrationStepRow {
  id: string;
  orchestration_id: string;
  step_number: number;
  name: string | null;
  step_type: string | null;
  agent_id: string | null;
  status: string | null;
  risk_level: string | null;
  approval_required: boolean;
  tool_references: unknown;
  knowledge_references: unknown;
  model_reference: string | null;
  input_summary: string | null;
  expected_output: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

// Candidate-agent scoring row. `orchestration_id`/`agent_id` FK ON DELETE
// RESTRICT. Scoring metadata only — runtime availability is not implied.
export interface AiOrchestrationCandidateRow {
  id: string;
  orchestration_id: string;
  agent_id: string;
  rank: number;
  score: number | null;
  capability_score: number | null;
  availability_score: number | null;
  policy_score: number | null;
  tool_score: number | null;
  knowledge_score: number | null;
  model_score: number | null;
  risk_score: number | null;
  eligible: boolean;
  rejection_reason: string | null;
  selection_reason: string | null;
  created_at: string;
}

// Append-oriented routing/governance decision row. INSERT-only — history is
// never overwritten or deleted. Display-safe business reasoning only.
export interface AiOrchestrationDecisionRow {
  id: string;
  orchestration_id: string;
  decision_type: string | null;
  decision: string | null;
  reason: string | null;
  actor_type: string | null;
  actor_reference: string | null;
  policy_reference: string | null;
  agent_reference: string | null;
  previous_state: string | null;
  new_state: string | null;
  created_at: string;
}

// --- Cost, Usage & Budgets (Phase 2 Prompt 15) -------------------------------

// Budget registry row. `budget_key` is the stable application identifier.
// `site_id`/`agent_id`/`model_id`/`provider_id` are resolved UUIDs (ON DELETE
// SET NULL). Configuration + reporting metadata only — budget limits are NOT
// enforced against runtime. `currency` is a safe ISO code (e.g. GBP). No
// customer billing credentials.
export interface AiBudgetRow {
  id: string;
  budget_key: string;
  name: string;
  description: string | null;
  scope_type: string;
  scope_reference: string | null;
  site_id: string | null;
  agent_id: string | null;
  model_id: string | null;
  provider_id: string | null;
  environment: string;
  period_type: string;
  currency: string;
  budget_amount: number | null;
  warning_threshold_percent: number | null;
  critical_threshold_percent: number | null;
  current_usage_amount: number;
  forecast_amount: number | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  owner_team: string | null;
  approval_required: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Append-oriented usage/cost record. `usage_key` is the stable identifier.
// Optional FKs (site/agent/run/model/provider) resolve to live rows where the
// key exists. `is_estimate`/`cost_source` mark honest migrated baselines.
export interface AiUsageCostRow {
  id: string;
  usage_key: string;
  occurred_at: string;
  site_id: string | null;
  agent_id: string | null;
  run_id: string | null;
  model_id: string | null;
  provider_id: string | null;
  usage_type: string | null;
  source_type: string | null;
  source_reference: string | null;
  input_units: number | null;
  output_units: number | null;
  total_units: number | null;
  unit_type: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency: string;
  cost_source: string | null;
  environment: string;
  correlation_id: string | null;
  is_estimate: boolean;
  metadata: unknown;
  created_at: string;
}

// Append-oriented budget threshold/governance history row. `event_key` is the
// stable identifier. `budget_id` is the resolved ai_budgets.id UUID (ON DELETE
// RESTRICT). No external notification is sent from these records.
export interface AiBudgetEventRow {
  id: string;
  event_key: string;
  budget_id: string | null;
  event_type: string;
  threshold_percent: number | null;
  observed_amount: number | null;
  budget_amount: number | null;
  forecast_amount: number | null;
  status: string;
  severity: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  summary: string | null;
  created_at: string;
}
// ============================================================================
// Central Support Ticket System — TypeScript types
// Mirrors the database foundation created in
// supabase/migrations/202608231200_create_central_support_ticket_system.sql
// ============================================================================

export type TicketStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'waiting_on_staff'
  | 'resolved'
  | 'closed'
  | 'spam';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export type TicketCategory =
  | 'general'
  | 'technical'
  | 'account'
  | 'billing'
  | 'access'
  | 'bug'
  | 'complaint'
  | 'feature_request'
  | 'security'
  | 'other';

export type TicketSource = 'website' | 'email' | 'admin' | 'api' | 'ai_agent' | 'import';

export type TicketSenderType = 'customer' | 'staff' | 'system' | 'ai_agent';

// ---------------------------------------------------------------------------
// Support routing (Prompt 15) — teams, routing rules, assignment.
// ---------------------------------------------------------------------------
export type RoutingStatus = 'unrouted' | 'queued' | 'assigned' | 'needs_review' | 'escalated';

export type RoutingConfidence = 'high' | 'medium' | 'low';

export type RoutingStrategy = 'manual' | 'round_robin' | 'least_open_tickets';

export type TeamStatus = 'active' | 'archived';

// ---------------------------------------------------------------------------
// AI ticket triage (Prompt 16) — AI recommendation, never authoritative.
// ---------------------------------------------------------------------------
export type TriageStatus = 'queued' | 'running' | 'completed' | 'failed' | 'unavailable';

export type TriageConfidence = 'high' | 'medium' | 'low';

export interface SupportTicketTriage {
  id: string;
  ticket_id: string;
  status: TriageStatus;
  category: string | null;
  subcategory: string | null;
  suggested_priority: TicketPriority | null;
  suggested_team_id: string | null;
  suggested_team_name: string | null;
  confidence: TriageConfidence | null;
  confidence_score: number | null;
  summary: string | null;
  likely_issue: string | null;
  suggested_action: string | null;
  suggested_diagnostic: string | null;
  suggested_response: string | null;
  security_related: boolean;
  model_provider: string | null;
  requested_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  feedback_helpful: boolean | null;
  feedback_correct_category: boolean | null;
  feedback_correct_team: boolean | null;
  feedback_correct_priority: boolean | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// AI reply assistant (Prompt 17) — draft-only replies, never auto-sent.
// ---------------------------------------------------------------------------
export type AiReplyStatus = 'queued' | 'running' | 'completed' | 'failed' | 'unavailable';

export type AiReplyAction =
  | 'generate'
  | 'improve'
  | 'shorten'
  | 'friendlier'
  | 'technical'
  | 'simple';

export type AiReplyTone = 'professional' | 'friendly' | 'concise' | 'technical' | 'simple';

export interface AiReplyFact {
  kind: 'confirmed' | 'likely' | 'unknown';
  statement: string;
}

export interface AiReplySource {
  type: string;
  label: string;
}

export interface AiReplySuggestion {
  id: string;
  ticket_id: string;
  action: AiReplyAction;
  tone: AiReplyTone;
  status: AiReplyStatus;
  reply_text: string | null;
  facts_summary: AiReplyFact[] | null;
  sources: AiReplySource[] | null;
  feedback_helpful: boolean | null;
  feedback_reason: string | null;
  requested_by: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ---------------------------------------------------------------------------
// Knowledge base (Prompt 17) — reusable, approved support content.
// ---------------------------------------------------------------------------
export type KnowledgeStatus = 'draft' | 'review' | 'approved' | 'archived';

export type KnowledgeVisibility = 'customer_safe' | 'internal_only';

export interface KnowledgeArticle {
  id: string;
  title: string;
  site_id: string | null;
  site_name: string | null;
  category: string | null;
  subcategory: string | null;
  content: string;
  internal_notes: string | null;
  summary: string | null;
  visibility: KnowledgeVisibility;
  status: KnowledgeStatus;
  version: number;
  created_by: string | null;
  created_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  review_due: boolean;
}

// ---------------------------------------------------------------------------
// Resolution memory (Prompt 17) — sanitised records from resolved tickets.
// ---------------------------------------------------------------------------
export type ResolutionOutcome =
  | 'resolved'
  | 'partially_resolved'
  | 'workaround'
  | 'escalated'
  | 'known_issue';

export type ResolutionStatus = 'draft' | 'approved';

export interface ResolutionRecord {
  id: string;
  site_id: string | null;
  site_name: string | null;
  category: string | null;
  symptom: string | null;
  root_cause: string | null;
  diagnostic_evidence: string | null;
  resolution_action: string | null;
  outcome: ResolutionOutcome;
  customer_safe_summary: string | null;
  status: ResolutionStatus;
  created_from_ticket_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface SupportTeam {
  id: string;
  name: string;
  description: string | null;
  status: TeamStatus;
  manager_id: string | null;
  manager_name: string | null;
  routing_strategy: RoutingStrategy;
  member_count: number;
  site_ids: string[];
  site_names: string[];
  open_tickets: number;
  created_at: string;
}

export interface TeamWorkload {
  team_id: string;
  name: string;
  open_tickets: number;
  urgent_tickets: number;
  sla_risk: number;
  waiting_on_staff: number;
  escalated_tickets: number;
}

export interface SupportRoutingRule {
  id: string;
  name: string;
  rule_order: number;
  is_active: boolean;
  site_id: string | null;
  site_name: string | null;
  category: string | null;
  priority: string | null;
  keywords: string | null;
  match_security: boolean;
  match_billing: boolean;
  team_id: string;
  team_name: string | null;
  suggested_priority: string | null;
  requires_escalation: boolean;
  created_at: string;
}

export interface AssignableStaff {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  open_tickets: number;
}

export interface SupportSite {
  id: string;
  website_id: string | null;
  project_id: number | null;
  site_name: string;
  site_slug: string;
  domain: string | null;
  support_email: string | null;
  is_active: boolean;
  integration_mode: TicketIntegrationMode;
  allowed_origins: string[];
  archived_at: string | null;
  default_support_team_id: string | null;
  status: SiteStatus;
  environment: SiteEnvironment;
  support_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  site_id: string;
  project_id: number | null;
  external_reference: string | null;
  customer_user_id: string | null;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  assigned_to: string | null;
  assigned_agent: string | null;
  is_unread: boolean;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_customer_reply_at: string | null;
  last_staff_reply_at: string | null;
  last_activity_at: string;
  due_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  routing_status: RoutingStatus;
  routing_reason: string | null;
  routing_confidence: RoutingConfidence | null;
  routed_at: string | null;
  matched_rule_id: string | null;
  escalation_level: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: TicketSenderType;
  sender_user_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  message_body: string;
  message_format: string;
  is_internal_note: boolean;
  is_read: boolean;
  email_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  is_customer_visible: boolean;
  created_at: string;
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  actor_user_id: string | null;
  actor_type: string;
  event_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}

export interface TicketSlaRule {
  id: string;
  site_id: string | null;
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TicketIntegrationMode = 'public_form' | 'server_to_server';

// ---------------------------------------------------------------------------
// Site onboarding + connector management (Prompt 19).
// ---------------------------------------------------------------------------
export type SiteStatus = 'setup' | 'testing' | 'active' | 'degraded' | 'disabled';

export type SiteEnvironment = 'production' | 'staging' | 'test';

export type ConnectorType =
  | 'supabase'
  | 'rest_api'
  | 'n8n'
  | 'stripe'
  | 'email_provider'
  | 'custom_dfp';

export type ConnectorHealth = 'unknown' | 'operational' | 'degraded' | 'error' | 'disabled';

export type CapabilityKey =
  | 'ticket_intake'
  | 'customer_resolution'
  | 'diagnostics'
  | 'repairs'
  | 'view_as_customer'
  | 'ai_triage'
  | 'ai_reply'
  | 'knowledge'
  | 'billing'
  | 'email_delivery'
  | 'site_health';

export type CapabilityStatus =
  | 'configured'
  | 'not_configured'
  | 'testing'
  | 'operational'
  | 'error'
  | 'disabled';

export interface SupportSiteConnector {
  id: string;
  site_id: string;
  connector_type: ConnectorType;
  api_base_reference: string | null;
  credential_configured: boolean;
  n8n_workflow_reference: string | null;
  health_status: ConnectorHealth;
  needs_rotation: boolean;
  disabled: boolean;
  disabled_reason: string | null;
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportSiteCapability {
  id: string;
  site_id: string;
  capability: CapabilityKey;
  status: CapabilityStatus;
  enabled: boolean;
  required: boolean;
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type ConnectorTestStatus = 'pass' | 'fail' | 'not_configured' | 'error';

export interface ConnectorTest {
  id: string;
  site_id: string;
  capability: CapabilityKey;
  test_type: string;
  status: ConnectorTestStatus;
  started_at: string;
  completed_at: string | null;
  requested_by: string | null;
  safe_error: string | null;
  test_reference: string | null;
  created_at: string;
}

export interface N8nWorkflowStatus {
  diagnostics: 'configured' | 'not_configured';
  repairs: 'configured' | 'not_configured';
  ai_triage: 'configured' | 'not_configured';
  ai_reply: 'configured' | 'not_configured';
}

// Integration credential. Never contains the raw secret — only its hash and an
// encrypted ciphertext (both non-selectable through browser queries).
export interface TicketApiClient {
  id: string;
  site_id: string;
  client_name: string;
  integration_mode: TicketIntegrationMode;
  key_prefix: string;
  allowed_origins: string[];
  turnstile_required: boolean;
  elevated_priority_allowed: boolean;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketRateLimit {
  id: number;
  site_id: string;
  bucket: string;
  subject_hash: string;
  window_start: string;
  request_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketRequestLog {
  id: number;
  site_id: string;
  nonce_hash: string | null;
  idempotency_hash: string | null;
  request_timestamp: string;
  ticket_id: string | null;
  created_at: string;
  expires_at: string;
}

export type TicketNotificationType =
  | 'new_ticket'
  | 'customer_reply'
  | 'staff_reply'
  | 'assignment'
  | 'overdue'
  | 'urgent_ticket'
  | 'daily_summary';

export type TicketNotificationStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface TicketNotification {
  id: string;
  ticket_id: string | null;
  message_id: string | null;
  recipient_user_id: string | null;
  recipient_email: string;
  notification_type: TicketNotificationType;
  provider: string | null;
  provider_message_id: string | null;
  status: TicketNotificationStatus;
  attempt_count: number;
  last_error_code: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface TicketNotificationPreferences {
  id: string;
  user_id: string;
  notify_new_ticket: boolean;
  notify_customer_reply: boolean;
  notify_assignment: boolean;
  notify_overdue: boolean;
  notify_urgent: boolean;
  daily_summary: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketSiteSettings {
  id: string;
  site_id: string;
  notify_ticket_received: boolean;
  notify_staff_reply: boolean;
  notify_resolved: boolean;
  notify_closed: boolean;
  notify_reopened: boolean;
  enabled_categories: TicketCategory[];
  default_category: TicketCategory;
  max_public_priority: TicketPriority;
  default_priority: TicketPriority;
  auto_assign: boolean;
  default_assigned_user_id: string | null;
  notify_customer_confirmation: boolean;
  notify_staff_alert: boolean;
  captcha_required: boolean;
  max_attachment_size_mb: number;
  spam_protection_mode: SpamProtectionMode;
  acknowledgement_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteRateLimitConfig {
  id: string;
  site_id: string;
  network_per_15m: number;
  email_per_hour: number;
  failed_auth_threshold: number;
  block_minutes: number;
  max_body_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface SupportSiteStats {
  site_id: string;
  ticket_count: number;
  last_ticket_at: string | null;
  request_count_24h: number;
  last_request_at: string | null;
  active_credential_count: number;
  total_credential_count: number;
}

export interface SupportStaffMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export type SpamProtectionMode = 'standard' | 'strict' | 'off';

// ---------------------------------------------------------------------------
// Support Reports — summary metrics returned by internal_support_summary().
// ---------------------------------------------------------------------------
export interface SupportSummary {
  tickets_received: number;
  tickets_resolved: number;
  active_open: number;
  overdue_active: number;
  unassigned_active: number;
  customer_replies: number;
  staff_replies: number;
  sla_breaches: number;
}

export type ReportRangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

// ---------------------------------------------------------------------------
// Support Reports — ticket-volume series returned by internal_support_volume().
// One row per grouping bucket (day / week / month), each with four series.
// ---------------------------------------------------------------------------
export interface SupportVolumePoint {
  period: string;
  label: string;
  tickets_received: number;
  tickets_resolved: number;
  customer_replies: number;
  staff_replies: number;
}

export type VolumeGranularity = 'day' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Support Reports — website performance row returned by
// internal_support_site_performance(). One row per registered website.
// ---------------------------------------------------------------------------
export interface SupportSitePerformance {
  site_id: string;
  site_name: string;
  site_slug: string;
  domain: string | null;
  tickets_received: number;
  active_tickets: number;
  resolved_tickets: number;
  overdue_active: number;
  unassigned_active: number;
  last_ticket_received: string | null;
  avg_first_response_seconds: number | null;
  avg_resolution_seconds: number | null;
}

export type SitePerformanceSortKey =
  | 'received'
  | 'active'
  | 'overdue'
  | 'unassigned';

// ---------------------------------------------------------------------------
// Support Reports — SLA summary + breach rows.
// ---------------------------------------------------------------------------
export type SlaBreachType = 'first_response' | 'resolution';

export interface SupportSlaSummary {
  tickets_with_sla_target: number;
  completed_within_sla: number;
  completed_after_sla: number;
  active_overdue: number;
  first_response_breaches: number;
  resolution_breaches: number;
  total_breaches: number;
  compliance_percent: number | null;
}

export interface SupportSlaBreach {
  ticket_id: string;
  ticket_number: string;
  site_name: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_name: string | null;
  breach_type: SlaBreachType;
  due_time: string | null;
  breached_seconds: number | null;
  last_activity_at: string | null;
}

export type SlaBreachSortKey =
  | 'priority'
  | 'breach_type'
  | 'due_time'
  | 'breached_duration'
  | 'website';

// ---------------------------------------------------------------------------
// Support Reports — staff workload + unassigned summary.
// ---------------------------------------------------------------------------
export interface SupportStaffWorkload {
  user_id: string;
  staff_name: string | null;
  staff_email: string | null;
  open_assigned: number;
  overdue_assigned: number;
  critical_urgent_assigned: number;
  received: number;
  resolved: number;
  avg_first_response_seconds: number | null;
  avg_resolution_seconds: number | null;
  last_activity_at: string | null;
}

export type StaffWorkloadSortKey =
  | 'staff'
  | 'open'
  | 'overdue'
  | 'resolved'
  | 'response'
  | 'resolution';

export interface SupportUnassignedSummary {
  active_unassigned: number;
  overdue_unassigned: number;
  urgent_unassigned: number;
  critical_unassigned: number;
  oldest_ticket_id: string | null;
  oldest_ticket_number: string | null;
  oldest_created_at: string | null;
}

// ---------------------------------------------------------------------------
// Support Analytics (Prompt 18) — server-side aggregated operational metrics.
// ---------------------------------------------------------------------------

export interface SupportAnalyticsSite {
  site_id: string;
  site_name: string;
  site_slug: string;
  domain: string | null;
}

export interface SupportAnalyticsOverview {
  open_tickets: number;
  new_today: number;
  resolved_today: number;
  urgent_tickets: number;
  sla_at_risk: number;
  sla_breached: number;
  unassigned: number;
  needs_review: number;
  pending_repairs: number;
  active_sessions: number;
}

export type CategoryTrend = 'increasing' | 'decreasing' | 'stable';

export interface SupportCategoryStat {
  category: string;
  count: number;
  percent: number;
  avg_resolution_seconds: number | null;
  repeat_count: number;
  trend: CategoryTrend;
}

export interface SupportRecurringIssue {
  site_name: string;
  category: string;
  occurrences: number;
  trend: CategoryTrend;
  typical_resolution: string | null;
}

export interface DiagnosticScopeStat {
  scope: string;
  count: number;
  failures: number;
}

export interface SupportDiagnosticAnalytics {
  runs: number;
  completed: number;
  failed: number;
  cancelled: number;
  avg_duration_seconds: number | null;
  scopes: DiagnosticScopeStat[];
  leading_to_repair: number;
  leading_to_resolution: number;
}

export interface RepairBreakdown {
  action_type?: string;
  risk_level?: string;
  site_name?: string;
  count: number;
}

export interface SupportRepairAnalytics {
  requested: number;
  approved: number;
  rejected: number;
  completed: number;
  failed: number;
  verification_failed: number;
  pending_approval: number;
  success_rate: number | null;
  by_action_type: RepairBreakdown[];
  by_risk: RepairBreakdown[];
  by_site: RepairBreakdown[];
}

export interface SupportSessionAnalytics {
  started: number;
  completed: number;
  expired: number;
  revoked: number;
  avg_duration_seconds: number | null;
  sites_using_view_as_customer: number;
}

export interface SupportTriageAnalytics {
  runs: number;
  completed: number;
  failed: number;
  confidence: { high: number; medium: number; low: number };
  category_accepted: number;
  team_accepted: number;
  priority_accepted: number;
  manual_overrides: number;
  helpful: number;
  not_helpful: number;
  feedback_recorded: number;
}

export interface SupportReplyAnalytics {
  generated: number;
  used: number;
  discarded: number;
  helpful: number;
  not_helpful: number;
  reasons: { reason: string; count: number }[];
}

export interface SupportKnowledgeAnalytics {
  total_articles: number;
  approved_articles: number;
  stale_articles: number;
  articles_due_review: number;
  resolution_memories: number;
  approved_resolution_memories: number;
}

export interface RoutingTeamStat {
  team_name: string;
  routed: number;
  needs_review: number;
  default_fallback: number;
}

export interface SupportRoutingAnalytics {
  routed: number;
  needs_review: number;
  queued: number;
  unrouted: number;
  escalated: number;
  default_team_fallbacks: number;
  manual_overrides: number;
  by_team: RoutingTeamStat[];
}

export interface SupportEscalationAnalytics {
  escalated_tickets: number;
  security_escalations: number;
  technical_escalations: number;
  sla_escalations: number;
  repair_failures: number;
  by_type: { escalation_type: string; count: number }[];
}
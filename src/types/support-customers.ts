// ============================================================================
// DFP Command — Customer / User Resolution Foundation (Prompt 10)
// Types mirror the JSON shapes returned by the support_customer_* RPCs.
// ============================================================================

export type ResolutionStatus = 'resolved' | 'partial' | 'unresolved' | 'multiple';

export type DiagnosticStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CustomerSearchResult {
  customer_id: string;
  email: string | null;
  full_name: string | null;
  organisation_name: string | null;
  products: string | null;
  role: string | null;
  status: string | null;
  match_field: string;
  user_id_short: string | null;
}

export interface TicketAccountCustomer {
  customer_id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  email_verified: boolean | null;
  last_login: string | null;
  created_at: string | null;
}

export interface TicketAccountOrganisation {
  id: string;
  name: string | null;
  status: string | null;
  client_reference: string | null;
}

export interface TicketAccountProduct {
  id: string;
  name: string | null;
  primary_domain: string | null;
  status: string | null;
}

export interface TicketAccountSubscription {
  id: string;
  name: string | null;
  status: string | null;
  customer_reference: string | null;
  billing_state: string | null;
}

export interface TicketAccount {
  ticket_id: string;
  resolution_status: ResolutionStatus;
  link_source: 'auto' | 'manual';
  customer: TicketAccountCustomer;
  organisation: TicketAccountOrganisation | null;
  source_site: { site_id: string | null; product: string | null };
  products: TicketAccountProduct[] | null;
  subscription: TicketAccountSubscription | null;
}

export interface Customer360Overview {
  customer_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  email_verified: boolean | null;
  last_login: string | null;
  created_at: string | null;
}

export interface Customer360Organisation {
  id: string;
  name: string | null;
  status: string | null;
}

export interface Customer360Product {
  id: string;
  name: string | null;
  primary_domain: string | null;
  status: string | null;
  website_type: string | null;
}

export interface Customer360Subscription {
  id: string;
  name: string | null;
  status: string | null;
  customer_reference: string | null;
  billing_cycle: string | null;
}

export interface Customer360Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  priority: string;
  status: string;
  assigned_agent: string | null;
  created_at: string;
  site_name: string;
}

export interface Customer360Activity {
  id: string;
  action: string;
  ticket_id: string | null;
  site_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Customer360Diagnostic {
  id: string;
  status: DiagnosticStatus;
  requested_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Customer360 {
  overview: Customer360Overview;
  organisation: Customer360Organisation | null;
  products: Customer360Product[] | null;
  subscriptions: Customer360Subscription[] | null;
  tickets: Customer360Ticket[] | null;
  activity: Customer360Activity[] | null;
  diagnostics: Customer360Diagnostic[] | null;
}

// ============================================================================
// Automated Account Diagnostics (Prompt 11)
// ============================================================================

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'unavailable' | 'error';
export type CheckSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type OverallStatus = 'pass' | 'warning' | 'fail' | 'error';

export type ScopeKey = 'account' | 'authentication' | 'subscription' | 'email' | 'recent_errors';

export interface DiagnosticCheck {
  name: string;
  status: CheckStatus;
  message: string;
  severity: CheckSeverity;
  timestamp?: string;
  source?: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticAiSummary {
  likely_cause?: string;
  evidence?: string[];
  suggested_action?: string;
  confidence?: string;
}

export interface DiagnosticResultData {
  overall_status: OverallStatus;
  checks: DiagnosticCheck[];
  ai_summary: DiagnosticAiSummary | null;
  recommended_repair: RecommendedRepair | null;
}

export interface DiagnosticRunSummary {
  id: string;
  status: DiagnosticStatus;
  requested_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  error_message: string | null;
  diagnostic_scope: string | null;
  created_at: string;
}

export interface DiagnosticDetail extends DiagnosticRunSummary {
  customer_id: string | null;
  customer_name: string | null;
  site_id: string | null;
  site_name: string | null;
  user_id: string | null;
  ticket_id: string | null;
  requested_by_name: string | null;
  duration_ms: number | null;
  result_data: DiagnosticResultData | null;
}

// ============================================================================
// Human-Approved Account Repair Actions (Prompt 12)
// ============================================================================

export type RepairStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export type RepairRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RepairActionType =
  | 'resend_verification_email'
  | 'resend_password_reset_email'
  | 'retry_failed_email'
  | 'refresh_account_sync'
  | 'retry_failed_webhook'
  | 'rebuild_customer_mapping'
  | 'clear_safe_application_cache'
  | 'unlock_login'
  | 'reactivate_account'
  | 'refresh_permissions'
  | 'refresh_subscription_status'
  | 'subscription_modification'
  | 'role_modification'
  | 'financial_action'
  | 'account_deletion'
  | 'ownership_transfer'
  | 'security_credential_modification';

export interface RepairVerification {
  status: 'confirmed' | 'warning' | 'failed';
  message: string | null;
}

export interface RecommendedRepair {
  action_type: string;
  risk_level: RepairRiskLevel;
  problem_detected: string | null;
  reason: string | null;
  requested_change: string | null;
  current_value: string | null;
  proposed_value: string | null;
  security_related: boolean;
}

export interface SupportRepairAction {
  id: string;
  ticket_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  site_id: string | null;
  site_name: string | null;
  user_id: string | null;
  diagnostic_run_id: string | null;
  action_type: string;
  risk_level: RepairRiskLevel;
  status: RepairStatus;
  reason: string | null;
  problem_detected: string | null;
  requested_change: string | null;
  current_value: string | null;
  proposed_value: string | null;
  security_related: boolean;
  requested_by: string | null;
  requested_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  previous_state: string | null;
  new_state: string | null;
  verification: RepairVerification | null;
  result_summary: string | null;
  error_message: string | null;
}

export interface RepairMetrics {
  awaiting_approval: number;
  executing: number;
  failed: number;
  completed_today: number;
  medium_pending: number;
}

export interface RepairsOverview {
  metrics: RepairMetrics;
  pending_approval: SupportRepairAction[];
  executing: SupportRepairAction[];
  failed: SupportRepairAction[];
  recently_completed: SupportRepairAction[];
}

// ============================================================================
// Secure Temporary Support Session + Read-Only View-as-Customer (Prompt 13)
// ============================================================================

export type SupportSessionStatus =
  | 'requested'
  | 'approved'
  | 'active'
  | 'expired'
  | 'ended'
  | 'rejected'
  | 'revoked'
  | 'failed';

export type SupportSessionType = 'read_only';

export interface SupportSession {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  user_id: string | null;
  site_id: string | null;
  site_name: string | null;
  ticket_id: string | null;
  ticket_number: string | null;
  requested_by: string;
  requested_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  session_type: SupportSessionType;
  status: SupportSessionStatus;
  reason: string | null;
  created_at: string;
  approved_at: string | null;
  started_at: string | null;
  expires_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  ended_by_name: string | null;
  revoked_by: string | null;
  revoked_by_name: string | null;
  revocation_reason: string | null;
  access_scope: string[] | null;
  duration_minutes: number;
}

export interface SupportSessionViewSession {
  id: string;
  status: string;
  session_type: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  site_id: string | null;
  site_name: string | null;
  ticket_id: string | null;
  ticket_number: string | null;
  started_at: string | null;
  expires_at: string | null;
  remaining_seconds: number;
  reason: string | null;
  access_scope: string[] | null;
  requested_by_name: string | null;
}

export interface SupportSessionViewProfile {
  name: string | null;
  email: string | null;
  status: string | null;
  role: string | null;
  company: string | null;
  created_at: string | null;
}

export interface SupportSessionViewSubscription {
  name: string | null;
  status: string | null;
  amount: number | string | null;
  currency: string | null;
  interval: string | null;
  next_billing_date: string | null;
  billing_cycle: string | null;
  payment_method: string | null;
}

export interface SupportSessionViewSite {
  name: string | null;
  domain: string | null;
  is_active: boolean | null;
}

export interface SupportSessionViewTicket {
  ticket_number: string;
  subject: string;
  status: string;
  created_at: string;
}

export interface SupportSessionView {
  session: SupportSessionViewSession;
  profile: SupportSessionViewProfile | null;
  subscription: SupportSessionViewSubscription | null;
  site: SupportSessionViewSite | null;
  recent_tickets: SupportSessionViewTicket[];
  diagnostics_count: number;
  repairs_count: number;
}
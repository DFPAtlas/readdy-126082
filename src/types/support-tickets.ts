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

export type ReportRangeKey = 'today' | '7d' | '30d' | 'custom';

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
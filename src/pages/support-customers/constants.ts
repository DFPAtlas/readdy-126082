import type {
  ResolutionStatus,
  DiagnosticStatus,
  CheckStatus,
  CheckSeverity,
  OverallStatus,
  ScopeKey,
  RepairStatus,
  RepairRiskLevel,
  SupportSessionStatus,
} from '@/types/support-customers';

export const resolutionStatusLabels: Record<ResolutionStatus, string> = {
  resolved: 'Resolved',
  partial: 'Partially Resolved',
  unresolved: 'Unresolved',
  multiple: 'Multiple Matches',
};

export const resolutionStatusColors: Record<ResolutionStatus, string> = {
  resolved: 'bg-emerald-500/15 text-emerald-400',
  partial: 'bg-amber-500/15 text-amber-400',
  unresolved: 'bg-foreground-500/15 text-foreground-400',
  multiple: 'bg-red-500/15 text-red-400',
};

export const diagnosticStatusLabels: Record<DiagnosticStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const diagnosticStatusColors: Record<DiagnosticStatus, string> = {
  queued: 'bg-foreground-500/15 text-foreground-400',
  running: 'bg-accent-500/15 text-accent-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-foreground-500/10 text-foreground-500',
};

export function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Not available';
  return value;
}

export function verifiedLabel(value: boolean | null): string {
  if (value === true) return 'Verified';
  if (value === false) return 'Not verified';
  return 'Not available';
}

export function formatShortId(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return `${value.slice(0, 8)}…`;
}

// ============================================================================
// Automated Account Diagnostics (Prompt 11)
// ============================================================================

export const SCOPE_KEYS: ScopeKey[] = [
  'account',
  'authentication',
  'subscription',
  'email',
  'recent_errors',
];

export const scopeLabels: Record<ScopeKey, string> = {
  account: 'Account',
  authentication: 'Authentication',
  subscription: 'Subscription',
  email: 'Email',
  recent_errors: 'Recent Errors',
};

export const checkStatusLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  warning: 'Warning',
  fail: 'Fail',
  unavailable: 'Unavailable',
  error: 'Error',
};

export const checkStatusTones: Record<CheckStatus, string> = {
  pass: 'text-emerald-400',
  warning: 'text-amber-400',
  fail: 'text-red-400',
  unavailable: 'text-foreground-500',
  error: 'text-red-400',
};

export const checkStatusIcons: Record<CheckStatus, string> = {
  pass: 'ri-check-line',
  warning: 'ri-alert-line',
  fail: 'ri-close-line',
  unavailable: 'ri-subtract-line',
  error: 'ri-error-warning-line',
};

export const overallStatusLabels: Record<OverallStatus, string> = {
  pass: 'Healthy',
  warning: 'Warnings',
  fail: 'Issues found',
  error: 'Error',
};

export const overallStatusTones: Record<OverallStatus, string> = {
  pass: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  fail: 'bg-red-500/15 text-red-400',
  error: 'bg-red-500/15 text-red-400',
};

/**
 * Legacy diagnostic results may contain the historical "ok" status. Normalise
 * it to the canonical "pass" so older records still render correctly without
 * any data loss or migration.
 */
export function normalizeCheckStatus(status: string): CheckStatus {
  return status === 'ok' ? 'pass' : (status as CheckStatus);
}

export function normalizeOverallStatus(status: string): OverallStatus {
  return status === 'ok' ? 'pass' : (status as OverallStatus);
}

export const severityLabels: Record<CheckSeverity, string> = {
  info: 'Info',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const checkTypeLabels: Record<string, string> = {
  account_status: 'Account Status',
  authentication: 'Authentication',
  email_verification: 'Email Verification',
  login_activity: 'Login Activity',
  subscription: 'Subscription',
  billing_state: 'Billing State',
  email_delivery: 'Email Delivery',
  storage: 'Storage',
  recent_errors: 'Recent Errors',
  api_health: 'API Health',
  permissions: 'Permissions',
  recent_activity: 'Recent Activity',
};

export function checkTypeLabel(name: string): string {
  return checkTypeLabels[name] ?? name.replace(/_/g, ' ');
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

// ============================================================================
// Human-Approved Account Repair Actions (Prompt 12)
// ============================================================================

export const repairStatusLabels: Record<RepairStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const repairStatusColors: Record<RepairStatus, string> = {
  draft: 'bg-foreground-500/15 text-foreground-400',
  pending_approval: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-accent-500/15 text-accent-400',
  executing: 'bg-secondary-500/15 text-secondary-300',
  completed: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-red-500/15 text-red-400',
  rejected: 'bg-foreground-500/10 text-foreground-500',
  cancelled: 'bg-foreground-500/10 text-foreground-500',
};

export const repairRiskLabels: Record<RepairRiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const repairRiskColors: Record<RepairRiskLevel, string> = {
  low: 'bg-emerald-500/15 text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-orange-500/15 text-orange-400',
  critical: 'bg-red-500/15 text-red-400',
};

export const repairTypeLabels: Record<string, string> = {
  resend_verification_email: 'Resend Verification Email',
  resend_password_reset_email: 'Resend Password Reset Email',
  retry_failed_email: 'Retry Failed Email',
  refresh_account_sync: 'Refresh Account Sync',
  retry_failed_webhook: 'Retry Failed Webhook',
  rebuild_customer_mapping: 'Rebuild Customer Mapping',
  clear_safe_application_cache: 'Clear Application Cache',
  unlock_login: 'Unlock Login',
  reactivate_account: 'Reactivate Account',
  refresh_permissions: 'Refresh Permissions',
  refresh_subscription_status: 'Refresh Subscription Status',
  subscription_modification: 'Modify Subscription',
  role_modification: 'Modify Role',
  financial_action: 'Financial Action',
  account_deletion: 'Delete Account',
  ownership_transfer: 'Transfer Ownership',
  security_credential_modification: 'Modify Security Credentials',
};

// Risk classification per action type (mirrors the server-side allowlist).
export const repairTypeRisk: Record<string, RepairRiskLevel> = {
  resend_verification_email: 'low',
  resend_password_reset_email: 'low',
  retry_failed_email: 'low',
  refresh_account_sync: 'low',
  retry_failed_webhook: 'low',
  rebuild_customer_mapping: 'low',
  clear_safe_application_cache: 'low',
  unlock_login: 'medium',
  reactivate_account: 'medium',
  refresh_permissions: 'medium',
  refresh_subscription_status: 'medium',
  subscription_modification: 'high',
  role_modification: 'high',
  financial_action: 'high',
  account_deletion: 'critical',
  ownership_transfer: 'critical',
  security_credential_modification: 'critical',
};

// Only LOW / MEDIUM types are executable through this workflow.
export const EXECUTABLE_REPAIR_TYPES = [
  'resend_verification_email',
  'resend_password_reset_email',
  'retry_failed_email',
  'refresh_account_sync',
  'retry_failed_webhook',
  'rebuild_customer_mapping',
  'clear_safe_application_cache',
  'unlock_login',
  'reactivate_account',
  'refresh_permissions',
  'refresh_subscription_status',
];

export function repairTypeLabel(type: string): string {
  return repairTypeLabels[type] ?? type.replace(/_/g, ' ');
}

// ============================================================================
// Secure Temporary Support Session (Prompt 13)
// ============================================================================

export const sessionStatusLabels: Record<SupportSessionStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  active: 'Active',
  expired: 'Expired',
  ended: 'Ended',
  rejected: 'Rejected',
  revoked: 'Revoked',
  failed: 'Failed',
};

export const sessionStatusColors: Record<SupportSessionStatus, string> = {
  requested: 'bg-foreground-500/15 text-foreground-400',
  approved: 'bg-accent-500/15 text-accent-400',
  active: 'bg-emerald-500/15 text-emerald-400',
  expired: 'bg-foreground-500/10 text-foreground-500',
  ended: 'bg-foreground-500/10 text-foreground-500',
  rejected: 'bg-foreground-500/10 text-foreground-500',
  revoked: 'bg-red-500/15 text-red-400',
  failed: 'bg-red-500/15 text-red-400',
};

export const SESSION_DURATIONS = [15, 30, 60] as const;

export const SESSION_SCOPE_KEYS = [
  'profile',
  'dashboard',
  'account_status',
  'subscription_summary',
  'site_data',
  'activity',
  'support_context',
] as const;

export type SessionScopeKey = (typeof SESSION_SCOPE_KEYS)[number];

export const sessionScopeLabels: Record<SessionScopeKey, string> = {
  profile: 'Profile',
  dashboard: 'Dashboard',
  account_status: 'Account Status',
  subscription_summary: 'Subscription',
  site_data: 'Site Data',
  activity: 'Activity',
  support_context: 'Support Context',
};

export function formatSessionRemaining(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
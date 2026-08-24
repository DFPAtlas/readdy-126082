import type {
  CapabilityKey,
  CapabilityStatus,
  ConnectorHealth,
  ConnectorType,
  SiteEnvironment,
  SiteStatus,
} from '@/types/support-tickets';

export const CAPABILITIES: Array<{ key: CapabilityKey; label: string; description: string; icon: string }> = [
  { key: 'ticket_intake', label: 'Ticket Intake', description: 'Accepts support tickets from the site.', icon: 'ri-inbox-line' },
  { key: 'customer_resolution', label: 'Customer Resolution', description: 'Resolves site users to customer records.', icon: 'ri-user-search-line' },
  { key: 'diagnostics', label: 'Account Diagnostics', description: 'Read-only account diagnostics via n8n.', icon: 'ri-stethoscope-line' },
  { key: 'repairs', label: 'Repair Actions', description: 'Approved low/medium repair actions.', icon: 'ri-tools-line' },
  { key: 'view_as_customer', label: 'View-as-Customer', description: 'Read-only support sessions.', icon: 'ri-eye-line' },
  { key: 'ai_triage', label: 'AI Triage', description: 'AI ticket classification.', icon: 'ri-robot-2-line' },
  { key: 'ai_reply', label: 'AI Reply Assistant', description: 'Draft-only AI reply suggestions.', icon: 'ri-chat-smile-2-line' },
  { key: 'knowledge', label: 'Knowledge Base', description: 'Approved support articles.', icon: 'ri-book-open-line' },
  { key: 'billing', label: 'Subscription / Billing', description: 'Billing and subscription checks.', icon: 'ri-bank-card-line' },
  { key: 'email_delivery', label: 'Email Delivery', description: 'Email deliverability checks.', icon: 'ri-mail-check-line' },
  { key: 'site_health', label: 'Site Health Check', description: 'Site reachability and health.', icon: 'ri-pulse-line' },
];

export const CAPABILITY_STATUS_META: Record<CapabilityStatus, { label: string; tone: string }> = {
  configured: { label: 'Configured', tone: 'bg-secondary-500/15 text-secondary-300' },
  not_configured: { label: 'Not Configured', tone: 'bg-foreground-600/15 text-foreground-500' },
  testing: { label: 'Testing', tone: 'bg-amber-500/15 text-amber-400' },
  operational: { label: 'Operational', tone: 'bg-emerald-500/15 text-emerald-400' },
  error: { label: 'Error', tone: 'bg-red-500/15 text-red-400' },
  disabled: { label: 'Disabled', tone: 'bg-foreground-600/15 text-foreground-500' },
};

export const CONNECTOR_TYPES: Array<{ value: ConnectorType; label: string; icon: string }> = [
  { value: 'supabase', label: 'Supabase', icon: 'ri-database-2-line' },
  { value: 'rest_api', label: 'REST API', icon: 'ri-plug-line' },
  { value: 'n8n', label: 'n8n', icon: 'ri-flow-chart' },
  { value: 'stripe', label: 'Stripe', icon: 'ri-bank-card-line' },
  { value: 'email_provider', label: 'Email Provider', icon: 'ri-mail-line' },
  { value: 'custom_dfp', label: 'Custom DFP Connector', icon: 'ri-settings-4-line' },
];

export const CONNECTOR_TYPE_LABEL: Record<ConnectorType, string> = Object.fromEntries(
  CONNECTOR_TYPES.map((c) => [c.value, c.label]),
) as Record<ConnectorType, string>;

export const SITE_STATUS_META: Record<SiteStatus, { label: string; tone: string }> = {
  setup: { label: 'Setup', tone: 'bg-amber-500/15 text-amber-400' },
  testing: { label: 'Testing', tone: 'bg-amber-500/15 text-amber-400' },
  active: { label: 'Active', tone: 'bg-emerald-500/15 text-emerald-400' },
  degraded: { label: 'Degraded', tone: 'bg-orange-500/15 text-orange-400' },
  disabled: { label: 'Disabled', tone: 'bg-foreground-600/15 text-foreground-500' },
};

export const SITE_STATUSES: SiteStatus[] = ['setup', 'testing', 'active', 'degraded', 'disabled'];

export const ENVIRONMENT_LABELS: Record<SiteEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  test: 'Test',
};

export const ENVIRONMENTS: SiteEnvironment[] = ['production', 'staging', 'test'];

export const CONNECTOR_HEALTH_META: Record<ConnectorHealth, { label: string; tone: string }> = {
  unknown: { label: 'Unknown', tone: 'bg-foreground-600/15 text-foreground-500' },
  operational: { label: 'Operational', tone: 'bg-emerald-500/15 text-emerald-400' },
  degraded: { label: 'Degraded', tone: 'bg-orange-500/15 text-orange-400' },
  error: { label: 'Error', tone: 'bg-red-500/15 text-red-400' },
  disabled: { label: 'Disabled', tone: 'bg-foreground-600/15 text-foreground-500' },
};
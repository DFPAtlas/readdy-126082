export interface ProjectIntegration {
  id: string;
  project_id: number;
  github_repository: string | null;
  github_owner: string | null;
  github_url: string | null;
  github_default_branch: string | null;
  readdy_project_id: string | null;
  readdy_project_url: string | null;
  supabase_project_ref: string | null;
  supabase_project_name: string | null;
  supabase_dashboard_url: string | null;
  supabase_region: string | null;
  production_provider: string | null;
  production_url: string | null;
  production_environment_id: string | null;
  staging_provider: string | null;
  staging_url: string | null;
  staging_environment_id: string | null;
  dns_provider: string | null;
  dns_zone: string | null;
  runtime_node: string | null;
  runtime_environment: string | null;
  monitoring_provider: string | null;
  monitoring_target: string | null;
  monitoring_dashboard_url: string | null;
  infrastructure_notes: string | null;
  infrastructure_status: string | null;
  last_infrastructure_check_at: string | null;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Shared integration status model (DFP COMMAND 16A §8).
// One vocabulary across every Project Command Centre section — a mapping must
// never read "Connected" in one page and "Unknown" in another.
// ────────────────────────────────────────────────────────────────────────────
export type IntegrationState =
  | 'VERIFIED'
  | 'CONNECTED'
  | 'CONFIGURED'
  | 'NOT CONFIGURED'
  | 'UNAVAILABLE'
  | 'ERROR'
  | 'UNKNOWN';

export const INTEGRATION_STATE_LABELS: Record<IntegrationState, string> = {
  VERIFIED: 'Verified',
  CONNECTED: 'Connected',
  CONFIGURED: 'Configured',
  'NOT CONFIGURED': 'Not Configured',
  UNAVAILABLE: 'Unavailable',
  ERROR: 'Error',
  UNKNOWN: 'Unknown',
};

export const INTEGRATION_STATE_COLORS: Record<IntegrationState, string> = {
  VERIFIED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  CONNECTED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  CONFIGURED: 'text-accent-400 bg-accent-500/10 border-accent-500/20',
  'NOT CONFIGURED': 'text-foreground-500 bg-foreground-500/10 border-foreground-500/20',
  UNAVAILABLE: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ERROR: 'text-red-400 bg-red-500/10 border-red-500/20',
  UNKNOWN: 'text-foreground-500 bg-foreground-500/10 border-foreground-500/20',
};

// Legacy alias kept so existing InfrastructureSection summary cards and any
// other InfraState consumers keep compiling unchanged.
export type InfraState = IntegrationState;

export const INFRA_STATE_COLORS: Record<InfraState, string> = INTEGRATION_STATE_COLORS;

// Editable form fields (identity + configuration only — no secrets, no meta).
// Source Control (GitHub) and Readdy are part of the SAME canonical record and
// are edited through the same unified "Edit Project Integrations" action.
export interface InfraFormFields {
  github_repository: string;
  github_owner: string;
  github_url: string;
  github_default_branch: string;
  readdy_project_id: string;
  readdy_project_url: string;
  supabase_project_ref: string;
  supabase_project_name: string;
  supabase_dashboard_url: string;
  supabase_region: string;
  production_provider: string;
  production_url: string;
  production_environment_id: string;
  staging_provider: string;
  staging_url: string;
  staging_environment_id: string;
  dns_provider: string;
  dns_zone: string;
  runtime_node: string;
  runtime_environment: string;
  monitoring_provider: string;
  monitoring_target: string;
  monitoring_dashboard_url: string;
  infrastructure_notes: string;
}

// Operator-entered suggestions (datalist) — not an exhaustive restriction.
export const INFRA_SUGGESTIONS: Record<string, string[]> = {
  productionProvider: ['Readdy', 'AWS', 'Coolify', 'Vercel', 'Netlify', 'Self Hosted', 'Other'],
  stagingProvider: ['Readdy', 'AWS', 'Coolify', 'Vercel', 'Netlify', 'Self Hosted', 'Other'],
  dnsProvider: ['Cloudflare', 'AWS Route 53', 'Namecheap', 'GoDaddy', 'Cloudflare Registrar', 'Other'],
  runtimeNode: ['atlas-hal-runtime-01', 'atlas-tron-runtime-01', 'None', 'External', 'Other'],
  runtimeEnvironment: ['Production', 'Staging', 'Development', 'External', 'Other'],
  monitoringProvider: ['LibreNMS', 'DFP Command', 'Uptime Monitoring', 'External', 'Other'],
  supabaseRegion: ['eu-west-1', 'eu-central-1', 'us-east-1', 'us-west-1', 'ap-southeast-1', 'Other'],
};
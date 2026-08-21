export interface MonitoredWebsite {
  id: number;
  project_id: number;
  website_name: string;
  environment: string;
  url: string;
  expected_status_code: number;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  last_checked_at: string | null;
  status: string;
  ssl_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseMonitor {
  id: number;
  project_id: number;
  supabase_project_name: string;
  supabase_url: string | null;
  anon_key_configured: boolean;
  service_role_configured: boolean;
  database_status: string;
  auth_status: string;
  storage_status: string;
  edge_functions_status: string;
  realtime_status: string;
  last_checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EdgeFunctionMonitor {
  id: number;
  project_id: number;
  function_name: string;
  function_url: string | null;
  purpose: string | null;
  required_env_vars: string | null;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  status: string;
  last_error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMonitor {
  id: number;
  project_id: number;
  agent_name: string;
  agent_type: string;
  status: string;
  workflow_url: string | null;
  webhook_url: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error_message: string | null;
  run_count_today: number;
  failure_count_today: number;
  average_runtime_ms: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookMonitor {
  id: number;
  project_id: number;
  webhook_name: string;
  provider: string;
  webhook_url: string | null;
  purpose: string | null;
  status: string;
  last_received_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count_today: number;
  last_error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitoringLog {
  id: number;
  project_id: number | null;
  monitor_type: string;
  monitor_id: number | null;
  status: string;
  status_code: number | null;
  response_time_ms: number | null;
  message: string | null;
  error_message: string | null;
  checked_at: string;
  metadata_json: any;
  created_at: string;
}

export interface MonitoringIncident {
  id: number;
  project_id: number;
  incident_title: string;
  incident_type: string;
  severity: string;
  status: string;
  source_monitor_type: string | null;
  source_monitor_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  summary: string | null;
  error_message: string | null;
  action_taken: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitoringAlert {
  id: number;
  project_id: number;
  alert_title: string;
  alert_type: string;
  severity: string;
  source: string | null;
  source_monitor_type: string | null;
  source_monitor_id: number | null;
  detected_at: string;
  status: string;
  resolved_at: string | null;
  action_taken: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  project_name: string;
}
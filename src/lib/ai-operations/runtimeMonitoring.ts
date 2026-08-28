// ============================================================================
// AI Operations — Runtime Monitoring & Health History (Phase 3 Prompt 02).
//
// Persisted connectivity history + monitoring-rule configuration. Read-only
// history (append-oriented) plus owner/admin rule mutations. All sensitive
// checks run server-side in the runtime-health / runtime-health-scheduled Edge
// Functions; this module only reads sanitised persisted results and manages
// monitoring configuration (never credentials or arbitrary URLs).
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Row types ---------------------------------------------------------------

export type RuntimeHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'not_configured'
  | 'not_testable'
  | 'unknown';

export interface AiRuntimeHealthCheckRow {
  id: string;
  check_key: string;
  sweep_key: string | null;
  connection_key: string | null;
  system_slug: string;
  category: string | null;
  checked_at: string;
  status: string;
  reachable: boolean;
  authenticated: boolean | null;
  latency_ms: number | null;
  configuration_state: string | null;
  error_category: string | null;
  safe_message: string | null;
  environment: string;
  source: string;
  initiated_by: string | null;
  trigger_type: string;
  created_at: string;
}

export interface AiRuntimeHealthSweepRow {
  id: string;
  sweep_key: string;
  started_at: string;
  completed_at: string | null;
  trigger_type: string;
  initiated_by: string | null;
  systems_requested: string[] | null;
  systems_checked: string[] | null;
  healthy_count: number;
  degraded_count: number;
  unavailable_count: number;
  not_configured_count: number;
  not_testable_count: number;
  overall_status: string | null;
  duration_ms: number | null;
  environment: string;
  summary: string | null;
  created_at: string;
}

export interface AiRuntimeMonitoringRuleRow {
  id: string;
  rule_key: string;
  name: string;
  system_slug: string;
  connection_key: string | null;
  enabled: boolean;
  interval_minutes: number;
  timeout_ms: number;
  failure_threshold: number;
  recovery_threshold: number;
  create_alert_on_failure: boolean;
  create_alert_on_recovery: boolean;
  environment: string;
  owner_team: string | null;
  last_checked_at: string | null;
  next_check_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Derived per-system health -----------------------------------------------

export type HealthSource = 'cloud_edge' | 'local_bridge';

export interface DerivedSystemHealth {
  system: string;
  source: HealthSource;
  currentStatus: RuntimeHealthStatus;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  averageLatencyMs: number | null;
  totalChecks: number;
}

const FAILURE_STATUSES = new Set(['degraded', 'unavailable']);

/** Derive the latest health per system from persisted checks (reverse-chrono
 *  order assumed). Honest — does not fabricate availability from thin data. */
export function deriveLatestBySystem(
  checks: AiRuntimeHealthCheckRow[],
): Map<string, DerivedSystemHealth> {
  const bySystem = new Map<string, AiRuntimeHealthCheckRow[]>();
  for (const c of checks) {
    const arr = bySystem.get(c.system_slug);
    if (arr) arr.push(c);
    else bySystem.set(c.system_slug, [c]);
  }

  const result = new Map<string, DerivedSystemHealth>();
  for (const [system, rows] of bySystem.entries()) {
    // Rows are already reverse-chronological (fetched ordered desc). Sort to be safe.
    const ordered = [...rows].sort(
      (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime(),
    );

    let consecutiveFailures = 0;
    for (const c of ordered) {
      if (FAILURE_STATUSES.has(c.status)) consecutiveFailures += 1;
      else break;
    }
    let consecutiveSuccesses = 0;
    for (const c of ordered) {
      if (c.status === 'healthy') consecutiveSuccesses += 1;
      else break;
    }

    let lastHealthyAt: string | null = null;
    for (const c of ordered) {
      if (c.status === 'healthy') {
        lastHealthyAt = c.checked_at;
        break;
      }
    }

    const latencies = ordered
      .map((c) => c.latency_ms)
      .filter((v): v is number => v != null && v >= 0);
    const averageLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    result.set(system, {
      system,
      source: 'cloud_edge',
      currentStatus: (ordered[0]?.status as RuntimeHealthStatus) ?? 'unknown',
      lastCheckedAt: ordered[0]?.checked_at ?? null,
      lastHealthyAt,
      consecutiveFailures,
      consecutiveSuccesses,
      averageLatencyMs,
      totalChecks: ordered.length,
    });
  }
  return result;
}

/** 24h availability percentage for a system, or null when history is too thin. */
export function computeAvailability(
  checks: AiRuntimeHealthCheckRow[],
  windowMs = 24 * 60 * 60 * 1000,
  minSamples = 3,
): number | null {
  const cutoff = Date.now() - windowMs;
  const inWindow = checks.filter(
    (c) => new Date(c.checked_at).getTime() >= cutoff,
  );
  if (inWindow.length < minSamples) return null;

  const total = inWindow.length;
  const healthy = inWindow.filter((c) => c.status === 'healthy').length;
  return Math.round((healthy / total) * 100);
}

// --- Data access -------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to access this record.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the database. Please try again.';
    }
  }
  return 'Unable to load runtime health data.';
}

async function runQuery<T>(
  builder: Promise<{ data: T | null; error: unknown }>,
): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) return { data: null, error: sanitiseError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getRuntimeHealthChecks(
  limit = 200,
): Promise<AiOpsResult<AiRuntimeHealthCheckRow[]>> {
  return runQuery<AiRuntimeHealthCheckRow[]>(
    supabase
      .from('ai_runtime_health_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit),
  );
}

export function getRuntimeHealthChecksBySystem(
  systemSlug: string,
  limit = 100,
): Promise<AiOpsResult<AiRuntimeHealthCheckRow[]>> {
  return runQuery<AiRuntimeHealthCheckRow[]>(
    supabase
      .from('ai_runtime_health_checks')
      .select('*')
      .eq('system_slug', systemSlug)
      .order('checked_at', { ascending: false })
      .limit(limit),
  );
}

export function getRuntimeHealthSweeps(
  limit = 50,
): Promise<AiOpsResult<AiRuntimeHealthSweepRow[]>> {
  return runQuery<AiRuntimeHealthSweepRow[]>(
    supabase
      .from('ai_runtime_health_sweeps')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit),
  );
}

export function getRuntimeMonitoringRules(): Promise<
  AiOpsResult<AiRuntimeMonitoringRuleRow[]>
> {
  return runQuery<AiRuntimeMonitoringRuleRow[]>(
    supabase
      .from('ai_runtime_monitoring_rules')
      .select('*')
      .order('name', { ascending: true }),
  );
}

// Monitoring-rule metadata mutation. `interval_minutes` is constrained >= 5 by
// the DB; `failure_threshold`/`recovery_threshold` are plain integers. Never
// accepts credentials or arbitrary endpoint URLs — targets remain allowlisted
// via `system_slug`.
export interface AiRuntimeMonitoringRuleUpdate {
  enabled?: boolean;
  interval_minutes?: number;
  failure_threshold?: number;
  recovery_threshold?: number;
  create_alert_on_failure?: boolean;
  create_alert_on_recovery?: boolean;
}

export function updateRuntimeMonitoringRule(
  ruleKey: string,
  input: AiRuntimeMonitoringRuleUpdate,
): Promise<AiOpsResult<AiRuntimeMonitoringRuleRow>> {
  return runQuery<AiRuntimeMonitoringRuleRow>(
    supabase
      .from('ai_runtime_monitoring_rules')
      .update(input)
      .eq('rule_key', ruleKey)
      .select()
      .single(),
  );
}
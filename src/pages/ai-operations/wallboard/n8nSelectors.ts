// ============================================================================
// AI Operations — Wallboard N8N Automation & Workflow selectors.
//
// Pure read-only derivations over the n8n snapshot (n8nStore.ts) + the shared
// runtime-health store (local/cloud n8n health, reused — never re-fetched) +
// the group live-data resolution maps (site/agent names, reused). Produces a
// distance-readable automation view and the critical n8n incident that feeds
// Wallboard 22 Incident Mode.
//
// Honesty rules honoured here:
//   * Instance presentation states (ONLINE / DEGRADED / UNREACHABLE / UNKNOWN /
//     NOT CONFIGURED) are NORMALISED for the wallboard only — the connector's
//     underlying booleans are never rewritten.
//   * A connector that did not respond is UNKNOWN, never reported healthy.
//   * The workflow registry being empty is reported as "no registered
//     workflows", never as "0 healthy workflows".
//   * Executions are derived ONLY from real callbacks — no running/failed/
//     queued counts are invented when no execution history exists.
//   * No consecutive-failure incident is invented (no authoritative rule
//     defines a repeated-failure criticality threshold in the system).
// ============================================================================

import {
  getN8nData,
  type N8nWorkflowRegistryRow,
  type N8nCallbackRow,
} from '@/pages/ai-operations/wallboard/n8nStore';
import { getRuntimeHealthState } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import {
  EFFECTIVE_PATH_META,
  type EffectivePath,
} from '@/lib/ai-operations/runtimeHealthSource';
import type { N8nConnectionState } from '@/lib/ai-operations/runtimeN8n';

// --- Normalised instance state -----------------------------------------------

export type N8nInstanceState = 'healthy' | 'degraded' | 'offline' | 'unknown' | 'not_configured';

export const N8N_INSTANCE_META: Record<
  N8nInstanceState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  healthy: { label: 'ONLINE', tone: 'emerald' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'UNREACHABLE', tone: 'red' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
  not_configured: { label: 'NOT CONFIGURED', tone: 'secondary' },
};

/** Normalise the live connector connection state onto wallboard levels. A
 *  missing/empty connection is UNKNOWN, never healthy. */
function instanceState(conn: N8nConnectionState | null): N8nInstanceState {
  if (!conn) return 'unknown';
  if (!conn.configured) return 'not_configured';
  if (conn.reachable === true && conn.authenticated === true) return 'healthy';
  if (conn.reachable === true && conn.authenticated === false) return 'degraded';
  if (conn.reachable === false) return 'offline';
  return 'unknown';
}

// --- Instance cards -----------------------------------------------------------

export interface N8nInstanceCard {
  key: string;
  name: string;
  state: N8nInstanceState;
  configured: boolean;
  reachable: boolean | null;
  authenticated: boolean | null;
  error: string | null;
  runtimePath: string;
  runtimePathTone: 'emerald' | 'amber' | 'red' | 'secondary';
}

/**
 * The n8n runtime path from the shared runtime-health store (local bridge vs
 * cloud edge), reused — never re-fetched. This is the secondary n8n health
 * signal alongside the connector's direct reachability check.
 */
function n8nRuntimePath(): { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' } {
  const health = getRuntimeHealthState();
  const path = health.effectivePaths['n8n'] as EffectivePath | undefined;
  const meta = path ? EFFECTIVE_PATH_META[path] : EFFECTIVE_PATH_META.unknown;
  return { label: meta.label, tone: meta.tone };
}

/** Configured n8n instances. Today DFP Command uses a single n8n runtime
 *  (one N8N_URL), but the model is a list so additional instances can be added
 *  without redesign. */
export function getN8nInstances(): N8nInstanceCard[] {
  const data = getN8nData();
  const path = n8nRuntimePath();
  return [
    {
      key: 'n8n-primary',
      name: 'n8n Runtime',
      state: instanceState(data.connection),
      configured: data.connection?.configured ?? false,
      reachable: data.connection?.reachable ?? null,
      authenticated: data.connection?.authenticated ?? null,
      error: data.connection?.error ?? null,
      runtimePath: path.label,
      runtimePathTone: path.tone,
    },
  ];
}

// --- Workflow cards ----------------------------------------------------------

export interface N8nWorkflowCard {
  key: string;
  name: string;
  workflowType: string;
  environment: string;
  enabled: boolean;
  runtimeStatus: string;
  riskLevel: string | null;
  site: string;
  agent: string;
  nodeCount: number | null;
  lastVerified: string | null;
}

/** Registered workflows, enriched with site/agent names from the group
 *  registry (stable uuid → name, never display-name matching). */
export function getN8nWorkflows(): N8nWorkflowCard[] {
  const data = getN8nData();
  const live = getGroupLiveData();
  return data.workflows.map((w: N8nWorkflowRegistryRow) => ({
    key: w.workflow_key,
    name: w.name ?? w.workflow_key,
    workflowType: w.workflow_type ?? 'unclassified',
    environment: w.environment,
    enabled: w.is_active === true,
    runtimeStatus: w.runtime_status,
    riskLevel: w.risk_level,
    site: w.site_id ? (live.siteNameByUuid.get(w.site_id) ?? 'Unassigned') : 'Unassigned',
    agent: w.agent_id ? (live.agentNameByUuid.get(w.agent_id) ?? 'Unassigned') : 'Unassigned',
    nodeCount: w.node_count,
    lastVerified: w.last_verified_at,
  }));
}

// --- Workflow categories (master / site / agent / lead / support) ------------

export interface WorkflowCategory {
  label: string;
  count: number;
  workflows: N8nWorkflowCard[];
}

/** Group workflows by their registered workflow_type, preserving the existing
 *  category model (central/master, per-site, AI-agent, lead, support). */
export function getWorkflowCategories(): WorkflowCategory[] {
  const workflows = getN8nWorkflows();
  const groups = new Map<string, N8nWorkflowCard[]>();
  for (const w of workflows) {
    const list = groups.get(w.workflowType) ?? [];
    list.push(w);
    groups.set(w.workflowType, list);
  }
  return [...groups.entries()]
    .map(([label, items]) => ({ label, count: items.length, workflows: items }))
    .sort((a, b) => b.count - a.count);
}

// --- Site automation ----------------------------------------------------------

export interface SiteAutomation {
  site: string;
  workflowCount: number;
  enabledCount: number;
}

/** Workflows grouped by owning site (stable site_id → name). */
export function getSiteAutomation(): SiteAutomation[] {
  const workflows = getN8nWorkflows();
  const bySite = new Map<string, N8nWorkflowCard[]>();
  for (const w of workflows) {
    const list = bySite.get(w.site) ?? [];
    list.push(w);
    bySite.set(w.site, list);
  }
  return [...bySite.entries()]
    .map(([site, items]) => ({
      site,
      workflowCount: items.length,
      enabledCount: items.filter((w) => w.enabled).length,
    }))
    .sort((a, b) => b.workflowCount - a.workflowCount);
}

// --- Execution states (derived from real callbacks only) ---------------------

export type ExecutionState = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'QUEUED' | 'WAITING' | 'UNKNOWN';

export const EXECUTION_META: Record<
  ExecutionState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  RUNNING: { label: 'RUNNING', tone: 'amber' },
  SUCCESS: { label: 'SUCCESS', tone: 'emerald' },
  FAILED: { label: 'FAILED', tone: 'red' },
  QUEUED: { label: 'QUEUED', tone: 'secondary' },
  WAITING: { label: 'WAITING', tone: 'secondary' },
  UNKNOWN: { label: 'UNKNOWN', tone: 'secondary' },
};

/** Normalise a callback onto the wallboard execution states. */
function callbackState(c: N8nCallbackRow): ExecutionState {
  const type = (c.callback_type ?? '').toLowerCase();
  const outcome = (c.outcome ?? '').toLowerCase();
  if (type.includes('error')) return 'FAILED';
  if (type.includes('progress')) return 'RUNNING';
  if (type.includes('result')) {
    if (outcome === 'failed' || outcome === 'error') return 'FAILED';
    return 'SUCCESS';
  }
  if (type.includes('handshake')) return 'UNKNOWN';
  return 'UNKNOWN';
}

/** Failed-workflow cards (latest failed callback per workflow, bounded). */
export interface FailedWorkflow {
  workflow: string;
  site: string;
  failureTime: string | null;
  consecutiveFailures: number;
  lastSuccess: string | null;
  summary: string | null;
}

/** Consecutive failed callbacks per workflow (leading failures, bounded to the
 *  fetched window). Distinguishes a one-off failure from a persistent outage. */
function consecutiveFailures(byWorkflow: Map<string, N8nCallbackRow[]>): Map<string, number> {
  const result = new Map<string, number>();
  for (const [key, list] of byWorkflow.entries()) {
    let count = 0;
    for (const c of list) {
      if (callbackState(c) === 'FAILED') count += 1;
      else break;
    }
    if (count > 0) result.set(key, count);
  }
  return result;
}

/** Failed production workflows, prioritised (site name from stable id). */
export function getFailedWorkflows(): FailedWorkflow[] {
  const data = getN8nData();
  const live = getGroupLiveData();

  const byWorkflow = new Map<string, N8nCallbackRow[]>();
  for (const c of data.callbacks) {
    if (!c.workflow_key) continue;
    const list = byWorkflow.get(c.workflow_key) ?? [];
    list.push(c);
    byWorkflow.set(c.workflow_key, list);
  }

  const consec = consecutiveFailures(byWorkflow);
  const workflows = getN8nWorkflows();
  const siteByKey = new Map(workflows.map((w) => [w.key, w.site]));
  const lastSuccessByKey = new Map<string, string | null>();

  for (const [key, list] of byWorkflow.entries()) {
    const success = list.find((c) => callbackState(c) === 'SUCCESS');
    lastSuccessByKey.set(key, success?.occurred_at ?? null);
  }

  const failures: FailedWorkflow[] = [];
  for (const [key, list] of byWorkflow.entries()) {
    const latest = list[0];
    if (!latest || callbackState(latest) !== 'FAILED') continue;
    const name =
      workflows.find((w) => w.key === key)?.name ?? key;
    failures.push({
      workflow: name,
      site: siteByKey.get(key) ?? 'Unassigned',
      failureTime: latest.occurred_at,
      consecutiveFailures: consec.get(key) ?? 1,
      lastSuccess: lastSuccessByKey.get(key) ?? null,
      summary: latest.safe_summary ?? null,
    });
  }

  return failures.sort((a, b) => (b.failureTime ?? '').localeCompare(a.failureTime ?? ''));
}

// --- Current activity (running) ----------------------------------------------

export interface RunningWorkflow {
  workflow: string;
  site: string;
  startedAt: string | null;
  summary: string | null;
}

/** Workflows with an in-flight (progress) callback — latest per workflow. */
export function getRunningWorkflows(): RunningWorkflow[] {
  const data = getN8nData();
  const live = getGroupLiveData();
  const workflows = getN8nWorkflows();
  const siteByKey = new Map(workflows.map((w) => [w.key, w.site]));

  const running = new Map<string, N8nCallbackRow>();
  for (const c of data.callbacks) {
    if (callbackState(c) !== 'RUNNING') continue;
    if (!c.workflow_key) continue;
    if (!running.has(c.workflow_key)) running.set(c.workflow_key, c);
  }

  return [...running.entries()].map(([key, c]) => {
    const name = workflows.find((w) => w.key === key)?.name ?? key;
    return {
      workflow: name,
      site: siteByKey.get(key) ?? 'Unassigned',
      startedAt: c.occurred_at,
      summary: c.safe_summary ?? null,
    };
  });
}

// --- Summary -----------------------------------------------------------------

export interface N8nSummary {
  instances: number;
  instancesOnline: number;
  activeWorkflows: number;
  running: number;
  failed: number;
  queued: number;
  totalExecutions: number;
  sourceState: 'live' | 'partial' | 'unavailable';
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

/** Distance-readable automation summary. Failure counts are derived only from
 *  real callbacks; an empty registry/callback set is reported honestly. */
export function getN8nSummary(): N8nSummary {
  const data = getN8nData();
  const instances = getN8nInstances();
  const workflows = getN8nWorkflows();
  const failed = getFailedWorkflows();
  const running = getRunningWorkflows();

  const totalExecutions = data.callbacks.length;

  const activeWorkflows = workflows.filter((w) => w.enabled).length;
  const instancesOnline = instances.filter((i) => i.state === 'healthy').length;

  let sourceState: N8nSummary['sourceState'];
  if (data.loading) {
    sourceState = 'unavailable';
  } else if (data.connectorAvailability || data.registryAvailability) {
    sourceState = 'live';
  } else {
    sourceState = 'unavailable';
  }

  const unreachable = instances.some((i) => i.state === 'offline');
  const hasUnknown = instances.some((i) => i.state === 'unknown');
  const hasDegraded = instances.some((i) => i.state === 'degraded');
  const allNotConfigured = instances.every((i) => i.state === 'not_configured');

  let label: string;
  let detail: string;
  let tone: N8nSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'N8N STATUS UNKNOWN';
    detail = 'The n8n automation monitoring source could not be reached.';
    tone = 'secondary';
  } else if (unreachable) {
    label = 'N8N INSTANCE UNREACHABLE';
    detail = 'The n8n runtime is configured but could not be reached.';
    tone = 'red';
  } else if (hasUnknown) {
    label = 'N8N STATUS UNKNOWN';
    detail = 'The n8n instance health check did not return a result.';
    tone = 'secondary';
  } else if (hasDegraded) {
    label = 'N8N DEGRADED';
    detail = 'The n8n runtime is reachable but reporting an authentication issue.';
    tone = 'amber';
  } else if (allNotConfigured) {
    label = 'N8N NOT CONFIGURED';
    detail = 'No n8n runtime URL / key is configured.';
    tone = 'secondary';
  } else {
    label = 'AUTOMATION HEALTHY';
    detail = 'The n8n runtime is reachable and no failed executions are recorded.';
    tone = 'emerald';
  }

  return {
    instances: instances.length,
    instancesOnline,
    activeWorkflows,
    running: running.length,
    failed: failed.length,
    queued: 0, // no queue/worker telemetry source — reported as a gap, never invented
    totalExecutions,
    sourceState,
    label,
    detail,
    tone,
  };
}

// --- Monitoring gaps (honest, never fabricated) ------------------------------

export interface N8nGap {
  area: string;
  note: string;
}

export function getN8nGaps(): N8nGap[] {
  return [
    { area: 'Queue / worker telemetry', note: 'No queue or worker health metric source exists.' },
    { area: 'Execution duration history', note: 'No aggregate execution-duration source is registered.' },
    { area: 'Scheduled-workflow state', note: 'No authoritative next-run / missed-run source is tracked.' },
    { area: 'Multi-instance registry', note: 'A single n8n runtime (one N8N_URL) is assumed; no per-instance registry exists.' },
    { area: 'Workflow criticality rules', note: 'No approved rule maps repeated workflow failures to a criticality level.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) --------------------

export interface N8nIncident {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  affectedService: string;
  sourceLabel: string;
  firstDetected: string | null;
  lastUpdated: string | null;
  status: string;
  description: string;
}

/**
 * Authoritative n8n incidents only (existing approved conditions):
 *   * production n8n instance configured but unreachable → CRITICAL.
 *
 * No repeated-workflow-failure incident is invented — there is no existing
 * business rule that defines a consecutive-failure criticality threshold, so
 * none is applied. Normal automation failures do not trigger Incident Mode.
 */
export function getN8nIncidents(): N8nIncident[] {
  const data = getN8nData();
  const incidents: N8nIncident[] = [];
  const conn = data.connection;

  if (conn && conn.configured && conn.reachable === false) {
    incidents.push({
      id: 'n8n-instance-unreachable',
      severity: 'critical',
      title: 'n8n runtime instance unreachable',
      affectedService: 'n8n Runtime',
      sourceLabel: 'Automation',
      firstDetected: null,
      lastUpdated: data.lastRefreshed.toISOString(),
      status: 'unreachable',
      description: 'The production n8n instance is configured but could not be reached from the cloud Edge runtime.',
    });
  }

  return incidents;
}
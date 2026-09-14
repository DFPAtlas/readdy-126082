// ============================================================================
// DFP COMMAND 13B — PRODUCTION VERIFICATION — TYPES + PURE EVALUATION
// ============================================================================
// Verification is a READ-TIME AGGREGATOR over existing sources (Project
// Monitoring from Command 10, Infrastructure, Launch Approval, and the
// deployment record from Command 13A). It confirms the deployed release is
// actually operating correctly before it may be accepted.
//
// Core principle: NEVER manufacture success. Configured ≠ healthy, no-data ≠
// green, failed query ≠ zero alerts, a missing deployed SHA ≠ a match. A
// mandatory UNKNOWN makes the overall result INCOMPLETE — never PASS.
import type { Project } from './types';
import type { ProjectIntegration } from './infrastructureTypes';
import type { LaunchApproval } from './launchTypes';
import type { ProjectDeployment } from './deploymentTypes';
import type {
  MonitoredWebsite,
  SupabaseMonitor,
  MonitoringAlert,
} from './monitoringTypes';
import type { MonitoringSummary } from './monitoringUtils';
import {
  websiteForEnvironment,
  backendState,
  normalizeSeverity,
  isActiveStatus,
  anyMonitoringConfigured,
} from './monitoringUtils';
import { configured } from './infrastructureUtils';

// ─── Check state ────────────────────────────────────────────────────────────

export type VerificationCheckState = 'PASS' | 'FAIL' | 'WARNING' | 'UNKNOWN' | 'NOT_REQUIRED';

export const VERIFICATION_STATE_LABELS: Record<VerificationCheckState, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  WARNING: 'Warning',
  UNKNOWN: 'Unknown',
  NOT_REQUIRED: 'Not Required',
};

export const VERIFICATION_STATE_STYLES: Record<VerificationCheckState, string> = {
  PASS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAIL: 'bg-red-500/10 text-red-400 border-red-500/20',
  WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400 border-foreground-500/20',
  NOT_REQUIRED: 'bg-foreground-500/10 text-foreground-500 border-foreground-500/20',
};

export interface VerificationCheck {
  key: string;
  label: string;
  state: VerificationCheckState;
  detail: string;
}

// ─── Overall result ─────────────────────────────────────────────────────────

export type VerificationOverall = 'PASS' | 'FAIL' | 'INCOMPLETE';

// ─── Snapshot (stored on the deployment record when verified) ──────────────

export interface VerificationSnapshot {
  productionUrl: string | null;
  approvedSha: string | null;
  deployedSha: string | null;
  monitoringResult: VerificationCheckState;
  criticalAlertResult: VerificationCheckState;
  backendResult: VerificationCheckState;
  runtimeResult: VerificationCheckState;
  aiResult: VerificationCheckState;
  applicationHealthResult: VerificationCheckState;
  verifiedAt: string;
}

export interface VerificationResult {
  checks: VerificationCheck[];
  passed: number;
  warnings: number;
  failed: number;
  unknown: number;
  overall: VerificationOverall;
  snapshot: VerificationSnapshot;
}

export interface VerificationEvalInput {
  project: Project;
  integration: ProjectIntegration | null;
  deployment: ProjectDeployment;
  approval: LaunchApproval | null;
  websites: MonitoredWebsite[];
  supabaseMonitors: SupabaseMonitor[];
  alerts: MonitoringAlert[];
  alertsLoadFailed: boolean;
  monitoringLoadFailed: boolean;
  monitoringSummary: MonitoringSummary;
}

function normalizeDomain(d: string): string {
  return d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function stateFor(checks: VerificationCheck[], key: string): VerificationCheckState {
  return checks.find((c) => c.key === key)?.state ?? 'UNKNOWN';
}

// ─── Evaluation ─────────────────────────────────────────────────────────────

export function evaluateVerification(input: VerificationEvalInput): VerificationResult {
  const {
    project,
    integration,
    deployment,
    approval,
    websites,
    supabaseMonitors,
    alerts,
    alertsLoadFailed,
    monitoringLoadFailed,
    monitoringSummary,
  } = input;

  const prodUrl = deployment.production_url ?? integration?.production_url ?? project.domain_live ?? null;
  const approvedSha = approval?.github_sha ?? deployment.github_sha ?? null;
  const deployedSha = deployment.deployed_sha ?? null;

  const checks: VerificationCheck[] = [];

  // ── 1. Production URL reachable ──────────────────────────────────────────
  const live = websiteForEnvironment(websites, 'live');
  if (live) {
    if (live.status === 'online') {
      checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'PASS', detail: 'Production responding (monitored online)' });
    } else if (live.status === 'offline' || live.status === 'error') {
      checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'FAIL', detail: 'Production confirmed down' });
    } else if (live.status === 'slow') {
      checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'WARNING', detail: 'Production responding slowly' });
    } else {
      checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'UNKNOWN', detail: 'Production status unknown' });
    }
  } else if (prodUrl) {
    checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'UNKNOWN', detail: 'Configured — no reachability check available' });
  } else if (project.is_internal_tool) {
    checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'NOT_REQUIRED', detail: 'Internal tool — no public URL' });
  } else {
    checks.push({ key: 'url-reachable', label: 'Production URL Reachable', state: 'FAIL', detail: 'No production URL configured' });
  }

  // ── 2. Expected production domain ────────────────────────────────────────
  const approvedTarget =
    approval?.evaluation_snapshot?.productionDomain ??
    integration?.production_url ??
    project.domain_live ??
    null;
  if (approvedTarget && deployment.production_url) {
    if (normalizeDomain(approvedTarget) === normalizeDomain(deployment.production_url)) {
      checks.push({ key: 'domain-match', label: 'Expected Production Domain', state: 'PASS', detail: 'Matches approved launch configuration' });
    } else {
      checks.push({ key: 'domain-match', label: 'Expected Production Domain', state: 'FAIL', detail: 'Production configuration does not match approved launch configuration.' });
    }
  } else if (approvedTarget || deployment.production_url) {
    checks.push({ key: 'domain-match', label: 'Expected Production Domain', state: 'UNKNOWN', detail: 'Cannot fully compare — one target is missing' });
  } else if (project.is_internal_tool) {
    checks.push({ key: 'domain-match', label: 'Expected Production Domain', state: 'NOT_REQUIRED', detail: 'Internal tool — no public domain' });
  } else {
    checks.push({ key: 'domain-match', label: 'Expected Production Domain', state: 'UNKNOWN', detail: 'No production domain configured' });
  }

  // ── 3. Approved SHA deployed ─────────────────────────────────────────────
  if (approvedSha && deployedSha) {
    if (approvedSha === deployedSha) {
      checks.push({ key: 'sha-match', label: 'Approved SHA Deployed', state: 'PASS', detail: 'Approved SHA matches deployed SHA' });
    } else {
      checks.push({ key: 'sha-match', label: 'Approved SHA Deployed', state: 'FAIL', detail: 'Deployed SHA does not match the approved SHA' });
    }
  } else if (!deployedSha) {
    checks.push({ key: 'sha-match', label: 'Approved SHA Deployed', state: 'UNKNOWN', detail: 'Actual deployed SHA not recorded' });
  } else {
    checks.push({ key: 'sha-match', label: 'Approved SHA Deployed', state: 'UNKNOWN', detail: 'Approved SHA missing' });
  }

  // ── 4. Monitoring available ──────────────────────────────────────────────
  const monConfigured = anyMonitoringConfigured({
    monitoringProvider: integration?.monitoring_provider,
    productionUrl: prodUrl,
    stagingUrl: integration?.staging_url ?? project.domain_staging ?? null,
    supabaseRef: integration?.supabase_project_ref,
    runtimeNode: integration?.runtime_node,
  });
  if (!monConfigured) {
    checks.push({
      key: 'monitoring',
      label: 'Monitoring Available',
      state: project.is_internal_tool ? 'NOT_REQUIRED' : 'FAIL',
      detail: project.is_internal_tool ? 'Monitoring not required' : 'Monitoring not configured',
    });
  } else {
    switch (monitoringSummary.health) {
      case 'HEALTHY':
        checks.push({ key: 'monitoring', label: 'Monitoring Available', state: 'PASS', detail: 'Monitoring configured & healthy' });
        break;
      case 'DEGRADED':
        checks.push({ key: 'monitoring', label: 'Monitoring Available', state: 'WARNING', detail: 'Monitoring degraded' });
        break;
      case 'CRITICAL':
      case 'OFFLINE':
        checks.push({ key: 'monitoring', label: 'Monitoring Available', state: 'FAIL', detail: 'Production confirmed down / critical' });
        break;
      case 'NOT CONFIGURED':
        checks.push({ key: 'monitoring', label: 'Monitoring Available', state: 'UNKNOWN', detail: 'Configured — no current telemetry' });
        break;
      default:
        checks.push({
          key: 'monitoring',
          label: 'Monitoring Available',
          state: 'UNKNOWN',
          detail: monitoringLoadFailed ? 'Monitoring source unavailable' : 'Monitoring state unknown/stale',
        });
    }
  }

  // ── 5. Critical operational alerts ───────────────────────────────────────
  if (alertsLoadFailed) {
    checks.push({ key: 'critical-alerts', label: 'No Critical Operational Alerts', state: 'UNKNOWN', detail: 'Alert query failed — cannot confirm zero critical alerts' });
  } else {
    const active = alerts.filter((a) => isActiveStatus(a.status));
    const critical = active.filter((a) => normalizeSeverity(a.severity) === 'CRITICAL').length;
    const nonCritical = active.length - critical;
    if (critical > 0) {
      checks.push({ key: 'critical-alerts', label: 'No Critical Operational Alerts', state: 'FAIL', detail: `${critical} critical operational alert${critical > 1 ? 's' : ''}` });
    } else if (nonCritical > 0) {
      checks.push({ key: 'critical-alerts', label: 'No Critical Operational Alerts', state: 'WARNING', detail: `${nonCritical} non-critical alert${nonCritical > 1 ? 's' : ''}` });
    } else {
      checks.push({ key: 'critical-alerts', label: 'No Critical Operational Alerts', state: 'PASS', detail: 'No active operational alerts' });
    }
  }

  // ── 6. Backend / database reachable ──────────────────────────────────────
  const ref = integration?.supabase_project_ref;
  const monitor = supabaseMonitors[0];
  if (monitor) {
    const st = backendState(monitor, true);
    if (st === 'UP') {
      checks.push({ key: 'backend', label: 'Backend / Database Reachable', state: 'PASS', detail: 'Backend healthy' });
    } else if (st === 'DOWN') {
      checks.push({ key: 'backend', label: 'Backend / Database Reachable', state: 'FAIL', detail: 'Backend confirmed failed' });
    } else if (st === 'DEGRADED' || st === 'STALE') {
      checks.push({ key: 'backend', label: 'Backend / Database Reachable', state: 'WARNING', detail: st === 'STALE' ? 'Backend telemetry stale' : 'Backend degraded' });
    } else {
      checks.push({ key: 'backend', label: 'Backend / Database Reachable', state: 'UNKNOWN', detail: 'Backend state unknown' });
    }
  } else if (configured(ref)) {
    checks.push({ key: 'backend', label: 'Backend / Database Reachable', state: 'UNKNOWN', detail: 'Configured — live verification unavailable' });
  } else {
    checks.push({ key: 'backend', label: 'Backend / Database Reachable', state: 'NOT_REQUIRED', detail: 'No backend mapping' });
  }

  // ── 7. Required runtime online ───────────────────────────────────────────
  if (configured(integration?.runtime_node)) {
    checks.push({ key: 'runtime', label: 'Required Runtime Online', state: 'UNKNOWN', detail: 'Runtime node mapped — live state not project-scoped' });
  } else {
    checks.push({ key: 'runtime', label: 'Required Runtime Online', state: 'NOT_REQUIRED', detail: 'No runtime dependency' });
  }

  // ── 8. AI operations available ───────────────────────────────────────────
  if (project.is_ai_powered) {
    checks.push({ key: 'ai', label: 'AI Operations Available', state: 'UNKNOWN', detail: 'AI runtime state not project-scoped' });
  } else {
    checks.push({ key: 'ai', label: 'AI Operations Available', state: 'NOT_REQUIRED', detail: 'Project not AI-powered' });
  }

  // ── 9. Critical application health ───────────────────────────────────────
  checks.push({
    key: 'app-health',
    label: 'Critical Application Health',
    state: 'NOT_REQUIRED',
    detail: 'No dedicated health endpoint — covered by reachability check',
  });

  // ── Overall result ────────────────────────────────────────────────────────
  const mandatory = checks.filter((c) => c.state !== 'NOT_REQUIRED');
  const passed = mandatory.filter((c) => c.state === 'PASS').length;
  const warnings = mandatory.filter((c) => c.state === 'WARNING').length;
  const failed = mandatory.filter((c) => c.state === 'FAIL').length;
  const unknown = mandatory.filter((c) => c.state === 'UNKNOWN').length;

  let overall: VerificationOverall;
  if (failed > 0) overall = 'FAIL';
  else if (unknown > 0) overall = 'INCOMPLETE';
  else overall = 'PASS';

  const snapshot: VerificationSnapshot = {
    productionUrl: prodUrl,
    approvedSha,
    deployedSha,
    monitoringResult: stateFor(checks, 'monitoring'),
    criticalAlertResult: stateFor(checks, 'critical-alerts'),
    backendResult: stateFor(checks, 'backend'),
    runtimeResult: stateFor(checks, 'runtime'),
    aiResult: stateFor(checks, 'ai'),
    applicationHealthResult: stateFor(checks, 'app-health'),
    verifiedAt: new Date().toISOString(),
  };

  return { checks, passed, warnings, failed, unknown, overall, snapshot };
}
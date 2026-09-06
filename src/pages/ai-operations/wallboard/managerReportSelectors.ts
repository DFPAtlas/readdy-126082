// ============================================================================
// AI Operations — Wallboard QuickGuard Autonomous Manager Report selectors.
//
// Pure read-only derivations over the manager-report store. No new fetch, no
// new table, no mutation. This file converts the raw newest report row into a
// display-ready status object consumed by the QuickGuard wall widget and the
// QG master-agent row.
//
// Honesty rules honoured here:
//   * Reporting freshness is computed from `observed_at` ONLY (≤ 10 minutes =
//     FRESH, otherwise STALE). `received_at` is never consulted for freshness.
//   * Business health (business_health) is kept SEPARATE from workflow execution
//     status (workflow_status). A successful workflow with RED business health
//     must show successful reporting alongside a RED business assessment.
//   * Missing data → AWAITING REPORT; query failure → UNAVAILABLE; a stale
//     report is never green.
//   * coverage.possiblyTruncated caps are shown as "N+" (never a misleading
//     exact count), with an "observed rows; query limit reached" note.
//   * The report's overseer text is labelled as the INTENDED overseer — it does
//     not prove live oversight.
// ============================================================================

import {
  getManagerReportData,
  type ManagerReportRow,
} from '@/pages/ai-operations/wallboard/managerReportStore';

export type ReportTone = 'green' | 'amber' | 'red' | 'muted';

/** Reporting freshness window: observed_at within 10 minutes = FRESH. */
export const MANAGER_REPORT_FRESH_MS = 10 * 60_000;

export type ReportingStatus = 'fresh' | 'stale' | 'awaiting' | 'unavailable';
export type ReportSource = 'loading' | 'unavailable' | 'available';

export interface ManagerMetric {
  key: string;
  label: string;
  value: number;
  truncated: boolean;
}

export interface QuickGuardManagerReport {
  source: ReportSource;
  reportingStatus: ReportingStatus;
  reportingLabel: string;
  reportingTone: ReportTone;
  manager: string | null;
  host: string | null;
  mode: string | null;
  overseer: string | null;
  workflowStatus: string | null;
  workflowStatusLabel: string | null;
  workflowStatusTone: ReportTone;
  businessHealth: string | null;
  businessHealthTone: ReportTone;
  observedAt: string | null;
  ageLabel: string | null;
  metrics: ManagerMetric[];
  reasons: string[];
  anyTruncated: boolean;
}

/**
 * Metrics surfaced on the wall, with the coverage category they come from.
 * Only DIRECT observed-row counts of a capped query are marked truncatable;
 * derived/subset counts (e.g. criticalAlerts, unmatchedJobs) are kept exact —
 * they are never the capped count themselves.
 */
const METRIC_DEFS: { key: string; label: string; truncate?: string }[] = [
  { key: 'openAlerts', label: 'OPEN ALERTS', truncate: 'alerts' },
  { key: 'criticalAlerts', label: 'CRITICAL' },
  { key: 'jobsObserved', label: 'JOBS', truncate: 'jobs' },
  { key: 'activeClients', label: 'CLIENTS', truncate: 'clients' },
  { key: 'activeGuards', label: 'GUARDS', truncate: 'guards' },
  { key: 'pendingEmails', label: 'EMAILS', truncate: 'emails' },
];

const MODE_LABELS: Record<string, string> = {
  READ_ONLY_SUPERVISION: 'READ-ONLY SUPERVISION',
};

/** Human-readable age ("2s", "3m", "1h", "2d") for a timestamp. */
function ageLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let diff = Date.now() - d.getTime();
  if (diff < 0) diff = 0;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function businessTone(v: string | null): ReportTone {
  const s = (v ?? '').toUpperCase();
  if (s === 'RED') return 'red';
  if (s === 'AMBER' || s === 'YELLOW') return 'amber';
  if (s === 'GREEN') return 'green';
  return 'muted';
}

function workflowTone(v: string | null): ReportTone {
  const s = (v ?? '').toLowerCase();
  if (s === 'succeeded' || s === 'success') return 'green';
  if (s === 'failed' || s === 'error' || s === 'crashed') return 'red';
  return 'muted';
}

function modeLabel(v: string | null): string | null {
  if (!v) return null;
  return MODE_LABELS[v] ?? v.replace(/_/g, ' ');
}

function emptyReport(
  source: ReportSource,
  status: ReportingStatus,
  label: string,
  tone: ReportTone,
): QuickGuardManagerReport {
  return {
    source,
    reportingStatus: status,
    reportingLabel: label,
    reportingTone: tone,
    manager: null,
    host: null,
    mode: null,
    overseer: null,
    workflowStatus: null,
    workflowStatusLabel: null,
    workflowStatusTone: 'muted',
    businessHealth: null,
    businessHealthTone: 'muted',
    observedAt: null,
    ageLabel: null,
    metrics: [],
    reasons: [],
    anyTruncated: false,
  };
}

function buildReport(row: ManagerReportRow): QuickGuardManagerReport {
  const observedAt = row.observed_at;
  const ageMs = observedAt ? Date.now() - new Date(observedAt).getTime() : NaN;
  const fresh = !Number.isNaN(ageMs) && ageMs < MANAGER_REPORT_FRESH_MS;

  const reportingStatus: ReportingStatus = fresh ? 'fresh' : 'stale';
  const reportingLabel = fresh ? 'FRESH' : 'STALE';
  const reportingTone: ReportTone = fresh ? 'green' : 'amber';

  const payload = row.report ?? {};
  const coverage = payload.coverage ?? {};

  const metrics: ManagerMetric[] = METRIC_DEFS.map((def) => {
    const raw = payload.metrics?.[def.key];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    const truncated =
      def.truncate != null ? coverage.possiblyTruncated?.[def.truncate] === true : false;
    return { key: def.key, label: def.label, value, truncated };
  });

  const anyTruncated = metrics.some((m) => m.truncated);
  const reasons = Array.isArray(payload.reasons)
    ? payload.reasons.filter((r): r is string => typeof r === 'string')
    : [];

  const workflowStatus = row.workflow_status;
  const businessHealth = row.business_health;

  return {
    source: 'available',
    reportingStatus,
    reportingLabel,
    reportingTone,
    manager: payload.manager ?? null,
    host: payload.host ?? null,
    mode: modeLabel(payload.operatingMode ?? null),
    overseer: payload.overseer ?? null,
    workflowStatus,
    workflowStatusLabel: workflowStatus ? workflowStatus.toUpperCase() : null,
    workflowStatusTone: workflowTone(workflowStatus),
    businessHealth,
    businessHealthTone: businessTone(businessHealth),
    observedAt,
    ageLabel: ageLabel(observedAt),
    metrics,
    reasons,
    anyTruncated,
  };
}

/** The QuickGuard autonomous-manager live report, ready for the wall. */
export function getQuickGuardManagerReport(): QuickGuardManagerReport {
  const data = getManagerReportData();

  if (data.loading) {
    return emptyReport('loading', 'awaiting', 'AWAITING REPORT', 'muted');
  }
  if (!data.available) {
    return emptyReport('unavailable', 'unavailable', 'UNAVAILABLE', 'red');
  }
  if (!data.report) {
    return emptyReport('available', 'awaiting', 'AWAITING REPORT', 'muted');
  }

  return buildReport(data.report);
}
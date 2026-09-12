// ============================================================================
// DFP AI Operations — Site manager report selectors (generalised).
//
// Pure read-only derivations over the generalised site-manager report store
// (siteManagerReportsStore.ts). Produces a display-ready report for ANY
// configured site manager, using the SAME separation guarantees as the
// QuickGuard selector:
//
//   * Reporting freshness ← observed_at ONLY (reuses the shared 10-minute
//     QuickGuard threshold MANAGER_REPORT_FRESH_MS).
//   * Workflow execution result, business health, report freshness and host
//     reachability are kept as SEPARATE signals.
//   * Missing report → AWAITING REPORT; query failure → UNAVAILABLE;
//     unmapped site → NOT MAPPED.
//   * Missing metrics → UNAVAILABLE (never zero); capped counts → "N+".
//   * The report's overseer is labelled INTENDED overseer (never proof of live
//     oversight).
// ============================================================================

import {
  getSiteManagerReportsData,
  type SiteManagerReportsData,
} from '@/pages/ai-operations/network/siteManagerReportsStore';
import type { ManagerReportRow } from '@/pages/ai-operations/wallboard/managerReportStore';
import {
  MANAGER_REPORT_FRESH_MS,
  type ReportTone,
  type ReportingStatus,
} from '@/pages/ai-operations/wallboard/managerReportSelectors';

export type SiteReportSource = 'loading' | 'unavailable' | 'not_mapped' | 'available';

/** A report metric; `value = null` means the metric was NOT present (unavailable),
 *  never coerced to zero. */
export interface SiteMetric {
  key: string;
  label: string;
  value: number | null;
  truncated: boolean;
}

export interface SiteManagerReport {
  siteKey: string | null;
  workflowId: string | null;
  workflowLabel: string | null;
  source: SiteReportSource;
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
  metrics: SiteMetric[];
  reasons: string[];
  anyTruncated: boolean;
}

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
  source: SiteReportSource,
  status: ReportingStatus,
  label: string,
  tone: ReportTone,
  siteKey: string | null,
  workflowId: string | null,
  workflowLabel: string | null,
): SiteManagerReport {
  return {
    siteKey,
    workflowId,
    workflowLabel,
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

function buildReport(
  row: ManagerReportRow,
  workflowLabel: string | null,
): SiteManagerReport {
  const observedAt = row.observed_at;
  const ageMs = observedAt ? Date.now() - new Date(observedAt).getTime() : NaN;
  const fresh = !Number.isNaN(ageMs) && ageMs < MANAGER_REPORT_FRESH_MS;

  const reportingStatus: ReportingStatus = fresh ? 'fresh' : 'stale';
  const reportingTone: ReportTone = fresh ? 'green' : 'amber';

  const payload = row.report ?? {};
  const coverage = payload.coverage ?? {};

  const metrics: SiteMetric[] = METRIC_DEFS.map((def) => {
    const raw = payload.metrics?.[def.key];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    const truncated =
      def.truncate != null ? coverage.possiblyTruncated?.[def.truncate] === true : false;
    return { key: def.key, label: def.label, value, truncated };
  });

  const reasons = Array.isArray(payload.reasons)
    ? payload.reasons.filter((r): r is string => typeof r === 'string')
    : [];

  return {
    siteKey: row.site_key,
    workflowId: row.workflow_id,
    workflowLabel,
    source: 'available',
    reportingStatus,
    reportingLabel: fresh ? 'FRESH' : 'STALE',
    reportingTone,
    manager: payload.manager ?? null,
    host: payload.host ?? null,
    mode: modeLabel(payload.operatingMode ?? null),
    overseer: payload.overseer ?? null,
    workflowStatus: row.workflow_status,
    workflowStatusLabel: row.workflow_status ? row.workflow_status.toUpperCase() : null,
    workflowStatusTone: workflowTone(row.workflow_status),
    businessHealth: row.business_health,
    businessHealthTone: businessTone(row.business_health),
    observedAt,
    ageLabel: ageLabel(observedAt),
    metrics,
    reasons,
    anyTruncated: metrics.some((m) => m.truncated),
  };
}

function newestEntryForSite(
  data: SiteManagerReportsData,
  siteKey: string,
): { mapping: { siteKey: string; workflowId: string; label: string }; report: ManagerReportRow | null } | null {
  const candidates = data.entries.filter((e) => e.mapping.siteKey === siteKey);
  if (candidates.length === 0) return null;

  // Newest observed_at wins; received_at breaks ties (fallback to first).
  let best = candidates[0];
  for (const c of candidates.slice(1)) {
    const a = c.report?.observed_at ?? '';
    const b = best.report?.observed_at ?? '';
    if (a > b) best = c;
    else if (a === b && (c.report?.received_at ?? '') > (best.report?.received_at ?? '')) best = c;
  }
  return best;
}

/**
 * The newest manager report for a site, resolved by its exact site/workflow
 * mapping. Honest states: loading / unavailable / not_mapped / available.
 */
export function getSiteManagerReport(siteKey: string): SiteManagerReport {
  const data = getSiteManagerReportsData();

  if (data.loading) {
    return emptyReport('loading', 'awaiting', 'AWAITING REPORT', 'muted', siteKey, null, null);
  }
  if (!data.available) {
    return emptyReport('unavailable', 'unavailable', 'UNAVAILABLE', 'red', siteKey, null, null);
  }

  const entry = newestEntryForSite(data, siteKey);
  if (!entry) {
    return emptyReport('not_mapped', 'awaiting', 'AWAITING REPORT', 'muted', siteKey, null, null);
  }
  if (!entry.report) {
    return emptyReport('available', 'awaiting', 'AWAITING REPORT', 'muted', siteKey, entry.mapping.workflowId, entry.mapping.label);
  }

  return buildReport(entry.report, entry.mapping.label);
}

/** All resolved reports (one per configured mapping), for tab/detail surfaces. */
export function getAllSiteManagerReports(): SiteManagerReport[] {
  const data = getSiteManagerReportsData();
  if (data.loading || !data.available) return [];

  // One report per site (newest across that site's mappings).
  const seen = new Set<string>();
  const out: SiteManagerReport[] = [];
  for (const entry of data.entries) {
    if (seen.has(entry.mapping.siteKey)) continue;
    seen.add(entry.mapping.siteKey);
    const r = getSiteManagerReport(entry.mapping.siteKey);
    if (r.source === 'available') out.push(r);
  }
  return out;
}
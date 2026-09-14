import { supabase } from '@/lib/supabase';
import type { Bug, ChangeRequest } from './types';
import type { ProjectBuildItem } from './buildUtils';
import { isBlocked } from './buildUtils';
import type { UatFeedback } from '@/pages/admin/website-uat/types';
import { isUnresolvedDefect } from './uatTypes';

// ─── Workstream source model ────────────────────────────────────────────────
//
// A single "project workstream" is assembled at READ TIME from four separate
// source systems. None of them are merged or rewritten — each keeps its own
// records, and this layer only presents them side by side with clear provenance.

export type WorkSource = 'project_bug' | 'uat_defect' | 'build_blocker';

export type NormalizedStatus =
  | 'OPEN'
  | 'IN PROGRESS'
  | 'READY FOR RETEST'
  | 'RESOLVED'
  | 'CLOSED'
  | 'BLOCKED'
  | 'UNKNOWN';

export const SOURCE_LABELS: Record<WorkSource, string> = {
  project_bug: 'PROJECT BUG',
  uat_defect: 'UAT DEFECT',
  build_blocker: 'BUILD BLOCKER',
};

export const SOURCE_STYLES: Record<WorkSource, string> = {
  project_bug: 'bg-red-500/10 text-red-400',
  uat_defect: 'bg-violet-500/10 text-violet-400',
  build_blocker: 'bg-orange-500/10 text-orange-400',
};

export const NORMALIZED_STATUS_STYLES: Record<NormalizedStatus, string> = {
  OPEN: 'bg-red-500/10 text-red-400',
  'IN PROGRESS': 'bg-sky-500/10 text-sky-400',
  'READY FOR RETEST': 'bg-violet-500/10 text-violet-400',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400',
  CLOSED: 'bg-foreground-500/10 text-foreground-500',
  BLOCKED: 'bg-orange-500/10 text-orange-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export interface UnifiedWorkItem {
  key: string;
  source: WorkSource;
  title: string;
  severity: string | null;
  priority: string | null;
  status: string | null;
  normalizedStatus: NormalizedStatus;
  owner: string | null;
  created: string | null;
  updated: string | null;
  // cross-system references
  buildPhase: string | null;
  buildStage: string | null;
  buildRunId: number | null;
  buildItemId: number | null;
  uatDefectId: string | null;
  uatTest: string | null;
  retestStatus: string | null;
  // raw ids
  bugId: number | null;
  // provenance
  hasLinkedBug: boolean;
}

// ─── Status normalisation (display only — never persisted) ──────────────────

export function normalizeBugStatus(status: string | null | undefined, retestStatus: string | null | undefined): NormalizedStatus {
  if (retestStatus === 'ready_for_retest') return 'READY FOR RETEST';
  switch (status) {
    case 'open':
    case 'investigating':
      return 'OPEN';
    case 'in_progress':
      return 'IN PROGRESS';
    case 'fixed':
    case 'resolved':
      return 'RESOLVED';
    case 'wont_fix':
    case 'duplicate':
    case 'closed':
      return 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

export function normalizeDefectStatus(status: string | null | undefined): NormalizedStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'open':
      return 'OPEN';
    case 'in_progress':
      return 'IN PROGRESS';
    case 'fixed':
    case 'resolved':
      return 'RESOLVED';
    case 'closed':
    case 'wont_fix':
    case 'duplicate':
      return 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

export const RESOLVED_DEFECT_STATUSES = ['fixed', 'closed', 'resolved', 'wont_fix', 'duplicate'];

// ─── Retest helpers (honest — no simulated outcomes) ────────────────────────

/** A UAT-linked bug is "UAT VERIFIED" only when the linked defect is actually
 *  resolved in the UAT system. We never infer a pass from bug status alone. */
export function uatRetestState(
  bug: Bug,
  defects: UatFeedback[],
): 'UAT VERIFIED' | null {
  if (bug.source !== 'uat' || !bug.uat_defect_id) return null;
  const defect = defects.find((d) => d.id === bug.uat_defect_id);
  if (!defect) return null;
  if (RESOLVED_DEFECT_STATUSES.includes((defect.status ?? '').toLowerCase())) return 'UAT VERIFIED';
  return null;
}

// ─── Unified list assembly ──────────────────────────────────────────────────

function ts(item: UnifiedWorkItem): number {
  const raw = item.updated || item.created;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function severityWeight(severity: string | null): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function buildUnifiedWorkItems(
  bugs: Bug[],
  defects: UatFeedback[],
  blockers: ProjectBuildItem[],
): UnifiedWorkItem[] {
  const items: UnifiedWorkItem[] = [];

  for (const b of bugs) {
    items.push({
      key: `bug-${b.id}`,
      source: 'project_bug',
      title: b.title,
      severity: b.severity ?? null,
      priority: null,
      status: b.status,
      normalizedStatus: normalizeBugStatus(b.status, b.retest_status),
      owner: b.assigned_to ?? null,
      created: b.created_at,
      updated: b.updated_at ?? b.created_at,
      buildPhase: null,
      buildStage: null,
      buildRunId: b.build_run_id ?? null,
      buildItemId: b.build_item_id ?? null,
      uatDefectId: b.uat_defect_id ?? null,
      uatTest: null,
      retestStatus: b.retest_status ?? null,
      bugId: b.id,
      hasLinkedBug: true,
    });
  }

  for (const d of defects) {
    if (!isUnresolvedDefect(d)) continue;
    items.push({
      key: `uat-${d.id}`,
      source: 'uat_defect',
      title: d.title || 'Untitled defect',
      severity: d.severity ?? null,
      priority: d.priority ?? null,
      status: d.status,
      normalizedStatus: normalizeDefectStatus(d.status),
      owner: null,
      created: d.created_at,
      updated: d.updated_at ?? d.created_at,
      buildPhase: null,
      buildStage: null,
      buildRunId: null,
      buildItemId: null,
      uatDefectId: d.id,
      uatTest: null,
      retestStatus: null,
      bugId: null,
      hasLinkedBug: d.internal_bug_id != null,
    });
  }

  for (const it of blockers) {
    items.push({
      key: `blocker-${it.id}`,
      source: 'build_blocker',
      title: it.item_title,
      severity: null,
      priority: null,
      status: it.status,
      normalizedStatus: 'BLOCKED',
      owner: null,
      created: null,
      updated: it.updated_at ?? null,
      buildPhase: it.phase,
      buildStage: `Stage ${it.stage_number} ${it.stage_title}`.trim(),
      buildRunId: it.run_id,
      buildItemId: it.id,
      uatDefectId: null,
      uatTest: null,
      retestStatus: null,
      bugId: null,
      hasLinkedBug: false,
    });
  }

  return items.sort((a, b) => {
    const sw = severityWeight(b.severity) - severityWeight(a.severity);
    if (sw !== 0) return sw;
    return ts(b) - ts(a);
  });
}

/** Build blockers = blocked (and not yet checked) items on the active run. */
export function activeBlockers(
  items: ProjectBuildItem[],
): ProjectBuildItem[] {
  return items.filter((i) => !i.checked && isBlocked(i));
}

// ─── Bug filter model ───────────────────────────────────────────────────────

export type BugFilter =
  | 'all'
  | 'project_bugs'
  | 'uat_defects'
  | 'build_blockers'
  | 'critical'
  | 'open'
  | 'in_progress'
  | 'ready_for_retest'
  | 'resolved';

export const BUG_FILTERS: { value: BugFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'project_bugs', label: 'Project Bugs' },
  { value: 'uat_defects', label: 'UAT Defects' },
  { value: 'build_blockers', label: 'Build Blockers' },
  { value: 'critical', label: 'Critical' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_retest', label: 'Ready for Retest' },
  { value: 'resolved', label: 'Resolved' },
];

export function filterWorkItems(items: UnifiedWorkItem[], filter: BugFilter): UnifiedWorkItem[] {
  switch (filter) {
    case 'all':
      return items;
    case 'project_bugs':
      return items.filter((i) => i.source === 'project_bug');
    case 'uat_defects':
      return items.filter((i) => i.source === 'uat_defect');
    case 'build_blockers':
      return items.filter((i) => i.source === 'build_blocker');
    case 'critical':
      return items.filter((i) => i.severity === 'critical');
    case 'open':
      return items.filter((i) => i.normalizedStatus === 'OPEN');
    case 'in_progress':
      return items.filter((i) => i.normalizedStatus === 'IN PROGRESS');
    case 'ready_for_retest':
      return items.filter((i) => i.normalizedStatus === 'READY FOR RETEST');
    case 'resolved':
      return items.filter((i) => i.normalizedStatus === 'RESOLVED' || i.normalizedStatus === 'CLOSED');
    default:
      return items;
  }
}

// ─── Summaries (display only) ───────────────────────────────────────────────

export interface BugsSummary {
  openBugs: number;
  critical: number;
  highPriority: number;
  inProgress: number;
  readyForRetest: number;
  uatDefects: number;
  buildBlockers: number;
  recentlyResolved: number;
}

export function computeBugsSummary(
  bugs: Bug[],
  defects: UatFeedback[],
  blockers: ProjectBuildItem[],
): BugsSummary {
  const openDefects = defects.filter(isUnresolvedDefect);
  const activeBlk = activeBlockers(blockers);

  const openBugs = bugs.filter((b) => normalizeBugStatus(b.status, b.retest_status) === 'OPEN').length;
  const critical = bugs.filter((b) => b.severity === 'critical' && normalizeBugStatus(b.status, b.retest_status) === 'OPEN').length
    + openDefects.filter((d) => (d.severity ?? '').toLowerCase() === 'critical').length;
  const highPriority = bugs.filter((b) => b.severity === 'high').length
    + openDefects.filter((d) => (d.priority ?? '').toLowerCase() === 'high' || (d.severity ?? '').toLowerCase() === 'high').length;
  const inProgress = bugs.filter((b) => normalizeBugStatus(b.status, b.retest_status) === 'IN PROGRESS').length
    + openDefects.filter((d) => (d.status ?? '').toLowerCase() === 'in_progress').length;
  const readyForRetest = bugs.filter((b) => b.retest_status === 'ready_for_retest').length;
  const recentlyResolved = bugs.filter((b) => {
    const n = normalizeBugStatus(b.status, b.retest_status);
    return n === 'RESOLVED' || n === 'CLOSED';
  }).length;

  return {
    openBugs,
    critical,
    highPriority,
    inProgress,
    readyForRetest,
    uatDefects: openDefects.length,
    buildBlockers: activeBlk.length,
    recentlyResolved,
  };
}

export interface ChangesSummary {
  openRequests: number;
  pendingReview: number;
  approved: number;
  inProgress: number;
  implemented: number;
  rejected: number;
  highImpact: number;
}

export function computeChangesSummary(changeRequests: ChangeRequest[]): ChangesSummary {
  const openRequests = changeRequests.filter((c) => !['completed', 'rejected'].includes(c.status)).length;
  const pendingReview = changeRequests.filter((c) => c.status === 'requested').length;
  const approved = changeRequests.filter((c) => c.status === 'approved').length;
  const inProgress = changeRequests.filter((c) => c.status === 'in_progress' || c.status === 'testing').length;
  const implemented = changeRequests.filter((c) => c.status === 'completed').length;
  const rejected = changeRequests.filter((c) => c.status === 'rejected').length;
  const highImpact = changeRequests.filter((c) => c.priority === 'critical' || c.priority === 'high').length;

  return { openRequests, pendingReview, approved, inProgress, implemented, rejected, highImpact };
}

export interface WorkstreamSummary {
  criticalBugs: number;
  uatDefects: number;
  buildBlockers: number;
  approvedChanges: number;
  readyForRetest: number;
}

export function computeWorkstreamSummary(
  bugs: Bug[],
  defects: UatFeedback[],
  blockers: ProjectBuildItem[],
  changeRequests: ChangeRequest[],
): WorkstreamSummary {
  const bs = computeBugsSummary(bugs, defects, blockers);
  const cs = computeChangesSummary(changeRequests);
  return {
    criticalBugs: bs.critical,
    uatDefects: bs.uatDefects,
    buildBlockers: bs.buildBlockers,
    approvedChanges: cs.approved,
    readyForRetest: bs.readyForRetest,
  };
}

// ─── Change-request ↔ Build linkage (honest — no fabricated links) ─────────

export type BuildLinkState = 'NOT PLANNED' | 'PLANNED' | 'IN BUILD' | 'IMPLEMENTED' | 'UNKNOWN';

export function changeRequestBuildState(
  cr: ChangeRequest,
  bugs: Bug[],
  activeItems: ProjectBuildItem[],
): BuildLinkState {
  // Only a bug-sourced change request can plausibly trace into the build.
  const srcBug = cr.source_bug_id ? bugs.find((b) => b.id === cr.source_bug_id) : null;
  if (!srcBug || srcBug.build_item_id == null) return 'NOT PLANNED';
  const item = activeItems.find((i) => i.id === srcBug.build_item_id);
  if (!item) return 'PLANNED';
  if (item.checked) return 'IMPLEMENTED';
  return 'IN BUILD';
}

// ─── Activity logging (project-scoped) ─────────────────────────────────────

export async function logWorkstreamActivity(
  projectId: number | null | undefined,
  action: string,
  description: string,
): Promise<void> {
  if (!projectId) return;
  try {
    await supabase.from('internal_activity_log').insert({
      entity_type: 'project',
      entity_id: projectId,
      action,
      description,
    });
  } catch {
    // non-critical
  }
}
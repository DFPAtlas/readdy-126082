// ============================================================================
// AI Operations — Wallboard Operations Workload selectors.
//
// Pure read-only derivations over the workload snapshot (workloadStore.ts) and
// the shared group live-data snapshot (AI runs / approvals / agents). These
// produce a distance-readable, privacy-safe workload view for the wallboard.
//
// Rules honoured here:
//   * Aggregate workload is prioritised — no employee tables, no customer
//     names/emails, no ticket subject/body, no tester identity.
//   * Unavailable data is NEVER shown as zero — each section carries a
//     distinct live / unavailable / zero status.
//   * "Overdue" is derived ONLY from an authoritative deadline
//     (internal_projects.target_launch_date / ticket sla_state), never from
//     record age alone.
//   * Existing priority enums (normal/high/urgent, risk levels) are reused
//     as-is; no new priority model is invented.
//   * No capacity percentages are invented from task counts.
//   * This view does NOT create incidents — failed/blocked AI runs already
//     feed Wallboard 22 Incident Mode via getWallboardIncidents.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getWorkloadData, type WorkloadProjectRow } from '@/pages/ai-operations/wallboard/workloadStore';

// --- Shared status types -----------------------------------------------------

export type WorkloadSectionStatus = 'live' | 'unavailable' | 'zero';

export type WorkloadSourceState = 'live' | 'partial' | 'unavailable';

function sectionStatus(available: boolean, count: number, loading: boolean): WorkloadSectionStatus {
  if (loading) return 'live';
  if (!available) return 'unavailable';
  return count > 0 ? 'live' : 'zero';
}

// --- Time helpers ------------------------------------------------------------

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function todayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Compact age: "18h", "2d", "12d". */
function ageLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return null;
  const h = Math.floor(diff / HOUR_MS);
  if (h < 48) return `${h}h`;
  return `${Math.floor(diff / DAY_MS)}d`;
}

function dateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

// --- Primary workload summary ------------------------------------------------

export interface WorkloadSummary {
  sourceState: WorkloadSourceState;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
  label: string;
  detail: string;

  activeProjects: number;
  overdueProjects: number;
  projectsStatus: WorkloadSectionStatus;

  openTickets: number;
  urgentTickets: number;
  unassignedTickets: number;
  ticketsStatus: WorkloadSectionStatus;

  activeUat: number;
  uatAwaitingApproval: number;
  uatStatus: WorkloadSectionStatus;

  pendingApprovals: number;
  highPriorityApprovals: number;
  approvalsStatus: WorkloadSectionStatus;

  runningTasks: number;
  queuedTasks: number;
  failedTasks: number;
  agentsActive: number;
  aiStatus: WorkloadSectionStatus;

  activeStaff: number;
  staffStatus: WorkloadSectionStatus;
}

const OPEN_TICKET_EXCLUDED = new Set(['resolved', 'closed']);
const URGENT_PRIORITIES = new Set(['urgent', 'high', 'critical']);
const PENDING_APPROVAL_STATUS = new Set(['pending', 'under_review', 'more_info_required']);
const PENDING_APPROVAL_SEVERITY = new Set(['high', 'critical']);
const ACTIVE_AGENT_STATUS = new Set(['active', 'working', 'idle', 'degraded']);

function isOpenTicket(status: string | null | undefined): boolean {
  return !OPEN_TICKET_EXCLUDED.has((status ?? '').toLowerCase());
}

/** A project is still in delivery (not merely an idea) if it is building or live. */
function isActiveProjectStatus(status: string | null | undefined): boolean {
  return ['building', 'live'].includes((status ?? '').toLowerCase());
}

function isOverdueProject(p: WorkloadProjectRow, todayMs: number): boolean {
  if (!p.target_launch_date) return false;
  if (isActiveProjectStatus(p.status) === false && (p.status ?? '').toLowerCase() !== 'idea') return false;
  const due = new Date(`${p.target_launch_date}T00:00:00`).getTime();
  return due < todayMs;
}

export function getWorkloadSummary(): WorkloadSummary {
  const data = getGroupLiveData();
  const wl = getWorkloadData();
  const a = wl.availability;
  const now = new Date();
  const todayMs = todayStart();

  // --- Projects ---
  const activeProjects = wl.projects.filter((p) => isActiveProjectStatus(p.status)).length;
  const overdueProjects = wl.projects.filter((p) => isOverdueProject(p, todayMs)).length;

  // --- Support ---
  const open = wl.tickets.filter((t) => isOpenTicket(t.status));
  const openTickets = open.length;
  const urgentTickets = open.filter((t) => URGENT_PRIORITIES.has((t.priority ?? '').toLowerCase())).length;
  const unassignedTickets = open.filter((t) => t.assigned_to == null).length;

  // --- UAT ---
  const activeUat = wl.uatJobs.filter((j) => ['open', 'in_progress'].includes((j.status ?? '').toLowerCase())).length;
  const uatAwaitingApproval = wl.uatAssignments.filter((x) => (x.status ?? '').toLowerCase() === 'submitted').length;

  // --- Approvals (AI) ---
  const pendingApprovals = data.approvals.filter((ap) => PENDING_APPROVAL_STATUS.has(ap.status ?? '')).length;
  const highPriorityApprovals = data.approvals.filter(
    (ap) => PENDING_APPROVAL_STATUS.has(ap.status ?? '') && PENDING_APPROVAL_SEVERITY.has((ap.severity ?? '').toLowerCase()),
  ).length;

  // --- AI operations ---
  const runningTasks = data.runs.filter((r) => r.status === 'working').length;
  const queuedTasks = data.runs.filter((r) => ['queued', 'waiting'].includes(r.status)).length;
  const failedTasks = data.runs.filter((r) => ['failed', 'blocked'].includes(r.status)).length;
  const agentsActive = data.agents.filter((ag) => ACTIVE_AGENT_STATUS.has(ag.status ?? '')).length;

  // --- Staff ---
  const activeStaff = wl.staff.filter((s) => s.active !== false && (s.status ?? '').toLowerCase() === 'active').length;

  const projectsStatus = sectionStatus(a.projects, wl.projects.length, wl.loading);
  const ticketsStatus = sectionStatus(a.tickets, wl.tickets.length, wl.loading);
  const uatStatus = sectionStatus(a.uatJobs && a.uatAssignments, wl.uatJobs.length + wl.uatAssignments.length, wl.loading);
  const approvalsStatus = sectionStatus(data.availability.approvals, data.approvals.length, data.loading);
  const aiStatus = sectionStatus(data.availability.runs && data.availability.agents, data.runs.length + data.agents.length, data.loading);
  const staffStatus = sectionStatus(a.staff, wl.staff.length, wl.loading);

  const coreAvailable = a.projects && a.tickets && a.uatJobs && a.uatAssignments;
  const aiAvailable = data.availability.runs && data.availability.agents && data.availability.approvals;

  let sourceState: WorkloadSourceState;
  if (wl.loading || data.loading) {
    sourceState = 'unavailable';
  } else if (coreAvailable && aiAvailable) {
    sourceState = 'live';
  } else if (coreAvailable || aiAvailable) {
    sourceState = 'partial';
  } else {
    sourceState = 'unavailable';
  }

  let label: string;
  let detail: string;
  let tone: WorkloadSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'WORKLOAD STATUS UNKNOWN';
    detail = 'Operational workload sources could not be reached.';
    tone = 'secondary';
  } else if (overdueProjects > 0 || failedTasks > 0 || urgentTickets > 0) {
    const parts: string[] = [];
    if (overdueProjects > 0) parts.push(`${overdueProjects} overdue project${overdueProjects > 1 ? 's' : ''}`);
    if (failedTasks > 0) parts.push(`${failedTasks} failed AI task${failedTasks > 1 ? 's' : ''}`);
    if (urgentTickets > 0) parts.push(`${urgentTickets} urgent ticket${urgentTickets > 1 ? 's' : ''}`);
    label = 'ATTENTION NEEDED';
    detail = parts.join(' · ');
    tone = 'amber';
  } else {
    label = 'WORKLOAD NORMAL';
    detail = 'No overdue, failed, or urgent work outstanding.';
    tone = 'emerald';
  }

  return {
    sourceState,
    tone,
    label,
    detail,
    activeProjects,
    overdueProjects,
    projectsStatus,
    openTickets,
    urgentTickets,
    unassignedTickets,
    ticketsStatus,
    activeUat,
    uatAwaitingApproval,
    uatStatus,
    pendingApprovals,
    highPriorityApprovals,
    approvalsStatus,
    runningTasks,
    queuedTasks,
    failedTasks,
    agentsActive,
    aiStatus,
    activeStaff,
    staffStatus,
  };
}

// --- Team workload -----------------------------------------------------------

export interface TeamWorkload {
  key: string;
  name: string;
  icon: string;
  primary: number;
  primaryLabel: string;
  detail: string;
  status: WorkloadSectionStatus;
}

export function getTeamWorkload(): TeamWorkload[] {
  const s = getWorkloadSummary();

  return [
    {
      key: 'support',
      name: 'SUPPORT',
      icon: 'ri-customer-service-2-line',
      primary: s.openTickets,
      primaryLabel: 'open',
      detail: `${s.unassignedTickets} unassigned · ${s.urgentTickets} urgent`,
      status: s.ticketsStatus,
    },
    {
      key: 'delivery',
      name: 'PROJECT DELIVERY',
      icon: 'ri-rocket-2-line',
      primary: s.activeProjects,
      primaryLabel: 'active',
      detail: `${s.overdueProjects} overdue`,
      status: s.projectsStatus,
    },
    {
      key: 'uat',
      name: 'UAT',
      icon: 'ri-flask-line',
      primary: s.activeUat,
      primaryLabel: 'active',
      detail: `${s.uatAwaitingApproval} awaiting approval`,
      status: s.uatStatus,
    },
    {
      key: 'ai',
      name: 'AI OPS',
      icon: 'ri-robot-2-line',
      primary: s.runningTasks,
      primaryLabel: 'running',
      detail: `${s.queuedTasks} queued · ${s.failedTasks} failed`,
      status: s.aiStatus,
    },
  ];
}

// --- Blockers ----------------------------------------------------------------

export interface WorkloadBlocker {
  key: string;
  label: string;
  count: number;
  severity: 'high' | 'critical' | 'attention';
  detail: string;
}

export function getBlockers(): WorkloadBlocker[] {
  const data = getGroupLiveData();
  const s = getWorkloadSummary();

  const failed = data.runs.filter((r) => r.status === 'failed').length;
  const blocked = data.runs.filter((r) => r.status === 'blocked').length;

  const blockers: WorkloadBlocker[] = [];

  if (s.projectsStatus !== 'unavailable' && s.overdueProjects > 0) {
    blockers.push({
      key: 'overdue-projects',
      label: 'Overdue projects',
      count: s.overdueProjects,
      severity: 'attention',
      detail: 'Target launch date has passed.',
    });
  }

  if (failed > 0) {
    blockers.push({
      key: 'failed-runs',
      label: 'Failed AI tasks',
      count: failed,
      severity: 'high',
      detail: 'Requires intervention.',
    });
  }

  if (blocked > 0) {
    blockers.push({
      key: 'blocked-runs',
      label: 'Blocked AI runs',
      count: blocked,
      severity: 'critical',
      detail: 'Run blocked and not progressing.',
    });
  }

  if (s.ticketsStatus !== 'unavailable' && s.urgentTickets > 0) {
    blockers.push({
      key: 'urgent-tickets',
      label: 'Urgent tickets',
      count: s.urgentTickets,
      severity: 'high',
      detail: 'Unresolved urgent support.',
    });
  }

  return blockers;
}

// --- Oldest pending ----------------------------------------------------------

export interface OldestPending {
  label: string;
  value: string;
  status: WorkloadSectionStatus;
}

export function getOldestPending(): OldestPending[] {
  const data = getGroupLiveData();
  const wl = getWorkloadData();

  const pendingApprovals = data.approvals
    .filter((ap) => PENDING_APPROVAL_STATUS.has(ap.status ?? ''))
    .sort((x, y) => (x.requested_at ?? '').localeCompare(y.requested_at ?? ''));

  const openTickets = wl.tickets
    .filter((t) => isOpenTicket(t.status))
    .sort((x, y) => (x.created_at ?? '').localeCompare(y.created_at ?? ''));

  const todayMs = todayStart();
  const overdueProjects = wl.projects
    .filter((p) => isOverdueProject(p, todayMs))
    .sort((x, y) => (x.target_launch_date ?? '').localeCompare(y.target_launch_date ?? ''));

  const oldestApproval = pendingApprovals[0];
  const oldestTicket = openTickets[0];
  const oldestProject = overdueProjects[0];

  return [
    {
      label: 'Oldest approval',
      value: oldestApproval ? (ageLabel(oldestApproval.requested_at) ?? '—') : 'None pending',
      status: sectionStatus(data.availability.approvals, data.approvals.length, data.loading),
    },
    {
      label: 'Oldest open ticket',
      value: oldestTicket ? (ageLabel(oldestTicket.created_at) ?? '—') : 'None open',
      status: sectionStatus(wl.availability.tickets, wl.tickets.length, wl.loading),
    },
    {
      label: 'Oldest overdue project',
      value: oldestProject ? (dateLabel(oldestProject.target_launch_date) ?? '—') : 'None overdue',
      status: sectionStatus(wl.availability.projects, wl.projects.length, wl.loading),
    },
  ];
}

// --- Recent completions (today) ----------------------------------------------

export interface RecentCompletions {
  tasksCompletedToday: number;
  approvalsDecidedToday: number;
  uatCompletedToday: number;
  status: WorkloadSectionStatus;
}

export function getRecentCompletions(): RecentCompletions {
  const data = getGroupLiveData();
  const wl = getWorkloadData();
  const todayMs = todayStart();

  const tasksCompletedToday = data.runs.filter(
    (r) => r.status === 'completed' && r.completed_at && new Date(r.completed_at).getTime() >= todayMs,
  ).length;

  const approvalsDecidedToday = data.approvals.filter(
    (ap) => ap.decision_at && new Date(ap.decision_at).getTime() >= todayMs,
  ).length;

  const uatCompletedToday = wl.uatAssignments.filter(
    (x) => x.completed_at && new Date(x.completed_at).getTime() >= todayMs,
  ).length;

  return {
    tasksCompletedToday,
    approvalsDecidedToday,
    uatCompletedToday,
    status: sectionStatus(
      data.availability.runs && data.availability.approvals && wl.availability.uatAssignments,
      data.runs.length + data.approvals.length + wl.uatAssignments.length,
      data.loading || wl.loading,
    ),
  };
}
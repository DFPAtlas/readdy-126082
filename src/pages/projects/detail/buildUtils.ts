import { PHASE_LABELS } from '@/pages/build-process/types';

// Types + pure helpers for the project-level Build Process integration.
// Reuses the existing global Build Process tables/columns — no new schema.

export interface ProjectBuildRun {
  id: number;
  project_id: number | null;
  template_id: number | null;
  run_name: string;
  run_status: string;
  app_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  total_items: number | null;
  completed_items: number | null;
  launch_blockers_remaining: number | null;
  progress_percent: number | null;
  launch_readiness_score: number | null;
  current_phase: string | null;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectBuildItem {
  id: number;
  run_id: number;
  phase: string;
  stage_number: number;
  stage_title: string;
  item_order: number;
  item_title: string;
  item_description: string | null;
  status: string;
  checked: boolean;
  due_date: string | null;
  notes: string | null;
  blocker_notes: string | null;
  is_required: boolean;
  is_launch_blocker: boolean;
  updated_at: string;
}

export type ReadinessState = 'READY' | 'AT RISK' | 'NEARLY READY' | 'NOT READY' | 'NO CHECKLIST';

export interface ReadinessResult {
  reqDone: number;
  reqTotal: number;
  reqRemaining: number;
  reqPct: number;
  launchBlockers: number;
  state: ReadinessState;
}

export const READINESS_STATE_COLORS: Record<ReadinessState, string> = {
  READY: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'AT RISK': 'text-red-400 bg-red-500/10 border-red-500/20',
  'NEARLY READY': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'NOT READY': 'text-foreground-400 bg-foreground-500/10 border-foreground-500/20',
  'NO CHECKLIST': 'text-foreground-500 bg-foreground-500/10 border-foreground-500/20',
};

/** A blocked task = status 'blocked' OR a non-empty blocker note (display only). */
export function isBlocked(item: ProjectBuildItem): boolean {
  return item.status === 'blocked' || (item.blocker_notes != null && item.blocker_notes.trim() !== '');
}

export function countOpenBlockers(items: ProjectBuildItem[]): number {
  return items.filter((i) => !i.checked && isBlocked(i)).length;
}

export function computeReadiness(items: ProjectBuildItem[]): ReadinessResult {
  const req = items.filter((i) => i.is_required);
  const reqDone = req.filter((i) => i.checked).length;
  const reqTotal = req.length;
  const reqPct = reqTotal > 0 ? Math.round((reqDone / reqTotal) * 100) : 0;
  const launchBlockers = items.filter((i) => i.is_launch_blocker && !i.checked).length;

  let state: ReadinessState;
  if (reqTotal === 0) state = 'NO CHECKLIST';
  else if (reqPct >= 100 && launchBlockers === 0) state = 'READY';
  else if (launchBlockers > 0) state = 'AT RISK';
  else if (reqPct >= 90) state = 'NEARLY READY';
  else state = 'NOT READY';

  return { reqDone, reqTotal, reqRemaining: reqTotal - reqDone, reqPct, launchBlockers, state };
}

export function currentWorkItem(items: ProjectBuildItem[]): ProjectBuildItem | null {
  const requiredIncomplete = items
    .filter((i) => i.is_required && !i.checked)
    .sort((a, b) => a.item_order - b.item_order);
  return requiredIncomplete[0] ?? null;
}

export function progressPercent(run: ProjectBuildRun, items: ProjectBuildItem[]): number {
  if (run.progress_percent != null && run.progress_percent >= 0) return run.progress_percent;
  if (items.length > 0) {
    const done = items.filter((i) => i.checked).length;
    return Math.round((done / items.length) * 100);
  }
  if (run.total_items && run.total_items > 0) {
    return Math.round(((run.completed_items ?? 0) / run.total_items) * 100);
  }
  return 0;
}

export function overdueItems(items: ProjectBuildItem[]): ProjectBuildItem[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return items.filter((i) => i.due_date && !i.checked && new Date(i.due_date).getTime() < now.getTime());
}

export function runTargetOverdue(run: ProjectBuildRun): boolean {
  if (!run.due_date) return false;
  if (run.run_status === 'completed') return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return new Date(run.due_date).getTime() < now.getTime();
}

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function buildNextWorkPrompt(projectName: string, item: ProjectBuildItem): string {
  return `Update the Digital Footprint project for ${projectName}. Work on build process item: ${item.item_title}. This belongs to phase ${item.phase}, stage ${item.stage_number} ${item.stage_title}. Current notes: ${item.notes || 'None'}. Blockers: ${item.blocker_notes || 'None'}. Make the required UI/database/code changes and keep the existing style consistent.`;
}

export interface BuildStatusSummary {
  statusLabel: string;
  progressPercent: number;
  openBlockers: number;
  readinessState: ReadinessState | null;
}

export function buildStatusSummary(run: ProjectBuildRun | null, items: ProjectBuildItem[]): BuildStatusSummary {
  if (!run) {
    return { statusLabel: 'Not Started', progressPercent: 0, openBlockers: 0, readinessState: null };
  }
  const statusLabel =
    run.run_status === 'active' ? 'Building' : run.run_status === 'completed' ? 'Completed' : run.run_status;
  return {
    statusLabel,
    progressPercent: progressPercent(run, items),
    openBlockers: countOpenBlockers(items),
    readinessState: computeReadiness(items).state,
  };
}
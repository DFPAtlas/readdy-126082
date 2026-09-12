// ============================================================================
// DFP AI Operations — Activity tab selectors (Prompt 02).
//
// Pure read-only derivations for the activity tabs below the network:
//   * Live activity   — confirmed starts / completions / failures (from real
//                       ai_runs) + manager-report arrivals (observed_at).
//   * Needs attention — prioritised active alerts + pending approval requests.
//   * Run history     — filterable run records with result, timestamps, duration.
//
// Honesty guarantees:
//   * Only real registry/run/report evidence is shown — demo supporting
//     metadata never feeds these surfaces.
//   * Unknown values stay "—" (never a fabricated zero/green).
//   * Bounded history with a clear coverage note — a partial window is never
//     described as a complete total.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getAllSiteManagerReports } from '@/pages/ai-operations/network/siteManagerReportSelectors';
import type { AiRunRow } from '@/lib/ai-operations';

// --- Live activity ------------------------------------------------------------

export type ActivityEventKind = 'start' | 'completion' | 'failure' | 'report';

export interface LiveActivityEvent {
  id: string;
  kind: ActivityEventKind;
  timestampLabel: string;
  timestampRaw: string;
  siteKey: string;
  siteName: string;
  agentKey: string | null;
  agentName: string | null;
  summary: string;
  tone: 'emerald' | 'amber' | 'red' | 'accent';
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} · ${hh}:${mm}`;
}

function durationLabel(started: string | null, completed: string | null): string | null {
  if (!started || !completed) return null;
  const a = new Date(started).getTime();
  const b = new Date(completed).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  const ms = b - a;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function kindForRun(status: string): { kind: ActivityEventKind; tone: LiveActivityEvent['tone'] } | null {
  if (status === 'working') return { kind: 'start', tone: 'accent' };
  if (status === 'completed' || status === 'partially_completed') return { kind: 'completion', tone: 'emerald' };
  if (status === 'failed' || status === 'timed_out' || status === 'blocked') return { kind: 'failure', tone: 'red' };
  return null;
}

/** Confirmed activity: run starts/completions/failures + manager-report arrivals.
 *  Each run contributes exactly one event; reports arrive separately. Bounded to
 *  the latest 40 events. */
export function getLiveActivityEvents(): LiveActivityEvent[] {
  const data = getGroupLiveData();
  const events: LiveActivityEvent[] = [];

  for (const r of data.runs) {
    const mapped = kindForRun(r.status);
    if (!mapped) continue;
    const ts = r.started_at ?? r.completed_at ?? r.created_at;
    events.push({
      id: `run:${r.run_key}`,
      kind: mapped.kind,
      timestampLabel: fmtDateTime(ts),
      timestampRaw: ts ?? '',
      siteKey: r.site_id ? (data.siteKeyByUuid.get(r.site_id) ?? 'group') : 'group',
      siteName: r.site_id ? (data.siteNameByUuid.get(r.site_id) ?? 'Group-wide') : 'Group-wide',
      agentKey: r.agent_id ? (data.agentKeyByUuid.get(r.agent_id) ?? null) : null,
      agentName: r.agent_id ? (data.agentNameByUuid.get(r.agent_id) ?? '—') : null,
      summary: r.result_summary ?? r.error_summary ?? mapped.kind,
      tone: mapped.tone,
    });
  }

  // Manager-report arrivals (observed_at is the authoritative arrival time).
  for (const report of getAllSiteManagerReports()) {
    if (!report.observedAt) continue;
    events.push({
      id: `report:${report.siteKey}`,
      kind: 'report',
      timestampLabel: fmtDateTime(report.observedAt),
      timestampRaw: report.observedAt,
      siteKey: report.siteKey ?? 'group',
      siteName: report.siteKey ?? 'Group-wide',
      agentKey: null,
      agentName: report.manager ?? null,
      summary: `Manager report received (${report.reportingLabel.toLowerCase()})`,
      tone: report.reportingTone === 'green' ? 'emerald' : report.reportingTone === 'red' ? 'red' : 'amber',
    });
  }

  return events
    .sort((a, b) => b.timestampRaw.localeCompare(a.timestampRaw))
    .slice(0, 40);
}

// --- Needs attention ----------------------------------------------------------

export interface AttentionItem {
  id: string;
  type: 'alert' | 'approval';
  siteKey: string;
  siteName: string;
  agentName: string | null;
  title: string;
  severity: string;
  tone: 'red' | 'amber' | 'secondary';
  referenceType: 'alert' | 'approval';
  referenceKey: string;
  timestampRaw: string;
  timestampLabel: string;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Prioritised active alerts + pending approvals (needs attention). */
export function getAttentionItems(): AttentionItem[] {
  const data = getGroupLiveData();
  const items: AttentionItem[] = [];

  for (const a of data.alerts) {
    if (['resolved', 'closed', 'suppressed'].includes(a.status ?? '')) continue;
    items.push({
      id: `alert:${a.alert_key}`,
      type: 'alert',
      siteKey: a.site_id ? (data.siteKeyByUuid.get(a.site_id) ?? 'group') : 'group',
      siteName: a.site_id ? (data.siteNameByUuid.get(a.site_id) ?? 'Group-wide') : 'Group-wide',
      agentName: a.agent_id ? (data.agentNameByUuid.get(a.agent_id) ?? '—') : null,
      title: a.title,
      severity: a.severity ?? 'info',
      tone: a.severity === 'critical' || a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'secondary',
      referenceType: 'alert',
      referenceKey: a.alert_key,
      timestampRaw: a.last_seen_at ?? a.created_at,
      timestampLabel: fmtDateTime(a.last_seen_at ?? a.created_at),
    });
  }

  for (const ap of data.approvals) {
    if (!['pending', 'under_review', 'more_info_required'].includes(ap.status)) continue;
    items.push({
      id: `approval:${ap.approval_key}`,
      type: 'approval',
      siteKey: ap.site_id ? (data.siteKeyByUuid.get(ap.site_id) ?? 'group') : 'group',
      siteName: ap.site_id ? (data.siteNameByUuid.get(ap.site_id) ?? 'Group-wide') : 'Group-wide',
      agentName: ap.agent_id ? (data.agentNameByUuid.get(ap.agent_id) ?? '—') : null,
      title: ap.requested_action ?? ap.title ?? 'Approval request',
      severity: ap.severity ?? 'medium',
      tone: ap.severity === 'critical' || ap.severity === 'high' ? 'red' : ap.severity === 'medium' ? 'amber' : 'secondary',
      referenceType: 'approval',
      referenceKey: ap.approval_key,
      timestampRaw: ap.requested_at,
      timestampLabel: fmtDateTime(ap.requested_at),
    });
  }

  return items.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 9;
    const sb = SEVERITY_ORDER[b.severity] ?? 9;
    if (sa !== sb) return sa - sb;
    return b.timestampRaw.localeCompare(a.timestampRaw);
  });
}

// --- Run history --------------------------------------------------------------

export interface RunHistoryItem {
  runKey: string;
  siteKey: string;
  siteName: string;
  agentKey: string | null;
  agentName: string | null;
  status: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
  startedAt: string | null;
  completedAt: string | null;
  durationLabel: string | null;
  summary: string | null;
}

function runTone(status: string): RunHistoryItem['tone'] {
  if (status === 'completed' || status === 'partially_completed') return 'emerald';
  if (status === 'working') return 'amber';
  if (status === 'failed' || status === 'timed_out' || status === 'blocked') return 'red';
  return 'secondary';
}

/** Full run history (filterable), newest-first. Bounded by the caller. */
export function getRunHistory(): RunHistoryItem[] {
  const data = getGroupLiveData();
  return data.runs
    .map((r: AiRunRow) => ({
      runKey: r.run_key,
      siteKey: r.site_id ? (data.siteKeyByUuid.get(r.site_id) ?? 'group') : 'group',
      siteName: r.site_id ? (data.siteNameByUuid.get(r.site_id) ?? 'Group-wide') : 'Group-wide',
      agentKey: r.agent_id ? (data.agentKeyByUuid.get(r.agent_id) ?? null) : null,
      agentName: r.agent_id ? (data.agentNameByUuid.get(r.agent_id) ?? '—') : null,
      status: r.status,
      tone: runTone(r.status),
      startedAt: r.started_at,
      completedAt: r.completed_at,
      durationLabel: durationLabel(r.started_at, r.completed_at),
      summary: r.result_summary ?? r.error_summary ?? null,
    }))
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}
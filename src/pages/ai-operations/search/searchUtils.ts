// ============================================================================
// AI Operations — Global Search & Command Palette — search utilities.
//
// Deterministic frontend matching + ranking (no AI search model), grouping,
// filtering and quick-navigation metadata. The index is passed in from the
// caller (built once per live snapshot change), so no Supabase query runs per
// keystroke — filtering/ranking is purely local.
// ============================================================================

import type { AiGlobalSearchResult, AiSearchRecordType } from '@/pages/ai-operations/search/searchIndex';

export interface QuickNavItem {
  label: string;
  icon: string;
  route: string;
}

export const QUICK_NAV: QuickNavItem[] = [
  { label: 'AI Overview', icon: 'ri-dashboard-3-line', route: '/ai-operations' },
  { label: 'Live Operations', icon: 'ri-pulse-line', route: '/ai-operations/live' },
  { label: 'Wallboard', icon: 'ri-tv-line', route: '/ai-operations/wallboard' },
  { label: 'Sites', icon: 'ri-global-line', route: '/ai-operations/sites' },
  { label: 'Agents', icon: 'ri-robot-2-line', route: '/ai-operations/agents' },
  { label: 'Tasks & Runs', icon: 'ri-list-check-3', route: '/ai-operations/runs' },
  { label: 'Approvals', icon: 'ri-shield-check-line', route: '/ai-operations/approvals' },
  { label: 'Orchestrator', icon: 'ri-route-line', route: '/ai-operations/orchestrator' },
  { label: 'Tools & Connections', icon: 'ri-plug-2-line', route: '/ai-operations/tools' },
  { label: 'Models', icon: 'ri-cpu-line', route: '/ai-operations/models' },
  { label: 'Knowledge & Memory', icon: 'ri-book-2-line', route: '/ai-operations/knowledge' },
  { label: 'Security', icon: 'ri-shield-keyhole-line', route: '/ai-operations/security' },
  { label: 'Alerts & Incidents', icon: 'ri-alert-line', route: '/ai-operations/alerts' },
  { label: 'Audit & Evidence', icon: 'ri-file-list-3-line', route: '/ai-operations/audit' },
  { label: 'Cost & Budgets', icon: 'ri-money-pound-circle-line', route: '/ai-operations/costs' },
  { label: 'Notifications & Escalations', icon: 'ri-notification-3-line', route: '/ai-operations/notifications' },
  { label: 'Scheduling & Automation', icon: 'ri-calendar-2-line', route: '/ai-operations/schedules' },
  { label: 'Production Readiness', icon: 'ri-shield-check-line', route: '/ai-operations/readiness' },
];

export const CATEGORY_ORDER: string[] = [
  'Sites',
  'Agents',
  'Runs',
  'Approvals',
  'Orchestrations',
  'Tools',
  'Models',
  'Knowledge',
  'Security',
  'Alerts',
  'Audit',
  'Costs/Budgets',
  'Notifications',
  'Schedules',
];

export const RECORD_TYPE_OPTIONS: { value: AiSearchRecordType; label: string }[] = [
  { value: 'site', label: 'Sites' },
  { value: 'agent', label: 'Agents' },
  { value: 'run', label: 'Runs' },
  { value: 'approval', label: 'Approvals' },
  { value: 'orchestration', label: 'Orchestrations' },
  { value: 'tool', label: 'Tools & Connections' },
  { value: 'model', label: 'Models' },
  { value: 'knowledge', label: 'Knowledge Sources' },
  { value: 'policy', label: 'Security Policies' },
  { value: 'alert', label: 'Alerts & Incidents' },
  { value: 'audit', label: 'Audit Records' },
  { value: 'budget', label: 'Budgets' },
  { value: 'notification_rule', label: 'Notification Rules' },
  { value: 'schedule', label: 'Schedules' },
];

export const RECORD_TYPE_ICONS: Record<AiSearchRecordType, string> = {
  site: 'ri-global-line',
  agent: 'ri-robot-2-line',
  run: 'ri-list-check-3',
  approval: 'ri-shield-check-line',
  orchestration: 'ri-route-line',
  tool: 'ri-plug-2-line',
  model: 'ri-cpu-line',
  knowledge: 'ri-book-2-line',
  policy: 'ri-shield-keyhole-line',
  alert: 'ri-alert-line',
  audit: 'ri-file-list-3-line',
  budget: 'ri-money-pound-circle-line',
  notification_rule: 'ri-notification-3-line',
  schedule: 'ri-calendar-2-line',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Deterministic ranking tiers (lower = higher relevance):
//   0 exact ID, 1 exact title, 2 title starts-with, 3 ID starts-with,
//   4 keyword contains, 5 secondary metadata contains.
export function searchRecords(query: string, index: AiGlobalSearchResult[]): AiGlobalSearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const scored: { result: AiGlobalSearchResult; score: number }[] = [];

  for (const r of index) {
    const id = normalize(r.referenceId);
    const title = normalize(r.title);
    const subtitle = normalize(r.subtitle);
    const site = normalize(r.siteName);
    const category = normalize(r.category);
    const status = normalize(r.statusLabel);

    let score = -1;
    if (id === q) score = 0;
    else if (title === q) score = 1;
    else if (title.startsWith(q)) score = 2;
    else if (id.startsWith(q)) score = 3;
    else if (r.keywords.some((k) => normalize(k).includes(q))) score = 4;
    else if (subtitle.includes(q) || site.includes(q) || category.includes(q) || status.includes(q)) score = 5;

    if (score >= 0) scored.push({ result: r, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.result.title.localeCompare(b.result.title))
    .map((x) => x.result);
}

// Returns ranked results for a query, or the full index (ordered by category)
// when the query is empty.
export function queryResults(query: string, index: AiGlobalSearchResult[]): AiGlobalSearchResult[] {
  if (normalize(query)) return searchRecords(query, index);
  return [...index].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.title.localeCompare(b.title),
  );
}

export interface SearchFilters {
  recordType: string;
  site: string;
  module: string;
  status: string;
}

export function applyFilters(list: AiGlobalSearchResult[], f: SearchFilters): AiGlobalSearchResult[] {
  return list.filter((r) => {
    if (f.recordType && r.recordType !== f.recordType) return false;
    if (f.site) {
      if (f.site === 'group') {
        if (r.siteId !== 'group' && r.siteId !== null) return false;
      } else if (r.siteId !== f.site) {
        return false;
      }
    }
    if (f.module && r.category !== f.module) return false;
    if (f.status && r.statusLabel !== f.status) return false;
    return true;
  });
}
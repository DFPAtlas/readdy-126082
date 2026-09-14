export interface Project {
  id: number;
  project_name: string;
  project_slug: string;
  description: string | null;
  status: string;
  priority: string;
  owner: string | null;
  tech_stack: string | null;
  domain_live: string | null;
  domain_staging: string | null;
  target_launch_date: string | null;
  launched_at: string | null;
  is_ai_powered: boolean;
  is_saas: boolean;
  is_client_build: boolean;
  is_internal_tool: boolean;
  monthly_revenue: number;
  monthly_costs: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: number;
  idea_name: string;
  category: string | null;
  priority: string;
  status: string;
  description: string | null;
  owner: string | null;
  ai_generated: boolean;
}

export interface Bug {
  id: number;
  title: string;
  severity: string;
  status: string;
  type: string | null;
  description: string | null;
  environment: string | null;
  assigned_to: string | null;
  steps_to_reproduce: string | null;
  created_at: string;
  updated_at?: string | null;
  // ── Workstream traceability (DFP Command 07) ──
  source?: string | null; // 'project' | 'uat' | 'build' | 'support'
  uat_defect_id?: string | null; // uuid string referencing uat_feedback.id
  build_run_id?: number | null;
  build_item_id?: number | null;
  retest_status?: string | null; // null | 'ready_for_retest' | 'retest_passed' | 'retest_failed'
  // ── Support traceability (DFP Command 09) ──
  support_ticket_id?: string | null; // uuid string referencing internal_support_tickets.id
}

export interface ChangeRequest {
  id: number;
  title: string;
  priority: string;
  status: string;
  type: string | null;
  description: string | null;
  requested_by: string | null;
  estimated_hours: number | null;
  created_at?: string;
  updated_at?: string | null;
  // ── Workstream traceability (DFP Command 07) ──
  origin?: string | null; // 'manual' | 'bug' | 'uat' | 'support'
  source_bug_id?: number | null;
  // ── Support traceability (DFP Command 09) ──
  support_ticket_id?: string | null; // uuid string referencing internal_support_tickets.id
}

export interface Note {
  id: number;
  title: string;
  category: string;
  content: string | null;
  tags: string[] | null;
  pinned: boolean;
  created_at: string;
}

export interface FileLink {
  id: number;
  name: string;
  type: string;
  url: string;
  description: string | null;
  category: string | null;
}

export interface ActivityEntry {
  id: number;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  project_id: number | null;
  description: string;
  created_at: string;
}

export type SectionKey =
  | 'overview'
  | 'build'
  | 'github'
  | 'infrastructure'
  | 'ai'
  | 'uat'
  | 'bugs'
  | 'changes'
  | 'budget'
  | 'support'
  | 'monitoring'
  | 'launch'
  | 'deployment'
  | 'operations'
  | 'activity'
  | 'files';

export const SECTION_KEYS: SectionKey[] = [
  'overview',
  'build',
  'github',
  'infrastructure',
  'ai',
  'uat',
  'bugs',
  'changes',
  'budget',
  'support',
  'monitoring',
  'launch',
  'deployment',
  'operations',
  'activity',
  'files',
];

export function isSectionKey(value: string | null | undefined): value is SectionKey {
  return value != null && (SECTION_KEYS as string[]).includes(value);
}

export const statusColors: Record<string, string> = {
  idea: 'bg-secondary-500/10 text-secondary-300',
  planning: 'bg-sky-500/10 text-sky-400',
  building: 'bg-accent-500/10 text-accent-400',
  testing: 'bg-yellow-500/10 text-yellow-400',
  live: 'bg-emerald-500/10 text-emerald-400',
  on_hold: 'bg-foreground-500/10 text-foreground-400',
  archived: 'bg-foreground-500/10 text-foreground-600',
  new: 'bg-secondary-500/10 text-secondary-300',
  approved: 'bg-sky-500/10 text-sky-400',
  in_progress: 'bg-accent-500/10 text-accent-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-foreground-500/10 text-foreground-500',
  building_idea: 'bg-accent-500/10 text-accent-400',
  reviewing: 'bg-yellow-500/10 text-yellow-400',
  done: 'bg-emerald-500/10 text-emerald-400',
};

export const priorityColors: Record<string, string> = {
  low: 'text-foreground-500',
  medium: 'text-foreground-300',
  high: 'text-primary-400',
  critical: 'text-red-400',
};

export const severityColors: Record<string, string> = {
  low: 'bg-foreground-500/10 text-foreground-400',
  medium: 'bg-secondary-500/10 text-secondary-300',
  high: 'bg-primary-500/10 text-primary-400',
  critical: 'bg-red-500/10 text-red-400',
};

export const bugStatusColors: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-yellow-500/10 text-yellow-400',
  in_progress: 'bg-sky-500/10 text-sky-400',
  fixed: 'bg-emerald-500/10 text-emerald-400',
  wont_fix: 'bg-foreground-500/10 text-foreground-500',
  duplicate: 'bg-foreground-500/10 text-foreground-500',
  resolved: 'bg-emerald-500/10 text-emerald-400',
};

export const noteCategoryIcons: Record<string, string> = {
  decision: 'ri-scales-3-line',
  research: 'ri-search-eye-line',
  meeting: 'ri-chat-3-line',
  general: 'ri-sticky-note-line',
  legal: 'ri-scales-line',
  pricing: 'ri-money-pound-circle-line',
  client_feedback: 'ri-feedback-line',
  supplier: 'ri-truck-line',
  other: 'ri-more-line',
};

export const fileTypeIcons: Record<string, string> = {
  link: 'ri-link',
  dashboard: 'ri-dashboard-3-line',
  repo: 'ri-github-line',
  file: 'ri-file-3-line',
  document: 'ri-file-text-line',
  figma: 'ri-pen-nib-line',
};
export interface BuildTemplate {
  id: number;
  template_name: string;
  template_type: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuildTemplateItem {
  id: number;
  template_id: number;
  phase: 'conception' | 'development' | 'deployment';
  stage_number: number;
  stage_title: string;
  item_order: number;
  item_title: string;
  item_description: string | null;
  is_required: boolean;
  is_launch_blocker: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuildRun {
  id: number;
  project_id: number | null;
  template_id: number | null;
  run_name: string;
  run_status: string;
  started_at: string | null;
  completed_at: string | null;
  total_items: number;
  completed_items: number;
  launch_blockers_remaining: number;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildRunItem {
  id: number;
  run_id: number;
  template_item_id: number | null;
  phase: 'conception' | 'development' | 'deployment';
  stage_number: number;
  stage_title: string;
  item_order: number;
  item_title: string;
  item_description: string | null;
  status: 'not_started' | 'in_progress' | 'blocked' | 'done' | 'skipped';
  checked: boolean;
  checked_at: string | null;
  checked_by: string | null;
  owner: string | null;
  due_date: string | null;
  notes: string | null;
  blocker_notes: string | null;
  is_required: boolean;
  is_launch_blocker: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  project_name: string;
  slug: string;
}

export interface SummaryStats {
  activeChecklists: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  launchBlockers: number;
  averageReadiness: number;
  readyForLaunch: number;
  overdueItems: number;
}

export const PHASE_OPTIONS = [
  { value: 'all', label: 'All Phases' },
  { value: 'conception', label: 'C — Conception' },
  { value: 'development', label: 'D — Development' },
  { value: 'deployment', label: 'D — Deployment' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skipped' },
] as const;

export const APP_TYPE_OPTIONS = [
  { value: 'all', label: 'All App Types' },
  { value: 'full_saas', label: 'Full SaaS Web App' },
  { value: 'marketing_website', label: 'Marketing Website' },
  { value: 'internal_tool', label: 'Internal Tool' },
  { value: 'client_portal', label: 'Client Portal' },
  { value: 'ai_agent', label: 'AI Agent System' },
] as const;

export const APP_TYPE_LABELS: Record<string, string> = {
  full_saas: 'Full SaaS Web App',
  marketing_website: 'Marketing Website',
  internal_tool: 'Internal Tool',
  client_portal: 'Client Portal',
  ai_agent: 'AI Agent System',
};

export const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-foreground-500/10 text-foreground-400',
  in_progress: 'bg-sky-500/10 text-sky-400',
  blocked: 'bg-red-500/10 text-red-400',
  done: 'bg-emerald-500/10 text-emerald-400',
  skipped: 'bg-amber-500/10 text-amber-400',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  not_started: 'bg-foreground-400',
  in_progress: 'bg-sky-400',
  blocked: 'bg-red-400',
  done: 'bg-emerald-400',
  skipped: 'bg-amber-400',
};

export const PHASE_LABELS: Record<string, string> = {
  conception: 'C — Conception',
  development: 'D — Development',
  deployment: 'D — Deployment',
};

export const PHASE_ICONS: Record<string, string> = {
  conception: 'ri-lightbulb-line',
  development: 'ri-code-s-slash-line',
  deployment: 'ri-rocket-line',
};

export const PHASE_COLORS: Record<string, string> = {
  conception: 'bg-sky-500/10 text-sky-400',
  development: 'bg-accent-500/10 text-accent-400',
  deployment: 'bg-emerald-500/10 text-emerald-400',
};

export const READINESS_VERDICT: { min: number; max: number; label: string; color: string }[] = [
  { min: 0, max: 69, label: 'NO GO', color: 'text-red-400' },
  { min: 70, max: 89, label: 'CONDITIONAL GO', color: 'text-amber-400' },
  { min: 90, max: 100, label: 'GO', color: 'text-emerald-400' },
];
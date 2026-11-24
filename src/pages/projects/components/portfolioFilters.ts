

export type FilterKey =
  | 'all'
  | 'idea'
  | 'planning'
  | 'building'
  | 'testing'
  | 'live'
  | 'on_hold'
  | 'critical'
  | 'attention'
  | 'launch_ready'
  | 'over_budget'
  | 'ai'
  | 'saas'
  | 'client'
  | 'internal';

export type SortKey =
  | 'default'
  | 'priority'
  | 'lifecycle'
  | 'target_launch'
  | 'health'
  | 'last_activity'
  | 'budget_risk'
  | 'name';

export type ViewMode = 'cards' | 'table';

export const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Ideas' },
  { value: 'planning', label: 'Planning' },
  { value: 'building', label: 'Building' },
  { value: 'testing', label: 'Testing' },
  { value: 'live', label: 'Live' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'critical', label: 'Critical' },
  { value: 'attention', label: 'Needs Attention' },
  { value: 'launch_ready', label: 'Launch Ready' },
  { value: 'over_budget', label: 'Over Budget' },
  { value: 'ai', label: 'AI Powered' },
  { value: 'saas', label: 'SaaS' },
  { value: 'client', label: 'Client Builds' },
  { value: 'internal', label: 'Internal Tools' },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Needs Attention' },
  { value: 'priority', label: 'Priority' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'target_launch', label: 'Target Launch' },
  { value: 'health', label: 'Operational Health' },
  { value: 'last_activity', label: 'Last Activity' },
  { value: 'budget_risk', label: 'Budget Risk' },
  { value: 'name', label: 'Project Name' },
];

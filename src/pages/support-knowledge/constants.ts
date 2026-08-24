import type { KnowledgeStatus, KnowledgeVisibility, ResolutionOutcome } from '@/types/support-tickets';

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  archived: 'Archived',
};

export const KNOWLEDGE_STATUS_COLORS: Record<KnowledgeStatus, string> = {
  draft: 'bg-foreground-500/15 text-foreground-400',
  review: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  archived: 'bg-foreground-500/10 text-foreground-600',
};

export const KNOWLEDGE_VISIBILITY_LABELS: Record<KnowledgeVisibility, string> = {
  customer_safe: 'Customer-safe',
  internal_only: 'Internal only',
};

export const RESOLUTION_OUTCOME_LABELS: Record<ResolutionOutcome, string> = {
  resolved: 'Resolved',
  partially_resolved: 'Partially Resolved',
  workaround: 'Workaround',
  escalated: 'Escalated',
  known_issue: 'Known Issue',
};

export const RESOLUTION_OUTCOME_COLORS: Record<ResolutionOutcome, string> = {
  resolved: 'bg-emerald-500/15 text-emerald-400',
  partially_resolved: 'bg-amber-500/15 text-amber-400',
  workaround: 'bg-secondary-500/15 text-secondary-300',
  escalated: 'bg-orange-500/15 text-orange-400',
  known_issue: 'bg-sky-500/15 text-sky-400',
};
import type {
  RoutingStatus,
  RoutingConfidence,
  RoutingStrategy,
  TeamStatus,
} from '@/types/support-tickets';

export const ROUTING_STATUS_OPTIONS: RoutingStatus[] = [
  'unrouted',
  'queued',
  'assigned',
  'needs_review',
  'escalated',
];

export const routingStatusLabels: Record<RoutingStatus, string> = {
  unrouted: 'Unrouted',
  queued: 'Queued',
  assigned: 'Assigned',
  needs_review: 'Needs Review',
  escalated: 'Escalated',
};

export const routingStatusColors: Record<RoutingStatus, string> = {
  unrouted: 'bg-foreground-500/10 text-foreground-400',
  queued: 'bg-secondary-500/15 text-secondary-300',
  assigned: 'bg-primary-500/15 text-primary-400',
  needs_review: 'bg-amber-500/15 text-amber-400',
  escalated: 'bg-orange-500/15 text-orange-400',
};

export const routingStatusIcons: Record<RoutingStatus, string> = {
  unrouted: 'ri-question-line',
  queued: 'ri-stack-line',
  assigned: 'ri-user-star-line',
  needs_review: 'ri-eye-2-line',
  escalated: 'ri-alarm-warning-line',
};

export const routingConfidenceLabels: Record<RoutingConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const ROUTING_STRATEGY_OPTIONS: RoutingStrategy[] = [
  'manual',
  'round_robin',
  'least_open_tickets',
];

export const routingStrategyLabels: Record<RoutingStrategy, string> = {
  manual: 'Manual',
  round_robin: 'Round Robin',
  least_open_tickets: 'Least Open Tickets',
};

export const routingStrategyDescriptions: Record<RoutingStrategy, string> = {
  manual: 'Tickets stay in the team queue until a manager assigns them.',
  round_robin: 'Assign the next ticket to the member who has waited longest since their last assignment.',
  least_open_tickets: 'Assign the next ticket to the member with the fewest open tickets.',
};

export const TEAM_STATUS_OPTIONS: TeamStatus[] = ['active', 'archived'];

export const teamStatusLabels: Record<TeamStatus, string> = {
  active: 'Active',
  archived: 'Archived',
};

export const teamStatusColors: Record<TeamStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  archived: 'bg-foreground-500/15 text-foreground-400',
};

export const membershipRoleLabels: Record<string, string> = {
  manager: 'Manager',
  member: 'Member',
};
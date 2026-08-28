import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
} from '@/types/support-tickets';

export const STATUS_OPTIONS: TicketStatus[] = [
  'new',
  'open',
  'in_progress',
  'waiting_on_customer',
  'waiting_on_staff',
  'resolved',
  'closed',
  'spam',
];

export const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent', 'critical'];

export const CATEGORY_OPTIONS: TicketCategory[] = [
  'general',
  'technical',
  'account',
  'billing',
  'access',
  'bug',
  'complaint',
  'feature_request',
  'security',
  'other',
];

export const SOURCE_OPTIONS: TicketSource[] = [
  'website',
  'email',
  'admin',
  'api',
  'ai_agent',
  'import',
  'uat',
];

export const statusLabels: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  waiting_on_staff: 'Waiting on Staff',
  resolved: 'Resolved',
  closed: 'Closed',
  spam: 'Spam',
};

export const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
};

export const categoryLabels: Record<TicketCategory, string> = {
  general: 'General',
  technical: 'Technical',
  account: 'Account',
  billing: 'Billing',
  access: 'Access',
  bug: 'Bug',
  complaint: 'Complaint',
  feature_request: 'Feature Request',
  security: 'Security',
  other: 'Other',
};

export const sourceLabels: Record<TicketSource, string> = {
  website: 'Website',
  email: 'Email',
  admin: 'Admin',
  api: 'API',
  ai_agent: 'AI Agent',
  import: 'Import',
  uat: 'UAT',
};

export const statusColors: Record<TicketStatus, string> = {
  new: 'bg-accent-500/15 text-accent-400',
  open: 'bg-primary-500/15 text-primary-400',
  in_progress: 'bg-amber-500/15 text-amber-400',
  waiting_on_customer: 'bg-yellow-500/15 text-yellow-400',
  waiting_on_staff: 'bg-orange-500/15 text-orange-400',
  resolved: 'bg-emerald-500/15 text-emerald-400',
  closed: 'bg-foreground-500/15 text-foreground-400',
  spam: 'bg-red-500/10 text-red-400/70',
};

export const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-foreground-500/10 text-foreground-400',
  normal: 'bg-secondary-500/15 text-secondary-300',
  high: 'bg-amber-500/15 text-amber-400',
  urgent: 'bg-orange-500/15 text-orange-400',
  critical: 'bg-red-500/15 text-red-400',
};

export const statusIcons: Record<TicketStatus, string> = {
  new: 'ri-mail-unread-line',
  open: 'ri-mail-open-line',
  in_progress: 'ri-loader-4-line',
  waiting_on_customer: 'ri-time-line',
  waiting_on_staff: 'ri-timer-line',
  resolved: 'ri-check-double-line',
  closed: 'ri-mail-close-line',
  spam: 'ri-spam-2-line',
};

export const priorityIcons: Record<TicketPriority, string> = {
  low: 'ri-arrow-down-line',
  normal: 'ri-arrow-right-line',
  high: 'ri-arrow-up-line',
  urgent: 'ri-alarm-warning-line',
  critical: 'ri-error-warning-line',
};

export type SortValue =
  | 'default'
  | 'created_desc'
  | 'created_asc'
  | 'activity_desc'
  | 'activity_asc'
  | 'priority_desc'
  | 'due_asc'
  | 'customer_asc'
  | 'ticket_number_asc';

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'default', label: 'Relevance' },
  { value: 'created_desc', label: 'Newest created' },
  { value: 'created_asc', label: 'Oldest created' },
  { value: 'activity_desc', label: 'Most recent activity' },
  { value: 'activity_asc', label: 'Oldest activity' },
  { value: 'priority_desc', label: 'Highest priority' },
  { value: 'due_asc', label: 'Due soonest' },
  { value: 'customer_asc', label: 'Customer name' },
  { value: 'ticket_number_asc', label: 'Ticket number' },
];

export const PAGE_SIZES = [25, 50, 100];

export const isTerminalStatus = (status: TicketStatus): boolean =>
  status === 'resolved' || status === 'closed' || status === 'spam';

export function isOverdue(dueAt: string | null, status: TicketStatus): boolean {
  if (!dueAt) return false;
  if (isTerminalStatus(status)) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function overdueDuration(dueAt: string): string {
  const diffMs = Date.now() - new Date(dueAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m overdue`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h overdue`;
  const days = Math.floor(hours / 24);
  return `${days}d overdue`;
}
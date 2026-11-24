import type { SupportSummary } from '@/types/support-tickets';

export interface MetricDef {
  key: keyof SupportSummary;
  label: string;
  icon: string;
  accent: string;
  description: string;
}

export const METRICS: MetricDef[] = [
  { key: 'tickets_received', label: 'Tickets Received', icon: 'ri-mail-add-line', accent: 'text-primary-400', description: 'New tickets created in the selected period.' },
  { key: 'tickets_resolved', label: 'Tickets Resolved', icon: 'ri-check-double-line', accent: 'text-emerald-400', description: 'Tickets marked resolved in the selected period.' },
  { key: 'active_open', label: 'Active Open Tickets', icon: 'ri-inbox-line', accent: 'text-accent-400', description: 'Currently open — excludes resolved, closed and spam.' },
  { key: 'overdue_active', label: 'Overdue Active', icon: 'ri-alarm-warning-line', accent: 'text-orange-400', description: 'Active tickets past their due time.' },
  { key: 'unassigned_active', label: 'Unassigned Active', icon: 'ri-user-line', accent: 'text-foreground-400', description: 'Active tickets with no assigned staff.' },
  { key: 'customer_replies', label: 'Customer Replies', icon: 'ri-chat-3-line', accent: 'text-secondary-300', description: 'Customer messages in the selected period.' },
  { key: 'staff_replies', label: 'Public Staff Replies', icon: 'ri-reply-line', accent: 'text-primary-400', description: 'Public staff replies — internal notes excluded.' },
  { key: 'sla_breaches', label: 'SLA Breaches', icon: 'ri-timer-flash-line', accent: 'text-red-400', description: 'Tickets breaching first-response or resolution SLA.' },
];

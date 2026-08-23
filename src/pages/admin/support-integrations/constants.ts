import type { TicketCategory, TicketPriority } from '@/types/support-tickets';

export const INTEGRATION_MODES = [
  { value: 'public_form', label: 'Public form', description: 'Browser support form with origin checks and CAPTCHA.' },
  { value: 'server_to_server', label: 'Server-to-server', description: 'Signed backend request with HMAC authentication.' },
] as const;

export const CATEGORIES: TicketCategory[] = [
  'general', 'technical', 'account', 'billing', 'access',
  'bug', 'complaint', 'feature_request', 'security', 'other',
];

export const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent', 'critical'];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: 'General',
  technical: 'Technical',
  account: 'Account',
  billing: 'Billing',
  access: 'Access',
  bug: 'Bug',
  complaint: 'Complaint',
  feature_request: 'Feature request',
  security: 'Security',
  other: 'Other',
};

export const SPAM_MODES = [
  { value: 'standard', label: 'Standard', description: 'Honeypot, link limits and rate limiting.' },
  { value: 'strict', label: 'Strict', description: 'Standard plus CAPTCHA recommended and tighter limits.' },
  { value: 'off', label: 'Off', description: 'No anti-spam checks (not recommended).' },
] as const;

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidDomain = (value: string): boolean => {
  const v = value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!v) return false;
  if (v === '*' || v.includes('*')) return false;
  return /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(v);
};

export const isValidSlug = (value: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

// Exact origin validation — scheme + host + optional port only. No wildcards,
// no credentials, no path/query/hash.
export const isValidOrigin = (value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  if (v === '*' || v.includes('*')) return false;
  try {
    const u = new URL(v);
    if (!['https:', 'http:'].includes(u.protocol)) return false;
    if (u.pathname && u.pathname !== '/') return false;
    if (u.search || u.hash || u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatRelative = (value: string | null | undefined): string => {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
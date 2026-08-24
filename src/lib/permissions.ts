// ============================================================================
// DFP Command — role + permission model (Prompt 14).
//
// Mirrors the server-side `internal_has_permission()` matrix exactly. Client
// side is for UI visibility only — the server remains the authority for every
// sensitive action.
// ============================================================================

export type Role =
  | 'owner'
  | 'admin'
  | 'support_manager'
  | 'support_agent'
  | 'developer'
  | 'viewer';

export const SUPPORT_ROLES: Role[] = [
  'owner',
  'admin',
  'support_manager',
  'support_agent',
  'developer',
  'viewer',
];

export type Permission =
  | 'support.tickets.view'
  | 'support.tickets.reply'
  | 'support.tickets.assign'
  | 'support.tickets.priority'
  | 'support.tickets.escalate'
  | 'support.customers.view'
  | 'support.customers.search'
  | 'support.diagnostics.view'
  | 'support.diagnostics.run'
  | 'support.diagnostics.retry'
  | 'support.repairs.view'
  | 'support.repairs.request'
  | 'support.repairs.approve.low'
  | 'support.repairs.approve.medium'
  | 'support.repairs.reject'
  | 'support.repairs.cancel'
  | 'support.repairs.execute'
  | 'support.sessions.view'
  | 'support.sessions.start'
  | 'support.sessions.end'
  | 'support.sessions.revoke'
  | 'support.audit.view'
  | 'support.integrations.view'
  | 'support.integrations.manage'
  | 'support.metrics.view'
  | 'support.knowledge.view'
  | 'support.knowledge.create'
  | 'support.knowledge.edit'
  | 'support.knowledge.approve'
  | 'support.knowledge.archive'
  | 'support.resolutions.view'
  | 'support.resolutions.create'
  | 'support.resolutions.approve'
  | 'support.ai_reply.generate'
  | 'support.triage.run'
  | 'support.sites.view'
  | 'support.sites.test'
  | 'support.sites.manage'
  | 'staff.view'
  | 'staff.manage'
  | 'staff.roles.manage';

// The exact permission set for each role (owner = all).
const ROLE_PERMISSIONS: Record<Exclude<Role, 'owner'>, Permission[]> = {
  admin: [
    'support.tickets.view', 'support.tickets.reply', 'support.tickets.assign',
    'support.tickets.priority', 'support.tickets.escalate',
    'support.customers.view', 'support.customers.search',
    'support.diagnostics.view', 'support.diagnostics.run', 'support.diagnostics.retry',
    'support.repairs.view', 'support.repairs.request', 'support.repairs.approve.low',
    'support.repairs.approve.medium', 'support.repairs.reject', 'support.repairs.cancel',
    'support.repairs.execute',
    'support.sessions.view', 'support.sessions.start', 'support.sessions.end', 'support.sessions.revoke',
    'support.audit.view',
    'support.integrations.view', 'support.integrations.manage',
    'support.metrics.view',
    'support.knowledge.view', 'support.knowledge.create', 'support.knowledge.edit', 'support.knowledge.approve', 'support.knowledge.archive',
    'support.resolutions.view', 'support.resolutions.create', 'support.resolutions.approve',
    'support.ai_reply.generate', 'support.triage.run',
    'support.sites.view', 'support.sites.test', 'support.sites.manage',
    'staff.view', 'staff.manage', 'staff.roles.manage',
  ],
  support_manager: [
    'support.tickets.view', 'support.tickets.reply', 'support.tickets.assign',
    'support.tickets.priority', 'support.tickets.escalate',
    'support.customers.view', 'support.customers.search',
    'support.diagnostics.view',
    'support.repairs.view', 'support.repairs.request', 'support.repairs.approve.low',
    'support.repairs.approve.medium', 'support.repairs.reject', 'support.repairs.cancel',
    'support.repairs.execute',
    'support.sessions.view', 'support.sessions.start', 'support.sessions.end', 'support.sessions.revoke',
    'support.audit.view',
    'support.metrics.view',
    'support.knowledge.view', 'support.knowledge.create', 'support.knowledge.edit', 'support.knowledge.approve', 'support.knowledge.archive',
    'support.resolutions.view', 'support.resolutions.create', 'support.resolutions.approve',
    'support.ai_reply.generate', 'support.triage.run',
    'support.sites.view', 'support.sites.test',
  ],
  support_agent: [
    'support.tickets.view', 'support.tickets.reply', 'support.tickets.escalate',
    'support.customers.view', 'support.customers.search',
    'support.diagnostics.view',
    'support.repairs.view', 'support.repairs.request',
    'support.sessions.view', 'support.sessions.start', 'support.sessions.end',
    'support.metrics.view',
    'support.knowledge.view', 'support.knowledge.create',
    'support.resolutions.view', 'support.resolutions.create',
    'support.ai_reply.generate', 'support.triage.run',
    'support.sites.view',
  ],
  developer: [
    'support.tickets.view', 'support.tickets.reply',
    'support.customers.view',
    'support.diagnostics.view',
    'support.repairs.view', 'support.repairs.request',
    'support.knowledge.view', 'support.knowledge.create',
    'support.resolutions.view',
    'support.ai_reply.generate', 'support.triage.run',
    'support.sites.view',
  ],
  viewer: [
    'support.tickets.view', 'support.customers.view', 'support.customers.search',
    'support.diagnostics.view', 'support.repairs.view', 'support.sessions.view',
    'support.metrics.view',
    'support.knowledge.view', 'support.resolutions.view',
    'support.sites.view',
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'owner') return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  support_manager: 'Support Manager',
  support_agent: 'Support Agent',
  developer: 'Developer',
  viewer: 'Viewer',
};

export const ROLE_BADGE_COLORS: Record<Role, string> = {
  owner: 'bg-primary-500/15 text-primary-400',
  admin: 'bg-accent-500/15 text-accent-400',
  support_manager: 'bg-emerald-500/15 text-emerald-400',
  support_agent: 'bg-sky-500/15 text-sky-400',
  developer: 'bg-amber-500/15 text-amber-400',
  viewer: 'bg-secondary-500/15 text-secondary-300',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full support authority — staff, roles, tickets, diagnostics, repairs, sessions, integrations and audit.',
  admin: 'Manage tickets, diagnostics, LOW/MEDIUM repairs, sessions, integrations and staff (not the owner role).',
  support_manager: 'Manage support operations, approve LOW/MEDIUM repairs, run AI triage, start/revoke sessions and view audit.',
  support_agent: 'Work permitted tickets, reply, run AI triage, request repairs and start own read-only sessions.',
  developer: 'View technical tickets and diagnostics, add technical notes and run AI triage.',
  viewer: 'Read-only access across the support platform.',
};

// Roles selectable when inviting a new staff member (owner is never grantable
// through invitations or role changes made by non-owners).
export const INVITABLE_ROLES: Role[] = [
  'admin',
  'support_manager',
  'support_agent',
  'developer',
  'viewer',
];
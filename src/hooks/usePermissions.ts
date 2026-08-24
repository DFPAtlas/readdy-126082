import { useAuth } from '@/components/feature/AuthGuard';
import { hasPermission, type Permission, type Role } from '@/lib/permissions';

export interface Permissions {
  role: Role | null;
  can: (permission: Permission) => boolean;
  canReply: boolean;
  canAssign: boolean;
  canRunDiagnostics: boolean;
  canRetryDiagnostics: boolean;
  canRequestRepair: boolean;
  canApproveRepair: boolean;
  canRejectRepair: boolean;
  canStartSession: boolean;
  canRevokeSession: boolean;
  canViewAudit: boolean;
  canManageIntegrations: boolean;
  canManageStaff: boolean;
  canManageRoles: boolean;
  canGenerateAiReply: boolean;
  canRunTriage: boolean;
  canViewKnowledge: boolean;
  canCreateKnowledge: boolean;
  canEditKnowledge: boolean;
  canApproveKnowledge: boolean;
  canArchiveKnowledge: boolean;
  canViewResolutions: boolean;
  canCreateResolutions: boolean;
  canApproveResolutions: boolean;
  canManageSites: boolean;
  canTestSites: boolean;
  canViewSites: boolean;
}

/**
 * Central client-side permission helper (Prompt 14). UI visibility only — the
 * server (`internal_has_permission`) remains authoritative for every action.
 */
export default function usePermissions(): Permissions {
  const { role } = useAuth();
  const can = (permission: Permission) => hasPermission(role, permission);

  return {
    role,
    can,
    canReply: can('support.tickets.reply'),
    canAssign: can('support.tickets.assign'),
    canRunDiagnostics: can('support.diagnostics.run'),
    canRetryDiagnostics: can('support.diagnostics.retry'),
    canRequestRepair: can('support.repairs.request'),
    canApproveRepair: can('support.repairs.approve.medium'),
    canRejectRepair: can('support.repairs.reject'),
    canStartSession: can('support.sessions.start'),
    canRevokeSession: can('support.sessions.revoke'),
    canViewAudit: can('support.audit.view'),
    canManageIntegrations: can('support.integrations.manage'),
    canManageStaff: can('staff.manage'),
    canManageRoles: can('staff.roles.manage'),
    canGenerateAiReply: can('support.ai_reply.generate'),
    canRunTriage: can('support.triage.run'),
    canViewKnowledge: can('support.knowledge.view'),
    canCreateKnowledge: can('support.knowledge.create'),
    canEditKnowledge: can('support.knowledge.edit'),
    canApproveKnowledge: can('support.knowledge.approve'),
    canArchiveKnowledge: can('support.knowledge.archive'),
    canViewResolutions: can('support.resolutions.view'),
    canCreateResolutions: can('support.resolutions.create'),
    canApproveResolutions: can('support.resolutions.approve'),
    canManageSites: can('support.sites.manage'),
    canTestSites: can('support.sites.test'),
    canViewSites: can('support.sites.view'),
  };
}
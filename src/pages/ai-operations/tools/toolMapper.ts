// ============================================================================
// AI Operations — Tools & Connections Registry — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows and the existing
// `ToolConnection` / `ToolAgentAccess` contracts. All DB→frontend field
// differences are handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `connection_key` (text, unique) is the stable application identifier used
//     by routes (/ai-operations/tools/:connectionId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//   * Existing routes keep working because the demo `id` values already equal
//     the `connection_key` values (CON-…).
//
// Live vs demo:
//   * Authoritative connection base metadata comes from the live
//     `ai_tool_connections` row: identity, category/provider, scope/site,
//     environment, status, health state, risk, authentication type, credential
//     reference label, allowed/restricted operations, approval/audit
//     requirement, ownership, configuration state.
//   * Agent access comes from the live `ai_tool_agent_access` rows (not demo).
//   * Nested supporting metadata (access mode, rich operation groups,
//     permissions matrix, site usage, dependencies, usage events, security
//     controls, detailed health diagnostics) has no live table yet, so it is
//     merged from the demo registry as clearly-labelled "Demo Supporting
//     Metadata".
//
// Credentials: only safe reference labels are ever stored or displayed — never
// the value.
// ============================================================================

import type {
  ToolConnection,
  ToolAgentAccess,
  ToolCategory,
  ToolConnectionStatus,
  ConnectionHealth,
  ConfigurationState,
  Environment,
  Criticality,
  ToolAccessMode,
  RiskLevel,
  ToolHealthDiagnostics,
  ToolSecurityControls,
} from '@/pages/ai-operations/types';
import type {
  AiToolConnectionRow,
  AiToolAgentAccessRow,
  AiToolConnectionUpsertInput,
} from '@/lib/ai-operations';

// Resolved lookup maps (agent key/name/site-name by UUID, site key/name by
// UUID), built by the Tools context from the live Agent + Site registries.
// No UUIDs leak into the UI.
export interface ToolResolutionContext {
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  agentSiteNameById: Map<string, string>;
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse a JSONB string[] column safely.
function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

// Safe empty defaults for fields with no live production table yet.
function emptySupporting(): Partial<ToolConnection> {
  return {
    accessMode: 'read',
    siteUsage: [],
    operationGroups: [],
    permissions: [],
    dependencies: [],
    usageEvents: [],
    security: {
      credentialsExternal: true,
      secretsHiddenFromAgents: true,
      environmentIsolation: true,
      leastPrivilege: true,
      approvalForHighRisk: true,
      auditEnabled: true,
      rotationStatus: '—',
      lastSecurityReview: '—',
    } as ToolSecurityControls,
    health: {
      state: 'unknown',
      lastSuccessfulCheck: '—',
      lastFailure: '—',
      failureSummary: 'Not yet configured.',
      responseTime: '—',
      availability: '—',
      recommendedAction: 'Complete connection setup.',
    } as ToolHealthDiagnostics,
  };
}

// Derive allowed/restricted operation names from the demo operation groups
// (green/amber → allowed, red → restricted) when the live row has no values.
function demoOperationSplit(demo: ToolConnection | undefined): { allowed: string[]; restricted: string[] } {
  if (!demo) return { allowed: [], restricted: [] };
  const allowed = demo.operationGroups
    .filter((g) => g.riskClass !== 'red')
    .flatMap((g) => g.operations);
  const restricted = demo.operationGroups
    .filter((g) => g.riskClass === 'red')
    .flatMap((g) => g.operations);
  return { allowed, restricted };
}

/**
 * Map a live `ai_tool_agent_access` row to a `ToolAgentAccess` record.
 */
export function mapAccessRowToToolAgentAccess(
  row: AiToolAgentAccessRow,
  ctx: ToolResolutionContext,
): ToolAgentAccess {
  return {
    agentId: ctx.agentKeyById.get(row.agent_id) ?? 'unresolved',
    agentName: ctx.agentNameById.get(row.agent_id) ?? 'Unresolved Agent',
    site: ctx.agentSiteNameById.get(row.agent_id) ?? '',
    accessMode: (row.access_level as ToolAccessMode) ?? 'read',
    allowedOperations: readStringArray(row.allowed_operations),
    restrictedOperations: readStringArray(row.restricted_operations),
    risk: (row.risk_limit as RiskLevel) ?? 'medium',
    approvalRequired: row.approval_required,
    status: row.is_active ? 'connected' : 'disconnected',
  };
}

/**
 * Map a live `ai_tool_connections` row to a `ToolConnection`.
 *
 * @param row         The Supabase row.
 * @param demo        Optional matching demo record (by `connection_key`) for
 *                    nested demo supporting metadata.
 * @param accessRows  Live agent-access rows for this connection.
 * @param ctx         Resolved agent/site lookup maps.
 */
export function mapToolConnectionRowToRecord(
  row: AiToolConnectionRow,
  demo: ToolConnection | undefined,
  accessRows: AiToolAgentAccessRow[],
  ctx: ToolResolutionContext,
): ToolConnection {
  const d = demo ?? (emptySupporting() as ToolConnection);
  const split = demoOperationSplit(demo);

  // Resolve site key/name (no UUID in the UI).
  const siteKey = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? null) : null;
  const siteName = row.site_id
    ? (ctx.siteNameById.get(row.site_id) ?? 'Unresolved Site')
    : '';

  const allowed = row.allowed_operations != null ? readStringArray(row.allowed_operations) : split.allowed;
  const restricted = row.restricted_operations != null ? readStringArray(row.restricted_operations) : split.restricted;

  return {
    // Stable application identifier — equals the DB `connection_key`.
    id: row.connection_key,
    name: row.name,
    provider: row.provider ?? d.provider,
    category: (row.category as ToolCategory) ?? d.category,
    description: row.description ?? d.description,
    scope: row.scope ?? (siteKey ? 'Site' : 'Group-wide'),
    siteId: siteKey,
    environment: (row.environment as Environment) ?? d.environment,
    status: (row.status as ToolConnectionStatus) ?? d.status,
    criticality: (row.risk_level as Criticality) ?? d.criticality,
    configurationState: (row.configuration_state as ConfigurationState) ?? d.configurationState,
    accessMode: d.accessMode ?? 'read',
    // Safe credential reference label only — the value is never stored/displayed.
    reference: row.credential_reference ?? d.reference,
    authenticationType: row.authentication_type ?? d.authenticationType,
    allowedOperations: allowed,
    restrictedOperations: restricted,
    ownerTeam: row.owner_team ?? d.ownerTeam,
    lastChecked: row.last_checked_at ? formatDate(row.last_checked_at) : d.lastChecked,
    lastSuccessfulUse: row.last_success_at ? formatDate(row.last_success_at) : d.lastSuccessfulUse,
    failureCount: d.failureCount ?? 0,
    approvalRequired: row.approval_required,
    auditRequired: row.audit_required,
    notes: row.notes ?? d.notes,
    createdAt: d.createdAt ?? formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    // Live agent access (from ai_tool_agent_access).
    agentAccess: accessRows.map((r) => mapAccessRowToToolAgentAccess(r, ctx)),
    // Demo supporting metadata (no live production tables yet).
    siteUsage: d.siteUsage ?? [],
    operationGroups: d.operationGroups ?? [],
    permissions: d.permissions ?? [],
    health: {
      state: (row.health as ConnectionHealth) ?? d.health.state,
      lastSuccessfulCheck: d.health.lastSuccessfulCheck,
      lastFailure: d.health.lastFailure,
      failureSummary: row.failure_summary ?? d.health.failureSummary,
      responseTime: d.health.responseTime,
      availability: d.health.availability,
      recommendedAction: d.health.recommendedAction,
    },
    dependencies: d.dependencies ?? [],
    usageEvents: d.usageEvents ?? [],
    security: d.security ?? (emptySupporting() as ToolConnection).security,
  };
}

/**
 * Map a `ToolConnection` record to the database input for create/update.
 * Only safe base metadata is persisted — nested demo metadata and detailed
 * health/security controls are intentionally excluded. `siteUuid` is the
 * resolved `ai_sites.id` (or null for group-wide). No credential values are
 * accepted.
 */
export function mapRecordToConnectionInput(
  record: ToolConnection,
  siteUuid: string | null,
): AiToolConnectionUpsertInput {
  return {
    connection_key: record.id,
    name: record.name,
    description: record.description,
    category: record.category,
    provider: record.provider,
    scope: record.siteId ? 'site' : 'group',
    site_id: siteUuid,
    connection_type: record.category,
    environment: record.environment,
    status: record.status,
    health: record.health.state,
    risk_level: record.criticality,
    authentication_type: record.authenticationType ?? null,
    credential_reference: record.reference === '—' ? null : record.reference,
    allowed_operations: record.allowedOperations ?? null,
    restricted_operations: record.restrictedOperations ?? null,
    approval_required: record.approvalRequired,
    audit_required: record.auditRequired,
    owner_team: record.ownerTeam,
    configuration_state: record.configurationState,
    notes: record.notes,
  };
}
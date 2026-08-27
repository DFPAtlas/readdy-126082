// ============================================================================
// AI Operations — Group Site Registry — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase `ai_sites` row and the existing
// `SiteRegistryRecord` shape. All DB→frontend field differences are handled
// here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `site_key` (text, unique) is the stable application identifier used by
//     routes and relationships.
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//   * Existing routes (/ai-operations/sites/:siteId) keep working because the
//     demo `id` values already equal the `site_key` values.
//
// Live vs demo:
//   * Base identity/metadata comes from the live `ai_sites` row.
//   * Nested metadata (connections, capabilities, dependencies, ownership,
//     agent previews) and operational KPI values do not yet have production
//     tables, so they are merged from the demo registry as clearly-labelled
//     "Demo Supporting Metadata". A newly created live site (no demo match)
//     gets safe empty defaults.
// ============================================================================

import type {
  SiteRegistryRecord,
  BusinessType,
  Environment,
  SiteAiStatus,
  AiStatus,
  Criticality,
} from '@/pages/ai-operations/types';
import type { AiSiteRow, AiSiteUpsertInput } from '@/lib/ai-operations';

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Safe empty defaults for fields that have no live production table yet.
function emptySupportingData() {
  return {
    lastHealthCheck: 'Never',
    lastAgentActivity: 'Never',
    activeAgentCount: 0,
    currentJobs: 0,
    failedJobs: 0,
    pendingApprovals: 0,
    openAlerts: 0,
    openTickets: 0,
    uatStatus: 'Not started',
    connections: [],
    capabilities: [],
    dependencies: [],
    ownership: {
      businessOwner: '',
      technicalOwner: '',
      supportTeam: '',
      escalationTeam: '',
      defaultSeverity: 'Medium',
      supportQueue: '',
    },
    agents: [],
  };
}

/**
 * Map a live `ai_sites` row to a `SiteRegistryRecord`.
 *
 * @param row      The Supabase row.
 * @param demoSite Optional matching demo record (by `site_key`) used to supply
 *                 nested demo metadata + KPI values that have no live table yet.
 */
export function mapSiteRowToRecord(
  row: AiSiteRow,
  demoSite?: SiteRegistryRecord,
): SiteRegistryRecord {
  const demo = demoSite ?? (emptySupportingData() as Partial<SiteRegistryRecord>);

  return {
    // Stable application identifier — equals the DB `site_key`, keeps routes stable.
    id: row.site_key,
    name: row.name,
    productName: row.product_name ?? row.name,
    domain: row.domain ?? '',
    description: row.description ?? '',
    businessType: (row.business_type as BusinessType) ?? 'website',
    environment: (row.environment as Environment) ?? 'production',
    operationalStatus: (row.operational_status as SiteAiStatus) ?? 'unknown',
    aiStatus: (row.ai_status as AiStatus) ?? 'not_configured',
    criticality: (row.criticality as Criticality) ?? 'medium',
    ownerTeam: row.owner_team ?? '',
    repository: row.repository_reference ?? '',
    readdyProject: row.readdy_reference ?? '',
    supabaseProject: row.supabase_reference ?? '',
    n8nConnection: row.n8n_reference ?? '',
    billingProvider: row.billing_provider ?? '',
    emailProvider: row.email_provider ?? '',
    authProvider: row.authentication_provider ?? '',
    hosting: row.hosting_provider ?? '',
    notes: row.notes ?? '',
    createdAt: demo.createdAt ?? formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    // Demo supporting metadata (no production tables yet).
    lastHealthCheck: demo.lastHealthCheck ?? 'Never',
    lastAgentActivity: demo.lastAgentActivity ?? 'Never',
    activeAgentCount: demo.activeAgentCount ?? 0,
    currentJobs: demo.currentJobs ?? 0,
    failedJobs: demo.failedJobs ?? 0,
    pendingApprovals: demo.pendingApprovals ?? 0,
    openAlerts: demo.openAlerts ?? 0,
    openTickets: demo.openTickets ?? 0,
    uatStatus: demo.uatStatus ?? 'Not started',
    connections: demo.connections ?? [],
    capabilities: demo.capabilities ?? [],
    dependencies: demo.dependencies ?? [],
    ownership: demo.ownership ?? {
      businessOwner: '',
      technicalOwner: '',
      supportTeam: '',
      escalationTeam: '',
      defaultSeverity: 'Medium',
      supportQueue: '',
    },
    agents: demo.agents ?? [],
  };
}

/**
 * Map a `SiteRegistryRecord` to the database input for create/update.
 * Only base metadata is persisted — nested demo metadata and KPI values are
 * intentionally excluded (they have no production tables yet).
 */
export function mapRecordToSiteInput(record: SiteRegistryRecord): AiSiteUpsertInput {
  return {
    site_key: record.id,
    name: record.name,
    product_name: record.productName,
    domain: record.domain,
    description: record.description,
    business_type: record.businessType,
    environment: record.environment,
    operational_status: record.operationalStatus,
    ai_status: record.aiStatus,
    criticality: record.criticality,
    owner_team: record.ownerTeam,
    repository_reference: record.repository,
    readdy_reference: record.readdyProject,
    supabase_reference: record.supabaseProject,
    n8n_reference: record.n8nConnection,
    billing_provider: record.billingProvider,
    email_provider: record.emailProvider,
    authentication_provider: record.authProvider,
    hosting_provider: record.hosting,
    notes: record.notes,
  };
}
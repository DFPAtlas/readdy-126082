// ============================================================================
// AI Operations — Central Agent Registry — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase `ai_operations_agents` row and
// the existing `AgentRegistryRecord` shape. All DB→frontend field differences
// are handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `agent_key` (text, unique) is the stable application identifier used by
//     routes and relationships.
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//   * Existing routes (/ai-operations/agents/:agentId) keep working because the
//     demo `id` values already equal the `agent_key` values.
//
// Live vs demo:
//   * Base identity/metadata comes from the live `ai_operations_agents` row.
//   * Nested metadata (model detail, tools, data/action permissions, approval
//     policy, dependencies, runs, events) and operational KPI values do not yet
//     have production tables, so they are merged from the demo registry as
//     clearly-labelled "Demo Supporting Metadata". A newly created live agent
//     (no demo match) gets safe empty defaults.
// ============================================================================

import type {
  AgentRegistryRecord,
  AgentType,
  AgentCategory,
  AgentStatus,
  AgentHealth,
  AgentAutonomy,
  RiskLevel,
  Environment,
} from '@/pages/ai-operations/types';
import type { AiAgentRow, AiAgentUpsertInput } from '@/lib/ai-operations';

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse a numeric success-rate value into the frontend string ("99.4%"), or
// "—" when null/empty.
function formatSuccessRate(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}

// Parse a stored model reference ("Anthropic / Claude Sonnet") into provider
// and model name parts. Safe reference strings only — never a credential.
function parseModelReference(ref: string | null): { provider: string; model: string } {
  if (!ref) return { provider: '', model: '' };
  const [provider, model] = ref.split(' / ');
  return { provider: (provider ?? '').trim(), model: (model ?? '').trim() };
}

// Convert the frontend success-rate string back to a numeric DB value.
function parseSuccessRate(value: string): number | null {
  if (!value || value === '—' || value === '-') return null;
  const n = parseFloat(value.replace('%', '').trim());
  return Number.isNaN(n) ? null : n;
}

// Safe empty defaults for nested metadata with no live production table yet.
function emptySupportingData(): Partial<AgentRegistryRecord> {
  return {
    lastRun: 'Never',
    lastSuccessfulRun: 'Never',
    jobsToday: 0,
    failedJobsToday: 0,
    avgRunDuration: '—',
    avgEstimatedCost: '—',
    tools: [],
    dataPermissions: [],
    actionPermissions: [],
    approvalPolicy: {
      approvalRequired: true,
      minApprovers: 1,
      approvalTeam: 'Group AI Operations',
      maxPermittedRisk: 'medium',
      autoExpiry: '24h',
      verificationRequired: true,
      uatRequired: false,
      auditRequired: true,
    },
    dependencies: [],
    runs: [],
    events: [],
  };
}

/**
 * Map a live `ai_operations_agents` row to an `AgentRegistryRecord`.
 *
 * @param row       The Supabase row.
 * @param demoAgent Optional matching demo record (by `agent_key`) used to
 *                  supply nested demo metadata + KPI values with no live table.
 * @param siteKey   Resolved stable site key for this agent's `site_id` (null
 *                  for group/shared agents).
 * @param siteName  Resolved site display name (ignored for group agents).
 */
export function mapAgentRowToRecord(
  row: AiAgentRow,
  demoAgent?: AgentRegistryRecord,
  siteKey: string | null = null,
  siteName: string = '',
): AgentRegistryRecord {
  const demo = demoAgent ?? (emptySupportingData() as Partial<AgentRegistryRecord>);

  const primary = parseModelReference(row.primary_model_reference);
  const fallback = parseModelReference(row.fallback_model_reference);

  return {
    // Stable application identifier — equals the DB `agent_key`, keeps routes stable.
    id: row.agent_key,
    name: row.name,
    description: row.description ?? '',
    type: (row.agent_type as AgentType) ?? 'site_specific',
    category: (row.category as AgentCategory) ?? 'other',
    assignedSite: siteKey,
    scope: siteKey ? siteName || siteKey : 'Group-wide',
    environment: (row.environment as Environment) ?? 'production',
    status: (row.status as AgentStatus) ?? 'not_configured',
    health: (row.health as AgentHealth) ?? 'unknown',
    risk: (row.risk_level as RiskLevel) ?? 'low',
    autonomy: (row.autonomy_level as AgentAutonomy) ?? 'limited_automatic',
    currentTask: row.current_task ?? 'Awaiting configuration',
    // `current_run_id` is not linked live yet (demo run ids are not real UUIDs).
    currentRunId: '—',
    queueCount: row.queue_count ?? 0,
    // Demo operational KPIs (no production tables yet).
    lastRun: demo.lastRun ?? 'Never',
    lastSuccessfulRun: demo.lastSuccessfulRun ?? 'Never',
    successRate: formatSuccessRate(row.success_rate),
    jobsToday: demo.jobsToday ?? 0,
    failedJobsToday: demo.failedJobsToday ?? 0,
    avgRunDuration: demo.avgRunDuration ?? '—',
    avgEstimatedCost: demo.avgEstimatedCost ?? '—',
    ownerTeam: row.owner_team ?? '',
    escalationTeam: row.escalation_team ?? '',
    createdAt: demo.createdAt ?? formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    notes: row.notes ?? '',
    // Model references are live; the remaining model detail is demo-derived.
    model: {
      primaryProvider: primary.provider || demo.model?.primaryProvider || '',
      primaryModel: primary.model || demo.model?.primaryModel || '',
      fallbackProvider: fallback.provider || demo.model?.fallbackProvider || '',
      fallbackModel: fallback.model || demo.model?.fallbackModel || '',
      purpose: demo.model?.purpose ?? 'General reasoning and task execution',
      configStatus: demo.model?.configStatus ?? 'Configured',
      promptRef: row.prompt_version_reference ?? demo.model?.promptRef ?? 'prompt-registry/draft',
      lastConfigUpdate: demo.model?.lastConfigUpdate ?? formatDate(row.updated_at),
    },
    // Demo supporting metadata (no production tables yet).
    tools: demo.tools ?? [],
    dataPermissions: demo.dataPermissions ?? [],
    actionPermissions: demo.actionPermissions ?? [],
    approvalPolicy: demo.approvalPolicy ?? {
      approvalRequired: true,
      minApprovers: 1,
      approvalTeam: 'Group AI Operations',
      maxPermittedRisk: 'medium',
      autoExpiry: '24h',
      verificationRequired: true,
      uatRequired: false,
      auditRequired: true,
    },
    dependencies: demo.dependencies ?? [],
    runs: demo.runs ?? [],
    events: demo.events ?? [],
  };
}

/**
 * Map an `AgentRegistryRecord` to the database input for create/update.
 * Only base metadata is persisted — nested demo metadata and KPI values are
 * intentionally excluded (they have no production tables yet).
 *
 * @param record   The frontend record.
 * @param siteUuid Resolved `ai_sites.id` UUID (null for group/shared agents).
 */
export function mapRecordToAgentInput(
  record: AgentRegistryRecord,
  siteUuid: string | null,
): AiAgentUpsertInput {
  return {
    agent_key: record.id,
    name: record.name,
    description: record.description,
    agent_type: record.type,
    category: record.category,
    site_id: siteUuid,
    environment: record.environment,
    status: record.status,
    health: record.health,
    risk_level: record.risk,
    autonomy_level: record.autonomy,
    owner_team: record.ownerTeam,
    escalation_team: record.escalationTeam,
    primary_model_reference: `${record.model.primaryProvider} / ${record.model.primaryModel}`,
    fallback_model_reference: `${record.model.fallbackProvider} / ${record.model.fallbackModel}`,
    prompt_version_reference: record.model.promptRef,
    current_task: record.currentTask,
    queue_count: record.queueCount,
    success_rate: parseSuccessRate(record.successRate),
    notes: record.notes,
  };
}
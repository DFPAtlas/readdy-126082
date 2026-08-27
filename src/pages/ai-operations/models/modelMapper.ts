// ============================================================================
// AI Operations — Models & AI Providers — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_model_providers,
// ai_operations_models) and the existing `AiProvider` / `AiModel` contracts.
// All DB→frontend field differences are handled here so no mapping logic
// leaks into JSX.
//
// ID strategy:
//   * `provider_key` / `model_key` (text, unique) are the stable application
//     identifiers used by routes (/ai-operations/models/:modelId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//   * Existing routes keep working because the demo `id` values already equal
//     the `model_key` values (MOD-…).
//
// Live vs demo:
//   * Authoritative registry metadata (identity, provider, type, hosting,
//     environment, status, health, capability flags, context/output limits,
//     cost metadata, latency/quality, risk/data policy, fallback priority,
//     default/active state) comes from the live rows.
//   * Nested runtime metadata (usage, usage events, detailed health, security
//     controls, local runtime state, rich fallback policy, limits) has no live
//     production table yet, so it is merged from the demo registry as
//     clearly-labelled "Demo Supporting Metadata". Newly created live records
//     (no demo match) get safe empty defaults.
//
// Credentials: only safe reference labels are ever stored or displayed — never
// the value.
// ============================================================================

import type {
  AiModel,
  AiProvider,
  ProviderType,
  ModelPurpose,
  ModelStatus,
  ConnectionHealth,
  HostingType,
  Environment,
  RiskLevel,
  ModelCapabilitySet,
  ModelLimits,
  ModelFallbackPolicy,
  ModelUsageMetrics,
  ModelHealth,
  ModelSecurityControls,
  LocalModelMeta,
} from '@/pages/ai-operations/types';
import type {
  AiModelProviderRow,
  AiOperationsModelRow,
  AiModelProviderUpsertInput,
  AiOperationsModelUpsertInput,
} from '@/lib/ai-operations';

// Resolved provider lookup, built by the Models context from the live provider
// rows. No UUIDs leak into the UI.
export interface ModelResolutionContext {
  providerKeyById: Map<string, string>;
  providerNameById: Map<string, string>;
  providerTypeById: Map<string, string>;
  providerUuidByKey: Map<string, string>;
}

function formatContext(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `${Math.round(n / 1000)}K tokens`;
  return `${n} tokens`;
}

function formatTokens(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `${Math.round(n / 1000)}K tokens`;
  return `${n} tokens`;
}

function formatCost(n: number | null): string {
  if (n == null) return '—';
  return `$${n} / 1M tokens`;
}

// Derive a capability set from live boolean flags (no demo record available).
function deriveCapabilities(row: AiOperationsModelRow): ModelCapabilitySet {
  return {
    text: 'supported',
    reasoning: row.supports_reasoning ? 'supported' : 'unsupported',
    coding: row.supports_code ? 'supported' : 'unsupported',
    vision: row.supports_vision ? 'supported' : 'unsupported',
    tools: row.supports_tools ? 'supported' : 'unsupported',
    structuredOutput: row.supports_tools ? 'supported' : 'unsupported',
    embeddings: row.supports_embeddings ? 'supported' : 'unsupported',
    longContext: 'supported',
  };
}

function deriveLimits(row: AiOperationsModelRow): ModelLimits {
  return {
    contextWindow: formatContext(row.context_window),
    maxOutput: formatTokens(row.max_output_tokens),
    rate: '—',
    concurrency: '—',
    localResource: null,
  };
}

function deriveFallback(row: AiOperationsModelRow): ModelFallbackPolicy {
  return {
    primaryModelId: row.model_key,
    primaryModel: row.name,
    fallbackModelId: null,
    fallbackModel: '—',
    trigger: 'Not configured',
    providerChange: false,
    costChange: '—',
    capabilityDifference: '—',
  };
}

function deriveUsage(): ModelUsageMetrics {
  return {
    jobsToday: 0,
    estimatedInputTokens: '—',
    estimatedOutputTokens: '—',
    estimatedProviderCost: '£0.00',
    localComputeEstimate: '—',
    avgCostPerRun: '—',
    avgResponseTime: '—',
    failureRate: '—',
  };
}

function deriveHealth(row: AiOperationsModelRow): ModelHealth {
  return {
    status: (row.status as ModelStatus) ?? 'not_configured',
    lastChecked: '—',
    responseHealth: '—',
    capacityState: 'offline',
    recentFailures: 0,
    failureSummary: 'Registry metadata only — no live health check.',
    recommendedAction: 'Live provider connectivity monitoring is not connected yet.',
  };
}

function deriveSecurity(hostingType: HostingType): ModelSecurityControls {
  if (hostingType === 'local') {
    return {
      localProcessingAvailable: true,
      externalProviderInvolved: false,
      credentialsHidden: true,
      environmentSeparation: true,
      sensitiveDataRestricted: false,
      approvalForRestricted: false,
      loggingPolicyRef: 'security/logging-local-models',
    };
  }
  return {
    localProcessingAvailable: false,
    externalProviderInvolved: true,
    credentialsHidden: true,
    environmentSeparation: true,
    sensitiveDataRestricted: true,
    approvalForRestricted: true,
    loggingPolicyRef: 'security/logging-cloud-models',
  };
}

function deriveLocal(row: AiOperationsModelRow): LocalModelMeta | null {
  if ((row.hosting_type as HostingType) !== 'local') return null;
  return {
    hostRef: 'unassigned',
    runtime: 'Ollama',
    modelName: row.model_reference ?? row.name,
    loaded: false,
    capacity: '—',
    queue: 0,
    estimatedMemory: '—',
    availability: 'Not loaded',
  };
}

/**
 * Map a live `ai_operations_models` row to an `AiModel`.
 *
 * @param row      The Supabase row.
 * @param provider Resolved provider ({ key, name, type }) or null.
 * @param demo     Optional matching demo record (by `model_key`) supplying
 *                 nested demo runtime metadata.
 */
export function mapModelRowToRecord(
  row: AiOperationsModelRow,
  provider: { key: string; name: string; type: ProviderType } | null,
  demo?: AiModel,
): AiModel {
  const d = demo;
  const hostingType = (row.hosting_type as HostingType) ?? d?.hostingType ?? 'cloud';
  const purpose = (row.model_type as ModelPurpose) ?? d?.purpose ?? 'general';

  return {
    // Stable application identifier — equals the DB `model_key`.
    id: row.model_key,
    name: row.name,
    providerId: provider?.key ?? 'unknown',
    providerName: provider?.name ?? 'Unknown Provider',
    providerType: provider?.type ?? d?.providerType ?? 'cloud',
    description: row.description ?? d?.description ?? '',
    family: d?.family ?? 'Custom',
    purpose,
    hostingLocation: d?.hostingLocation ?? (hostingType === 'local' ? 'Local (DFP on-prem)' : 'Cloud'),
    environment: (row.environment as Environment) ?? 'production',
    status: (row.status as ModelStatus) ?? 'not_configured',
    health: (row.health as ConnectionHealth) ?? 'unknown',
    enabled: row.is_active,
    hostingType,
    contextWindow: d?.contextWindow ?? formatContext(row.context_window),
    maxOutput: d?.maxOutput ?? formatTokens(row.max_output_tokens),
    visionSupport: row.supports_vision,
    toolSupport: row.supports_tools,
    structuredOutputSupport: d?.structuredOutputSupport ?? row.supports_tools,
    embeddingSupport: row.supports_embeddings,
    speed: d?.speed ?? (row.latency_class ?? '—'),
    quality: d?.quality ?? (row.quality_tier ?? '—'),
    cost: d?.cost ?? '—',
    inputCost: d?.inputCost ?? formatCost(row.input_cost_per_million),
    outputCost: d?.outputCost ?? formatCost(row.output_cost_per_million),
    localComputeCost: d?.localComputeCost ?? '—',
    jobsToday: d?.jobsToday ?? 0,
    failuresToday: d?.failuresToday ?? 0,
    avgResponseTime: d?.avgResponseTime ?? '—',
    fallbackModelId: d?.fallbackModelId ?? null,
    fallbackModel: d?.fallbackModel ?? '—',
    configurationState: d?.configurationState ?? 'complete',
    lastChecked: d?.lastChecked ?? '—',
    notes: row.notes ?? d?.notes ?? '',
    // Live registry metadata.
    riskLevel: (row.risk_level as RiskLevel) ?? undefined,
    dataPolicy: row.data_policy ?? undefined,
    // Demo supporting metadata (no live production tables yet).
    capabilities: d?.capabilities ?? deriveCapabilities(row),
    limits: d?.limits ?? deriveLimits(row),
    fallback: d?.fallback ?? deriveFallback(row),
    usage: d?.usage ?? deriveUsage(),
    usageEvents: d?.usageEvents ?? [],
    healthMeta: d?.healthMeta ?? deriveHealth(row),
    security: d?.security ?? deriveSecurity(hostingType),
    localMeta: d?.localMeta ?? deriveLocal(row),
  };
}

/**
 * Map a live `ai_model_providers` row to an `AiProvider`.
 *
 * @param row        The Supabase row.
 * @param demo       Optional matching demo record (by `provider_key`).
 * @param modelCount Number of live models currently linked to this provider.
 */
export function mapProviderRowToRecord(
  row: AiModelProviderRow,
  demo: AiProvider | undefined,
  modelCount: number,
): AiProvider {
  return {
    // Stable application identifier — equals the DB `provider_key`.
    id: row.provider_key,
    name: row.name,
    type: (row.provider_type as ProviderType) ?? 'internal',
    status: (row.status as ModelStatus) ?? 'not_configured',
    description: row.description ?? '',
    availableModels: modelCount > 0 ? String(modelCount) : (demo?.availableModels ?? '0'),
    activeRequests: demo?.activeRequests ?? 0,
    failures: demo?.failures ?? 0,
    avgResponseTime: demo?.avgResponseTime ?? '—',
    estimatedCostToday: demo?.estimatedCostToday ?? '£0.00',
    lastActivity: demo?.lastActivity ?? '—',
    connectionId: demo?.connectionId ?? null,
    // Live registry metadata — safe labels only.
    credentialReference: row.credential_reference ?? undefined,
    endpointReference: row.endpoint_reference ?? undefined,
    ownerTeam: row.owner_team ?? undefined,
    isActive: row.is_active,
  };
}

/**
 * Map an `AiProvider` record to the database input for create/update.
 * Only safe base metadata is persisted. `credential_reference` /
 * `endpoint_reference` are safe labels — never values.
 */
export function mapRecordToProviderInput(record: AiProvider): AiModelProviderUpsertInput {
  return {
    provider_key: record.id,
    name: record.name,
    description: record.description,
    provider_type: record.type,
    hosting_type: record.type === 'local' || record.type === 'internal' ? 'local' : 'cloud',
    environment: 'production',
    status: record.status,
    health: 'unknown',
    credential_reference: record.credentialReference ?? null,
    endpoint_reference: record.endpointReference ?? null,
    owner_team: record.ownerTeam ?? 'DFP Core Team',
    is_active: record.isActive ?? true,
  };
}

/**
 * Map an `AiModel` record to the database input for create/update.
 * Only registry metadata is persisted — nested demo runtime metadata is
 * intentionally excluded. `providerUuid` is the resolved
 * `ai_model_providers.id` UUID.
 */
export function mapRecordToModelInput(
  record: AiModel,
  providerUuid: string,
): AiOperationsModelUpsertInput {
  return {
    model_key: record.id,
    provider_id: providerUuid,
    name: record.name,
    description: record.description,
    model_type: record.purpose,
    hosting_type: record.hostingType,
    environment: record.environment,
    status: record.status,
    health: record.health,
    supports_vision: record.visionSupport,
    supports_tools: record.toolSupport,
    supports_embeddings: record.embeddingSupport,
    supports_reasoning: record.capabilities?.reasoning === 'supported',
    supports_code: record.capabilities?.coding === 'supported',
    latency_class: record.speed && record.speed !== '—' ? record.speed : null,
    quality_tier: record.quality && record.quality !== '—' ? record.quality : null,
    risk_level: record.riskLevel ?? null,
    is_active: record.enabled,
    notes: record.notes,
  };
}
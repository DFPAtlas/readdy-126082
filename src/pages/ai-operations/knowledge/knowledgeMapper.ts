// ============================================================================
// AI Operations — Knowledge & Memory — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_knowledge_sources,
// ai_incident_memory) and the existing `KnowledgeSource` / `IncidentMemory`
// contracts. All DB→frontend field differences are handled here so no mapping
// logic leaks into JSX.
//
// ID strategy:
//   * `knowledge_key` / `memory_key` (text, unique) are the stable application
//     identifiers used by routes (/ai-operations/knowledge/:sourceId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//
// Live vs demo:
//   * Authoritative registry metadata (identity, description, source type,
//     knowledge type, scope, site, environment, classification, sensitivity,
//     reference, owner, authority/trust, ingestion/indexing/embedding state,
//     review/retention/audit flags, notes) comes from the live rows.
//   * Nested runtime metadata (permissions list, agent access list,
//     governance, usage events, review history, quality checks, index detail,
//     relationships, keywords/tags/topics, ai-usage rules) has no live
//     production table yet, so it is merged from the demo registry as
//     clearly-labelled "Demo Supporting Metadata". Newly created live records
//     (no demo match) get safe empty defaults.
//   * Incident memory is authoritative from `ai_incident_memory` (sanitised
//     summaries) and mapped into the source's `incidentMemory` field.
//
// No secrets, document bodies, or raw private incident logs are ever stored or
// displayed — only safe references and sanitised summaries.
// ============================================================================

import type {
  KnowledgeSource,
  IncidentMemory,
  KnowledgeSourceType,
  KnowledgeScope,
  KnowledgeSourceStatus,
  InformationClassification,
  ReviewState,
  KnowledgeGovernance,
  KnowledgeIndexMetadata,
  KnowledgePermission,
} from '@/pages/ai-operations/types';
import type {
  AiKnowledgeSourceRow,
  AiIncidentMemoryRow,
  AiKnowledgeSourceUpsertInput,
} from '@/lib/ai-operations';

// Resolved site context, built by the Knowledge context from live ai_sites.
// No UUIDs leak into the UI.
export interface KnowledgeResolutionContext {
  siteKey: string | null;
  siteName: string;
}

// Map a frontend KnowledgeSourceType to the broader §3 knowledge-type category.
export function mapSourceTypeToKnowledgeType(type: KnowledgeSourceType): string {
  switch (type) {
    case 'documentation':
    case 'training':
      return 'Documentation';
    case 'sop':
      return 'Procedure';
    case 'policy':
    case 'business_rules':
      return 'Policy';
    case 'faq':
    case 'support_knowledge':
      return 'Support';
    case 'uat':
      return 'Compliance';
    case 'technical':
    case 'troubleshooting':
    case 'database_reference':
    case 'api_documentation':
      return 'Technical';
    case 'product':
    case 'website_content':
      return 'Product';
    case 'incident_history':
      return 'Incident';
    case 'agent_instructions':
      return 'Agent';
    default:
      return 'Other';
  }
}

function deriveHealthFromStatus(status: string | null): string {
  if (status === 'active') return 'healthy';
  if (status === 'restricted' || status === 'review_required' || status === 'stale') return 'warning';
  return 'unknown';
}

function deriveReviewState(status: string | null): ReviewState {
  if (status === 'review_required') return 'due_soon';
  if (status === 'stale') return 'overdue';
  if (status === 'archived') return 'not_required';
  return 'current';
}

const DEFAULT_PERMISSIONS: KnowledgePermission[] = [
  { permission: 'Read', state: 'allowed', note: 'Read permitted for assigned agents.' },
  { permission: 'Retrieve', state: 'allowed', note: 'Retrieval within permitted scope.' },
  { permission: 'Summarise', state: 'allowed', note: 'Summarisation allowed where enabled.' },
  { permission: 'Reference in answer', state: 'allowed', note: 'May be cited in agent answers.' },
  { permission: 'Use for planning', state: 'allowed', note: 'Usable for planning tasks.' },
  { permission: 'Use for diagnostics', state: 'allowed', note: 'Usable for diagnostics.' },
  { permission: 'Update', state: 'restricted', note: 'Edits require human curation.' },
  { permission: 'Delete', state: 'denied', note: 'Destructive — denied by default.' },
];

function deriveGovernance(row: AiKnowledgeSourceRow): KnowledgeGovernance {
  return {
    trustedSource: row.authority_level === 'trusted',
    owner: row.owner_team ?? 'Unassigned',
    reviewRequired: row.review_required,
    reviewFrequency: 'Quarterly',
    lastReviewer: '—',
    versionControl: 'Versioned',
    expiryDate: '—',
    auditRequired: row.audit_required,
  };
}

function deriveIndex(row: AiKnowledgeSourceRow): KnowledgeIndexMetadata {
  const indexed = row.indexing_state === 'indexed';
  return {
    vectorReady: row.embedding_state === 'embedded',
    indexed,
    indexProvider: indexed ? 'Knowledge Index' : '—',
    embeddingModelId: row.embedding_model_reference ?? null,
    embeddingModel: row.embedding_model_reference ? 'text-embedding-3-small' : '—',
    lastIndexed: row.last_ingested_at ?? 'Never',
    chunkCount: 0,
  };
}

/**
 * Map a live `ai_incident_memory` row to the `IncidentMemory` contract.
 * Sanitised summaries only — `demo` fills any gaps not tracked live.
 */
export function mapIncidentMemoryRowToRecord(
  row: AiIncidentMemoryRow,
  siteName: string,
  demo?: IncidentMemory | null,
): IncidentMemory {
  return {
    incidentId: row.memory_key,
    site: siteName || demo?.site || 'Group-wide',
    problem: row.summary ?? demo?.problem ?? '',
    rootCauseSummary: row.known_cause ?? demo?.rootCauseSummary ?? '',
    resolution: row.resolution_summary ?? demo?.resolution ?? '',
    verificationResult: row.verification_state === 'verified'
      ? 'Verified — resolved'
      : (row.verification_state ?? demo?.verificationResult ?? '—'),
    uatResult: demo?.uatResult ?? '—',
    relatedRunId: demo?.relatedRunId ?? null,
    dateResolved: row.last_seen_at ?? demo?.dateResolved ?? '—',
  };
}

/**
 * Map a live `ai_knowledge_sources` row to a `KnowledgeSource`.
 *
 * @param row            The Supabase row.
 * @param ctx            Resolved site ({ key, name }) or group-wide.
 * @param demo           Optional matching demo record (by `knowledge_key`)
 *                       supplying nested "Demo Supporting Metadata".
 * @param liveIncident   Optional live incident memory attached to this source.
 */
export function mapKnowledgeSourceRowToRecord(
  row: AiKnowledgeSourceRow,
  ctx: KnowledgeResolutionContext,
  demo?: KnowledgeSource,
  liveIncident?: IncidentMemory | null,
): KnowledgeSource {
  const d = demo;
  const type = (row.source_type as KnowledgeSourceType) ?? d?.type ?? 'other';
  const status = (row.status as KnowledgeSourceStatus) ?? d?.status ?? 'draft';

  return {
    // Stable application identifier — equals the DB `knowledge_key`.
    id: row.knowledge_key,
    title: row.name,
    description: row.description ?? d?.description ?? '',
    type,
    scope: (row.scope as KnowledgeScope) ?? d?.scope ?? 'group',
    siteId: ctx.siteKey ?? d?.siteId ?? null,
    siteName: ctx.siteName ?? d?.siteName ?? 'Group-wide',
    assignedAgentIds: d?.assignedAgentIds ?? [],
    ownerTeam: row.owner_team ?? d?.ownerTeam ?? 'Unassigned',
    status,
    classification: (row.classification as InformationClassification) ?? d?.classification ?? 'internal',
    sensitivity: row.sensitivity ?? d?.sensitivity ?? 'Medium',
    version: d?.version ?? '—',
    reference: row.source_reference ?? d?.reference ?? '',
    contentFormat: d?.contentFormat ?? 'Markdown',
    reviewState: d?.reviewState ?? deriveReviewState(status),
    lastReviewed: d?.lastReviewed ?? row.last_verified_at ?? '—',
    nextReview: d?.nextReview ?? '—',
    createdAt: d?.createdAt ?? row.created_at,
    updatedAt: d?.updatedAt ?? row.updated_at,
    trustedSource: row.authority_level === 'trusted' ? true : d?.trustedSource ?? false,
    aiUsageAllowed: d?.aiUsageAllowed ?? true,
    retrievalAllowed: d?.retrievalAllowed ?? true,
    summarisationAllowed: d?.summarisationAllowed ?? true,
    modificationAllowed: d?.modificationAllowed ?? false,
    vectorReady: row.embedding_state === 'embedded' ? true : d?.vectorReady ?? false,
    indexingState: d?.indexingState ?? row.indexing_state ?? 'Not indexed',
    notes: row.notes ?? d?.notes ?? '',
    keywords: d?.keywords ?? [],
    tags: d?.tags ?? [],
    topics: d?.topics ?? [],
    permissions: d?.permissions ?? DEFAULT_PERMISSIONS,
    agentAccess: d?.agentAccess ?? [],
    governance: d?.governance ?? deriveGovernance(row),
    aiUsageRules: d?.aiUsageRules ?? [],
    relationships: d?.relationships ?? [],
    usageEvents: d?.usageEvents ?? [],
    reviewHistory: d?.reviewHistory ?? [],
    quality: d?.quality ?? [],
    index: d?.index ?? deriveIndex(row),
    incidentMemory: liveIncident ?? d?.incidentMemory ?? null,
  };
}

/**
 * Map a `KnowledgeSource` record to the database input for create/update.
 * Only registry metadata is persisted — nested demo runtime metadata is
 * intentionally excluded. `siteUuid` is the resolved `ai_sites.id` UUID
 * (or null for group-wide). No document bodies, no ingestion.
 */
export function mapRecordToKnowledgeSourceInput(
  record: KnowledgeSource,
  siteUuid: string | null,
): AiKnowledgeSourceUpsertInput {
  const indexed = record.vectorReady ?? false;
  return {
    knowledge_key: record.id,
    name: record.title,
    description: record.description || null,
    source_type: record.type,
    knowledge_type: mapSourceTypeToKnowledgeType(record.type),
    scope: record.scope,
    site_id: siteUuid,
    environment: 'production',
    status: record.status,
    health: deriveHealthFromStatus(record.status),
    classification: record.classification,
    sensitivity: record.sensitivity,
    source_reference: record.reference || null,
    owner_team: record.ownerTeam || null,
    authority_level: record.trustedSource ? 'trusted' : 'standard',
    trust_level: record.trustedSource ? 'high' : 'standard',
    ingestion_state: indexed ? 'ingested' : 'not_ingested',
    indexing_state: indexed ? 'indexed' : 'not_indexed',
    embedding_state: indexed ? 'embedded' : 'not_embedded',
    embedding_model_reference: record.index?.embeddingModelId ?? null,
    review_required: record.governance?.reviewRequired ?? true,
    audit_required: record.governance?.auditRequired ?? true,
    is_active: record.status !== 'archived',
    notes: record.notes || null,
  };
}
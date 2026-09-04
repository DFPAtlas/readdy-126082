// ============================================================================
// AI Operations — Wallboard Knowledge & Memory selectors.
//
// Pure read-only derivations over the EXISTING shared sources — no new
// knowledge platform, no new vector store, no second registry, no retrieval:
//   * getGroupLiveData()  → ai_knowledge_sources (knowledge) +
//                           ai_knowledge_permissions (knowledgePermissions) +
//                           ai_sites (sites) + ai_operations_agents (agents)
//                           + resolution maps.
//   * getKnowledgeData()  → ai_incident_memory (sanitised known-issue memory).
//   * getSiteMasterCards() → Wallboard 47 site/master-agent relationship.
//
// Honesty rules honoured here:
//   * There is NO pgvector / vector service / embedding pipeline runtime and NO
//     retrieval-health probe — these are surfaced as UNKNOWN / NOT CONNECTED,
//     never fabricated. The registry `embedding_state` is the only vector
//     signal (an "embedded" marker, not a live vector-store health check).
//   * There is NO ingestion job queue — only static registry ingestion/
//     indexing states are surfaced.
//   * Staleness is derived ONLY from the authoritative `status='stale'` field
//     (never an invented freshness rule).
//   * "Failed" derives from an authoritative `status='failed'` / `health`
//     signal only — currently zero.
//   * Unknown is kept distinct from healthy.
//   * No document bodies, raw vectors, prompts, private memory, or credentials.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getKnowledgeData } from '@/pages/ai-operations/wallboard/knowledgeStore';
import { getSiteMasterCards } from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import type { AiKnowledgeSourceRow } from '@/lib/ai-operations';

// --- Knowledge source summary -------------------------------------------------

export interface KnowledgeSummary {
  sourceState: 'live' | 'unavailable';
  total: number;
  active: number;
  stale: number;
  reviewRequired: number;
  restricted: number;
  awaitingIngestion: number;
  failed: number;
}

export function getKnowledgeSummary(): KnowledgeSummary {
  const data = getGroupLiveData();
  const sources = data.knowledge;

  const count = (pred: (s: AiKnowledgeSourceRow) => boolean) => sources.filter(pred).length;

  return {
    sourceState: data.availability.knowledge ? 'live' : 'unavailable',
    total: sources.length,
    active: count((s) => (s.status ?? '').toLowerCase() === 'active'),
    stale: count((s) => (s.status ?? '').toLowerCase() === 'stale'),
    reviewRequired: count((s) => (s.status ?? '').toLowerCase() === 'review_required'),
    restricted: count((s) => (s.status ?? '').toLowerCase() === 'restricted'),
    awaitingIngestion: count((s) => (s.ingestion_state ?? '').toLowerCase() === 'not_ingested'),
    failed: count(
      (s) =>
        (s.status ?? '').toLowerCase() === 'failed' ||
        (s.health ?? '').toLowerCase() === 'unhealthy',
    ),
  };
}

// --- Vector & indexing health --------------------------------------------------

export interface VectorHealth {
  indexed: number;
  notIndexed: number;
  indexingRestricted: number;
  embedded: number;
  notEmbedded: number;
  lastIngested: string | null;
  embeddingModels: string[];
}

export function getVectorHealth(): VectorHealth {
  const data = getGroupLiveData();
  const sources = data.knowledge;

  const count = (pred: (s: AiKnowledgeSourceRow) => boolean) => sources.filter(pred).length;

  const lastIngested = sources
    .map((s) => s.last_ingested_at)
    .filter((v): v is string => v != null && v !== '')
    .sort()
    .pop() ?? null;

  const embeddingModels = Array.from(
    new Set(
      sources
        .map((s) => s.embedding_model_reference)
        .filter((v): v is string => v != null && v !== ''),
    ),
  );

  return {
    indexed: count((s) => (s.indexing_state ?? '').toLowerCase() === 'indexed'),
    notIndexed: count((s) => (s.indexing_state ?? '').toLowerCase() === 'not_indexed'),
    indexingRestricted: count((s) => (s.indexing_state ?? '').toLowerCase() === 'restricted'),
    embedded: count((s) => (s.embedding_state ?? '').toLowerCase() === 'embedded'),
    notEmbedded: count((s) => (s.embedding_state ?? '').toLowerCase() === 'not_embedded'),
    lastIngested,
    embeddingModels,
  };
}

// --- Ingestion state -----------------------------------------------------------

export interface IngestionState {
  ingested: number;
  notIngested: number;
  lastSuccessful: string | null;
}

export function getIngestionState(): IngestionState {
  const data = getGroupLiveData();
  const sources = data.knowledge;

  return {
    ingested: sources.filter((s) => (s.ingestion_state ?? '').toLowerCase() === 'ingested').length,
    notIngested: sources.filter((s) => (s.ingestion_state ?? '').toLowerCase() === 'not_ingested').length,
    lastSuccessful: sources
      .map((s) => s.last_ingested_at)
      .filter((v): v is string => v != null && v !== '')
      .sort()
      .pop() ?? null,
  };
}

// --- Source-type breakdown ------------------------------------------------------

export interface SourceTypeBreakdown {
  label: string;
  count: number;
}

export function getSourceTypeBreakdown(): SourceTypeBreakdown[] {
  const data = getGroupLiveData();
  const byType = new Map<string, number>();
  for (const s of data.knowledge) {
    const key = (s.knowledge_type ?? s.source_type ?? 'other').trim() || 'Other';
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  return Array.from(byType.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// --- Agent coverage -------------------------------------------------------------

export interface AgentCoverage {
  agentsTotal: number;
  agentsWithKnowledge: number;
  agentsWithoutKnowledge: number;
}

export function getAgentCoverage(): AgentCoverage {
  const data = getGroupLiveData();
  const activePermissions = data.knowledgePermissions.filter((p) => p.is_active !== false);
  const agentsWithAccess = new Set<string>(activePermissions.map((p) => p.agent_id));

  const registeredAgents = data.agents.filter(
    (a) => !['disabled', 'not_configured'].includes((a.status ?? '').toLowerCase()),
  );

  return {
    agentsTotal: registeredAgents.length,
    agentsWithKnowledge: registeredAgents.filter((a) => agentsWithAccess.has(a.id)).length,
    agentsWithoutKnowledge: registeredAgents.filter((a) => !agentsWithAccess.has(a.id)).length,
  };
}

// --- Per-site knowledge ----------------------------------------------------------

export type SiteKnowledgeState = 'indexed' | 'stale' | 'connected' | 'unavailable';

export interface SiteKnowledgeRow {
  siteId: string;
  siteName: string;
  masterAgentName: string | null;
  sources: number;
  embedded: number;
  stale: number;
  state: SiteKnowledgeState;
}

export function getSiteKnowledge(): SiteKnowledgeRow[] {
  const data = getGroupLiveData();
  const masterByName = new Map(
    getSiteMasterCards().map((c) => [c.siteId, c.masterAgentName]),
  );

  return data.sites.map((site) => {
    const sources = data.knowledge.filter((k) => k.site_id === site.id);
    const embedded = sources.filter((k) => (k.embedding_state ?? '').toLowerCase() === 'embedded').length;
    const stale = sources.filter((k) => (k.status ?? '').toLowerCase() === 'stale').length;

    let state: SiteKnowledgeState;
    if (sources.length === 0) state = 'unavailable';
    else if (stale > 0) state = 'stale';
    else if (embedded === sources.length) state = 'indexed';
    else state = 'connected';

    return {
      siteId: site.id,
      siteName: site.name,
      masterAgentName: masterByName.get(site.id) ?? null,
      sources: sources.length,
      embedded,
      stale,
      state,
    };
  });
}

// --- Memory status ----------------------------------------------------------------

export interface MemoryStatus {
  sourceState: 'live' | 'unavailable';
  records: number;
  verified: number;
  approvedForReuse: number;
}

export function getMemoryStatus(): MemoryStatus {
  const mem = getKnowledgeData();
  const rows = mem.memory;

  return {
    sourceState: mem.memoryAvailability ? 'live' : 'unavailable',
    records: rows.length,
    verified: rows.filter((r) => (r.verification_state ?? '').toLowerCase() === 'verified').length,
    approvedForReuse: rows.filter((r) => r.approved_for_reuse === true).length,
  };
}

// --- Monitoring gaps (honest, never fabricated) -----------------------------------

export interface KnowledgeGap {
  area: string;
  note: string;
}

export function getKnowledgeGaps(): KnowledgeGap[] {
  return [
    { area: 'Vector store', note: 'No pgvector / vector-service runtime exists — embedding_state is a registry marker, not a live health check.' },
    { area: 'Retrieval health', note: 'No retrieval-health probe exists — retrieval state is UNKNOWN, never assumed healthy.' },
    { area: 'Embedding pipeline', note: 'No embedding job queue or failed-embedding telemetry exists.' },
    { area: 'Ingestion jobs', note: 'No live ingestion/indexing job queue — only static registry states are available.' },
    { area: 'Agent memory runtime', note: 'No live agent-memory service or write/retrieval telemetry — only sanitised known-issue memory is registered.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ------------------------

export interface KnowledgeIncident {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  affectedService: string;
  sourceLabel: string;
  firstDetected: string | null;
  lastUpdated: string | null;
  status: string;
  description: string;
}

/**
 * Authoritative knowledge/vector/retrieval incidents only. There is currently
 * NO authoritative escalation signal here:
 *   * There is no central vector store / retrieval service runtime to be
 *     "unavailable" — so no outage can be raised honestly.
 *   * "Source stale" / "not embedded" are configuration/refresh states, not
 *     runtime failures.
 *   * There is no ingestion-failure telemetry.
 * Returns an empty list until an authoritative escalation rule exists.
 */
export function getKnowledgeIncidents(): KnowledgeIncident[] {
  return [];
}
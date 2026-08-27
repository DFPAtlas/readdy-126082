import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { demoKnowledgeSourcesA } from '@/mocks/ai-operations-knowledge';
import { demoKnowledgeSourcesB } from '@/mocks/ai-operations-knowledge-2';
import {
  getAiSites,
  getAiAgents,
  getAiKnowledgeSources,
  getAiKnowledgePermissions,
  getAiIncidentMemory,
  createAiKnowledgeSource,
  updateAiKnowledgeSource,
  createAiKnowledgePermission,
  updateAiKnowledgePermission,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import type {
  AiKnowledgePermissionRow,
  AiIncidentMemoryRow,
} from '@/lib/ai-operations';
import {
  mapKnowledgeSourceRowToRecord,
  mapRecordToKnowledgeSourceInput,
  mapIncidentMemoryRowToRecord,
} from '@/pages/ai-operations/knowledge/knowledgeMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Knowledge & Memory Registry. Mirrors the proven
// Sites/Agents/Models pattern so the page never pretends demo data is live:
//   * live  — Supabase ai_knowledge_sources + ai_incident_memory loaded.
//   * demo  — the existing mock registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type KnowledgeDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Access-level type for persisting an agent → knowledge permission.
export type KnowledgeAccessLevel = 'read' | 'create' | 'update' | 'delete' | 'read_write' | 'restricted';

interface KnowledgeContextValue {
  sources: KnowledgeSource[];
  /** Live ai_knowledge_permissions rows (agent → source access grants). */
  permissions: AiKnowledgePermissionRow[];
  /** Live ai_incident_memory rows (sanitised known-issue summaries). */
  incidentMemory: AiIncidentMemoryRow[];
  mode: KnowledgeDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  /** Create a live knowledge source (insert + audit event). */
  createSource: (record: KnowledgeSource) => Promise<SaveResult>;
  /** Update a live knowledge source (update + audit event). */
  updateSource: (id: string, record: KnowledgeSource) => Promise<SaveResult>;
  /** Grant agent → source access (insert/update ai_knowledge_permissions + audit). */
  grantPermission: (
    sourceKey: string,
    agentKey: string,
    accessLevel: KnowledgeAccessLevel,
    purpose: string,
    approvalRequired: boolean,
  ) => Promise<SaveResult>;
  /** Revoke agent → source access via is_active=false (never a physical delete). */
  revokePermission: (sourceKey: string, agentKey: string) => Promise<SaveResult>;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

const DEMO_SOURCES: KnowledgeSource[] = [...demoKnowledgeSourcesA, ...demoKnowledgeSourcesB];

// Demo lookup keyed by stable id (= knowledge_key) so live rows can merge their
// nested "Demo Supporting Metadata" (permissions, access list, governance,
// usage events, review history, quality, index detail, relationships) where no
// production table exists yet.
const demoSourceByKey = new Map(DEMO_SOURCES.map((s) => [s.id, s]));

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [permissions, setPermissions] = useState<AiKnowledgePermissionRow[]>([]);
  const [incidentMemory, setIncidentMemory] = useState<AiIncidentMemoryRow[]>([]);
  const [mode, setMode] = useState<KnowledgeDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutable resolution maps, rebuilt on each refresh (kept in a ref to avoid
  // re-renders). No UUIDs leak into the UI.
  const mapsRef = useRef({
    siteKeyByUuid: new Map<string, string>(),
    siteNameByUuid: new Map<string, string>(),
    sourceUuidByKey: new Map<string, string>(),
    agentUuidByKey: new Map<string, string>(),
    permissionByKey: new Map<string, AiKnowledgePermissionRow>(),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, sourcesRes, permsRes, incidentRes] = await Promise.all([
      getAiSites(),
      getAiAgents(),
      getAiKnowledgeSources(),
      getAiKnowledgePermissions(),
      getAiIncidentMemory(),
    ]);

    // Build site resolution maps from live ai_sites.
    const siteRows = (sitesRes.data ?? []).filter((r) => r.is_active !== false);
    const siteKeyByUuid = new Map<string, string>();
    const siteNameByUuid = new Map<string, string>();
    for (const row of siteRows) {
      siteKeyByUuid.set(row.id, row.site_key);
      siteNameByUuid.set(row.id, row.name);
    }

    // Agent key → UUID map for permission resolution.
    const agentUuidByKey = new Map<string, string>();
    for (const row of agentsRes.data ?? []) agentUuidByKey.set(row.agent_key, row.id);

    const sourceRows = (sourcesRes.data ?? []).filter((r) => r.is_active !== false);
    const sourceUuidByKey = new Map<string, string>();
    const sourceKeyByUuid = new Map<string, string>();
    for (const row of sourceRows) {
      sourceUuidByKey.set(row.knowledge_key, row.id);
      sourceKeyByUuid.set(row.id, row.knowledge_key);
    }

    const permRows = permsRes.data ?? [];
    const permissionByKey = new Map<string, AiKnowledgePermissionRow>();
    for (const row of permRows) permissionByKey.set(`${row.knowledge_source_id}|${row.agent_id}`, row);

    mapsRef.current = {
      siteKeyByUuid,
      siteNameByUuid,
      sourceUuidByKey,
      agentUuidByKey,
      permissionByKey,
    };

    if (sourcesRes.error) {
      setMode('error');
      setError(sourcesRes.error);
      setSources([]);
      setPermissions([]);
      setIncidentMemory([]);
      setLoading(false);
      return;
    }

    // Map live incident memory into a source-UUID-keyed map so each incident-
    // history source can render its live sanitised memory.
    const incidentBySourceUuid = new Map<string, ReturnType<typeof mapIncidentMemoryRowToRecord>>();
    for (const imRow of incidentRes.data ?? []) {
      if (!imRow.related_knowledge_source_id) continue;
      const srcKey = sourceKeyByUuid.get(imRow.related_knowledge_source_id);
      const siteName = imRow.site_id ? siteNameByUuid.get(imRow.site_id) ?? '' : 'Group-wide';
      const demoIncident = srcKey ? demoSourceByKey.get(srcKey)?.incidentMemory ?? null : null;
      incidentBySourceUuid.set(
        imRow.related_knowledge_source_id,
        mapIncidentMemoryRowToRecord(imRow, siteName, demoIncident),
      );
    }

    const mappedSources = sourceRows.map((row) => {
      const siteKey = row.site_id ? siteKeyByUuid.get(row.site_id) ?? null : null;
      const siteName = row.site_id ? siteNameByUuid.get(row.site_id) ?? '' : 'Group-wide';
      return mapKnowledgeSourceRowToRecord(
        row,
        { siteKey, siteName },
        demoSourceByKey.get(row.knowledge_key),
        incidentBySourceUuid.get(row.id) ?? null,
      );
    });

    setSources(mappedSources);
    setPermissions(permRows);
    setIncidentMemory(incidentRes.data ?? []);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setSources(DEMO_SOURCES);
    setPermissions([]);
    setIncidentMemory([]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  // Append a safe audit event. Reused by every live write.
  const appendAudit = useCallback(
    (input: {
      event_type: string;
      action: string;
      severity: string;
      site_id: string | null;
      agent_id: string | null;
      risk_level: string;
      environment: string;
      before_summary: string;
      after_summary: string;
      notes: string;
    }) => {
      return createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: input.event_type,
        action: input.action,
        outcome: 'success',
        severity: input.severity,
        site_id: input.site_id,
        agent_id: input.agent_id,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'knowledge',
        risk_level: input.risk_level,
        environment: input.environment,
        before_summary: input.before_summary,
        after_summary: input.after_summary,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: input.notes,
      });
    },
    [],
  );

  const createSource = useCallback(
    async (record: KnowledgeSource): Promise<SaveResult> => {
      if (mode !== 'live') {
        setSources((prev) => [record, ...prev]);
        return { error: null };
      }
      const siteUuid = record.siteId ? mapsRef.current.siteKeyByUuid.get(record.siteId) ?? null : null;
      const { error: writeError } = await createAiKnowledgeSource(
        mapRecordToKnowledgeSourceInput(record, siteUuid),
      );
      if (writeError) return { error: writeError };

      const auditRes = await appendAudit({
        event_type: 'knowledge_source_created',
        action: 'Create knowledge source',
        severity: 'low',
        site_id: siteUuid,
        agent_id: null,
        risk_level: 'green',
        environment: 'production',
        before_summary: 'Knowledge source did not exist.',
        after_summary: `Knowledge source created: ${record.title} (${record.id}).`,
        notes: 'Source metadata created — no ingestion/indexing/embedding performed; no document content stored.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh, appendAudit],
  );

  const updateSource = useCallback(
    async (id: string, record: KnowledgeSource): Promise<SaveResult> => {
      const previous = sources.find((s) => s.id === id);
      if (mode !== 'live') {
        setSources((prev) => prev.map((s) => (s.id === id ? { ...record } : s)));
        return { error: null };
      }
      const siteUuid = record.siteId ? mapsRef.current.siteKeyByUuid.get(record.siteId) ?? null : null;
      const { error: writeError } = await updateAiKnowledgeSource(
        id,
        mapRecordToKnowledgeSourceInput(record, siteUuid),
      );
      if (writeError) return { error: writeError };

      const auditRes = await appendAudit({
        event_type: 'knowledge_source_updated',
        action: 'Update knowledge source',
        severity: 'low',
        site_id: siteUuid,
        agent_id: null,
        risk_level: 'green',
        environment: 'production',
        before_summary: previous ? `Source was: ${previous.title} (status ${previous.status}).` : 'Unknown prior state.',
        after_summary: `Knowledge source updated: ${record.title} (status ${record.status}).`,
        notes: 'Source metadata updated — no ingestion/indexing/embedding performed.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, sources, refresh, appendAudit],
  );

  // Persist an agent → knowledge access grant. Configuration metadata only —
  // runtime retrieval is not connected.
  const grantPermission = useCallback(
    async (
      sourceKey: string,
      agentKey: string,
      accessLevel: KnowledgeAccessLevel,
      purpose: string,
      approvalRequired: boolean,
    ): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Permissions require live data.' };

      const sourceUuid = mapsRef.current.sourceUuidByKey.get(sourceKey);
      const agentUuid = mapsRef.current.agentUuidByKey.get(agentKey);
      if (!sourceUuid) return { error: 'Could not resolve knowledge source reference.' };
      if (!agentUuid) return { error: 'Could not resolve agent reference.' };

      const existing = mapsRef.current.permissionByKey.get(`${sourceUuid}|${agentUuid}`);
      const payload = {
        knowledge_source_id: sourceUuid,
        agent_id: agentUuid,
        access_level: accessLevel,
        purpose,
        environment: 'production',
        can_read: true,
        can_retrieve: true,
        can_reference: accessLevel === 'read_write',
        can_update_metadata: accessLevel === 'read_write',
        approval_required: approvalRequired,
        granted_by: 'Operator',
        granted_at: new Date().toISOString(),
        is_active: true,
      };

      const writeResult = existing
        ? await updateAiKnowledgePermission(sourceUuid, agentUuid, payload)
        : await createAiKnowledgePermission(payload);
      if (writeResult.error) return { error: writeResult.error };

      const auditRes = await appendAudit({
        event_type: existing ? 'knowledge_access_updated' : 'knowledge_access_granted',
        action: existing ? 'Update knowledge access' : 'Grant knowledge access',
        severity: 'low',
        site_id: null,
        agent_id: agentUuid,
        risk_level: 'green',
        environment: 'production',
        before_summary: existing ? `Access existed for ${agentKey} on ${sourceKey}.` : 'No prior access grant.',
        after_summary: `Agent ${agentKey} granted ${accessLevel} access to ${sourceKey}.`,
        notes: 'Knowledge permission registered — runtime retrieval is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh, appendAudit],
  );

  // Revoke access by setting is_active=false. Never a physical delete.
  const revokePermission = useCallback(
    async (sourceKey: string, agentKey: string): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Permissions require live data.' };

      const sourceUuid = mapsRef.current.sourceUuidByKey.get(sourceKey);
      const agentUuid = mapsRef.current.agentUuidByKey.get(agentKey);
      if (!sourceUuid || !agentUuid) return { error: 'Could not resolve knowledge source or agent reference.' };

      const { error: writeError } = await updateAiKnowledgePermission(sourceUuid, agentUuid, {
        is_active: false,
        granted_by: 'Operator',
      });
      if (writeError) return { error: writeError };

      const auditRes = await appendAudit({
        event_type: 'knowledge_access_revoked',
        action: 'Revoke knowledge access',
        severity: 'low',
        site_id: null,
        agent_id: agentUuid,
        risk_level: 'green',
        environment: 'production',
        before_summary: `Access existed for ${agentKey} on ${sourceKey}.`,
        after_summary: `Access revoked for ${agentKey} on ${sourceKey}.`,
        notes: 'Revocation via is_active=false — no physical delete.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh, appendAudit],
  );

  // Load live knowledge/permissions/incident memory on first mount. A failure
  // surfaces as `error` mode and never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      sources,
      permissions,
      incidentMemory,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      createSource,
      updateSource,
      grantPermission,
      revokePermission,
    }),
    [sources, permissions, incidentMemory, mode, loading, error, refresh, loadDemo, createSource, updateSource, grantPermission, revokePermission],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge(): KnowledgeContextValue {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be used within a KnowledgeProvider');
  return ctx;
}
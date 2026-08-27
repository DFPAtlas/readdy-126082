import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ToolConnection, ToolAccessMode, RiskLevel } from '@/pages/ai-operations/types';
import { demoConnections } from '@/mocks/ai-operations-tools';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import {
  getAiSites,
  getAiAgents,
  getAiToolConnections,
  getAiToolAgentAccess,
  createAiToolConnection,
  updateAiToolConnection,
  createAiToolAgentAccess,
  updateAiToolAgentAccess,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import type { AiToolAgentAccessRow } from '@/lib/ai-operations';
import {
  mapToolConnectionRowToRecord,
  mapRecordToConnectionInput,
  type ToolResolutionContext,
} from '@/pages/ai-operations/tools/toolMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Tools & Connections Registry. Mirrors the proven
// Sites/Agents/Security pattern so the page never pretends demo data is live:
//   * live  — Supabase ai_tool_connections + ai_tool_agent_access loaded.
//   * demo  — the existing mock registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type ToolsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// A lightweight agent option for the access-grant dropdown (stable agent key +
// display name). Never exposes the database UUID to the UI.
export interface ToolAgentOption {
  key: string;
  name: string;
}

// Input for granting/updating an agent→tool access assignment. Safe metadata
// only — no credentials, no runtime authority.
export interface AgentAccessInput {
  accessMode: ToolAccessMode;
  allowedOperations: string[];
  restrictedOperations: string[];
  risk: RiskLevel;
  approvalRequired: boolean;
}

interface ToolsContextValue {
  connections: ToolConnection[];
  mode: ToolsDataSourceMode;
  loading: boolean;
  error: string | null;
  /** Live agent options for the access-grant dropdown. */
  agents: ToolAgentOption[];
  refresh: () => Promise<void>;
  loadDemo: () => void;
  /** Create a live connection (insert ai_tool_connections + audit event). */
  createConnection: (record: ToolConnection, actor: string) => Promise<SaveResult>;
  /** Update a live connection (update ai_tool_connections + audit event). */
  updateConnection: (id: string, record: ToolConnection, actor: string) => Promise<SaveResult>;
  /** Grant or update agent→tool access (append-only; no runtime execution). */
  grantAccess: (connectionKey: string, agentKey: string, input: AgentAccessInput, actor: string) => Promise<SaveResult>;
  /** Revoke access by setting is_active=false (never a physical delete). */
  revokeAccess: (connectionKey: string, agentKey: string, reason: string, actor: string) => Promise<SaveResult>;
}

const ToolsContext = createContext<ToolsContextValue | null>(null);

// Demo lookup keyed by stable id (= connection_key) so live rows can merge
// their "Demo Supporting Metadata" (access mode, rich operation groups,
// permissions matrix, site usage, dependencies, usage events, security
// controls, detailed health) where no production table exists yet.
const demoConnectionById = new Map((demoConnections as ToolConnection[]).map((c) => [c.id, c]));

// Map a criticality value to a conservative audit risk level + severity.
function criticalityToRiskLevel(c: string | null | undefined): string {
  if (c === 'critical' || c === 'high') return 'red';
  if (c === 'medium') return 'amber';
  return 'green';
}
function criticalityToSeverity(c: string | null | undefined): string {
  if (c === 'critical') return 'critical';
  if (c === 'high') return 'high';
  if (c === 'medium') return 'medium';
  return 'low';
}

export function ToolsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<ToolConnection[]>([]);
  const [mode, setMode] = useState<ToolsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<ToolAgentOption[]>([]);

  // Mutable resolution maps, rebuilt on each refresh (kept in a ref to avoid
  // re-renders).
  const mapsRef = useRef({
    connectionUuidByKey: new Map<string, string>(),
    agentUuidByKey: new Map<string, string>(),
    ctx: null as ToolResolutionContext | null,
    accessByConnectionUuid: new Map<string, AiToolAgentAccessRow[]>(),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, connRes, accessRes] = await Promise.all([
      getAiSites(),
      getAiAgents(),
      getAiToolConnections(),
      getAiToolAgentAccess(),
    ]);

    // Site maps (TEST/SANDBOX excluded).
    const siteRows = (sitesRes.data ?? []).filter((r) => r.is_active !== false);
    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    for (const row of siteRows) {
      siteKeyById.set(row.id, row.site_key);
      siteNameById.set(row.id, row.name);
    }

    // Agent maps (TEST/SANDBOX excluded).
    const agentRows = (agentsRes.data ?? []).filter((r) => r.is_active !== false);
    const agentUuidByKey = new Map<string, string>();
    const agentKeyById = new Map<string, string>();
    const agentNameById = new Map<string, string>();
    const agentSiteNameById = new Map<string, string>();
    for (const row of agentRows) {
      agentUuidByKey.set(row.agent_key, row.id);
      agentKeyById.set(row.id, row.agent_key);
      agentNameById.set(row.id, row.name);
      agentSiteNameById.set(row.id, row.site_id ? (siteNameById.get(row.site_id) ?? '') : 'Group-wide');
    }

    const ctx: ToolResolutionContext = { agentKeyById, agentNameById, agentSiteNameById, siteKeyById, siteNameById };

    // Access rows grouped by connection UUID.
    const accessByConnectionUuid = new Map<string, AiToolAgentAccessRow[]>();
    for (const row of accessRes.data ?? []) {
      const list = accessByConnectionUuid.get(row.connection_id) ?? [];
      list.push(row);
      accessByConnectionUuid.set(row.connection_id, list);
    }

    mapsRef.current = { connectionUuidByKey: new Map(), agentUuidByKey, ctx, accessByConnectionUuid };

    // Form dropdown (live agents).
    setAgents(agentRows.map((r) => ({ key: r.agent_key, name: r.name })));

    if (connRes.error) {
      setMode('error');
      setError(connRes.error);
      setConnections([]);
      setLoading(false);
      return;
    }

    const rows = (connRes.data ?? []).filter((r) => r.is_active !== false);
    const connectionUuidByKey = new Map<string, string>();
    for (const row of rows) connectionUuidByKey.set(row.connection_key, row.id);
    mapsRef.current.connectionUuidByKey = connectionUuidByKey;

    const mapped = rows.map((r) =>
      mapToolConnectionRowToRecord(
        r,
        demoConnectionById.get(r.connection_key),
        accessByConnectionUuid.get(r.id) ?? [],
        ctx,
      ),
    );
    setConnections(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setConnections(demoConnections as ToolConnection[]);
    setAgents((demoAgents as { id: string; name: string }[]).map((a) => ({ key: a.id, name: a.name })));
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createConnection = useCallback(
    async (record: ToolConnection, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: never write demo records to Supabase.
        setConnections((prev) => [record, ...prev]);
        return { error: null };
      }
      const siteUuid = record.siteId ? (mapsRef.current.ctx?.siteKeyById.get(record.siteId) ?? null) : null;
      const { error: writeError } = await createAiToolConnection(mapRecordToConnectionInput(record, siteUuid));
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'tool_connection_created',
        action: 'Create connection',
        outcome: 'success',
        severity: criticalityToSeverity(record.criticality),
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'tools',
        risk_level: criticalityToRiskLevel(record.criticality),
        environment: record.environment,
        before_summary: 'Connection did not exist.',
        after_summary: `Connection created: ${record.name} (${record.id}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Connection metadata created — no credential value stored; no external connectivity performed.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateConnection = useCallback(
    async (id: string, record: ToolConnection, actor: string): Promise<SaveResult> => {
      const previous = connections.find((c) => c.id === id);
      if (mode !== 'live') {
        // Demo/local-only edit.
        setConnections((prev) => prev.map((c) => (c.id === id ? { ...record, updatedAt: 'Just now' } : c)));
        return { error: null };
      }
      const siteUuid = record.siteId ? (mapsRef.current.ctx?.siteKeyById.get(record.siteId) ?? null) : null;
      const { error: writeError } = await updateAiToolConnection(id, mapRecordToConnectionInput(record, siteUuid));
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'tool_connection_updated',
        action: 'Update connection',
        outcome: 'success',
        severity: criticalityToSeverity(record.criticality),
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'tools',
        risk_level: criticalityToRiskLevel(record.criticality),
        environment: record.environment,
        before_summary: previous ? `Connection was: ${previous.name} (status ${previous.status}).` : 'Unknown prior state.',
        after_summary: `Connection updated: ${record.name} (status ${record.status}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Connection metadata updated — no credential value stored.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, connections, refresh],
  );

  // Grant or update an agent→tool access assignment. Detects an existing row so
  // it audits tool_access_updated vs tool_access_granted. Never executes.
  const grantAccess = useCallback(
    async (connectionKey: string, agentKey: string, input: AgentAccessInput, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: update the in-memory agentAccess array.
        setConnections((prev) =>
          prev.map((c) => {
            if (c.id !== connectionKey) return c;
            const existing = c.agentAccess.some((a) => a.agentId === agentKey);
            const entry = {
              agentId: agentKey,
              agentName: agentKey,
              site: '',
              accessMode: input.accessMode,
              allowedOperations: input.allowedOperations,
              restrictedOperations: input.restrictedOperations,
              risk: input.risk,
              approvalRequired: input.approvalRequired,
              status: 'connected' as const,
            };
            const agentAccess = existing
              ? c.agentAccess.map((a) => (a.agentId === agentKey ? { ...a, ...entry } : a))
              : [...c.agentAccess, entry];
            return { ...c, agentAccess };
          }),
        );
        return { error: null };
      }

      const connectionUuid = mapsRef.current.connectionUuidByKey.get(connectionKey);
      const agentUuid = mapsRef.current.agentUuidByKey.get(agentKey);
      if (!connectionUuid || !agentUuid) return { error: 'Could not resolve connection or agent reference.' };

      const existing = mapsRef.current.accessByConnectionUuid.get(connectionUuid)?.find((r) => r.agent_id === agentUuid);
      const payload = {
        connection_id: connectionUuid,
        agent_id: agentUuid,
        access_level: input.accessMode,
        allowed_operations: input.allowedOperations,
        restricted_operations: input.restrictedOperations,
        approval_required: input.approvalRequired,
        risk_limit: input.risk,
        environment: 'production',
        granted_by: actor,
        is_active: true,
      };

      const writeResult = existing
        ? await updateAiToolAgentAccess(connectionUuid, agentUuid, payload)
        : await createAiToolAgentAccess(payload);
      if (writeResult.error) return { error: writeResult.error };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: existing ? 'tool_access_updated' : 'tool_access_granted',
        action: existing ? 'Update tool access' : 'Grant tool access',
        outcome: 'success',
        severity: criticalityToSeverity(input.risk),
        site_id: null,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'tools',
        risk_level: criticalityToRiskLevel(input.risk),
        environment: 'production',
        before_summary: existing ? `Access existed for ${agentKey} on ${connectionKey}.` : 'No prior access.',
        after_summary: `Agent ${agentKey} access to ${connectionKey} set to ${input.accessMode}.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Registry permission only — runtime enforcement is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Revoke access by setting is_active=false. Never a physical delete.
  const revokeAccess = useCallback(
    async (connectionKey: string, agentKey: string, reason: string, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: mark the in-memory entry disconnected.
        setConnections((prev) =>
          prev.map((c) =>
            c.id === connectionKey
              ? { ...c, agentAccess: c.agentAccess.map((a) => (a.agentId === agentKey ? { ...a, status: 'disconnected' as const } : a)) }
              : c,
          ),
        );
        return { error: null };
      }

      const connectionUuid = mapsRef.current.connectionUuidByKey.get(connectionKey);
      const agentUuid = mapsRef.current.agentUuidByKey.get(agentKey);
      if (!connectionUuid || !agentUuid) return { error: 'Could not resolve connection or agent reference.' };

      const { error: writeError } = await updateAiToolAgentAccess(connectionUuid, agentUuid, {
        is_active: false,
        reason,
        granted_by: actor,
      });
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'tool_access_revoked',
        action: 'Revoke tool access',
        outcome: 'success',
        severity: 'medium',
        site_id: null,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'tools',
        risk_level: 'amber',
        environment: 'production',
        before_summary: `Access existed for ${agentKey} on ${connectionKey}.`,
        after_summary: `Access revoked for ${agentKey} on ${connectionKey}${reason ? ` — ${reason}` : ''}.`,
        decision_reason: reason,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Revocation via is_active=false — no physical delete.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Load live connections (and site/agent/access maps) on first mount. A
  // failure surfaces as `error` mode and never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ToolsContextValue>(
    () => ({
      connections,
      mode,
      loading,
      error,
      agents,
      refresh,
      loadDemo,
      createConnection,
      updateConnection,
      grantAccess,
      revokeAccess,
    }),
    [connections, mode, loading, error, agents, refresh, loadDemo, createConnection, updateConnection, grantAccess, revokeAccess],
  );

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useTools() {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error('useTools must be used within a ToolsProvider');
  return ctx;
}
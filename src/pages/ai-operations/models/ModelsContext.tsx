import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiModel, AiProvider } from '@/pages/ai-operations/types';
import { demoModels, demoProviders } from '@/mocks/ai-operations-models';
import {
  getAiModelProviders,
  getAiOperationsModels,
  getAiAgentModelAssignments,
  createAiModelProvider,
  updateAiModelProvider,
  createAiOperationsModel,
  updateAiOperationsModel,
  createAiAgentModelAssignment,
  updateAiAgentModelAssignment,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import type { AiAgentModelAssignmentRow } from '@/lib/ai-operations';
import {
  mapModelRowToRecord,
  mapProviderRowToRecord,
  mapRecordToProviderInput,
  mapRecordToModelInput,
  type ModelResolutionContext,
} from '@/pages/ai-operations/models/modelMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Models & AI Providers Registry. Mirrors the proven
// Sites/Agents/Tools pattern so the page never pretends demo data is live:
//   * live  — Supabase ai_model_providers + ai_operations_models loaded.
//   * demo  — the existing mock registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type ModelsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Assignment type input for persisting an agent → model assignment.
export type ModelAssignmentType = 'primary' | 'fallback' | 'specialist' | 'embedding' | 'vision' | 'coding';

interface ModelsContextValue {
  models: AiModel[];
  providers: AiProvider[];
  mode: ModelsDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  /** Create a live provider (insert ai_model_providers + audit event). */
  createProvider: (record: AiProvider, actor: string) => Promise<SaveResult>;
  /** Update a live provider (update ai_model_providers + audit event). */
  updateProvider: (id: string, record: AiProvider, actor: string) => Promise<SaveResult>;
  /** Create a live model (insert ai_operations_models + audit event). */
  createModel: (record: AiModel, actor: string) => Promise<SaveResult>;
  /** Update a live model (update ai_operations_models + audit event). */
  updateModel: (id: string, record: AiModel, actor: string) => Promise<SaveResult>;
  /** Persist an agent → model assignment (configuration metadata only). */
  createAssignment: (agentKey: string, modelKey: string, type: ModelAssignmentType, actor: string) => Promise<SaveResult>;
  /** Revoke an assignment by setting is_active=false (never a physical delete). */
  revokeAssignment: (agentKey: string, modelKey: string, type: ModelAssignmentType, actor: string) => Promise<SaveResult>;
}

const ModelsContext = createContext<ModelsContextValue | null>(null);

// Demo lookups keyed by stable id (= model_key / provider_key) so live rows can
// merge their nested "Demo Supporting Metadata" (usage, health, security, local
// runtime state, rich fallback policy) where no production table exists yet.
const demoModelById = new Map((demoModels as AiModel[]).map((m) => [m.id, m]));
const demoProviderById = new Map((demoProviders as AiProvider[]).map((p) => [p.id, p]));

function riskToSeverity(risk: string | null | undefined): string {
  if (risk === 'critical') return 'critical';
  if (risk === 'high') return 'high';
  if (risk === 'medium') return 'medium';
  return 'low';
}

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<AiModel[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [mode, setMode] = useState<ModelsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutable resolution maps, rebuilt on each refresh (kept in a ref to avoid
  // re-renders).
  const mapsRef = useRef({
    providerCtx: null as ModelResolutionContext | null,
    modelUuidByKey: new Map<string, string>(),
    agentUuidByKey: new Map<string, string>(),
    assignmentByKey: new Map<string, AiAgentModelAssignmentRow>(),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [providersRes, modelsRes, assignmentsRes] = await Promise.all([
      getAiModelProviders(),
      getAiOperationsModels(),
      getAiAgentModelAssignments(),
    ]);

    // Provider resolution maps (no UUID in the UI).
    const providerRows = (providersRes.data ?? []).filter((r) => r.is_active !== false);
    const providerKeyById = new Map<string, string>();
    const providerNameById = new Map<string, string>();
    const providerTypeById = new Map<string, string>();
    const providerUuidByKey = new Map<string, string>();
    for (const row of providerRows) {
      providerKeyById.set(row.id, row.provider_key);
      providerNameById.set(row.id, row.name);
      providerTypeById.set(row.id, row.provider_type ?? 'internal');
      providerUuidByKey.set(row.provider_key, row.id);
    }

    const modelRows = (modelsRes.data ?? []).filter((r) => r.is_active !== false);
    const modelUuidByKey = new Map<string, string>();
    for (const row of modelRows) modelUuidByKey.set(row.model_key, row.id);

    // Assignment lookup keyed by `${agent_id}|${model_id}|${type}` for
    // idempotent create/update detection.
    const assignmentByKey = new Map<string, AiAgentModelAssignmentRow>();
    for (const row of assignmentsRes.data ?? []) {
      assignmentByKey.set(`${row.agent_id}|${row.model_id}|${row.assignment_type}`, row);
    }

    mapsRef.current = {
      providerCtx: { providerKeyById, providerNameById, providerTypeById, providerUuidByKey },
      modelUuidByKey,
      agentUuidByKey: new Map<string, string>(),
      assignmentByKey,
    };

    if (providersRes.error) {
      setMode('error');
      setError(providersRes.error);
      setModels([]);
      setProviders([]);
      setLoading(false);
      return;
    }
    if (modelsRes.error) {
      setMode('error');
      setError(modelsRes.error);
      setModels([]);
      setProviders([]);
      setLoading(false);
      return;
    }

    // Count models per provider for the provider cards.
    const modelCountByProvider = new Map<string, number>();
    for (const row of modelRows) {
      modelCountByProvider.set(row.provider_id, (modelCountByProvider.get(row.provider_id) ?? 0) + 1);
    }

    const mappedProviders = providerRows.map((r) =>
      mapProviderRowToRecord(
        r,
        demoProviderById.get(r.provider_key),
        modelCountByProvider.get(r.id) ?? 0,
      ),
    );

    const mappedModels = modelRows.map((r) =>
      mapModelRowToRecord(
        r,
        {
          key: providerKeyById.get(r.provider_id) ?? 'unknown',
          name: providerNameById.get(r.provider_id) ?? 'Unknown Provider',
          type: (providerTypeById.get(r.provider_id) as AiModel['providerType']) ?? 'cloud',
        },
        demoModelById.get(r.model_key),
      ),
    );

    setProviders(mappedProviders);
    setModels(mappedModels);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setModels(demoModels as AiModel[]);
    setProviders(demoProviders as AiProvider[]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createProvider = useCallback(
    async (record: AiProvider, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        setProviders((prev) => [record, ...prev]);
        return { error: null };
      }
      const { error: writeError } = await createAiModelProvider(mapRecordToProviderInput(record));
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'model_provider_created',
        action: 'Create provider',
        outcome: 'success',
        severity: 'low',
        site_id: null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'models',
        risk_level: 'green',
        environment: 'production',
        before_summary: 'Provider did not exist.',
        after_summary: `Provider created: ${record.name} (${record.id}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Provider metadata created — no credential value stored; no external connectivity performed.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateProvider = useCallback(
    async (id: string, record: AiProvider, actor: string): Promise<SaveResult> => {
      const previous = providers.find((p) => p.id === id);
      if (mode !== 'live') {
        setProviders((prev) => prev.map((p) => (p.id === id ? record : p)));
        return { error: null };
      }
      const { error: writeError } = await updateAiModelProvider(id, mapRecordToProviderInput(record));
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'model_provider_updated',
        action: 'Update provider',
        outcome: 'success',
        severity: 'low',
        site_id: null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'models',
        risk_level: 'green',
        environment: 'production',
        before_summary: previous ? `Provider was: ${previous.name} (status ${previous.status}).` : 'Unknown prior state.',
        after_summary: `Provider updated: ${record.name} (status ${record.status}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Provider metadata updated — no credential value stored.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, providers, refresh],
  );

  const createModel = useCallback(
    async (record: AiModel, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        setModels((prev) => [record, ...prev]);
        return { error: null };
      }
      const providerUuid = mapsRef.current.providerCtx?.providerUuidByKey.get(record.providerId);
      if (!providerUuid) return { error: 'Could not resolve provider reference.' };

      const { error: writeError } = await createAiOperationsModel(mapRecordToModelInput(record, providerUuid));
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'model_created',
        action: 'Create model',
        outcome: 'success',
        severity: riskToSeverity(record.riskLevel),
        site_id: null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'models',
        risk_level: record.riskLevel ?? 'green',
        environment: record.environment,
        before_summary: 'Model did not exist.',
        after_summary: `Model created: ${record.name} (${record.id}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Model registry metadata created — no model was called; no credentials stored.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateModel = useCallback(
    async (id: string, record: AiModel, actor: string): Promise<SaveResult> => {
      const previous = models.find((m) => m.id === id);
      if (mode !== 'live') {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...record } : m)));
        return { error: null };
      }
      const providerUuid = mapsRef.current.providerCtx?.providerUuidByKey.get(record.providerId);
      if (!providerUuid) return { error: 'Could not resolve provider reference.' };

      const { error: writeError } = await updateAiOperationsModel(id, mapRecordToModelInput(record, providerUuid));
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'model_updated',
        action: 'Update model',
        outcome: 'success',
        severity: riskToSeverity(record.riskLevel),
        site_id: null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'models',
        risk_level: record.riskLevel ?? 'green',
        environment: record.environment,
        before_summary: previous ? `Model was: ${previous.name} (status ${previous.status}).` : 'Unknown prior state.',
        after_summary: `Model updated: ${record.name} (status ${record.status}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Model registry metadata updated — no model was called.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, models, refresh],
  );

  // Persist an agent → model assignment (configuration metadata only). The
  // agent/model keys are resolved to UUIDs here, never exposed to the UI.
  const createAssignment = useCallback(
    async (agentKey: string, modelKey: string, type: ModelAssignmentType, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Assignments require live data.' };

      const agentUuid = mapsRef.current.agentUuidByKey.get(agentKey);
      const modelUuid = mapsRef.current.modelUuidByKey.get(modelKey);
      if (!agentUuid) return { error: 'Could not resolve agent reference.' };
      if (!modelUuid) return { error: 'Could not resolve model reference.' };

      const existing = mapsRef.current.assignmentByKey.get(`${agentUuid}|${modelUuid}|${type}`);
      const payload = {
        agent_id: agentUuid,
        model_id: modelUuid,
        assignment_type: type,
        environment: 'production',
        fallback_enabled: type === 'fallback',
        assigned_by: actor,
        assigned_at: new Date().toISOString(),
        is_active: true,
      };

      const writeResult = existing
        ? await updateAiAgentModelAssignment(agentUuid, modelUuid, type, payload)
        : await createAiAgentModelAssignment(payload);
      if (writeResult.error) return { error: writeResult.error };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: existing ? 'model_assignment_updated' : 'model_assignment_created',
        action: existing ? 'Update model assignment' : 'Assign model',
        outcome: 'success',
        severity: 'low',
        site_id: null,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'models',
        risk_level: 'green',
        environment: 'production',
        before_summary: existing ? `Assignment existed for ${agentKey} on ${modelKey}.` : 'No prior assignment.',
        after_summary: `Agent ${agentKey} assigned ${modelKey} as ${type}.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Model assignment registered — agent runtime is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Revoke an assignment by setting is_active=false. Never a physical delete.
  const revokeAssignment = useCallback(
    async (agentKey: string, modelKey: string, type: ModelAssignmentType, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Assignments require live data.' };

      const agentUuid = mapsRef.current.agentUuidByKey.get(agentKey);
      const modelUuid = mapsRef.current.modelUuidByKey.get(modelKey);
      if (!agentUuid || !modelUuid) return { error: 'Could not resolve agent or model reference.' };

      const { error: writeError } = await updateAiAgentModelAssignment(agentUuid, modelUuid, type, {
        is_active: false,
        assigned_by: actor,
      });
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'model_assignment_revoked',
        action: 'Revoke model assignment',
        outcome: 'success',
        severity: 'low',
        site_id: null,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'models',
        risk_level: 'green',
        environment: 'production',
        before_summary: `Assignment existed for ${agentKey} on ${modelKey} (${type}).`,
        after_summary: `Assignment revoked for ${agentKey} on ${modelKey} (${type}).`,
        decision_reason: null,
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

  // Load live providers/models/assignments on first mount. A failure surfaces
  // as `error` mode and never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ModelsContextValue>(
    () => ({
      models,
      providers,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      createProvider,
      updateProvider,
      createModel,
      updateModel,
      createAssignment,
      revokeAssignment,
    }),
    [models, providers, mode, loading, error, refresh, loadDemo, createProvider, updateProvider, createModel, updateModel, createAssignment, revokeAssignment],
  );

  return <ModelsContext.Provider value={value}>{children}</ModelsContext.Provider>;
}

export function useModels(): ModelsContextValue {
  const ctx = useContext(ModelsContext);
  if (!ctx) throw new Error('useModels must be used within a ModelsProvider');
  return ctx;
}
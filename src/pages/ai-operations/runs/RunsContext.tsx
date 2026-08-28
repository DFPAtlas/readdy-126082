import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiTaskRun, AiAuditEvent } from '@/pages/ai-operations/types';
import { demoRuns } from '@/mocks/ai-operations-runs';
import {
  getAiSites,
  getAiAgents,
  getAiTasks,
  getAiRuns,
  getAllAiRunSteps,
  getAiAuditEvents,
  createAiTask,
  type AiRunStepRow,
} from '@/lib/ai-operations';
import { mapRunRowToRecord, type RunResolutionContext } from '@/pages/ai-operations/runs/runMapper';
import { mapAuditEventRowToRecord, type AuditResolutionContext } from '@/pages/ai-operations/audit/auditMapper';
import { buildTaskLookup, toAiTaskInput, type TaskCreateInput } from '@/pages/ai-operations/runs/taskMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';
import { DIAGNOSTIC_RUN_TASK_KEY, DIAGNOSTIC_RUN_KEY_PREFIX } from '@/lib/ai-operations/runtimeDiagnosticRun';
import { APPROVAL_GATED_TASK_KEY_PREFIX, APPROVAL_GATED_RUN_KEY_PREFIX } from '@/lib/ai-operations/runtimeApprovalGatedRun';

// Data-source state for the Tasks & Runs module. Mirrors the proven Sites and
// Agents pattern so the page never pretends demo data is live:
//   * live  — Supabase ai_tasks/ai_runs/ai_run_steps rows loaded successfully.
//   * demo  — the existing mock run registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type RunsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Lightweight options for the Create Task form (stable keys + names only).
export interface RunSiteOption {
  key: string;
  name: string;
}
export interface RunAgentOption {
  key: string;
  name: string;
  assignedSite: string | null;
}

interface RunsContextValue {
  runs: AiTaskRun[];
  mode: RunsDataSourceMode;
  loading: boolean;
  error: string | null;
  sites: RunSiteOption[];
  agents: RunAgentOption[];
  refresh: () => Promise<void>;
  loadDemo: () => void;
  /** Create a non-executing task (live) — never starts an agent. */
  createTask: (input: TaskCreateInput) => Promise<SaveResult>;
  getRun: (runKey: string) => AiTaskRun | undefined;
  /** Live audit events linked to a run (compact audit trail). */
  getAuditForRun: (runKey: string) => AiAuditEvent[];
}

const RunsContext = createContext<RunsContextValue | null>(null);

// Demo lookup keyed by stable id (= run_key) so live rows can merge their
// supporting metadata (timing strings, nested objects, chain, tags).
const demoRunById = new Map((demoRuns as AiTaskRun[]).map((r) => [r.id, r]));

// Synthesise a minimal draft run for demo/local-only Create Task (never written
// to Supabase, never executed).
function makeDemoDraftRun(input: TaskCreateInput, siteName: string, agentName: string): AiTaskRun {
  return {
    id: input.taskKey,
    parentTaskId: null,
    parentRunId: null,
    rootRunId: null,
    correlationId: `COR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    taskName: input.name,
    taskDescription: input.description,
    taskType: input.taskType as AiTaskRun['taskType'],
    requestedBy: 'Draft',
    triggerSource: input.triggerSource as AiTaskRun['triggerSource'],
    siteId: input.siteId ?? 'group',
    siteName: input.siteId ? siteName : 'Group-wide',
    agentId: '',
    agentName,
    environment: input.environment as AiTaskRun['environment'],
    status: 'draft',
    priority: input.priority as AiTaskRun['priority'],
    risk: input.riskLevel as AiTaskRun['risk'],
    autonomy: 'limited_automatic',
    queuePosition: null,
    startedTime: '—',
    completedTime: '—',
    duration: '—',
    createdTime: '2026-08-25',
    updatedTime: 'Just now',
    attempts: 0,
    maxAttempts: 3,
    retryCount: 0,
    estimatedCost: '—',
    actualCost: '—',
    model: '—',
    provider: '—',
    inputSummary: '',
    resultSummary: '',
    errorSummary: '',
    approvalRequired: input.approvalRequired,
    approvalId: null,
    uatRequired: input.uatRequired,
    verificationRequired: input.verificationRequired,
    auditRequired: input.auditRequired,
    currentStep: 0,
    totalSteps: 4,
    tags: [],
    notes: input.notes,
    steps: [],
    chain: [],
    input: { type: 'Task', source: 'Draft', summary: input.description, dataClassification: 'Internal', size: '—', timestamp: '2026-08-25' },
    result: { outcome: 'Draft', summary: 'Draft task saved locally.', recordsAffected: '0', nextAction: 'Configure then run' },
    failure: null,
    retry: { retryAllowed: true, retryCount: 0, maxAttempts: 3, nextRetry: '—', retryReason: '—', backoffStrategy: 'Exponential (2s → 30s)', requiresApproval: false },
    cost: { model: '—', provider: '—', estimatedTokens: '—', estimatedCost: '—', actualCost: '—', toolCost: '—', totalEstimatedCost: '—' },
    approval: { approvalRequired: input.approvalRequired, approvalId: null, approvalState: input.approvalRequired ? 'Pending' : 'Not required', requestedTime: '—', risk: input.riskLevel as AiTaskRun['risk'], approverTeam: 'Group AI Operations' },
    uat: { uatRequired: input.uatRequired, uatStatus: input.uatRequired ? 'Pending' : 'Not required', testPlanRef: '—', testsPassed: 0, testsFailed: 0 },
    audit: { auditRequired: true, auditStatus: 'Pending', createdBy: 'Draft', createdAt: '2026-08-25', lastModifiedBy: 'Draft', lastModifiedAt: '2026-08-25', completionEvidence: false, verificationEvidence: false },
  };
}

export function RunsProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<AiTaskRun[]>([]);
  const [mode, setMode] = useState<RunsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<RunSiteOption[]>([]);
  const [agents, setAgents] = useState<RunAgentOption[]>([]);
  const [auditEvents, setAuditEvents] = useState<AiAuditEvent[]>([]);

  // Mutable resolution maps + site UUID lookup, rebuilt on each refresh. Kept
  // in a ref so they do not trigger re-renders.
  const mapsRef = useRef({
    siteUuidByKey: new Map<string, string>(),
    ctx: null as RunResolutionContext | null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, tasksRes, runsRes, stepsRes, auditRes] = await Promise.all([
      getAiSites(),
      getAiAgents(),
      getAiTasks(),
      getAiRuns(),
      getAllAiRunSteps(),
      getAiAuditEvents(),
    ]);

    // Build site maps (TEST/SANDBOX excluded).
    const siteRows = (sitesRes.data ?? []).filter((r) => r.is_active !== false);
    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    const siteUuidByKey = new Map<string, string>();
    for (const row of siteRows) {
      siteKeyById.set(row.id, row.site_key);
      siteNameById.set(row.id, row.name);
      siteUuidByKey.set(row.site_key, row.id);
    }

    const agentRows = (agentsRes.data ?? []).filter((r) => r.is_active !== false);
    const agentKeyById = new Map<string, string>();
    const agentNameById = new Map<string, string>();
    for (const row of agentRows) {
      agentKeyById.set(row.id, row.agent_key);
      agentNameById.set(row.id, row.name);
    }

    // Build task lookup (TEST/SANDBOX excluded, except the fixed Prompt 18
    // diagnostic task and the fixed Prompt 19 approval-gated task which are
    // legitimately persisted sandbox diagnostic runs).
    const taskRows = (tasksRes.data ?? []).filter(
      (r) =>
        r.environment !== 'sandbox' ||
        r.task_key === DIAGNOSTIC_RUN_TASK_KEY ||
        String(r.task_key).startsWith(APPROVAL_GATED_TASK_KEY_PREFIX),
    );
    const taskLookup = buildTaskLookup(taskRows, siteKeyById);

    // Build run-key lookup from live runs for parent/root resolution (sandbox
    // excluded except the fixed Prompt 18 diagnostic run and Prompt 19
    // approval-gated run).
    const runRows = (runsRes.data ?? []).filter(
      (r) =>
        r.environment !== 'sandbox' ||
        String(r.run_key).startsWith(DIAGNOSTIC_RUN_KEY_PREFIX) ||
        String(r.run_key).startsWith(APPROVAL_GATED_RUN_KEY_PREFIX),
    );
    const runKeyById = new Map<string, string>();
    for (const row of runRows) runKeyById.set(row.id, row.run_key);

    const ctx: RunResolutionContext = {
      siteKeyById,
      siteNameById,
      agentKeyById,
      agentNameById,
      runKeyById,
      taskNameById: taskLookup.nameById,
      taskTypeById: taskLookup.typeById,
      taskKeyById: taskLookup.keyById,
      taskDescriptionById: taskLookup.descriptionById,
    };
    mapsRef.current = { siteUuidByKey, ctx };

    // Map live audit events for the compact run audit trail. Approval links are
    // not resolved here (Runs scope) — they remain null/demo supporting.
    const auditCtx: AuditResolutionContext = {
      siteKeyById,
      siteNameById,
      agentKeyById,
      agentNameById,
      runKeyById,
      approvalKeyById: new Map<string, string>(),
    };
    const auditRows = (auditRes.data ?? []).filter((r) => r.environment !== 'sandbox');
    setAuditEvents(auditRows.map((row) => mapAuditEventRowToRecord(row, undefined, [], auditCtx)));

    // Form dropdowns (live).
    setSites(siteRows.map((r) => ({ key: r.site_key, name: r.name })));
    setAgents(
      agentRows.map((r) => ({
        key: r.agent_key,
        name: r.name,
        assignedSite: r.site_id ? (siteKeyById.get(r.site_id) ?? null) : null,
      })),
    );

    if (runsRes.error) {
      setMode('error');
      setError(runsRes.error);
      setRuns([]);
      setLoading(false);
      return;
    }

    // Group live steps by run_id for per-run timeline attachment.
    const stepsByRun = new Map<string, AiRunStepRow[]>();
    for (const s of stepsRes.data ?? []) {
      const list = stepsByRun.get(s.run_id) ?? [];
      list.push(s);
      stepsByRun.set(s.run_id, list);
    }

    const mapped = runRows.map((r) =>
      mapRunRowToRecord(r, demoRunById.get(r.run_key), ctx, stepsByRun.get(r.id) ?? []),
    );

    setRuns(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setRuns(demoRuns as AiTaskRun[]);
    setSites([]);
    setAgents([]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createTask = useCallback(
    async (input: TaskCreateInput): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: never write demo records to Supabase.
        const siteName = sites.find((s) => s.key === input.siteId)?.name ?? '';
        setRuns((prev) => [makeDemoDraftRun(input, siteName, 'Unassigned'), ...prev]);
        return { error: null };
      }
      const siteUuid = input.siteId
        ? mapsRef.current.siteUuidByKey.get(input.siteId) ?? null
        : null;
      const { error: writeError } = await createAiTask(
        toAiTaskInput({ ...input, siteId: siteUuid }),
      );
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh, sites, agents],
  );

  const getRun = useCallback(
    (runKey: string) => runs.find((r) => r.id === runKey),
    [runs],
  );

  const getAuditForRun = useCallback(
    (runKey: string) => auditEvents.filter((e) => e.runId === runKey),
    [auditEvents],
  );

  // Load live tasks & runs on first mount. A failure surfaces as `error` mode
  // and never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<RunsContextValue>(
    () => ({ runs, mode, loading, error, sites, agents, refresh, loadDemo, createTask, getRun, getAuditForRun }),
    [runs, mode, loading, error, sites, agents, refresh, loadDemo, createTask, getRun, getAuditForRun],
  );

  return <RunsContext.Provider value={value}>{children}</RunsContext.Provider>;
}

export function useRuns() {
  const ctx = useContext(RunsContext);
  if (!ctx) throw new Error('useRuns must be used within a RunsProvider');
  return ctx;
}
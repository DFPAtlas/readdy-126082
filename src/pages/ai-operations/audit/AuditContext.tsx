import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AiAuditEvent,
  AuditEvidence,
  AuditReviewItem,
  HumanOverrideAudit,
  ComplianceReadinessCheck,
} from '@/pages/ai-operations/types';
import {
  demoAuditEvents,
  demoAuditEvidence,
} from '@/mocks/ai-operations-audit';
import {
  demoAuditEvents2,
  demoAuditEvidence2,
  demoHumanOverrides,
  demoComplianceChecks,
} from '@/mocks/ai-operations-audit-2';
import {
  getAiSites,
  getAiAgents,
  getAiRuns,
  getAiApprovals,
  getAiAuditEvents,
  getAiAuditEvidence,
} from '@/lib/ai-operations';
import {
  mapAuditEventRowToRecord,
  mapEvidenceRowToRecord,
  type AuditResolutionContext,
} from '@/pages/ai-operations/audit/auditMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Audit & Evidence module. Mirrors the proven
// Sites/Agents/Runs/Approvals pattern:
//   * live  — Supabase ai_audit_events/ai_audit_evidence rows loaded.
//   * demo  — the existing mock audit registry (explicit fallback only).
//   * error — a live request failed; UI shows a recovery prompt (never
//             auto-switches to demo).
export type AuditDataSourceMode = DataSourceMode;

interface AuditContextValue {
  events: AiAuditEvent[];
  evidence: AuditEvidence[];
  mode: AuditDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getEvent: (auditKey: string) => AiAuditEvent | undefined;
  getEvidenceForEvent: (event: AiAuditEvent) => AuditEvidence[];
  reviewQueue: AuditReviewItem[];
  complianceChecks: ComplianceReadinessCheck[];
  humanOverrides: HumanOverrideAudit[];
}

const AuditContext = createContext<AuditContextValue | null>(null);

// Demo lookup keyed by stable id (= audit_key) so live rows can merge their
// supporting metadata (nested verification/uat/governance + secondary refs).
const demoEventById = new Map<string, AiAuditEvent>(
  [...demoAuditEvents, ...demoAuditEvents2].map((e) => [e.id, e]),
);
const allDemoEvents: AiAuditEvent[] = [...demoAuditEvents, ...demoAuditEvents2];
const allDemoEvidence: AuditEvidence[] = [...demoAuditEvidence, ...demoAuditEvidence2];

// Derive the review queue from the current events list (works for both live
// and demo). Mirrors the existing deterministic demo logic.
function deriveReviewQueue(events: AiAuditEvent[]): AuditReviewItem[] {
  return events
    .filter((e) => e.reviewRequired)
    .map((e) => {
      let reason: string;
      if (e.eventType === 'human_override') reason = 'Human override used';
      else if (e.verification.required && e.verification.status === 'Failed') reason = 'Failed verification';
      else if (e.uat.required && e.uat.blockingFailures) reason = 'Blocking UAT failures';
      else if (e.verification.required && !e.verification.evidenceAvailable) reason = 'Missing evidence';
      else if (e.outcome === 'blocked') reason = 'Blocked action requires review';
      else if (e.risk === 'red') reason = 'High/critical risk event';
      else reason = 'Incomplete record';
      return { auditId: e.id, reason, severity: e.severity, risk: e.risk };
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5);
    });
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AiAuditEvent[]>([]);
  const [evidence, setEvidence] = useState<AuditEvidence[]>([]);
  const [mode, setMode] = useState<AuditDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, runsRes, approvalsRes, auditRes, evidenceRes] = await Promise.all([
      getAiSites(),
      getAiAgents(),
      getAiRuns(),
      getAiApprovals(),
      getAiAuditEvents(),
      getAiAuditEvidence(),
    ]);

    // Build resolution maps (TEST/SANDBOX excluded where relevant).
    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    for (const row of sitesRes.data ?? []) {
      siteKeyById.set(row.id, row.site_key);
      siteNameById.set(row.id, row.name);
    }
    const agentKeyById = new Map<string, string>();
    const agentNameById = new Map<string, string>();
    for (const row of agentsRes.data ?? []) {
      agentKeyById.set(row.id, row.agent_key);
      agentNameById.set(row.id, row.name);
    }
    const runKeyById = new Map<string, string>();
    for (const row of runsRes.data ?? []) {
      runKeyById.set(row.id, row.run_key);
    }
    const approvalKeyById = new Map<string, string>();
    for (const row of approvalsRes.data ?? []) {
      approvalKeyById.set(row.id, row.approval_key);
    }
    const ctx: AuditResolutionContext = {
      siteKeyById,
      siteNameById,
      agentKeyById,
      agentNameById,
      runKeyById,
      approvalKeyById,
    };

    // audit_key by event UUID, for resolving evidence links.
    const auditKeyByEventId = new Map<string, string>();
    const auditEventRows = auditRes.data ?? [];
    for (const row of auditEventRows) {
      auditKeyByEventId.set(row.id, row.audit_key);
    }

    if (auditRes.error) {
      setMode('error');
      setError(auditRes.error);
      setEvents([]);
      setEvidence([]);
      setLoading(false);
      return;
    }

    // Filter sandbox verification rows out of the registry view.
    const eventRows = auditEventRows.filter((r) => r.environment !== 'sandbox');

    // Group evidence keys by event UUID so each event can surface its links.
    const evidenceKeysByEventId = new Map<string, string[]>();
    for (const er of evidenceRes.data ?? []) {
      if (!er.audit_event_id) continue;
      const list = evidenceKeysByEventId.get(er.audit_event_id) ?? [];
      list.push(er.evidence_key);
      evidenceKeysByEventId.set(er.audit_event_id, list);
    }

    const mappedEvents = eventRows.map((row) =>
      mapAuditEventRowToRecord(
        row,
        demoEventById.get(row.audit_key),
        evidenceKeysByEventId.get(row.id) ?? [],
        ctx,
      ),
    );

    const mappedEvidence = (evidenceRes.data ?? []).map((row) =>
      mapEvidenceRowToRecord(row, auditKeyByEventId),
    );

    setEvents(mappedEvents);
    setEvidence(mappedEvidence);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setEvents(allDemoEvents);
    setEvidence(allDemoEvidence);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const getEvent = useCallback(
    (auditKey: string) => events.find((e) => e.id === auditKey),
    [events],
  );

  const getEvidenceForEvent = useCallback(
    (event: AiAuditEvent) => evidence.filter((ev) => ev.relatedRecordId === event.id),
    [evidence],
  );

  const reviewQueue = useMemo(() => deriveReviewQueue(events), [events]);

  // Load live audit events on first mount. Failure surfaces as `error` mode and
  // never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuditContextValue>(
    () => ({
      events,
      evidence,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      getEvent,
      getEvidenceForEvent,
      reviewQueue,
      complianceChecks: demoComplianceChecks,
      humanOverrides: demoHumanOverrides,
    }),
    [events, evidence, mode, loading, error, refresh, loadDemo, getEvent, getEvidenceForEvent, reviewQueue],
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit(): AuditContextValue {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within an AuditProvider');
  return ctx;
}
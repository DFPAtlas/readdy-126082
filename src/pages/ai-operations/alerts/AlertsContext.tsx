import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiAlert, AlertStatus } from '@/pages/ai-operations/types';
import { demoAlerts } from '@/mocks/ai-operations-alerts';
import { demoAlerts2 } from '@/mocks/ai-operations-alerts-2';
import {
  getAiAlerts,
  getAiIncidents,
  getAiIncidentAlerts,
  getAiSites,
  getAiAgents,
  getAiRuns,
  getAiApprovals,
  getAiSecurityPolicies,
  getAiToolConnections,
  getAiOperationsModels,
  updateAiAlert,
  createAiIncident,
  linkAiAlertToIncident,
  appendAiIncidentTimeline,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import {
  mapAlertRowToRecord,
  mapIncidentRowToRecord,
  type AlertResolutionContext,
  type AiIncident,
} from '@/pages/ai-operations/alerts/alertMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

export type AlertsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

interface AlertsContextValue {
  alerts: AiAlert[];
  incidents: AiIncident[];
  mode: AlertsDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getAlert: (id: string) => AiAlert | undefined;
  /** Metadata-only status change (update ai_alerts + audit event). Never
   *  triggers remediation, notifications or agent execution. */
  updateStatus: (id: string, status: AlertStatus) => Promise<SaveResult>;
  /** Create an incident from a live alert (incident + link + timeline + audit). */
  createIncidentFromAlert: (alertKey: string) => Promise<SaveResult>;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

// Demo lookup keyed by stable id (= alert_key) so live rows can merge their
// nested "Demo Supporting Metadata" (timeline, diagnostics, known-issue,
// impact, governance, escalation, recurrence, tags) where no production table
// exists yet.
const demoAlertById = new Map<string, AiAlert>(
  ([...demoAlerts, ...demoAlerts2] as AiAlert[]).map((a) => [a.id, a]),
);

function severityToPriority(severity: string): string {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'normal';
  return 'low';
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const [incidents, setIncidents] = useState<AiIncident[]>([]);
  const [mode, setMode] = useState<AlertsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutable resolution maps, rebuilt on each refresh (kept in a ref to avoid
  // re-renders).
  const mapsRef = useRef<{
    ctx: AlertResolutionContext;
    alertUuidByKey: Map<string, string>;
    incidentUuidByKey: Map<string, string>;
    siteUuidByKey: Map<string, string>;
  }>({
    ctx: {
      siteKeyById: new Map(),
      siteNameById: new Map(),
      agentKeyById: new Map(),
      agentNameById: new Map(),
      runKeyById: new Map(),
      approvalKeyById: new Map(),
      policyKeyById: new Map(),
      policyNameById: new Map(),
      connectionKeyById: new Map(),
      modelKeyById: new Map(),
      incidentKeyByAlertUuid: new Map(),
    },
    alertUuidByKey: new Map(),
    incidentUuidByKey: new Map(),
    siteUuidByKey: new Map(),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [alertsRes, incidentsRes, linksRes, sitesRes, agentsRes, runsRes, approvalsRes, policiesRes, connectionsRes, modelsRes] =
      await Promise.all([
        getAiAlerts(),
        getAiIncidents(),
        getAiIncidentAlerts(),
        getAiSites(),
        getAiAgents(),
        getAiRuns(),
        getAiApprovals(),
        getAiSecurityPolicies(),
        getAiToolConnections(),
        getAiOperationsModels(),
      ]);

    if (alertsRes.error) {
      setMode('error');
      setError(alertsRes.error);
      setAlerts([]);
      setIncidents([]);
      setLoading(false);
      return;
    }
    if (incidentsRes.error) {
      setMode('error');
      setError(incidentsRes.error);
      setAlerts([]);
      setIncidents([]);
      setLoading(false);
      return;
    }

    const alertRows = (alertsRes.data ?? []).filter((r) => r.is_active !== false);
    const incidentRows = (incidentsRes.data ?? []).filter((r) => r.is_active !== false);
    const linkRows = linksRes.data ?? [];

    // Resolution maps (UUID → stable key / name). No UUIDs reach the UI.
    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    const siteUuidByKey = new Map<string, string>();
    for (const r of sitesRes.data ?? []) {
      siteKeyById.set(r.id, r.site_key);
      siteNameById.set(r.id, r.name);
      siteUuidByKey.set(r.site_key, r.id);
    }
    const agentKeyById = new Map<string, string>();
    const agentNameById = new Map<string, string>();
    for (const r of agentsRes.data ?? []) {
      agentKeyById.set(r.id, r.agent_key);
      agentNameById.set(r.id, r.name);
    }
    const runKeyById = new Map<string, string>();
    for (const r of runsRes.data ?? []) runKeyById.set(r.id, r.run_key);
    const approvalKeyById = new Map<string, string>();
    for (const r of approvalsRes.data ?? []) approvalKeyById.set(r.id, r.approval_key);
    const policyKeyById = new Map<string, string>();
    const policyNameById = new Map<string, string>();
    for (const r of policiesRes.data ?? []) {
      policyKeyById.set(r.id, r.policy_key);
      policyNameById.set(r.id, r.name);
    }
    const connectionKeyById = new Map<string, string>();
    for (const r of connectionsRes.data ?? []) connectionKeyById.set(r.id, r.connection_key);
    const modelKeyById = new Map<string, string>();
    for (const r of modelsRes.data ?? []) modelKeyById.set(r.id, r.model_key);

    // Alert UUID + incident UUID maps.
    const alertUuidByKey = new Map<string, string>();
    for (const r of alertRows) alertUuidByKey.set(r.alert_key, r.id);
    const incidentUuidByKey = new Map<string, string>();
    for (const r of incidentRows) incidentUuidByKey.set(r.incident_key, r.id);

    // alert_id → incident_key resolution (via ai_incident_alerts).
    const incidentKeyByAlertUuid = new Map<string, string>();
    for (const link of linkRows) {
      const key = incidentUuidByKey.get(link.incident_id);
      if (key) incidentKeyByAlertUuid.set(link.alert_id, key);
    }

    const ctx: AlertResolutionContext = {
      siteKeyById,
      siteNameById,
      agentKeyById,
      agentNameById,
      runKeyById,
      approvalKeyById,
      policyKeyById,
      policyNameById,
      connectionKeyById,
      modelKeyById,
      incidentKeyByAlertUuid,
    };

    mapsRef.current = { ctx, alertUuidByKey, incidentUuidByKey, siteUuidByKey };

    const mappedAlerts = alertRows.map((r) =>
      mapAlertRowToRecord(r, ctx, demoAlertById.get(r.alert_key)),
    );
    const mappedIncidents = incidentRows.map((r) =>
      mapIncidentRowToRecord(r, siteKeyById, siteNameById),
    );

    setAlerts(mappedAlerts);
    setIncidents(mappedIncidents);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setAlerts([...demoAlerts, ...demoAlerts2] as AiAlert[]);
    setIncidents([]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const getAlert = useCallback((id: string) => alerts.find((a) => a.id === id), [alerts]);

  // Metadata-only status change. Updates only ai_alerts (status + timestamps +
  // resolution summary), then appends an audit event. Never triggers
  // remediation, notifications, agent/n8n/model execution.
  const updateStatus = useCallback(
    async (id: string, status: AlertStatus): Promise<SaveResult> => {
      const previous = alerts.find((a) => a.id === id);

      if (mode !== 'live') {
        setAlerts((prev) =>
          prev.map((a) => {
            if (a.id !== id) return a;
            const now = 'Just now';
            const acknowledgedAt = status === 'acknowledged' ? now : a.acknowledgedAt;
            const resolutionStatus =
              status === 'resolved' || status === 'closed'
                ? status === 'resolved' ? 'Resolved' : 'Closed'
                : a.resolution.status;
            const closedAt = status === 'closed' ? now : a.resolution.closedAt;
            return {
              ...a,
              status,
              updatedAt: now,
              acknowledgedAt,
              resolution: { ...a.resolution, status: resolutionStatus, closedAt },
            };
          }),
        );
        return { error: null };
      }

      const now = new Date().toISOString();
      const payload: Record<string, unknown> = { status, last_seen_at: now };
      if (status === 'acknowledged') payload.acknowledged_at = now;
      if (status === 'resolved' || status === 'closed') payload.resolved_at = now;

      const { error: writeError } = await updateAiAlert(id, payload);
      if (writeError) return { error: writeError };

      const eventType =
        status === 'acknowledged'
          ? 'alert_acknowledged'
          : status === 'resolved'
            ? 'alert_resolved'
            : 'alert_status_changed';

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: eventType,
        action: 'Change alert status',
        outcome: 'success',
        severity: previous?.severity ?? 'low',
        site_id: previous && previous.siteId !== 'group' ? (mapsRef.current.siteUuidByKey.get(previous.siteId) ?? null) : null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'alerts',
        risk_level: previous?.governance.risk ?? 'green',
        environment: 'production',
        before_summary: previous ? `Alert was: ${previous.status}.` : 'Unknown prior state.',
        after_summary: `Alert ${id} status changed to ${status}.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Operational status only — automated remediation is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, alerts, refresh],
  );

  // Create an incident from a live alert: ai_incidents + ai_incident_alerts
  // link + baseline ai_incident_timeline + ai_audit_events. No remediation or
  // notification is performed.
  const createIncidentFromAlert = useCallback(
    async (alertKey: string): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Incident creation requires live data.' };

      const alert = alerts.find((a) => a.id === alertKey);
      if (!alert) return { error: 'Could not resolve the alert reference.' };

      const alertUuid = mapsRef.current.alertUuidByKey.get(alertKey);
      if (!alertUuid) return { error: 'Could not resolve the alert database reference.' };

      const incidentKey = `INC-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const now = new Date().toISOString();
      const siteUuid = alert.siteId !== 'group' ? (mapsRef.current.siteUuidByKey.get(alert.siteId) ?? null) : null;

      const { data: incidentRow, error: incidentError } = await createAiIncident({
        incident_key: incidentKey,
        title: alert.title,
        summary: alert.description,
        site_id: siteUuid,
        severity: alert.severity,
        priority: severityToPriority(alert.severity),
        status: 'new',
        incident_type: alert.type,
        lead_team: alert.assignedTeam,
        owner_reference: alert.escalationTeam,
        impact_summary: alert.impact,
        suspected_cause: alert.diagnostics.suspectedCause,
        response_plan: alert.suggestedAction,
        approval_required: alert.governance.approvalRequired,
        security_review_required: alert.type === 'security',
        uat_required: alert.uatRequired,
        started_at: now,
        is_active: true,
      });
      if (incidentError || !incidentRow) return { error: incidentError ?? 'Incident creation failed.' };

      const { error: linkError } = await linkAiAlertToIncident({
        incident_id: incidentRow.id,
        alert_id: alertUuid,
        relationship_type: 'primary',
      });
      if (linkError) return { error: linkError };

      const { error: timelineError } = await appendAiIncidentTimeline({
        incident_id: incidentRow.id,
        event_type: 'incident_created',
        previous_status: null,
        new_status: 'new',
        actor_reference: 'Operator',
        actor_role: 'human',
        summary: `Incident created from alert ${alertKey}.`,
      });
      if (timelineError) return { error: timelineError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'incident_created',
        action: 'Create incident',
        outcome: 'success',
        severity: alert.severity,
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'alerts',
        risk_level: alert.governance.risk,
        environment: 'production',
        before_summary: `No prior incident for alert ${alertKey}.`,
        after_summary: `Incident ${incidentKey} created from alert ${alertKey}.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Incident created — automated remediation is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, alerts, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AlertsContextValue>(
    () => ({
      alerts,
      incidents,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      getAlert,
      updateStatus,
      createIncidentFromAlert,
    }),
    [alerts, incidents, mode, loading, error, refresh, loadDemo, getAlert, updateStatus, createIncidentFromAlert],
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within an AlertsProvider');
  return ctx;
}
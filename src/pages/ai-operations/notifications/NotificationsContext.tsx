import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  NotificationRule,
  NotificationRuleStatus,
  NotificationEvent,
} from '@/pages/ai-operations/types';
import { demoNotificationRules } from '@/mocks/ai-operations-notifications';
import { demoNotificationEvents } from '@/mocks/ai-operations-notifications-events';
import {
  getAiNotificationRules,
  getAiNotificationEvents,
  getAiEscalationPolicies,
  getAiSites,
  getAiAlerts,
  getAiIncidents,
  getAiApprovals,
  getAiRuns,
  createAiNotificationRule,
  updateAiNotificationRule,
  acknowledgeAiNotificationEvent,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import {
  mapRuleRowToRecord,
  mapNotificationEventRowToRecord,
  type NotificationResolutionContext,
} from '@/pages/ai-operations/notifications/notificationMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

export type NotificationsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Safe metadata input for create/edit rule. No delivery occurs on save. No
// secrets or private contact details.
export interface NotificationRuleFormInput {
  rule_key: string;
  name: string;
  description?: string | null;
  event_type: string;
  scope: string;
  site_id?: string | null;
  environment: string;
  severity_minimum: string;
  priority_minimum: string;
  channels: string[];
  recipient_reference: string;
  acknowledgement_required: boolean;
  status?: string;
  owner_team?: string | null;
  audit_required?: boolean;
  notes?: string | null;
}

interface NotificationsContextValue {
  rules: NotificationRule[];
  events: NotificationEvent[];
  mode: NotificationsDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getRule: (id: string) => NotificationRule | undefined;
  getEventsByRule: (ruleId: string) => NotificationEvent[];
  /** Metadata-only status change (update ai_notification_rules + audit). Never
   *  sends a message. */
  updateRuleStatus: (id: string, status: NotificationRuleStatus) => Promise<SaveResult>;
  /** Create a rule — metadata only, no delivery. */
  createRule: (input: NotificationRuleFormInput) => Promise<SaveResult>;
  /** Update a rule — metadata only, no delivery. */
  updateRule: (ruleKey: string, input: Partial<NotificationRuleFormInput>) => Promise<SaveResult>;
  /** Acknowledge a live event (acknowledgement metadata only + audit). */
  acknowledgeEvent: (eventKey: string) => Promise<SaveResult>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const demoRuleByKey = new Map<string, NotificationRule>(
  (demoNotificationRules as NotificationRule[]).map((r) => [r.id, r]),
);
const demoEventByKey = new Map<string, NotificationEvent>(
  (demoNotificationEvents as NotificationEvent[]).map((e) => [e.id, e]),
);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [mode, setMode] = useState<NotificationsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<NotificationResolutionContext>({
    siteKeyById: new Map(),
    siteNameById: new Map(),
    ruleKeyById: new Map(),
    alertKeyById: new Map(),
    incidentKeyById: new Map(),
    approvalKeyById: new Map(),
    runKeyById: new Map(),
    maxLevelByPolicyKey: new Map(),
  });
  const siteUuidByKey = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    const [rulesRes, eventsRes, policiesRes, sitesRes, alertsRes, incidentsRes, approvalsRes, runsRes] =
      await Promise.all([
        getAiNotificationRules(),
        getAiNotificationEvents(),
        getAiEscalationPolicies(),
        getAiSites(),
        getAiAlerts(),
        getAiIncidents(),
        getAiApprovals(),
        getAiRuns(),
      ]);

    if (rulesRes.error || eventsRes.error) {
      setMode('error');
      setError(rulesRes.error ?? eventsRes.error ?? 'Unable to load notifications.');
      setRules([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    const ruleRows = rulesRes.data ?? [];
    const eventRows = eventsRes.data ?? [];

    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    const siteUuidMap = new Map<string, string>();
    for (const r of sitesRes.data ?? []) {
      siteKeyById.set(r.id, r.site_key);
      siteNameById.set(r.id, r.name);
      siteUuidMap.set(r.site_key, r.id);
    }
    const ruleKeyById = new Map<string, string>();
    for (const r of ruleRows) ruleKeyById.set(r.id, r.rule_key);
    const alertKeyById = new Map<string, string>();
    for (const r of alertsRes.data ?? []) alertKeyById.set(r.id, r.alert_key);
    const incidentKeyById = new Map<string, string>();
    for (const r of incidentsRes.data ?? []) incidentKeyById.set(r.id, r.incident_key);
    const approvalKeyById = new Map<string, string>();
    for (const r of approvalsRes.data ?? []) approvalKeyById.set(r.id, r.approval_key);
    const runKeyById = new Map<string, string>();
    for (const r of runsRes.data ?? []) runKeyById.set(r.id, r.run_key);
    const maxLevelByPolicyKey = new Map<string, number>();
    for (const r of policiesRes.data ?? []) maxLevelByPolicyKey.set(r.policy_key, r.max_level);

    const ctx: NotificationResolutionContext = {
      siteKeyById,
      siteNameById,
      ruleKeyById,
      alertKeyById,
      incidentKeyById,
      approvalKeyById,
      runKeyById,
      maxLevelByPolicyKey,
    };
    ctxRef.current = ctx;
    siteUuidByKey.current = siteUuidMap;

    const mappedRules = ruleRows.map((r) =>
      mapRuleRowToRecord(r, ctx, demoRuleByKey.get(r.rule_key)),
    );
    const mappedEvents = eventRows
      .map((r) => mapNotificationEventRowToRecord(r, ctx, demoEventByKey.get(r.event_key)))
      .sort((a, b) => b.time.localeCompare(a.time));

    setRules(mappedRules);
    setEvents(mappedEvents);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setRules([...demoNotificationRules] as NotificationRule[]);
    setEvents([...demoNotificationEvents] as NotificationEvent[]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const getRule = useCallback((id: string) => rules.find((r) => r.id === id), [rules]);
  const getEventsByRule = useCallback(
    (ruleId: string) => events.filter((e) => e.ruleId === ruleId),
    [events],
  );

  // Metadata-only status change. Live mode updates ai_notification_rules +
  // appends an audit event. Never sends a message.
  const updateRuleStatus = useCallback(
    async (id: string, status: NotificationRuleStatus): Promise<SaveResult> => {
      const previous = rules.find((r) => r.id === id);

      if (mode !== 'live') {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status, updatedAt: 'Just now' } : r)),
        );
        return { error: null };
      }

      const now = new Date().toISOString();
      const { error: writeError } = await updateAiNotificationRule(id, { status });
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'notification_rule_updated',
        action: 'Change notification rule status',
        outcome: 'success',
        severity: previous?.severityThreshold ?? 'low',
        site_id: previous && previous.siteId !== 'group' ? (siteUuidByKey.current.get(previous.siteId) ?? null) : null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'notifications',
        risk_level: previous?.riskThreshold ?? 'green',
        environment: 'production',
        before_summary: previous ? `Rule was: ${previous.status}.` : 'Unknown prior state.',
        after_summary: `Notification rule ${id} status changed to ${status}.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Configuration metadata only — no message was sent.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, rules, refresh],
  );

  const createRule = useCallback(
    async (input: NotificationRuleFormInput): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Creating rules requires live data.' };

      const siteUuid = input.site_id ? (siteUuidByKey.current.get(input.site_id) ?? null) : null;
      const now = new Date().toISOString();

      const { error: writeError } = await createAiNotificationRule({
        rule_key: input.rule_key,
        name: input.name,
        description: input.description,
        event_type: input.event_type,
        scope: input.scope,
        site_id: siteUuid,
        severity_minimum: input.severity_minimum,
        priority_minimum: input.priority_minimum,
        environment: input.environment,
        status: input.status ?? 'active',
        channels: input.channels,
        recipient_scope: 'team',
        recipient_reference: input.recipient_reference,
        acknowledgement_required: input.acknowledgement_required,
        escalation_enabled: false,
        suppression_enabled: true,
        audit_required: input.audit_required ?? false,
        owner_team: input.owner_team,
        is_active: input.status !== 'draft',
        notes: input.notes,
      });
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'notification_rule_created',
        action: 'Create notification rule',
        outcome: 'success',
        severity: input.severity_minimum,
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'notifications',
        risk_level: 'green',
        environment: input.environment,
        before_summary: 'No prior rule.',
        after_summary: `Notification rule ${input.rule_key} created.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Configuration metadata only — no message was sent.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateRule = useCallback(
    async (ruleKey: string, input: Partial<NotificationRuleFormInput>): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Updating rules requires live data.' };

      const siteUuid = input.site_id !== undefined
        ? (input.site_id ? (siteUuidByKey.current.get(input.site_id) ?? null) : null)
        : undefined;
      const now = new Date().toISOString();

      const payload: Record<string, unknown> = {
        name: input.name,
        description: input.description,
        event_type: input.event_type,
        scope: input.scope,
        severity_minimum: input.severity_minimum,
        priority_minimum: input.priority_minimum,
        environment: input.environment,
        channels: input.channels,
        recipient_reference: input.recipient_reference,
        acknowledgement_required: input.acknowledgement_required,
        owner_team: input.owner_team,
        audit_required: input.audit_required,
        notes: input.notes,
      };
      if (siteUuid !== undefined) payload.site_id = siteUuid;

      const { error: writeError } = await updateAiNotificationRule(ruleKey, payload);
      if (writeError) return { error: writeError };

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'notification_rule_updated',
        action: 'Update notification rule',
        outcome: 'success',
        severity: input.severity_minimum ?? 'low',
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'notifications',
        risk_level: 'green',
        environment: input.environment ?? 'production',
        before_summary: `Notification rule ${ruleKey} updated.`,
        after_summary: `Notification rule ${ruleKey} metadata updated.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Configuration metadata only — no message was sent.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Acknowledgement metadata only — never triggers external delivery.
  const acknowledgeEvent = useCallback(
    async (eventKey: string): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Acknowledgement requires live data.' };

      const { error: writeError } = await acknowledgeAiNotificationEvent(eventKey, 'Operator');
      if (writeError) return { error: writeError };

      const now = new Date().toISOString();
      await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'notification_acknowledged',
        action: 'Acknowledge notification event',
        outcome: 'success',
        severity: 'low',
        site_id: null,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'notifications',
        risk_level: 'green',
        environment: 'production',
        before_summary: `Notification event ${eventKey} was awaiting acknowledgement.`,
        after_summary: `Notification event ${eventKey} acknowledged.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Acknowledgement metadata only — no message was sent.',
      });

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      rules,
      events,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      getRule,
      getEventsByRule,
      updateRuleStatus,
      createRule,
      updateRule,
      acknowledgeEvent,
    }),
    [rules, events, mode, loading, error, refresh, loadDemo, getRule, getEventsByRule, updateRuleStatus, createRule, updateRule, acknowledgeEvent],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
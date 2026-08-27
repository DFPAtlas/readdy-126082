import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AiSchedule,
  EventAutomationRule,
  MaintenanceWindow,
  ScheduleStatus,
} from '@/pages/ai-operations/types';
import { demoSchedulesPart1 } from '@/mocks/ai-operations-schedules';
import {
  demoSchedulesPart2,
  demoEventAutomationRules,
  demoMaintenanceWindows,
} from '@/mocks/ai-operations-schedules-2';
import {
  getAiSchedules,
  getAiEventAutomationRules,
  getAiMaintenanceWindows,
  getAiSites,
  getAiAgents,
  getAiNotificationRules,
  createAiSchedule,
  updateAiSchedule,
  createAiEventAutomationRule,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import {
  mapScheduleRowToRecord,
  mapEventRuleRowToRecord,
  mapMaintenanceWindowRowToRecord,
  type ScheduleResolutionContext,
} from '@/pages/ai-operations/schedules/scheduleMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

export type SchedulesDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Safe metadata input for create/edit schedule. Saving NEVER registers a
// scheduler, runs a cron job, executes an agent or creates a run. No secrets.
export interface ScheduleFormInput {
  schedule_key: string;
  name: string;
  description?: string | null;
  automation_type: string;
  trigger_type: string;
  site_id?: string | null;
  agent_id?: string | null;
  notification_rule_id?: string | null;
  schedule_expression?: string | null;
  recurrence_summary?: string | null;
  timezone?: string | null;
  environment?: string;
  status?: string | null;
  risk_level?: string | null;
  priority?: string | null;
  approval_required?: boolean;
  audit_required?: boolean;
  owner_team?: string | null;
  notes?: string | null;
}

interface SchedulesContextValue {
  schedules: AiSchedule[];
  eventRules: EventAutomationRule[];
  maintenanceWindows: MaintenanceWindow[];
  mode: SchedulesDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getSchedule: (id: string) => AiSchedule | undefined;
  /** Metadata-only status change (ai_schedules + audit). Never stops/starts a job. */
  updateScheduleStatus: (scheduleKey: string, status: ScheduleStatus) => Promise<SaveResult>;
  /** Create a schedule — configuration metadata only, no scheduler. */
  createSchedule: (input: ScheduleFormInput) => Promise<SaveResult>;
  /** Create an event rule — configuration metadata only, no event listener. */
  createEventRule: (input: EventRuleFormInput) => Promise<SaveResult>;
}

export interface EventRuleFormInput {
  event_rule_key: string;
  name: string;
  description?: string | null;
  event_type: string;
  source_type?: string | null;
  site_id?: string | null;
  agent_id?: string | null;
  action_type?: string | null;
  action_reference?: string | null;
  condition?: string | null;
  environment?: string;
  approval_required?: boolean;
  audit_required?: boolean;
  owner_team?: string | null;
}

const SchedulesContext = createContext<SchedulesContextValue | null>(null);

const demoScheduleByKey = new Map<string, AiSchedule>(
  [...demoSchedulesPart1, ...demoSchedulesPart2].map((s) => [s.id, s]),
);
const demoEventRuleByKey = new Map<string, EventAutomationRule>(
  demoEventAutomationRules.map((r) => [r.id, r]),
);
const demoMaintenanceWindowByKey = new Map<string, MaintenanceWindow>(
  demoMaintenanceWindows.map((w) => [w.id, w]),
);

export function SchedulesProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<AiSchedule[]>([]);
  const [eventRules, setEventRules] = useState<EventAutomationRule[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [mode, setMode] = useState<SchedulesDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<ScheduleResolutionContext>({
    siteKeyById: new Map(),
    siteNameById: new Map(),
    agentKeyById: new Map(),
    agentNameById: new Map(),
    ruleKeyById: new Map(),
  });
  const siteUuidByKey = useRef<Map<string, string>>(new Map());
  const agentUuidByKey = useRef<Map<string, string>>(new Map());
  const ruleUuidByKey = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    const [schedRes, rulesRes, windowsRes, sitesRes, agentsRes, notifRulesRes] = await Promise.all([
      getAiSchedules(),
      getAiEventAutomationRules(),
      getAiMaintenanceWindows(),
      getAiSites(),
      getAiAgents(),
      getAiNotificationRules(),
    ]);

    if (schedRes.error || rulesRes.error || windowsRes.error) {
      setMode('error');
      setError(schedRes.error ?? rulesRes.error ?? windowsRes.error ?? 'Unable to load schedules.');
      setSchedules([]);
      setEventRules([]);
      setMaintenanceWindows([]);
      setLoading(false);
      return;
    }

    const ctx: ScheduleResolutionContext = {
      siteKeyById: new Map(),
      siteNameById: new Map(),
      agentKeyById: new Map(),
      agentNameById: new Map(),
      ruleKeyById: new Map(),
    };
    const siteUuidMap = new Map<string, string>();
    for (const r of sitesRes.data ?? []) {
      ctx.siteKeyById.set(r.id, r.site_key);
      ctx.siteNameById.set(r.id, r.name);
      siteUuidMap.set(r.site_key, r.id);
    }
    const agentUuidMap = new Map<string, string>();
    for (const r of agentsRes.data ?? []) {
      ctx.agentKeyById.set(r.id, r.agent_key);
      ctx.agentNameById.set(r.id, r.name);
      agentUuidMap.set(r.agent_key, r.id);
    }
    const ruleUuidMap = new Map<string, string>();
    for (const r of notifRulesRes.data ?? []) {
      ctx.ruleKeyById.set(r.id, r.rule_key);
      ruleUuidMap.set(r.rule_key, r.id);
    }
    ctxRef.current = ctx;
    siteUuidByKey.current = siteUuidMap;
    agentUuidByKey.current = agentUuidMap;
    ruleUuidByKey.current = ruleUuidMap;

    setSchedules((schedRes.data ?? []).map((r) => mapScheduleRowToRecord(r, ctx, demoScheduleByKey.get(r.schedule_key))));
    setEventRules((rulesRes.data ?? []).map((r) => mapEventRuleRowToRecord(r, ctx, demoEventRuleByKey.get(r.event_rule_key))));
    setMaintenanceWindows((windowsRes.data ?? []).map((r) => mapMaintenanceWindowRowToRecord(r, ctx, demoMaintenanceWindowByKey.get(r.window_key))));
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setSchedules([...demoSchedulesPart1, ...demoSchedulesPart2]);
    setEventRules([...demoEventAutomationRules]);
    setMaintenanceWindows([...demoMaintenanceWindows]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const getSchedule = useCallback((id: string) => schedules.find((s) => s.id === id), [schedules]);

  const updateScheduleStatus = useCallback(
    async (scheduleKey: string, status: ScheduleStatus): Promise<SaveResult> => {
      const previous = schedules.find((s) => s.id === scheduleKey);

      if (mode !== 'live') {
        setSchedules((prev) =>
          prev.map((s) => (s.id === scheduleKey ? { ...s, status, updatedAt: 'Just now' } : s)),
        );
        return { error: null };
      }

      const now = new Date().toISOString();
      const isActive = status === 'active' || status === 'running';
      const { error: writeError } = await updateAiSchedule(scheduleKey, {
        status,
        is_active: isActive,
      });
      if (writeError) return { error: writeError };

      await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'schedule_status_changed',
        action: 'Change schedule status',
        outcome: 'success',
        severity: previous?.risk ?? 'low',
        site_id: previous && previous.siteId !== 'group' ? (siteUuidByKey.current.get(previous.siteId) ?? null) : null,
        agent_id: previous?.agentId ? (agentUuidByKey.current.get(previous.agentId) ?? null) : null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'schedules',
        risk_level: previous?.risk ?? 'low',
        environment: previous?.environment ?? 'production',
        before_summary: previous ? `Schedule was: ${previous.status}.` : 'Unknown prior state.',
        after_summary: `Schedule ${scheduleKey} status changed to ${status}.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Registry state only — no scheduler process is connected.',
      });

      await refresh();
      return { error: null };
    },
    [mode, schedules, refresh],
  );

  const createSchedule = useCallback(
    async (input: ScheduleFormInput): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Creating schedules requires live data.' };

      const siteUuid = input.site_id ? (siteUuidByKey.current.get(input.site_id) ?? null) : null;
      const agentUuid = input.agent_id ? (agentUuidByKey.current.get(input.agent_id) ?? null) : null;
      const ruleUuid = input.notification_rule_id
        ? (ruleUuidByKey.current.get(input.notification_rule_id) ?? null)
        : null;
      const now = new Date().toISOString();

      const { error: writeError } = await createAiSchedule({
        schedule_key: input.schedule_key,
        name: input.name,
        description: input.description,
        automation_type: input.automation_type,
        trigger_type: input.trigger_type,
        site_id: siteUuid,
        agent_id: agentUuid,
        notification_rule_id: ruleUuid,
        target_type: input.automation_type,
        schedule_expression: input.schedule_expression,
        recurrence_summary: input.recurrence_summary,
        timezone: input.timezone,
        environment: input.environment ?? 'production',
        status: input.status ?? 'draft',
        risk_level: input.risk_level ?? 'low',
        priority: input.priority ?? 'normal',
        approval_required: input.approval_required ?? false,
        audit_required: input.audit_required ?? false,
        maintenance_behavior: 'Pause automation',
        retry_policy: {
          maxRetries: 1,
          retryDelay: '10m',
          backoffStrategy: 'linear',
          failureEscalation: 'Alert owner team',
          fallbackAgent: 'core-orchestrator',
          disableAfterRepeatedFailure: false,
          createIncidentAfterThreshold: false,
        },
        owner_team: input.owner_team,
        is_active: (input.status ?? 'draft') !== 'draft',
        notes: input.notes,
      });
      if (writeError) return { error: writeError };

      await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'schedule_created',
        action: 'Create schedule',
        outcome: 'success',
        severity: input.risk_level ?? 'low',
        site_id: siteUuid,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'schedules',
        risk_level: input.risk_level ?? 'low',
        environment: input.environment ?? 'production',
        before_summary: 'No prior schedule.',
        after_summary: `Schedule ${input.schedule_key} created.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Schedule saved — execution runtime is not connected.',
      });

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const createEventRule = useCallback(
    async (input: EventRuleFormInput): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Creating event rules requires live data.' };

      const siteUuid = input.site_id ? (siteUuidByKey.current.get(input.site_id) ?? null) : null;
      const agentUuid = input.agent_id ? (agentUuidByKey.current.get(input.agent_id) ?? null) : null;
      const now = new Date().toISOString();

      const { error: writeError } = await createAiEventAutomationRule({
        event_rule_key: input.event_rule_key,
        name: input.name,
        description: input.description,
        event_type: input.event_type,
        source_type: input.source_type ?? 'event',
        site_id: siteUuid,
        agent_id: agentUuid,
        action_type: input.action_type ?? 'run_workflow',
        action_reference: input.action_reference,
        conditions: input.condition ? { condition: input.condition } : null,
        environment: input.environment ?? 'production',
        status: 'active',
        risk_level: 'medium',
        approval_required: input.approval_required ?? false,
        audit_required: input.audit_required ?? true,
        owner_team: input.owner_team,
        is_active: true,
      });
      if (writeError) return { error: writeError };

      await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'event_rule_created',
        action: 'Create event automation rule',
        outcome: 'success',
        severity: 'medium',
        site_id: siteUuid,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'schedules',
        risk_level: 'medium',
        environment: input.environment ?? 'production',
        before_summary: 'No prior event rule.',
        after_summary: `Event rule ${input.event_rule_key} created.`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Event automation runtime is not connected — no event listener executes.',
      });

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SchedulesContextValue>(
    () => ({
      schedules,
      eventRules,
      maintenanceWindows,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      getSchedule,
      updateScheduleStatus,
      createSchedule,
      createEventRule,
    }),
    [schedules, eventRules, maintenanceWindows, mode, loading, error, refresh, loadDemo, getSchedule, updateScheduleStatus, createSchedule, createEventRule],
  );

  return <SchedulesContext.Provider value={value}>{children}</SchedulesContext.Provider>;
}

export function useSchedules(): SchedulesContextValue {
  const ctx = useContext(SchedulesContext);
  if (!ctx) throw new Error('useSchedules must be used within a SchedulesProvider');
  return ctx;
}
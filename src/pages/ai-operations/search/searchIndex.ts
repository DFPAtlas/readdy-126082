// ============================================================================
// AI Operations — Global Search & Command Palette — derived search index.
//
// Builds a single, lightweight searchable index from the existing central
// registry datasets. NO duplicate records are created — every entry is a thin
// projection of a record that already lives in src/mocks. Only safe operational
// metadata is indexed (no secrets, credentials, tokens or private contact
// details). The index is built once at module load and reused across keystrokes
// so no expensive transformation runs on every keypress.
// ============================================================================

import type { StatusTone } from '@/pages/ai-operations/constants';
import {
  SITE_STATUS,
  AGENT_STATUS,
  RUN_STATUS,
  APPROVAL_STATUS,
  ORCHESTRATION_STATUS,
  TOOL_CONNECTION_STATUS,
  MODEL_STATUS,
  KNOWLEDGE_STATUS,
  POLICY_STATUS,
  ALERT_STATUS,
  AUDIT_OUTCOME,
  BUDGET_STATUS,
  NOTIFICATION_RULE_STATUS,
  SCHEDULE_STATUS,
  AGENT_CATEGORY_LABELS,
  TASK_TYPE_LABELS,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  POLICY_CATEGORY_LABELS,
  ALERT_TYPE_LABELS,
  AUDIT_EVENT_TYPE_LABELS,
  BUDGET_SCOPE_LABELS,
} from '@/pages/ai-operations/constants';

import type {
  SiteRegistryRecord,
  AgentRegistryRecord,
  AiTaskRun,
  AiApproval,
  AiOrchestration,
  ToolConnection,
  AiModel,
  KnowledgeSource,
  AiSecurityPolicy,
  AiAlert,
  AiAuditEvent,
  AiBudget,
  NotificationRule,
  AiSchedule,
} from '@/pages/ai-operations/types';

import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoRuns } from '@/mocks/ai-operations-runs';
import { demoApprovals } from '@/mocks/ai-operations-approvals';
import { demoOrchestrations } from '@/mocks/ai-operations-orchestrator';
import { demoConnections } from '@/mocks/ai-operations-tools';
import { demoModels } from '@/mocks/ai-operations-models';
import { demoKnowledgeSourcesA } from '@/mocks/ai-operations-knowledge';
import { demoKnowledgeSourcesB } from '@/mocks/ai-operations-knowledge-2';
import { demoPolicies } from '@/mocks/ai-operations-security';
import { demoAlerts } from '@/mocks/ai-operations-alerts';
import { demoAlerts2 } from '@/mocks/ai-operations-alerts-2';
import { demoAuditEvents } from '@/mocks/ai-operations-audit';
import { demoAuditEvents2 } from '@/mocks/ai-operations-audit-2';
import { demoBudgets } from '@/mocks/ai-operations-costs';
import { demoNotificationRules } from '@/mocks/ai-operations-notifications';
import { demoSchedulesPart1 } from '@/mocks/ai-operations-schedules';
import { demoSchedulesPart2 } from '@/mocks/ai-operations-schedules-2';
import type { GroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

export type AiSearchRecordType =
  | 'site'
  | 'agent'
  | 'run'
  | 'approval'
  | 'orchestration'
  | 'tool'
  | 'model'
  | 'knowledge'
  | 'policy'
  | 'alert'
  | 'audit'
  | 'budget'
  | 'notification_rule'
  | 'schedule';

export interface AiGlobalSearchResult {
  /** Stable unique key (recordType + referenceId). */
  id: string;
  /** The actual central record ID, e.g. RUN-A1000, POL-CREDENTIALS. */
  referenceId: string;
  title: string;
  subtitle: string;
  /** Group label used for command-palette grouping, e.g. "Runs". */
  category: string;
  recordType: AiSearchRecordType;
  route: string;
  siteId: string | null;
  siteName: string;
  /** Raw status value (for programmatic use). */
  status: string;
  /** Human-readable status label. */
  statusLabel: string;
  statusTone: StatusTone;
  keywords: string[];
  priority: number;
}

// Small helper to drop empty keyword fragments.
function kw(...parts: (string | null | undefined)[]): string[] {
  return parts.filter((p): p is string => Boolean(p && p.trim()));
}

function make(
  recordType: AiSearchRecordType,
  category: string,
  referenceId: string,
  title: string,
  subtitle: string,
  route: string,
  siteId: string | null,
  siteName: string,
  status: string,
  statusLabel: string,
  statusTone: StatusTone,
  keywords: string[],
): AiGlobalSearchResult {
  return {
    id: `${recordType}:${referenceId}`,
    referenceId,
    title,
    subtitle,
    category,
    recordType,
    route,
    siteId,
    siteName,
    status,
    statusLabel,
    statusTone,
    keywords,
    priority: 0,
  };
}

function siteResults(): AiGlobalSearchResult[] {
  return (demoSites as SiteRegistryRecord[]).map((s) => {
    const st = SITE_STATUS[s.operationalStatus];
    return make(
      'site',
      'Sites',
      s.id,
      s.name,
      s.domain,
      `/ai-operations/sites/${s.id}`,
      s.id,
      s.name,
      s.operationalStatus,
      st.label,
      st.tone,
      kw(s.name, s.id, s.productName, s.domain, s.description),
    );
  });
}

function agentResults(): AiGlobalSearchResult[] {
  return (demoAgents as AgentRegistryRecord[]).map((a) => {
    const st = AGENT_STATUS[a.status];
    const cat = AGENT_CATEGORY_LABELS[a.category];
    return make(
      'agent',
      'Agents',
      a.id,
      a.name,
      `${a.scope} · ${cat}`,
      `/ai-operations/agents/${a.id}`,
      a.assignedSite,
      a.scope,
      a.status,
      st.label,
      st.tone,
      kw(a.name, a.id, a.scope, cat, a.description, a.currentTask),
    );
  });
}

function runResults(): AiGlobalSearchResult[] {
  return (demoRuns as AiTaskRun[]).map((r) => {
    const st = RUN_STATUS[r.status];
    return make(
      'run',
      'Runs',
      r.id,
      r.taskName,
      `${r.siteName} · ${r.agentName}`,
      `/ai-operations/runs/${r.id}`,
      r.siteId,
      r.siteName,
      r.status,
      st.label,
      st.tone,
      kw(r.taskName, r.id, r.siteName, r.agentName, TASK_TYPE_LABELS[r.taskType], r.taskDescription),
    );
  });
}

function approvalResults(): AiGlobalSearchResult[] {
  return (demoApprovals as AiApproval[]).map((a) => {
    const st = APPROVAL_STATUS[a.status];
    return make(
      'approval',
      'Approvals',
      a.id,
      a.title,
      `${a.siteName} · ${a.requestedAction}`,
      `/ai-operations/approvals/${a.id}`,
      a.siteId,
      a.siteName,
      a.status,
      st.label,
      st.tone,
      kw(a.title, a.id, a.siteName, a.agentName, a.requestedAction, a.description),
    );
  });
}

function orchestrationResults(): AiGlobalSearchResult[] {
  return (demoOrchestrations as AiOrchestration[]).map((o) => {
    const st = ORCHESTRATION_STATUS[o.status];
    return make(
      'orchestration',
      'Orchestrations',
      o.id,
      o.title,
      `${o.siteName} · ${TASK_TYPE_LABELS[o.taskType]}`,
      `/ai-operations/orchestrator/${o.id}`,
      o.siteId,
      o.siteName,
      o.status,
      st.label,
      st.tone,
      kw(o.title, o.id, o.correlationId, o.siteName, TASK_TYPE_LABELS[o.taskType], o.description),
    );
  });
}

function toolResults(): AiGlobalSearchResult[] {
  return (demoConnections as ToolConnection[]).map((t) => {
    const st = TOOL_CONNECTION_STATUS[t.status];
    return make(
      'tool',
      'Tools',
      t.id,
      t.name,
      `${t.provider} · ${t.scope}`,
      `/ai-operations/tools/${t.id}`,
      t.siteId,
      t.scope,
      t.status,
      st.label,
      st.tone,
      kw(t.name, t.id, t.provider, t.scope, t.description),
    );
  });
}

function modelResults(): AiGlobalSearchResult[] {
  return (demoModels as AiModel[]).map((m) => {
    const st = MODEL_STATUS[m.status];
    return make(
      'model',
      'Models',
      m.id,
      m.name,
      `${m.providerName} · ${m.family}`,
      `/ai-operations/models/${m.id}`,
      null,
      'Group-wide',
      m.status,
      st.label,
      st.tone,
      kw(m.name, m.id, m.providerName, m.family, m.description),
    );
  });
}

function knowledgeResults(): AiGlobalSearchResult[] {
  const sources = [...(demoKnowledgeSourcesA as KnowledgeSource[]), ...(demoKnowledgeSourcesB as KnowledgeSource[])];
  return sources.map((k) => {
    const st = KNOWLEDGE_STATUS[k.status];
    return make(
      'knowledge',
      'Knowledge',
      k.id,
      k.title,
      `${k.siteName} · ${KNOWLEDGE_SOURCE_TYPE_LABELS[k.type]}`,
      `/ai-operations/knowledge/${k.id}`,
      k.siteId,
      k.siteName,
      k.status,
      st.label,
      st.tone,
      kw(k.title, k.id, k.siteName, KNOWLEDGE_SOURCE_TYPE_LABELS[k.type], k.description, ...k.topics, ...k.keywords),
    );
  });
}

function policyResults(): AiGlobalSearchResult[] {
  return (demoPolicies as AiSecurityPolicy[]).map((p) => {
    const st = POLICY_STATUS[p.status];
    return make(
      'policy',
      'Security',
      p.id,
      p.name,
      `${POLICY_CATEGORY_LABELS[p.category]} · ${p.scope}`,
      `/ai-operations/security/policies/${p.id}`,
      p.siteId,
      p.siteName,
      p.status,
      st.label,
      st.tone,
      kw(p.name, p.id, POLICY_CATEGORY_LABELS[p.category], p.scope, p.description),
    );
  });
}

function alertResults(): AiGlobalSearchResult[] {
  const alerts = [...(demoAlerts as AiAlert[]), ...(demoAlerts2 as AiAlert[])];
  return alerts.map((a) => {
    const st = ALERT_STATUS[a.status];
    return make(
      'alert',
      'Alerts',
      a.id,
      a.title,
      `${a.siteName} · ${ALERT_TYPE_LABELS[a.type]}`,
      `/ai-operations/alerts/${a.id}`,
      a.siteId,
      a.siteName,
      a.status,
      st.label,
      st.tone,
      kw(a.title, a.id, a.incidentId, a.siteName, ALERT_TYPE_LABELS[a.type], a.agentName, a.description),
    );
  });
}

function auditResults(): AiGlobalSearchResult[] {
  const events = [...(demoAuditEvents as AiAuditEvent[]), ...(demoAuditEvents2 as AiAuditEvent[])];
  return events.map((e) => {
    const st = AUDIT_OUTCOME[e.outcome];
    return make(
      'audit',
      'Audit',
      e.id,
      e.action,
      `${e.siteName} · ${AUDIT_EVENT_TYPE_LABELS[e.eventType]}`,
      `/ai-operations/audit/${e.id}`,
      e.siteId,
      e.siteName,
      e.outcome,
      st.label,
      st.tone,
      kw(e.action, e.id, e.siteName, e.agentName, AUDIT_EVENT_TYPE_LABELS[e.eventType], e.decisionReason),
    );
  });
}

function budgetResults(): AiGlobalSearchResult[] {
  return demoBudgets.map((b) => {
    const st = BUDGET_STATUS[b.status];
    return make(
      'budget',
      'Costs/Budgets',
      b.id,
      b.name,
      `${b.scopeLabel} · ${BUDGET_SCOPE_LABELS[b.scope]}`,
      '/ai-operations/costs/budgets',
      b.scopeId,
      b.scopeLabel,
      b.status,
      st.label,
      st.tone,
      kw(b.name, b.id, b.scopeLabel, BUDGET_SCOPE_LABELS[b.scope], b.notes),
    );
  });
}

function notificationRuleResults(): AiGlobalSearchResult[] {
  return (demoNotificationRules as NotificationRule[]).map((r) => {
    const st = NOTIFICATION_RULE_STATUS[r.status];
    return make(
      'notification_rule',
      'Notifications',
      r.id,
      r.name,
      `${r.siteName} · ${r.eventSource}`,
      `/ai-operations/notifications/rules/${r.id}`,
      r.siteId,
      r.siteName,
      r.status,
      st.label,
      st.tone,
      kw(r.name, r.id, r.siteName, r.eventSource, r.eventType, r.description),
    );
  });
}

function scheduleResults(): AiGlobalSearchResult[] {
  const schedules = [...demoSchedulesPart1, ...demoSchedulesPart2];
  return schedules.map((s: AiSchedule) => {
    const st = SCHEDULE_STATUS[s.status];
    return make(
      'schedule',
      'Schedules',
      s.id,
      s.name,
      `${s.siteName} · ${s.agentName}`,
      `/ai-operations/schedules/${s.id}`,
      s.siteId,
      s.siteName,
      s.status,
      st.label,
      st.tone,
      kw(s.name, s.id, s.siteName, s.agentName, TASK_TYPE_LABELS[s.taskType], s.description),
    );
  });
}

// --- Demo fallback index (built once; used only when live data is unavailable) --

export const demoSearchIndex: AiGlobalSearchResult[] = [
  ...siteResults(),
  ...agentResults(),
  ...runResults(),
  ...approvalResults(),
  ...orchestrationResults(),
  ...toolResults(),
  ...modelResults(),
  ...knowledgeResults(),
  ...policyResults(),
  ...alertResults(),
  ...auditResults(),
  ...budgetResults(),
  ...notificationRuleResults(),
  ...scheduleResults(),
];

export const demoSearchIndexByRef: Map<string, AiGlobalSearchResult> = new Map(
  demoSearchIndex.map((r) => [r.referenceId, r]),
);

export function getResultByReferenceId(referenceId: string): AiGlobalSearchResult | undefined {
  return demoSearchIndexByRef.get(referenceId);
}

// --- Live search index builder -------------------------------------------------

function statusDisplay<T extends string>(
  map: Record<T, { tone: StatusTone; label: string }>,
  value: string,
  fallback: T,
): { tone: StatusTone; label: string } {
  return map[value as T] ?? map[fallback];
}

/**
 * Build a searchable index from the live group snapshot (stable keys only — no
 * Supabase UUIDs reach the index). Deterministic local filtering/ranking happens
 * downstream in searchUtils; this runs once per snapshot change, never per
 * keystroke.
 */
export function buildLiveSearchIndex(data: GroupLiveData): AiGlobalSearchResult[] {
  const siteName = (id: string | null) => (id ? (data.siteNameByUuid.get(id) ?? 'Group-wide') : 'Group-wide');
  const siteKey = (id: string | null) => (id ? (data.siteKeyByUuid.get(id) ?? 'group') : 'group');
  const agentName = (id: string | null) => (id ? (data.agentNameByUuid.get(id) ?? '') : '');

  const results: AiGlobalSearchResult[] = [];

  for (const s of data.sites) {
    const st = statusDisplay(SITE_STATUS, s.operational_status, 'unknown');
    results.push(
      make('site', 'Sites', s.site_key, s.name, s.domain ?? s.product_name ?? '', `/ai-operations/sites/${s.site_key}`, s.site_key, s.name, s.operational_status, st.label, st.tone, kw(s.name, s.site_key, s.product_name, s.domain, s.description)),
    );
  }

  for (const a of data.agents) {
    const st = statusDisplay(AGENT_STATUS, a.status ?? '', 'not_configured');
    const cat = AGENT_CATEGORY_LABELS[a.category as keyof typeof AGENT_CATEGORY_LABELS] ?? a.category ?? '';
    const scope = a.site_id ? siteName(a.site_id) : 'Group-wide';
    results.push(
      make('agent', 'Agents', a.agent_key, a.name, `${scope} · ${cat}`, `/ai-operations/agents/${a.agent_key}`, a.site_id ? siteKey(a.site_id) : null, scope, a.status ?? '', st.label, st.tone, kw(a.name, a.agent_key, scope, cat, a.description, a.current_task)),
    );
  }

  for (const r of data.runs) {
    const st = statusDisplay(RUN_STATUS, r.status, 'draft');
    results.push(
      make('run', 'Runs', r.run_key, r.result_summary ?? r.run_key, `${siteName(r.site_id)} · ${agentName(r.agent_id)}`, `/ai-operations/runs/${r.run_key}`, siteKey(r.site_id), siteName(r.site_id), r.status, st.label, st.tone, kw(r.result_summary, r.run_key, siteName(r.site_id), agentName(r.agent_id))),
    );
  }

  for (const a of data.approvals) {
    const st = statusDisplay(APPROVAL_STATUS, a.status, 'draft');
    results.push(
      make('approval', 'Approvals', a.approval_key, a.title ?? a.approval_key, `${siteName(a.site_id)} · ${a.requested_action ?? ''}`, `/ai-operations/approvals/${a.approval_key}`, siteKey(a.site_id), siteName(a.site_id), a.status, st.label, st.tone, kw(a.title, a.approval_key, siteName(a.site_id), agentName(a.agent_id), a.requested_action)),
    );
  }

  for (const o of data.orchestrations) {
    const st = statusDisplay(ORCHESTRATION_STATUS, o.status ?? '', 'received');
    results.push(
      make('orchestration', 'Orchestrations', o.orchestration_key, o.title, `${siteName(o.site_id)} · ${o.request_type ?? ''}`, `/ai-operations/orchestrator/${o.orchestration_key}`, siteKey(o.site_id), siteName(o.site_id), o.status ?? '', st.label, st.tone, kw(o.title, o.orchestration_key, o.correlation_id, siteName(o.site_id))),
    );
  }

  for (const t of data.tools) {
    const st = statusDisplay(TOOL_CONNECTION_STATUS, t.status ?? '', 'unknown');
    results.push(
      make('tool', 'Tools', t.connection_key, t.name, `${t.provider ?? ''} · ${t.scope ?? ''}`, `/ai-operations/tools/${t.connection_key}`, siteKey(t.site_id), t.scope ?? 'Group-wide', t.status ?? '', st.label, st.tone, kw(t.name, t.connection_key, t.provider, t.scope, t.description)),
    );
  }

  for (const m of data.models) {
    const st = statusDisplay(MODEL_STATUS, m.status ?? '', 'unknown');
    results.push(
      make('model', 'Models', m.model_key, m.name, `${m.model_reference ?? ''} · ${m.model_type ?? ''}`, `/ai-operations/models/${m.model_key}`, null, 'Group-wide', m.status ?? '', st.label, st.tone, kw(m.name, m.model_key, m.model_reference, m.description)),
    );
  }

  for (const k of data.knowledge) {
    const st = statusDisplay(KNOWLEDGE_STATUS, k.status ?? '', 'draft');
    const typeLabel = KNOWLEDGE_SOURCE_TYPE_LABELS[k.source_type as keyof typeof KNOWLEDGE_SOURCE_TYPE_LABELS] ?? k.source_type ?? '';
    results.push(
      make('knowledge', 'Knowledge', k.knowledge_key, k.name, `${siteName(k.site_id)} · ${typeLabel}`, `/ai-operations/knowledge/${k.knowledge_key}`, siteKey(k.site_id), siteName(k.site_id), k.status ?? '', st.label, st.tone, kw(k.name, k.knowledge_key, siteName(k.site_id), typeLabel, k.description)),
    );
  }

  for (const p of data.policies) {
    const st = statusDisplay(POLICY_STATUS, p.status ?? '', 'draft');
    const cat = POLICY_CATEGORY_LABELS[p.category as keyof typeof POLICY_CATEGORY_LABELS] ?? p.category ?? '';
    results.push(
      make('policy', 'Security', p.policy_key, p.name, `${cat} · ${p.scope ?? ''}`, `/ai-operations/security/policies/${p.policy_key}`, siteKey(p.site_id), siteName(p.site_id), p.status ?? '', st.label, st.tone, kw(p.name, p.policy_key, cat, p.scope, p.description)),
    );
  }

  for (const al of data.alerts) {
    const st = statusDisplay(ALERT_STATUS, al.status ?? '', 'new');
    const typeLabel = ALERT_TYPE_LABELS[al.alert_type as keyof typeof ALERT_TYPE_LABELS] ?? al.alert_type ?? '';
    results.push(
      make('alert', 'Alerts', al.alert_key, al.title, `${siteName(al.site_id)} · ${typeLabel}`, `/ai-operations/alerts/${al.alert_key}`, siteKey(al.site_id), siteName(al.site_id), al.status ?? '', st.label, st.tone, kw(al.title, al.alert_key, siteName(al.site_id), typeLabel, agentName(al.agent_id), al.summary)),
    );
  }

  for (const e of data.auditEvents) {
    const st = statusDisplay(AUDIT_OUTCOME, e.outcome ?? '', 'informational');
    const typeLabel = AUDIT_EVENT_TYPE_LABELS[e.event_type as keyof typeof AUDIT_EVENT_TYPE_LABELS] ?? e.event_type ?? '';
    results.push(
      make('audit', 'Audit', e.audit_key, e.action ?? e.audit_key, `${siteName(e.site_id)} · ${typeLabel}`, `/ai-operations/audit/${e.audit_key}`, siteKey(e.site_id), siteName(e.site_id), e.outcome ?? '', st.label, st.tone, kw(e.action, e.audit_key, siteName(e.site_id), agentName(e.agent_id), typeLabel, e.decision_reason)),
    );
  }

  for (const b of data.budgets) {
    const st = statusDisplay(BUDGET_STATUS, b.status, 'not_configured');
    const scopeLabel = BUDGET_SCOPE_LABELS[b.scope_type as keyof typeof BUDGET_SCOPE_LABELS] ?? b.scope_type;
    results.push(
      make('budget', 'Costs/Budgets', b.budget_key, b.name, `${b.scope_reference ?? ''} · ${scopeLabel}`, '/ai-operations/costs/budgets', siteKey(b.site_id), scopeLabel, b.status, st.label, st.tone, kw(b.name, b.budget_key, b.scope_reference, scopeLabel, b.notes)),
    );
  }

  for (const r of data.rules) {
    const st = statusDisplay(NOTIFICATION_RULE_STATUS, r.status ?? '', 'draft');
    results.push(
      make('notification_rule', 'Notifications', r.rule_key, r.name, `${siteName(r.site_id)} · ${r.event_type ?? ''}`, `/ai-operations/notifications/rules/${r.rule_key}`, siteKey(r.site_id), siteName(r.site_id), r.status ?? '', st.label, st.tone, kw(r.name, r.rule_key, siteName(r.site_id), r.event_type, r.description)),
    );
  }

  for (const sc of data.schedules) {
    const st = statusDisplay(SCHEDULE_STATUS, sc.status ?? '', 'draft');
    results.push(
      make('schedule', 'Schedules', sc.schedule_key, sc.name, `${siteName(sc.site_id)} · ${agentName(sc.agent_id)}`, `/ai-operations/schedules/${sc.schedule_key}`, siteKey(sc.site_id), siteName(sc.site_id), sc.status ?? '', st.label, st.tone, kw(sc.name, sc.schedule_key, siteName(sc.site_id), agentName(sc.agent_id))),
    );
  }

  return results;
}
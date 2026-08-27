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

// --- The single searchable index (built once) ----------------------------------

export const searchIndex: AiGlobalSearchResult[] = [
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

export const searchIndexByRef: Map<string, AiGlobalSearchResult> = new Map(
  searchIndex.map((r) => [r.referenceId, r]),
);

export function getResultByReferenceId(referenceId: string): AiGlobalSearchResult | undefined {
  return searchIndexByRef.get(referenceId);
}
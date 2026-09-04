import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import {
  getN8nSummary,
  getN8nInstances,
  getN8nWorkflows,
  getWorkflowCategories,
  getSiteAutomation,
  getFailedWorkflows,
  getRunningWorkflows,
  getN8nGaps,
  N8N_INSTANCE_META,
  type N8nInstanceState,
  type N8nInstanceCard,
} from '@/pages/ai-operations/wallboard/n8nSelectors';

const STATE_TEXT: Record<N8nInstanceState, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  offline: 'text-red-400',
  unknown: 'text-secondary-300',
  not_configured: 'text-secondary-300',
};

const STATE_BADGE: Record<N8nInstanceState, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-red-400 bg-red-500/10 border-red-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  not_configured: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const TONE_TEXT: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

const RISK_TEXT: Record<string, string> = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
};

const RUNTIME_STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  review_required: 'Review required',
  pending: 'Pending',
  not_configured: 'Not configured',
};

function fmtSeen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function InstanceBadge({ state }: { state: N8nInstanceState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[state]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {N8N_INSTANCE_META[state].label}
    </span>
  );
}

function InstancePanel({ instance }: { instance: N8nInstanceCard }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-git-branch-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Instance
        </h4>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{instance.name}</p>
            <p className="text-[11px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
              Runtime path · {instance.runtimePath}
            </p>
          </div>
          <InstanceBadge state={instance.state} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
            <p className="text-[10px] font-label text-foreground-600 uppercase">Configured</p>
            <p className={`text-sm font-heading font-semibold mt-0.5 ${instance.configured ? 'text-emerald-400' : 'text-secondary-300'}`}>
              {instance.configured ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
            <p className="text-[10px] font-label text-foreground-600 uppercase">Reachable</p>
            <p className={`text-sm font-heading font-semibold mt-0.5 ${instance.reachable === true ? 'text-emerald-400' : instance.reachable === false ? 'text-red-400' : 'text-secondary-300'}`}>
              {instance.reachable === true ? 'Yes' : instance.reachable === false ? 'No' : '—'}
            </p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
            <p className="text-[10px] font-label text-foreground-600 uppercase">Authenticated</p>
            <p className={`text-sm font-heading font-semibold mt-0.5 ${instance.authenticated === true ? 'text-emerald-400' : instance.authenticated === false ? 'text-amber-400' : 'text-secondary-300'}`}>
              {instance.authenticated === true ? 'Yes' : instance.authenticated === false ? 'Failed' : '—'}
            </p>
          </div>
        </div>

        {instance.error && (
          <p className="mt-3 text-[11px] font-label text-amber-400 leading-tight bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2">
            {instance.error}
          </p>
        )}
      </div>
    </section>
  );
}

function WorkflowRow({ workflow }: { workflow: ReturnType<typeof getN8nWorkflows>[number] }) {
  const statusLabel = RUNTIME_STATUS_LABEL[workflow.runtimeStatus] ?? (workflow.runtimeStatus || '—');
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{workflow.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">
            {workflow.workflowType}
          </span>
          {workflow.site !== 'Unassigned' && (
            <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">· {workflow.site}</span>
          )}
          <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">· {statusLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-label font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap ${
            workflow.enabled
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
              : 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${workflow.enabled ? 'bg-emerald-400' : 'bg-secondary-300'}`}></span>
          {workflow.enabled ? 'Active' : 'Inactive'}
        </span>
        {workflow.riskLevel && (
          <span className={`w-2 h-2 rounded-full ${RISK_TEXT[workflow.riskLevel] ?? 'bg-secondary-300'}`} title={`Risk: ${workflow.riskLevel}`}></span>
        )}
      </div>
    </div>
  );
}

function FailuresPanel() {
  const failures = getFailedWorkflows();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-error-warning-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Failed Workflows
        </h4>
      </div>
      <div className="p-4">
        {failures.length === 0 ? (
          <p className="text-sm font-label text-foreground-500">No failed executions recorded.</p>
        ) : (
          <div className="space-y-2">
            {failures.map((f) => (
              <div key={f.workflow} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{f.workflow}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                    {f.consecutiveFailures}×
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">{f.site}</span>
                  <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">· Failed {fmtSeen(f.failureTime)}</span>
                  {f.lastSuccess && (
                    <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">· Last OK {fmtSeen(f.lastSuccess)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityPanel() {
  const running = getRunningWorkflows();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-play-circle-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Current Activity
        </h4>
      </div>
      <div className="p-4">
        {running.length === 0 ? (
          <p className="text-sm font-label text-foreground-500">No workflows running.</p>
        ) : (
          <div className="space-y-2">
            {running.map((r) => (
              <div key={r.workflow} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{r.workflow}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
                    {r.site} · since {fmtSeen(r.startedAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-label font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  RUNNING
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SiteAutomationPanel() {
  const sites = getSiteAutomation();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-global-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Site Automation
        </h4>
      </div>
      <div className="p-4">
        {sites.length === 0 ? (
          <p className="text-sm font-label text-foreground-500">No site workflow mappings registered.</p>
        ) : (
          <div className="space-y-2">
            {sites.map((s) => (
              <div key={s.site} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{s.site}</p>
                <span className="text-[11px] font-label text-foreground-500 whitespace-nowrap shrink-0">
                  {s.enabledCount}/{s.workflowCount} active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function GapsPanel() {
  const gaps = getN8nGaps();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-alert-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Monitoring Gaps
        </h4>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2.5">
        <p className="text-[11px] font-label text-foreground-600 leading-tight">
          Metrics with no authoritative source. These are not monitored — never assumed healthy.
        </p>
        {gaps.map((g) => (
          <div key={g.area} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{g.area}</p>
              <p className="text-[11px] font-label text-foreground-500 truncate">{g.note}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border border-secondary-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
              NOT MONITORED
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function N8nView() {
  const data = useN8nData();
  const summary = getN8nSummary();
  const instances = getN8nInstances();
  const workflows = getN8nWorkflows();
  const categories = getWorkflowCategories();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Automation &amp; Workflows
          </h3>
          {!data.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only monitoring · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip — readable from across the room */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Instances" value={summary.instances} tone="text-foreground-100" icon="ri-git-branch-line" />
        <SummaryStat label="Active Workflows" value={summary.activeWorkflows} tone="text-emerald-400" icon="ri-play-list-line" />
        <SummaryStat label="Running" value={summary.running} tone={summary.running > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-play-circle-line" />
        <SummaryStat label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Queued" value={summary.queued} tone="text-secondary-300" icon="ri-time-line" />
        <SummaryStat label="Executions" value={summary.totalExecutions} tone="text-foreground-100" icon="ri-history-line" />
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-git-branch-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Instances Online" value={summary.instancesOnline} />
          <SummaryCount label="Active Workflows" value={summary.activeWorkflows} />
          <SummaryCount label="Failed" value={summary.failed} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading automation status…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Workflows (left) */}
          <div className="col-span-8 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-play-list-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Registered Workflows
                </h4>
              </div>
              {workflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
                  <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
                    <i className="ri-git-branch-line text-xl w-5 h-5 flex items-center justify-center"></i>
                  </span>
                  <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">No workflows registered</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">
                    No workflows are currently registered in the automation registry. An empty registry is never shown as healthy.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workflows.map((w) => (
                    <WorkflowRow key={w.key} workflow={w} />
                  ))}
                </div>
              )}
            </section>

            {categories.length > 0 && (
              <section className="shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                    <i className="ri-folder-open-line text-base w-4 h-4 flex items-center justify-center"></i>
                  </span>
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                    Categories
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <span
                      key={c.label}
                      className="inline-flex items-center gap-1.5 text-[11px] font-label text-secondary-300 bg-secondary-500/10 border border-secondary-500/25 rounded-full px-2.5 py-1 whitespace-nowrap"
                    >
                      <i className="ri-folder-line w-3 h-3 flex items-center justify-center"></i>
                      {c.label} · {c.count}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Instance + activity + failures + site + gaps (right) */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            {instances.map((i) => (
              <InstancePanel key={i.key} instance={i} />
            ))}
            <ActivityPanel />
            <FailuresPanel />
            <SiteAutomationPanel />
            <GapsPanel />
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: string;
}) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[84px]">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${tone}`}>
          <i className={`${icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      </div>
      <p className={`text-3xl font-heading font-bold ${tone} leading-none tabular-nums mt-2`}>{value}</p>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-2xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}
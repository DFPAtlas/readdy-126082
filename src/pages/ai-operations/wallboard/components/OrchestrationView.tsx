import {
  getOrchestrationTopology,
  getSiteLanes,
  getWorkflowBindings,
  getRoutingQueue,
  getRoutesExecuting,
  getRoutesWaitingApproval,
  getFailedRouting,
  getRecentlyCompletedRouting,
  getActiveRoutes,
  getCrossSiteWork,
  getApprovalGates,
  getConfigurationIssues,
  getRuntimeFailures,
  getWorkerAggregates,
  getOrchestrationSummary,
  getOrchestrationGaps,
  LINK_STATE_META,
  type LinkState,
  type TopologyLayer,
  type SiteLane,
} from '@/pages/ai-operations/wallboard/orchestrationSelectors';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { MASTER_AGENT_STATE_META, type MasterAgentState } from '@/pages/ai-operations/wallboard/masterAgentsSelectors';

const SOURCE_BADGE: Record<'live' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const LINK_BADGE: Record<LinkState, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  active: 'text-accent-400 bg-accent-500/10 border-accent-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  broken: 'text-red-400 bg-red-500/10 border-red-500/30',
  not_configured: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SUMMARY_TONE: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

const SITE_STATUS_TONE: Record<string, string> = {
  healthy: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  offline: 'text-red-400',
  maintenance: 'text-accent-400',
  unknown: 'text-secondary-300',
};

function StateBadge({ state }: { state: LinkState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${LINK_BADGE[state]}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${state === 'active' ? 'motion-safe:animate-pulse' : ''}`}></span>
      {LINK_STATE_META[state].label}
    </span>
  );
}

function MasterStateBadge({ state }: { state: MasterAgentState }) {
  const meta = MASTER_AGENT_STATE_META[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${
      state === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
        : state === 'degraded' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : state === 'offline' ? 'text-red-400 bg-red-500/10 border-red-500/30'
            : 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25'
    }`}>
      <span className="w-1 h-1 rounded-full bg-current"></span>
      {meta.label}
    </span>
  );
}

function PanelHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
        <i className={`${icon} text-base w-4 h-4 flex items-center justify-center`}></i>
      </span>
      <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-[11px] font-label text-foreground-500 py-1 leading-tight">{text}</p>;
}

export default function OrchestrationView() {
  useN8nData();
  useRuntimeHealth();
  const data = useGroupLiveData();

  const summary = getOrchestrationSummary();
  const topology = getOrchestrationTopology();
  const lanes = getSiteLanes();
  const bindings = getWorkflowBindings();
  const queue = getRoutingQueue();
  const executing = getRoutesExecuting();
  const waitingApproval = getRoutesWaitingApproval();
  const failed = getFailedRouting();
  const completed = getRecentlyCompletedRouting();
  const activeRoutes = getActiveRoutes();
  const crossSite = getCrossSiteWork();
  const approvalGates = getApprovalGates();
  const configIssues = getConfigurationIssues();
  const runtimeFailures = getRuntimeFailures();
  const workerAggregates = getWorkerAggregates();
  const gaps = getOrchestrationGaps();

  const bindingBySite = new Map(bindings.map((b) => [b.siteId, b]));

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Cross-Site Orchestration &amp; Workflow Map
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only topology · controls live in the Autonomous Manager · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-route-line text-xl w-5 h-5 flex items-center justify-center ${SUMMARY_TONE[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${SUMMARY_TONE[summary.tone]}`}>
            {summary.label}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Sites" value={summary.sitesConnected} />
          <SummaryCount label="Master Agents" value={`${summary.masterAgentsHealthy}/${summary.masterAgentsTotal}`} />
          <SummaryCount label="Workflows" value={`${summary.workflowsHealthy}/${summary.workflowsTotal}`} tone={summary.workflowsHealthy === summary.workflowsTotal ? undefined : 'text-amber-400'} />
          <SummaryCount label="Routes Active" value={summary.routesActive} tone={summary.routesActive > 0 ? 'text-accent-400' : undefined} />
          <SummaryCount label="Waiting" value={summary.routesWaiting} tone={summary.routesWaiting > 0 ? 'text-amber-400' : undefined} />
          <SummaryCount label="Failures" value={summary.failures} tone={summary.failures > 0 ? 'text-red-400' : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Column 1 — Route map (topology) + configuration issues */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-node-tree" title="System Connection Map" />
            <div className="p-3">
              <TopologyList nodes={topology} />
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-settings-3-line" title="Configuration Integrity" />
            <div className="p-4 space-y-1.5">
              {configIssues.length === 0 ? (
                <EmptyNote text="No configuration problems detected — every site has a master agent and a primary workflow." />
              ) : (
                configIssues.map((issue) => (
                  <div key={`${issue.site}-${issue.title}`} className="flex items-start gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <span className="text-amber-400 mt-0.5">
                      <i className="ri-alert-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-label font-semibold text-foreground-100 leading-tight">
                        {issue.site} · {issue.title}
                      </p>
                      <p className="text-[10px] font-label text-foreground-500 leading-tight mt-0.5">{issue.detail}</p>
                    </div>
                  </div>
                ))
              )}
              <p className="text-[10px] font-label text-foreground-500 pt-1 leading-tight">
                Structural problems are shown separately from runtime failures — never fabricated as runtime errors.
              </p>
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-error-warning-line" title="Data Scope &amp; Gaps" />
            <div className="p-4 space-y-1.5">
              {gaps.map((g) => (
                <div key={g.area} className="flex items-start gap-2">
                  <span className="text-foreground-500 mt-0.5">
                    <i className="ri-information-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  </span>
                  <p className="text-[11px] font-label text-foreground-500 leading-tight">
                    <span className="text-foreground-300 font-semibold">{g.area}.</span> {g.note}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Column 2 — Site lanes */}
        <div className="col-span-4 min-h-0 flex flex-col">
          <section className="flex-1 min-h-0 bg-background-100 border border-background-200/60 rounded-lg flex flex-col">
            <PanelHeading icon="ri-layout-grid-line" title="Site Lanes" />
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {lanes.map((lane) => (
                <SiteLaneCard key={lane.siteId} lane={lane} workers={workerAggregates.find((w) => w.siteName === lane.siteName)} binding={bindingBySite.get(lane.siteId) ?? null} />
              ))}
            </div>
          </section>
        </div>

        {/* Column 3 — Flow activity */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto pl-1">
          {/* Routing queue */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-flow-chart" title="Routing Queue" />
            <div className="p-4">
              <div className="grid grid-cols-5 gap-2 text-center">
                <MiniCell label="Queued" value={queue.length} tone={queue.length > 0 ? 'text-amber-400' : 'text-foreground-200'} />
                <MiniCell label="Executing" value={executing.length} tone={executing.length > 0 ? 'text-accent-400' : 'text-foreground-200'} />
                <MiniCell label="Approval" value={waitingApproval.length} tone={waitingApproval.length > 0 ? 'text-amber-400' : 'text-foreground-200'} />
                <MiniCell label="Failed" value={failed.length} tone={failed.length > 0 ? 'text-red-400' : 'text-foreground-200'} />
                <MiniCell label="Completed" value={completed.length} tone="text-emerald-400" />
              </div>

              {waitingApproval.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Waiting approval</p>
                  {waitingApproval.map((r) => (
                    <RouteRow key={r.key} title={r.title} site={r.site} meta={r.classification} tone="text-amber-400" />
                  ))}
                </div>
              )}

              {failed.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Failed routing</p>
                  {failed.map((r) => (
                    <RouteRow key={r.key} title={r.title} site={r.site} meta={r.classification} tone="text-red-400" />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Active routes */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-pulse-line" title="Active Routes" />
            <div className="p-4 space-y-1.5">
              {activeRoutes.length === 0 ? (
                <EmptyNote text="No runs are currently moving through the architecture." />
              ) : (
                activeRoutes.slice(0, 8).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      r.status === 'working' ? 'bg-accent-400 motion-safe:animate-pulse' : 'bg-amber-400'
                    }`}></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-label text-foreground-100 leading-tight truncate">{r.task}</p>
                      <p className="text-[10px] font-label text-foreground-500 mt-0.5 whitespace-nowrap">
                        {r.site} · {r.agent} · <span className="uppercase">{r.status}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Approval gates */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-git-pull-request-line" title="Approval Gates" />
            <div className="p-4 space-y-1.5">
              {approvalGates.length === 0 ? (
                <EmptyNote text="No orchestration is waiting for human approval." />
              ) : (
                approvalGates.slice(0, 6).map((g) => (
                  <div key={g.key} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-label text-foreground-100 leading-tight truncate">{g.title}</p>
                      <p className="text-[10px] font-label text-foreground-500 mt-0.5 whitespace-nowrap">{g.site}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-amber-500/25 text-[9px] font-label font-semibold text-amber-400 whitespace-nowrap">
                      WAITING APPROVAL
                    </span>
                  </div>
                ))
              )}
              <p className="text-[10px] font-label text-foreground-500 pt-1 leading-tight">
                Approval/rejection is performed in the control interface — never from this wall.
              </p>
            </div>
          </section>

          {/* Cross-site work */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-global-line" title="Cross-Site Work" />
            <div className="p-4 space-y-1.5">
              {crossSite.length === 0 ? (
                <EmptyNote text="No group-wide operations currently span multiple sites." />
              ) : (
                crossSite.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <span className="text-secondary-300">
                      <i className="ri-share-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-label text-foreground-100 leading-tight truncate">{c.title}</p>
                      <p className="text-[10px] font-label text-foreground-500 mt-0.5 whitespace-nowrap">
                        group-wide · {c.classification} · <span className="uppercase">{c.status}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Runtime failures */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-close-circle-line" title="Runtime Failures" />
            <div className="p-4 space-y-1.5">
              {runtimeFailures.length === 0 ? (
                <EmptyNote text="No runtime failures are currently recorded." />
              ) : (
                runtimeFailures.slice(0, 6).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <span className="text-red-400 mt-0.5">
                      <i className="ri-close-circle-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-label text-foreground-100 leading-tight truncate">{f.title}</p>
                      <p className="text-[10px] font-label text-foreground-500 mt-0.5 whitespace-nowrap">{f.site}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TopologyList({ nodes }: { nodes: TopologyLayer[] }) {
  return (
    <div className="space-y-0">
      {nodes.map((n, i) => (
        <div key={n.key}>
          <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{n.name}</p>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{n.role}</p>
              </div>
              <StateBadge state={n.state} />
            </div>
            <p className="text-[10px] font-label text-foreground-500 mt-1.5 leading-tight truncate">{n.detail}</p>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="h-3 w-px bg-background-300/60"></span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[8px] font-label font-semibold whitespace-nowrap ${LINK_BADGE[nodes[i + 1].linkState]}`}>
                {LINK_STATE_META[nodes[i + 1].linkState].label}
              </span>
              <span className="h-3 w-px bg-background-300/60"></span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SiteLaneCard({
  lane,
  workers,
  binding,
}: {
  lane: SiteLane;
  workers?: { total: number; active: number; failed: number; waiting: number };
  binding: { state: 'connected' | 'missing' | 'multiple' | 'unavailable'; primaryWorkflow: string | null; n8nReference: string | null } | null;
}) {
  const workflowLabel =
    binding?.primaryWorkflow ?? (binding?.n8nReference ? `planned: ${binding.n8nReference}` : null);

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-3.5 py-3">
      {/* Site + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-base font-heading font-semibold text-foreground-50 truncate">{lane.siteName}</p>
          <span className={`text-[10px] font-label font-semibold uppercase tracking-wide whitespace-nowrap ${SITE_STATUS_TONE[lane.siteStatus] ?? 'text-foreground-500'}`}>
            {lane.siteStatus}
          </span>
          {lane.criticality === 'critical' && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-red-500/25 text-[9px] font-label font-semibold text-red-400 whitespace-nowrap">
              critical
            </span>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {lane.activeTasks > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-accent-500/25 text-[9px] font-label font-semibold text-accent-400 whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-current motion-safe:animate-pulse"></span>
              {lane.activeTasks} active
            </span>
          )}
          <MasterStateBadge state={lane.masterState} />
        </div>
      </div>

      {/* Lane chain: master → workflow → work */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        <Chip label="Master" value={lane.masterAgentName ?? 'NO MASTER AGENT'} tone={lane.masterAgentName ? 'text-foreground-100' : 'text-amber-400'} />
        <span className="text-foreground-500">
          <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
        </span>
        <Chip
          label="Workflow"
          value={workflowLabel ?? 'NOT REGISTERED'}
          tone={
            binding?.state === 'connected' ? 'text-emerald-400'
              : binding?.state === 'multiple' ? 'text-red-400'
                : 'text-amber-400'
          }
        />
        <span className="text-foreground-500">
          <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
        </span>
        <span className="text-[11px] font-label text-foreground-300 leading-tight truncate">
          {lane.currentWork ?? 'idle'}
        </span>
      </div>

      {/* Worker aggregate */}
      {workers && (
        <p className="text-[10px] font-label text-foreground-500 mt-2 whitespace-nowrap">
          <span className="text-foreground-300 font-semibold">{workers.total} worker{workers.total === 1 ? '' : 's'}</span>
          {' · '}
          <span className="text-emerald-400">{workers.active} active</span>
          {workers.failed > 0 && <span className="text-red-400"> · {workers.failed} failed</span>}
          {workers.waiting > 0 && <span> · {workers.waiting} waiting</span>}
        </p>
      )}
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-background-200/40 max-w-[180px]">
      <span className="text-[8px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-[11px] font-label font-semibold truncate ${tone}`}>{value}</span>
    </span>
  );
}

function RouteRow({ title, site, meta, tone }: { title: string; site: string; meta: string; tone: string }) {
  return (
    <div className="flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone}`}></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-label text-foreground-100 leading-tight truncate">{title}</p>
        <p className="text-[10px] font-label text-foreground-500 mt-0.5 whitespace-nowrap">{site} · {meta}</p>
      </div>
    </div>
  );
}

function MiniCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-bold tabular-nums mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}

function SummaryCount({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}
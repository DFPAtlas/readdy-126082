import { Link } from 'react-router-dom';
import {
  getSiteMasterCards,
  getGroupOrchestrator,
  getMasterAgentSummary,
  getMasterAgentGaps,
  MASTER_AGENT_STATE_META,
  WORKFLOW_MAPPING_META,
  ASSIGNMENT_ISSUE_META,
  type MasterAgentState,
  type SiteMasterCard,
} from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';

const SOURCE_BADGE: Record<'live' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_BADGE: Record<MasterAgentState, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  idle: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  waiting: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-red-400 bg-red-500/10 border-red-500/30',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  not_assigned: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SITE_STATUS_TONE: Record<string, string> = {
  healthy: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  offline: 'text-red-400',
  maintenance: 'text-accent-400',
  unknown: 'text-secondary-300',
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

function StateBadge({ state }: { state: MasterAgentState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[state]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {MASTER_AGENT_STATE_META[state].label}
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

export default function MasterAgentsView() {
  useN8nData();
  const data = useGroupLiveData();

  const summary = getMasterAgentSummary();
  const group = getGroupOrchestrator();
  const cards = getSiteMasterCards();
  const gaps = getMasterAgentGaps();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Master Agents · One per Site
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          observation only · controls live in the Autonomous Manager · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className="ri-robot-2-line text-xl w-5 h-5 flex items-center justify-center text-accent-400"></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-50">
            {summary.sitesTotal} sites · {summary.masterAgentsTotal} master agent{summary.masterAgentsTotal === 1 ? '' : 's'}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {summary.unassignedSites > 0
              ? `${summary.unassignedSites} site${summary.unassignedSites === 1 ? '' : 's'} without a master agent`
              : 'All sites assigned'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Sites" value={summary.sitesTotal} />
          <SummaryCount label="Active" value={summary.active} tone="text-emerald-400" />
          <SummaryCount label="Idle" value={summary.idle} />
          <SummaryCount label="Degraded" value={summary.degraded} tone={summary.degraded > 0 ? 'text-amber-400' : undefined} />
          <SummaryCount label="Unassigned" value={summary.unassignedSites} tone={summary.unassignedSites > 0 ? 'text-amber-400' : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left: per-site master cards */}
        <div className="col-span-7 min-h-0 flex flex-col">
          <section className="flex-1 min-h-0 bg-background-100 border border-background-200/60 rounded-lg flex flex-col">
            <PanelHeading icon="ri-building-2-line" title="Site Master Agents" />
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {cards.map((card) => (
                <SiteMasterRow key={card.siteId} card={card} />
              ))}
            </div>
          </section>
        </div>

        {/* Right: group orchestrator + issues + autonomous manager + gaps */}
        <div className="col-span-5 min-h-0 flex flex-col gap-3 overflow-y-auto">
          {/* Group master orchestrator */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-git-branch-line" title="Group Master Orchestrator" />
            <div className="p-4">
              {!group ? (
                <p className="text-[11px] font-label text-foreground-500 leading-tight">
                  No group-level master orchestrator is registered.
                </p>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-heading font-bold text-foreground-50 truncate">{group.name}</p>
                      <p className="text-[11px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
                        {group.agentKey} · group-wide orchestration
                      </p>
                    </div>
                    <StateBadge state={group.state} />
                  </div>
                  <div className="mt-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                    <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Current work</p>
                    <p className="text-[12px] font-label text-foreground-200 mt-0.5 leading-tight">{group.currentTask ?? 'Standing by'}</p>
                    <p className="text-[10px] font-label text-foreground-500 mt-1.5 whitespace-nowrap">
                      last activity {fmtSeen(group.lastActivity)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Assignment issues */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-alert-line" title="Assignment Issues" />
            <div className="p-4 space-y-1.5">
              {cards.filter((c) => c.assignmentIssue !== 'none').length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500 leading-tight">
                  No assignment problems detected.
                </p>
              ) : (
                cards
                  .filter((c) => c.assignmentIssue !== 'none')
                  .map((c) => (
                    <div key={c.siteId} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                      <span className="text-[12px] font-label text-foreground-200 whitespace-nowrap truncate">{c.siteName}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${
                        c.assignmentIssue === 'multiple_master_agents'
                          ? 'text-red-400 bg-red-500/10 border-red-500/25'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                      }`}>
                        {ASSIGNMENT_ISSUE_META[c.assignmentIssue].label}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </section>

          {/* Autonomous Manager */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-external-link-line" title="Control Interface" />
            <div className="p-4">
              <p className="text-[11px] font-label text-foreground-500 leading-tight">
                This wallboard is <span className="text-foreground-200 font-semibold">observation only</span>. Master
                Agent controls remain in the Autonomous Manager (not yet routed) and the Central Agent Registry.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link
                  to="/ai-operations/agents"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 bg-background-200/60 text-[11px] font-label font-semibold text-foreground-100 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-robot-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Open Central Agent Registry
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border border-secondary-500/25 text-[9px] font-label font-semibold text-secondary-300 whitespace-nowrap">
                  <i className="ri-information-line w-3 h-3 flex items-center justify-center"></i>
                  Autonomous Manager not yet routed
                </span>
              </div>
            </div>
          </section>

          {/* Gaps */}
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
      </div>
    </main>
  );
}

function SiteMasterRow({ card }: { card: SiteMasterCard }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-heading font-semibold text-foreground-50 truncate">{card.siteName}</p>
            <span className={`text-[10px] font-label font-semibold uppercase tracking-wide whitespace-nowrap ${SITE_STATUS_TONE[card.siteStatus] ?? 'text-foreground-500'}`}>
              {card.siteStatus}
            </span>
            {card.criticality === 'critical' && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-red-500/25 text-[9px] font-label font-semibold text-red-400 whitespace-nowrap">
                critical
              </span>
            )}
          </div>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
            AI {card.aiStatus} · workflow ref {card.n8nReference ?? 'none'}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${
            card.workflowMapping === 'connected'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
              : 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25'
          }`}>
            <span className="w-1 h-1 rounded-full bg-current"></span>
            {WORKFLOW_MAPPING_META[card.workflowMapping].label}
          </span>
          <StateBadge state={card.masterAgentState} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 mt-3">
        <div className="col-span-4">
          <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Master Agent</p>
          <p className="text-[12px] font-label text-foreground-100 truncate mt-0.5">
            {card.masterAgentName ?? '—'}
          </p>
          {card.masterAgentKey && (
            <p className="text-[9px] font-label text-foreground-500 truncate whitespace-nowrap">{card.masterAgentKey}</p>
          )}
        </div>
        <div className="col-span-4">
          <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Current work</p>
          <p className="text-[11px] font-label text-foreground-200 truncate mt-0.5 leading-tight">
            {card.masterAgentName ? (card.currentTask ?? 'Standing by') : '—'}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Workers</p>
          <p className="text-[12px] font-label text-foreground-100 tabular-nums mt-0.5">
            {card.workersTotal}
          </p>
          <p className="text-[9px] font-label whitespace-nowrap mt-0.5">
            <span className="text-emerald-400">{card.workersActive} active</span>
            {card.workersFailed > 0 && <span className="text-red-400"> · {card.workersFailed} failed</span>}
            {card.workersWaiting > 0 && <span className="text-foreground-500"> · {card.workersWaiting} waiting</span>}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Last activity</p>
          <p className="text-[11px] font-label text-foreground-200 whitespace-nowrap mt-0.5">
            {fmtSeen(card.lastActivity)}
          </p>
          <p className="text-[9px] font-label text-foreground-500 whitespace-nowrap mt-0.5">
            {card.modelReference ?? 'no model ref'}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCount({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}
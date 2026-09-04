import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import {
  getWorkloadSummary,
  getTeamWorkload,
  getBlockers,
  getOldestPending,
  getRecentCompletions,
  type WorkloadSectionStatus,
  type TeamWorkload,
  type WorkloadBlocker,
  type OldestPending,
} from '@/pages/ai-operations/wallboard/workloadSelectors';

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

function SummaryStat({
  label,
  value,
  tone,
  icon,
  status,
}: {
  label: string;
  value: number;
  tone: string;
  icon: string;
  status: WorkloadSectionStatus;
}) {
  const unavailable = status === 'unavailable';
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[84px]">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${tone}`}>
          <i className={`${icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      </div>
      {unavailable ? (
        <p className="text-sm font-heading font-semibold text-foreground-500 mt-2 leading-tight">Unavailable</p>
      ) : (
        <p className={`text-3xl font-heading font-bold ${tone} leading-none tabular-nums mt-2`}>{value}</p>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: TeamWorkload }) {
  const unavailable = team.status === 'unavailable';
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 flex flex-col min-h-[96px]">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className={`${team.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
        </span>
        <p className="text-[11px] font-label font-semibold text-foreground-600 uppercase tracking-wide whitespace-nowrap">
          {team.name}
        </p>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        {unavailable ? (
          <p className="text-sm font-heading font-semibold text-foreground-500">Unavailable</p>
        ) : (
          <>
            <p className="text-3xl font-heading font-bold text-foreground-100 tabular-nums leading-none">{team.primary}</p>
            <p className="text-[11px] font-label text-foreground-600 uppercase whitespace-nowrap">{team.primaryLabel}</p>
          </>
        )}
      </div>
      {!unavailable && (
        <p className="text-[11px] font-label text-foreground-600 mt-1 whitespace-nowrap">{team.detail}</p>
      )}
    </div>
  );
}

function BlockerRow({ blocker }: { blocker: WorkloadBlocker }) {
  const tone =
    blocker.severity === 'critical'
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : blocker.severity === 'high'
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        : 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25';
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{blocker.label}</p>
        <p className="text-[11px] font-label text-foreground-600 truncate">{blocker.detail}</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[11px] font-label font-semibold tabular-nums whitespace-nowrap ${tone}`}>
        {blocker.count}
      </span>
    </div>
  );
}

function OldestRow({ item }: { item: OldestPending }) {
  const unavailable = item.status === 'unavailable';
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <p className="text-[11px] font-label text-foreground-600 uppercase whitespace-nowrap">{item.label}</p>
      <p className={`text-sm font-heading font-semibold whitespace-nowrap ${unavailable ? 'text-foreground-500' : 'text-foreground-100'}`}>
        {unavailable ? 'Unavailable' : item.value}
      </p>
    </div>
  );
}

export default function WorkloadView() {
  useGroupLiveData();
  const wl = useWorkloadData();
  const summary = getWorkloadSummary();
  const teams = getTeamWorkload();
  const blockers = getBlockers();
  const oldest = getOldestPending();
  const completions = getRecentCompletions();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Operations Workload
          </h3>
          {!wl.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · aggregate only · last refresh {wl.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary — readable from across the room */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-dashboard-3-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Staff Active" value={summary.activeStaff} status={summary.staffStatus} />
          <SummaryCount label="Overdue" value={summary.overdueProjects} tone={summary.overdueProjects > 0 ? 'text-amber-400' : 'text-foreground-100'} />
          <SummaryCount label="Urgent" value={summary.urgentTickets} tone={summary.urgentTickets > 0 ? 'text-amber-400' : 'text-foreground-100'} />
          <SummaryCount label="Failed AI" value={summary.failedTasks} tone={summary.failedTasks > 0 ? 'text-red-400' : 'text-foreground-100'} />
        </div>
      </div>

      {/* Primary workload strip */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-3">
        <SummaryStat label="Active Projects" value={summary.activeProjects} tone="text-accent-400" icon="ri-rocket-2-line" status={summary.projectsStatus} />
        <SummaryStat label="Open Tickets" value={summary.openTickets} tone="text-foreground-100" icon="ri-customer-service-2-line" status={summary.ticketsStatus} />
        <SummaryStat label="Unassigned" value={summary.unassignedTickets} tone="text-secondary-300" icon="ri-user-unfollow-line" status={summary.ticketsStatus} />
        <SummaryStat label="Active UAT" value={summary.activeUat} tone="text-accent-400" icon="ri-flask-line" status={summary.uatStatus} />
        <SummaryStat label="Pending Approvals" value={summary.pendingApprovals} tone={summary.pendingApprovals > 0 ? 'text-amber-400' : 'text-foreground-100'} icon="ri-shield-check-line" status={summary.approvalsStatus} />
        <SummaryStat label="Running Tasks" value={summary.runningTasks} tone="text-emerald-400" icon="ri-play-circle-line" status={summary.aiStatus} />
        <SummaryStat label="Queued Tasks" value={summary.queuedTasks} tone="text-foreground-100" icon="ri-stack-line" status={summary.aiStatus} />
        <SummaryStat label="Agents Active" value={summary.agentsActive} tone="text-accent-400" icon="ri-robot-2-line" status={summary.aiStatus} />
      </div>

      {wl.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading workload data…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Team workload + blockers */}
          <div className="col-span-7 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-team-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Team Workload
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {teams.map((team) => (
                  <TeamCard key={team.key} team={team} />
                ))}
              </div>
            </section>

            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-alert-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Blockers &amp; Attention
                </h4>
              </div>
              {blockers.length === 0 ? (
                <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-6 text-center">
                  <p className="text-sm font-heading font-semibold text-foreground-200">No blockers</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-1">
                    No failed, blocked, overdue, or urgent work is outstanding.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockers.map((b) => (
                    <BlockerRow key={b.key} blocker={b} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Oldest pending + recent completions */}
          <div className="col-span-5 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-time-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Oldest Pending
                </h4>
              </div>
              <div className="p-4 space-y-2.5">
                {oldest.map((o) => (
                  <OldestRow key={o.label} item={o} />
                ))}
                <p className="text-[11px] font-label text-foreground-500 leading-tight">
                  Ages only — no customer-identifying detail is shown on the wall display.
                </p>
              </div>
            </section>

            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-check-double-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Completed Today
                </h4>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <CompletionStat label="Tasks" value={completions.tasksCompletedToday} status={completions.status} />
                  <CompletionStat label="Approvals" value={completions.approvalsDecidedToday} status={completions.status} />
                  <CompletionStat label="UAT" value={completions.uatCompletedToday} status={completions.status} />
                </div>
              </div>
            </section>

            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-information-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Display Notes
                </h4>
              </div>
              <div className="p-4 space-y-1.5">
                <p className="text-[11px] font-label text-foreground-600 leading-tight">
                  · Aggregate workload only — no employee or customer detail.
                </p>
                <p className="text-[11px] font-label text-foreground-600 leading-tight">
                  · Unavailable sources are never shown as zero work.
                </p>
                <p className="text-[11px] font-label text-foreground-600 leading-tight">
                  · Overdue uses authoritative deadlines only.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCount({
  label,
  value,
  tone,
  status,
}: {
  label: string;
  value: number;
  tone?: string;
  status?: WorkloadSectionStatus;
}) {
  const unavailable = status === 'unavailable';
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${unavailable ? 'text-foreground-500' : tone ?? 'text-foreground-100'}`}>
        {unavailable ? '—' : value}
      </p>
    </div>
  );
}

function CompletionStat({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: WorkloadSectionStatus;
}) {
  const unavailable = status === 'unavailable';
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold tabular-nums mt-0.5 ${unavailable ? 'text-foreground-500' : 'text-foreground-100'}`}>
        {unavailable ? '—' : value}
      </p>
    </div>
  );
}
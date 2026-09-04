import {
  getScheduleJobs,
  getScheduleSummary,
  getScheduleCategories,
  getCriticalJobs,
  getUpcomingRuns,
  getScheduleBackupRelationship,
  getScheduleN8nRelationship,
  getScheduleAgentMapping,
  getScheduleGaps,
  SCHEDULE_STATE_META,
  type ScheduleJobState,
} from '@/pages/ai-operations/wallboard/scheduleSelectors';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

const SOURCE_BADGE: Record<'live' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_BADGE: Record<ScheduleJobState, { label: string; cls: string }> = {
  active: { label: 'ACTIVE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  failed: { label: 'FAILED', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  disabled: { label: 'DISABLED', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
  review: { label: 'REVIEW', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  unknown: { label: 'UNKNOWN', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
};

function fmtTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <span className="text-secondary-300 mt-0.5">
        <i className="ri-information-line w-3.5 h-3.5 flex items-center justify-center"></i>
      </span>
      <p className="text-[11px] font-label text-foreground-500 leading-tight">{text}</p>
    </div>
  );
}

export default function ScheduledOperationsView() {
  const data = useGroupLiveData();

  const summary = getScheduleSummary();
  const jobs = getScheduleJobs();
  const categories = getScheduleCategories();
  const critical = getCriticalJobs();
  const upcoming = getUpcomingRuns();
  const backup = getScheduleBackupRelationship();
  const n8n = getScheduleN8nRelationship();
  const agentMapping = getScheduleAgentMapping();
  const gaps = getScheduleGaps();
  const failedJobs = jobs.filter((j) => j.state === 'failed');
  const healthyJobs = jobs.filter((j) => j.state !== 'failed');

  const maxCategory = Math.max(1, ...categories.map((c) => c.count));

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Scheduled Operations · Cron &amp; Job Health
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          observation only · no schedule controls · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className="ri-calendar-check-line text-xl w-5 h-5 flex items-center justify-center text-accent-400"></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-50">
            {summary.total} scheduled jobs
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {summary.failed > 0 ? `${summary.failed} failed · ` : ''}
            {summary.review > 0 ? `${summary.review} review required` : 'on schedule'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <Stat label="Active" value={summary.active} tone="text-emerald-400" />
          <Stat label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'text-red-400' : undefined} />
          <Stat label="Disabled" value={summary.disabled} />
          <Stat label="Review" value={summary.review} tone={summary.review > 0 ? 'text-amber-400' : undefined} />
          <Stat label="Critical" value={summary.critical} tone={summary.critical > 0 ? 'text-red-400' : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left column: critical jobs + categories */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-alert-line" title="Critical Jobs" />
            <div className="p-3 space-y-1.5">
              {critical.length === 0 ? (
                <EmptyNote text="No job is flagged critical/high by the existing risk_level configuration." />
              ) : (
                critical.map((c) => (
                  <div key={c.job.key} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-label text-foreground-100 truncate whitespace-nowrap">{c.job.name}</p>
                      <p className="text-[9px] font-label text-foreground-500 truncate whitespace-nowrap">
                        {c.job.site} · {c.job.schedule}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${c.criticality === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
                        <span className="w-1 h-1 rounded-full bg-current"></span>
                        {c.criticality.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[c.job.state].cls}`}>
                        <span className="w-1 h-1 rounded-full bg-current"></span>
                        {STATE_BADGE[c.job.state].label}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-stack-line" title="Job Categories" />
            <div className="p-4 space-y-2">
              {categories.length === 0 ? (
                <EmptyNote text="No scheduled jobs are registered." />
              ) : (
                categories.map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-label text-foreground-200 whitespace-nowrap">{c.label}</span>
                      <span className="text-[11px] font-label text-foreground-100 tabular-nums">
                        {c.count}
                        {c.failed > 0 && <span className="text-red-400"> · {c.failed} failed</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-400"
                        style={{ width: `${Math.round((c.count / maxCategory) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Middle column: job registry */}
        <div className="col-span-4 min-h-0 flex flex-col overflow-y-auto">
          <section className="bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-file-list-3-line" title="Job Registry" />
            <div className="p-3 space-y-1.5">
              {jobs.length === 0 ? (
                <EmptyNote text="The schedule registry is empty — no scheduled jobs are configured." />
              ) : (
                <>
                  {failedJobs.map((j) => (
                    <div key={j.key} className="ow-alert-row flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 border text-[8px] font-label font-bold text-red-400 bg-red-500/15 border-red-500/40 whitespace-nowrap">PINNED</span>
                          <p className="text-[12px] font-label text-red-200 truncate whitespace-nowrap">{j.name}</p>
                        </div>
                        <p className="text-[9px] font-label text-red-400/70 truncate whitespace-nowrap mt-0.5">
                          {j.site} · {j.schedule}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-[9px] font-label text-red-400/70 tabular-nums whitespace-nowrap hidden 2xl:inline">
                          {fmtTime(j.nextRun)}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[j.state].cls}`}>
                          <span className="w-1 h-1 rounded-full bg-current"></span>
                          {STATE_BADGE[j.state].label}
                        </span>
                      </div>
                    </div>
                  ))}
                  {healthyJobs.map((j) => (
                    <div key={j.key} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-label text-foreground-100 truncate whitespace-nowrap">{j.name}</p>
                        <p className="text-[9px] font-label text-foreground-500 truncate whitespace-nowrap">
                          {j.site} · {j.schedule}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-[9px] font-label text-foreground-500 tabular-nums whitespace-nowrap hidden 2xl:inline">
                          {fmtTime(j.nextRun)}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[j.state].cls}`}>
                          <span className="w-1 h-1 rounded-full bg-current"></span>
                          {STATE_BADGE[j.state].label}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {jobs.length > 0 && (
              <p className="px-4 pb-3 text-[10px] font-label text-foreground-500 leading-tight">
                last/next run are registry timestamps — no live scheduler or execution telemetry is connected.
              </p>
            )}
          </section>
        </div>

        {/* Right column: upcoming + cross-system + gaps */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-time-line" title="Next 60 Minutes" />
            <div className="p-4 space-y-2">
              {upcoming.length === 0 ? (
                <EmptyNote text="No job has an upcoming run within the next 60 minutes — registry next-run values are migration baseline and no live scheduler updates them." />
              ) : (
                upcoming.map((u) => (
                  <div key={u.job.key} className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <p className="text-[12px] font-label text-foreground-100 truncate whitespace-nowrap">{u.job.name}</p>
                    <span className="text-[11px] font-label text-accent-400 tabular-nums whitespace-nowrap">{fmtTime(u.nextRun)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-git-branch-line" title="Cross-System Relationships" />
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Backup</p>
                  <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">
                    {backup.sourceState === 'live' ? `${backup.current}/${backup.total}` : '—'}
                  </p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">n8n WF</p>
                  <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{n8n.activeWorkflows}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Masters</p>
                  <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">
                    {agentMapping.sitesWithMaster}/{agentMapping.sitesTotal}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">n8n instances online</span>
                  <span className="text-[11px] font-label text-foreground-100 tabular-nums whitespace-nowrap">{n8n.instancesOnline}</span>
                </div>
                <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">n8n running / failed</span>
                  <span className="text-[11px] font-label text-foreground-100 tabular-nums whitespace-nowrap">
                    {n8n.running} / {n8n.failed}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Group orchestrator</span>
                  <span className="text-[11px] font-label text-foreground-100 whitespace-nowrap truncate max-w-[130px]">
                    {agentMapping.groupOrchestrator ?? '—'}
                  </span>
                </div>
              </div>
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
      </div>
    </main>
  );
}
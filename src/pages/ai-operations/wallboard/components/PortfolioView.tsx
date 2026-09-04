import { usePortfolioData } from '@/pages/ai-operations/wallboard/portfolioStore';
import {
  getPortfolioSummary,
  getPortfolioProjects,
  getBlockedProjects,
  type PortfolioStage,
  type LaunchReadiness,
  type UatState,
  type SourceState,
  type PortfolioProject,
} from '@/pages/ai-operations/wallboard/portfolioSelectors';

const SOURCE_BADGE: Record<SourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STAGE_META: Record<PortfolioStage, { label: string; cls: string; icon: string }> = {
  idea: { label: 'IDEA', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25', icon: 'ri-lightbulb-line' },
  design: { label: 'DESIGN', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25', icon: 'ri-pencil-ruler-2-line' },
  build: { label: 'BUILD', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25', icon: 'ri-code-s-slash-line' },
  test: { label: 'INTERNAL TEST', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-flask-line' },
  uat: { label: 'UAT', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-user-star-line' },
  blocked: { label: 'BLOCKED', cls: 'text-red-400 bg-red-500/10 border-red-500/30', icon: 'ri-forbid-line' },
  ready: { label: 'READY', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-rocket-line' },
  live: { label: 'LIVE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-check-double-line' },
  maintenance: { label: 'MAINTENANCE', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-tools-line' },
  unknown: { label: 'UNKNOWN', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60', icon: 'ri-question-line' },
};

const READINESS_META: Record<LaunchReadiness, { label: string; cls: string }> = {
  ready: { label: 'READY', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  conditional: { label: 'CONDITIONAL', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  not_ready: { label: 'NOT READY', cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
  unknown: { label: 'NO CHECKLIST', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
};

const UAT_META: Record<UatState, { label: string; cls: string; icon: string }> = {
  testing: { label: 'TESTING', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-loader-4-line' },
  approved: { label: 'APPROVED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-check-line' },
  completed: { label: 'COMPLETED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-check-double-line' },
  unknown: { label: 'UAT', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25', icon: 'ri-user-star-line' },
};

const SITE_META: Record<NonNullable<PortfolioProject['liveSiteStatus']>, { label: string; cls: string }> = {
  online: { label: 'SITE ONLINE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  degraded: { label: 'SITE DEGRADED', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  offline: { label: 'SITE OFFLINE', cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
  maintenance: { label: 'MAINTENANCE', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  unknown: { label: 'SITE UNKNOWN', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'updated today';
  if (days === 1) return 'updated 1 day ago';
  return `updated ${days} days ago`;
}

function StageBadge({ stage }: { stage: PortfolioStage }) {
  const meta = STAGE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${meta.cls}`}>
      <i className={`${meta.icon} w-3 h-3 flex items-center justify-center`}></i>
      {meta.label}
    </span>
  );
}

function ProjectCard({ project }: { project: PortfolioProject }) {
  const blocked = project.isBlocked;
  const cardCls = blocked
    ? 'bg-background-50 border-red-500/40'
    : 'bg-background-50 border-background-200/60';

  return (
    <div className={`rounded-lg border p-4 flex flex-col min-h-[168px] ${cardCls}`}>
      {/* Name + stage */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{project.name}</p>
          <p className="text-[11px] font-label text-foreground-600 truncate mt-0.5">
            {project.owner ? `${project.owner} · ` : ''}
            {project.isInternalTool ? 'internal' : project.isClientBuild ? 'client build' : 'product'}
          </p>
        </div>
        <StageBadge stage={blocked ? 'blocked' : project.stage} />
      </div>

      {/* Status chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.launchReadiness !== 'unknown' && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${READINESS_META[project.launchReadiness].cls}`}>
            {READINESS_META[project.launchReadiness].label}
          </span>
        )}
        {project.uatState && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${UAT_META[project.uatState].cls}`}>
            <i className={`${UAT_META[project.uatState].icon} w-2.5 h-2.5 flex items-center justify-center`}></i>
            UAT {UAT_META[project.uatState].label}
          </span>
        )}
        {project.liveSiteStatus && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${SITE_META[project.liveSiteStatus].cls}`}>
            {SITE_META[project.liveSiteStatus].label}
          </span>
        )}
      </div>

      {/* Build checklist + blocker detail */}
      <div className="mt-auto pt-3">
        {project.totalItems != null ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-label text-foreground-600">
              checklist {project.completedItems ?? 0}/{project.totalItems} done
            </p>
            {blocked ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-label font-semibold text-red-400 whitespace-nowrap">
                <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
                {project.launchBlockers} launch blocker{project.launchBlockers === 1 ? '' : 's'}
              </span>
            ) : (
              <p className="text-[10px] font-label text-foreground-500 whitespace-nowrap">
                {project.lastBuildUpdate ? fmtAgo(project.lastBuildUpdate) : 'no activity'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] font-label text-foreground-500">no build checklist</p>
        )}

        {project.targetLaunchDate && (
          <p className="text-[10px] font-label text-foreground-500 mt-1.5">
            target launch {fmtDate(project.targetLaunchDate)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PortfolioView() {
  const data = usePortfolioData();
  const summary = getPortfolioSummary();
  const projects = getPortfolioProjects();
  const blocked = getBlockedProjects();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Project Portfolio
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · project registry · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Active Builds" value={summary.activeProjects} tone="text-foreground-100" icon="ri-stack-line" />
        <SummaryStat label="In Build" value={summary.inBuild} tone="text-accent-400" icon="ri-code-s-slash-line" />
        <SummaryStat label="In UAT" value={summary.inUat} tone={summary.inUat > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-user-star-line" />
        <SummaryStat label="Blocked" value={summary.blocked} tone={summary.blocked > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-forbid-line" />
        <SummaryStat label="Ready" value={summary.ready} tone={summary.ready > 0 ? 'text-emerald-400' : 'text-foreground-200'} icon="ri-rocket-line" />
        <SummaryStat label="Live" value={summary.live} tone="text-emerald-400" icon="ri-check-double-line" />
      </div>

      {/* Distance-readable banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-layout-grid-line text-xl w-5 h-5 flex items-center justify-center ${summary.blocked > 0 ? 'text-red-400' : 'text-emerald-400'}`}></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-100">
            {summary.blocked > 0
              ? `${summary.blocked} project${summary.blocked > 1 ? 's' : ''} with launch blockers`
              : `${summary.activeProjects} active build${summary.activeProjects === 1 ? '' : 's'}`}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {summary.inBuild} in build · {summary.inUat} in UAT · {summary.ready} ready · {summary.live} live
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Projects" value={summary.activeProjects} />
          <SummaryCount label="Blocked" value={summary.blocked} />
          <SummaryCount label="Ready" value={summary.ready} />
          <SummaryCount label="Live" value={summary.live} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading project portfolio…</p>
        </div>
      ) : !summary.hasAnyData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
            <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
              <i className="ri-layout-grid-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </span>
            <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">No project data</p>
            <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">
              The project registry is empty. Missing data is shown as unavailable — no projects are fabricated.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Blocked projects — visually obvious, always first */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-red-400">
                  <i className="ri-forbid-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Blocked</h4>
              </div>
              {blocked.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-lg px-3 py-4">
                  No projects currently have launch blockers.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {blocked.map((p) => (
                    <div key={p.key} className="bg-background-50 border border-red-500/40 rounded-lg px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{p.name}</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-label font-semibold text-red-400 whitespace-nowrap">
                          <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
                          {p.launchBlockers}
                        </span>
                      </div>
                      <p className="text-[11px] font-label text-foreground-600 mt-1">
                        launch blockers · {p.lastBuildUpdate ? fmtAgo(p.lastBuildUpdate) : 'age unknown'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Legend */}
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-3">
              <p className="text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">Priority Order</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-red-400 bg-red-500/10 border-red-500/30">BLOCKED</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-emerald-400 bg-emerald-500/10 border-emerald-500/25">READY</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-amber-400 bg-amber-500/10 border-amber-500/30">UAT</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-accent-400 bg-accent-500/10 border-accent-500/25">BUILD</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-emerald-400 bg-emerald-500/10 border-emerald-500/25">LIVE</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border-secondary-500/25">IDEA</span>
              </div>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                Stage reflects the existing project registry. Launch readiness reuses the build-checklist rule; a project with no checklist is never shown as ready.
              </p>
            </section>
          </div>

          {/* Project grid */}
          <div className="col-span-8 min-h-0 flex flex-col overflow-y-auto pr-1">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                <i className="ri-stack-line text-base w-4 h-4 flex items-center justify-center"></i>
              </span>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">All Projects</h4>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {projects.map((p) => (
                <ProjectCard key={p.key} project={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryStat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: string }) {
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
import { useLaunchReadinessData } from '@/pages/ai-operations/wallboard/launchReadinessStore';
import {
  getLaunchReadinessSummary,
  getLaunchReadinessProjects,
  type LaunchState,
  type BlockerCategory,
  type SourceState,
  type LaunchReadinessProject,
} from '@/pages/ai-operations/wallboard/launchReadinessSelectors';

const SOURCE_BADGE: Record<SourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_META: Record<LaunchState, { label: string; cls: string; icon: string }> = {
  building: { label: 'BUILDING', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25', icon: 'ri-code-s-slash-line' },
  testing: { label: 'TESTING', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-user-star-line' },
  blocked: { label: 'BLOCKED', cls: 'text-red-400 bg-red-500/10 border-red-500/30', icon: 'ri-forbid-line' },
  not_ready: { label: 'NOT READY', cls: 'text-red-400 bg-red-500/10 border-red-500/25', icon: 'ri-close-circle-line' },
  conditional: { label: 'CONDITIONAL', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-time-line' },
  ready: { label: 'READY', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-rocket-line' },
  live: { label: 'LIVE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-check-double-line' },
  unknown: { label: 'UNKNOWN', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60', icon: 'ri-question-line' },
};

const CATEGORY_META: Record<BlockerCategory, { label: string; cls: string }> = {
  uat: { label: 'UAT', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  payment: { label: 'PAYMENT', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25' },
  legal: { label: 'LEGAL', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
  security: { label: 'SECURITY', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  deployment: { label: 'DEPLOYMENT', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  configuration: { label: 'CONFIG', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const UAT_META: Record<string, { label: string; cls: string }> = {
  testing: { label: 'UAT TESTING', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  approved: { label: 'UAT APPROVED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  completed: { label: 'UAT COMPLETED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unknown: { label: 'UAT', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
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

function StateBadge({ state }: { state: LaunchState }) {
  const meta = STATE_META[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-[10px] font-label font-semibold whitespace-nowrap ${meta.cls}`}>
      <i className={`${meta.icon} w-3 h-3 flex items-center justify-center`}></i>
      {meta.label}
    </span>
  );
}

function ProjectRow({ project }: { project: LaunchReadinessProject }) {
  const blocked = project.state === 'blocked';
  const rowCls = blocked
    ? 'bg-background-50 border-red-500/40'
    : 'bg-background-100 border-background-200/60';

  const checksLabel =
    project.mandatoryTotal != null
      ? `${project.mandatoryDone}/${project.mandatoryTotal}`
      : 'no checklist';

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-4 ${rowCls}`}>
      {/* Name + owner */}
      <div className="w-52 min-w-0 shrink-0">
        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{project.name}</p>
        <p className="text-[11px] font-label text-foreground-600 truncate mt-0.5">
          {project.owner ? `${project.owner} · ` : ''}
          {project.isInternalTool ? 'internal' : project.isClientBuild ? 'client build' : 'product'}
        </p>
      </div>

      {/* Launch state */}
      <div className="w-32 shrink-0">
        <StateBadge state={project.state} />
      </div>

      {/* Mandatory checks */}
      <div className="w-28 shrink-0">
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Checks</p>
        <p className={`text-sm font-heading font-semibold tabular-nums ${project.mandatoryTotal != null ? 'text-foreground-100' : 'text-foreground-500'}`}>
          {checksLabel}
        </p>
      </div>

      {/* Blockers */}
      <div className="w-24 shrink-0">
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Blockers</p>
        {project.blockerCount != null && project.blockerCount > 0 ? (
          <p className="inline-flex items-center gap-1 text-sm font-heading font-semibold text-red-400 tabular-nums">
            <i className="ri-alert-line w-3.5 h-3.5 flex items-center justify-center"></i>
            {project.blockerCount}
          </p>
        ) : (
          <p className="text-sm font-heading font-semibold text-foreground-500 tabular-nums">0</p>
        )}
      </div>

      {/* Blocker categories */}
      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
        {project.blockerBreakdown.length === 0 ? (
          <span className="text-[11px] font-label text-foreground-500">—</span>
        ) : (
          project.blockerBreakdown.map((b) => (
            <span
              key={b.category}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${CATEGORY_META[b.category].cls}`}
            >
              {CATEGORY_META[b.category].label} {b.count}
            </span>
          ))
        )}
      </div>

      {/* UAT state */}
      <div className="w-32 shrink-0">
        {project.uatState ? (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${UAT_META[project.uatState]?.cls ?? UAT_META.unknown.cls}`}>
            {UAT_META[project.uatState]?.label ?? 'UAT'}
          </span>
        ) : (
          <span className="text-[11px] font-label text-foreground-500">—</span>
        )}
      </div>

      {/* Target launch date (UK format) */}
      <div className="w-36 shrink-0 text-right">
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Target</p>
        <p className="text-[12px] font-label text-foreground-200 tabular-nums">{fmtDate(project.targetLaunchDate)}</p>
      </div>
    </div>
  );
}

export default function LaunchReadinessView() {
  const data = useLaunchReadinessData();
  const summary = getLaunchReadinessSummary();
  const projects = getLaunchReadinessProjects();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Launch Readiness
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · project + build + UAT registry · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Active Products" value={summary.activeProducts} tone="text-foreground-100" icon="ri-stack-line" />
        <SummaryStat label="Blocked" value={summary.blocked} tone={summary.blocked > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-forbid-line" />
        <SummaryStat label="Ready" value={summary.ready} tone={summary.ready > 0 ? 'text-emerald-400' : 'text-foreground-200'} icon="ri-rocket-line" />
        <SummaryStat label="Conditional" value={summary.conditional} tone={summary.conditional > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-time-line" />
        <SummaryStat label="Testing" value={summary.testing} tone={summary.testing > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-user-star-line" />
        <SummaryStat label="Live" value={summary.live} tone="text-emerald-400" icon="ri-check-double-line" />
      </div>

      {/* Distance-readable banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-rocket-line text-xl w-5 h-5 flex items-center justify-center ${summary.blocked > 0 ? 'text-red-400' : 'text-emerald-400'}`}></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-100">
            {summary.blocked > 0
              ? `${summary.blocked} product${summary.blocked > 1 ? 's' : ''} blocked from launch`
              : `${summary.ready} ready · ${summary.live} live`}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {summary.activeProducts} active products · {summary.building} building · {summary.testing} testing · {summary.ready} ready · {summary.conditional} conditional · {summary.live} live
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Products" value={summary.activeProducts} />
          <SummaryCount label="Blocked" value={summary.blocked} />
          <SummaryCount label="Ready" value={summary.ready} />
          <SummaryCount label="Live" value={summary.live} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading launch readiness…</p>
        </div>
      ) : !summary.hasAnyData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
            <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
              <i className="ri-rocket-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </span>
            <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">No project data</p>
            <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">
              The project registry is empty. Missing data is shown as unavailable — no readiness is fabricated.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Column header */}
          <div className="shrink-0 grid grid-cols-[13rem_8rem_7rem_6rem_1fr_8rem_9rem] gap-4 px-4 pb-2 text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide">
            <span>Product</span>
            <span>Readiness</span>
            <span>Checks</span>
            <span>Blockers</span>
            <span>Blocker Category</span>
            <span>UAT</span>
            <span className="text-right">Target Launch</span>
          </div>

          {/* Rows */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
            {projects.map((p) => (
              <ProjectRow key={p.key} project={p} />
            ))}
          </div>

          {/* Footer note — readiness sources + gaps */}
          <div className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 pt-2 border-t border-background-200/60 text-[10px] font-label text-foreground-600">
            <span>
              <i className="ri-information-line w-3 h-3 flex items-center justify-center mr-1"></i>
              Readiness reuses the build-checklist rule; a project with no checklist is never shown as ready.
            </span>
            {!summary.hasDeploymentData && (
              <span className="text-amber-400">Release/deployment ledger is empty — no deployment state to show.</span>
            )}
            <span>Launch dates shown are stored registry targets, not approved go-live dates.</span>
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
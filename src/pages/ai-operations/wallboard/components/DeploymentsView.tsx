import { useDeploymentData } from '@/pages/ai-operations/wallboard/deploymentStore';
import {
  getDeploymentSummary,
  getDeploymentFeed,
  getRecentReleases,
  getEnvironmentBreakdown,
  getProductionFailures,
  getRunningDeployments,
  type DeployEnvironment,
  type DeployState,
  type SourceState,
} from '@/pages/ai-operations/wallboard/deploymentSelectors';

const SOURCE_BADGE: Record<SourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_META: Record<DeployState, { label: string; cls: string; icon: string }> = {
  success: { label: 'Successful', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: 'ri-check-line' },
  failed: { label: 'Failed', cls: 'text-red-400 bg-red-500/10 border-red-500/30', icon: 'ri-close-line' },
  running: { label: 'Deploying', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25', icon: 'ri-loader-4-line' },
  pending: { label: 'Pending', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: 'ri-time-line' },
  unknown: { label: 'Unknown', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25', icon: 'ri-question-line' },
};

const ENV_META: Record<DeployEnvironment, { label: string; cls: string }> = {
  production: { label: 'PROD', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  staging: { label: 'STAGING', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  development: { label: 'DEV', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25' },
  test: { label: 'TEST', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
  unknown: { label: 'UNKNOWN', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const ENV_ORDER: DeployEnvironment[] = ['production', 'staging', 'development', 'test', 'unknown'];

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

function StateBadge({ state }: { state: DeployState }) {
  const meta = STATE_META[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${meta.cls}`}>
      <i className={`${meta.icon} w-3 h-3 flex items-center justify-center`}></i>
      {meta.label}
    </span>
  );
}

function EnvBadge({ env }: { env: DeployEnvironment }) {
  const meta = ENV_META[env];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold tracking-wide whitespace-nowrap ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function EmptyState({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
      <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
        <i className={`${icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
      </span>
      <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">{title}</p>
      <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">{note}</p>
    </div>
  );
}

export default function DeploymentsView() {
  const data = useDeploymentData();
  const summary = getDeploymentSummary();
  const feed = getDeploymentFeed();
  const releases = getRecentReleases();
  const environments = getEnvironmentBreakdown();
  const failures = getProductionFailures();
  const running = getRunningDeployments();

  const liveStatus = summary.liveServiceStatus;
  const liveHealthy = liveStatus === 'healthy';
  const liveUnknown = !liveStatus || liveStatus === 'unknown';

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Deployments &amp; Releases
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Deployments Today" value={summary.deploymentsToday} tone="text-foreground-100" icon="ri-rocket-2-line" />
        <SummaryStat label="Successful" value={summary.successful} tone="text-emerald-400" icon="ri-check-double-line" />
        <SummaryStat label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Running" value={summary.running} tone={summary.running > 0 ? 'text-accent-400' : 'text-foreground-200'} icon="ri-loader-4-line" />
        <SummaryStat label="Prod Failures" value={summary.productionFailed} tone={summary.productionFailed > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-alarm-warning-line" />
        <SummaryStat label="Releases" value={summary.releasesTotal} tone="text-foreground-100" icon="ri-git-commit-line" />
      </div>

      {/* Distance-readable banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-rocket-2-line text-xl w-5 h-5 flex items-center justify-center ${liveHealthy ? 'text-emerald-400' : liveUnknown ? 'text-secondary-300' : 'text-red-400'}`}></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-100">
            {summary.productionFailed > 0
              ? `${summary.productionFailed} production deployment${summary.productionFailed > 1 ? 's' : ''} failed`
              : summary.productionRunning > 0
                ? 'Production deployment in progress'
                : summary.deploymentsToday > 0
                  ? 'Deployment pipeline reporting'
                  : 'No deployment activity recorded'}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {liveStatus
              ? `deployment service: ${liveStatus.replace(/_/g, ' ')}${summary.liveServiceCheckedAt ? ` · checked ${fmtSeen(summary.liveServiceCheckedAt)}` : ''}`
              : 'deployment service: no live health signal'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Deployments" value={summary.deploymentsTotal} />
          <SummaryCount label="Failed" value={summary.failed} />
          <SummaryCount label="Running" value={summary.running} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading deployment status…</p>
        </div>
      ) : !summary.hasAnyData ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="ri-git-repository-line"
            title="No deployment data"
            note="No deployment or release records are currently reporting. Unavailable is never shown as healthy, and no history is fabricated."
          />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left: running + recent deployments + releases */}
          <div className="col-span-8 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            {running.length > 0 && (
              <section className="shrink-0">
                <SectionHeading icon="ri-loader-4-line" title="Currently Deploying" />
                <div className="space-y-2">
                  {running.map((d) => (
                    <DeployRow key={d.key} item={d} />
                  ))}
                </div>
              </section>
            )}

            <section className="shrink-0">
              <SectionHeading icon="ri-git-commit-line" title="Recent Deployments" />
              {feed.length === 0 ? (
                <EmptyState icon="ri-git-repository-line" title="No deployments" note="The deployment ledger is empty — no build or deploy activity has been recorded." />
              ) : (
                <div className="space-y-2">
                  {feed.slice(0, 8).map((d) => (
                    <DeployRow key={d.key} item={d} />
                  ))}
                </div>
              )}
            </section>

            <section className="shrink-0">
              <SectionHeading icon="ri-sparkling-line" title="Recent Releases" />
              {releases.length === 0 ? (
                <EmptyState icon="ri-sparkling-line" title="No releases" note="No production release records are available." />
              ) : (
                <div className="space-y-2">
                  {releases.slice(0, 6).map((r) => (
                    <ReleaseRow key={r.key} item={r} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: environment breakdown + production failures */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-stack-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Environments</h4>
              </div>
              <div className="p-3 space-y-2">
                {environments.length === 0 ? (
                  <p className="text-[11px] font-label text-foreground-500 py-2">No environment activity recorded.</p>
                ) : (
                  environments.map((e) => (
                    <div key={e.environment} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                      <EnvBadge env={e.environment} />
                      <div className="flex items-center gap-3 text-[11px] font-label">
                        <span className="text-emerald-400 tabular-nums">{e.success} ok</span>
                        <span className={e.failed > 0 ? 'text-red-400 tabular-nums' : 'text-foreground-500 tabular-nums'}>{e.failed} fail</span>
                        <span className={e.running > 0 ? 'text-accent-400 tabular-nums' : 'text-foreground-500 tabular-nums'}>{e.running} run</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-red-400">
                  <i className="ri-alarm-warning-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Production Failures</h4>
              </div>
              <div className="p-3">
                {failures.length === 0 ? (
                  <p className="text-[11px] font-label text-foreground-500 py-2">
                    No production deployment failures recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {failures.map((f) => (
                      <div key={f.key} className="bg-background-50 border border-red-500/25 rounded-md px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{f.projectLabel}</p>
                          <StateBadge state="failed" />
                        </div>
                        <p className="text-[11px] font-label text-foreground-600 mt-1">
                          failed {fmtSeen(f.completedAt)} · last commit {f.commit ?? '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Environment legend */}
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-3">
              <p className="text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">Environment Legend</p>
              <div className="flex flex-wrap gap-1.5">
                {ENV_ORDER.map((env) => (
                  <EnvBadge key={env} env={env} />
                ))}
              </div>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                A failed TEST/STAGING/DEV deployment is never shown as a production outage.
              </p>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
        <i className={`${icon} text-base w-4 h-4 flex items-center justify-center`}></i>
      </span>
      <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

function DeployRow({ item }: { item: ReturnType<typeof getDeploymentFeed>[number] }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{item.projectLabel}</p>
          <EnvBadge env={item.environment} />
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-0.5 truncate">
          {item.branch ?? '—'}
          {item.commit ? ` · ${item.commit}` : ''}
          {item.durationMinutes != null ? ` · ${item.durationMinutes}m` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <StateBadge state={item.state} />
        <p className="text-[10px] font-label text-foreground-500 mt-1 whitespace-nowrap">{fmtSeen(item.completedAt)}</p>
      </div>
    </div>
  );
}

function ReleaseRow({ item }: { item: ReturnType<typeof getRecentReleases>[number] }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{item.version ?? 'Untitled release'}</p>
          <EnvBadge env={item.environment} />
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-0.5 truncate">
          {item.summary ?? 'No summary'}
          {item.gitRef ? ` · ${item.gitRef}` : ''}
        </p>
        {item.rollbackNote && (
          <p className="text-[10px] font-label text-amber-400 mt-0.5 truncate">rollback: {item.rollbackNote}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <StateBadge state={item.state} />
        <p className="text-[10px] font-label text-foreground-500 mt-1 whitespace-nowrap">{fmtSeen(item.releasedAt)}</p>
      </div>
    </div>
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
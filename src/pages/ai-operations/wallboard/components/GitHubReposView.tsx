import { useGithubData } from '@/pages/ai-operations/wallboard/githubStore';
import {
  getGithubSummary,
  getActiveRepos,
  getBuildFailures,
  type GithubSourceState,
  type RepoHealth,
} from '@/pages/ai-operations/wallboard/githubSelectors';

const SOURCE_BADGE: Record<GithubSourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
};

function fmtAge(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function RepoRow({ repo }: { repo: RepoHealth }) {
  const buildFailed = repo.hasDeployment && /(fail|error|broken|rollback|revert|aborted)/i.test(repo.buildStatus ?? '');
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400 shrink-0">
            <i className="ri-git-repository-line text-sm w-3.5 h-3.5 flex items-center justify-center"></i>
          </span>
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{repo.name}</p>
          <span
            className={`text-[9px] font-label px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
              repo.isPrivate
                ? 'bg-secondary-500/15 text-secondary-300'
                : 'bg-accent-500/15 text-accent-400'
            }`}
          >
            {repo.isPrivate ? 'PRIVATE' : 'PUBLIC'}
          </span>
          {buildFailed && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap text-red-400 bg-red-500/10 border-red-500/30">
              <i className="ri-close-line w-3 h-3 flex items-center justify-center"></i>
              BUILD FAILED
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-0.5 truncate">
          <span className="inline-flex items-center gap-1">
            <i className="ri-git-branch-line text-xs w-3 h-3 flex items-center justify-center"></i>
            {repo.defaultBranch ?? 'no default branch'}
          </span>
          {repo.latestCommit && <span className="ml-2">· {repo.latestCommit}</span>}
          {repo.language && <span className="ml-2">· {repo.language}</span>}
          {repo.hasDeployment && <span className="ml-2 text-emerald-400">· deployed</span>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-label text-foreground-300 whitespace-nowrap">{fmtAge(repo.lastActivity)}</p>
        <p className="text-[9px] font-label text-foreground-600 whitespace-nowrap mt-0.5">last activity</p>
      </div>
    </div>
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

export default function GitHubReposView() {
  const data = useGithubData();
  const summary = getGithubSummary();
  const repos = getActiveRepos();
  const failures = getBuildFailures();

  const unavailable = summary.sourceState === 'unavailable';

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            GitHub &amp; Repos
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
        <SummaryStat label="Active Repos" value={summary.activeRepos} tone="text-foreground-100" icon="ri-git-repository-line" />
        <SummaryStat label="Archived" value={summary.archivedRepos} tone="text-foreground-200" icon="ri-archive-line" />
        <SummaryStat label="Updated Today" value={summary.updatedToday} tone="text-emerald-400" icon="ri-time-line" />
        <SummaryStat label="This Week" value={summary.updatedThisWeek} tone="text-foreground-200" icon="ri-calendar-line" />
        <SummaryStat label="Build Failures" value={summary.buildFailures} tone={summary.buildFailures > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Deploy Linked" value={summary.deploymentLinked} tone="text-foreground-100" icon="ri-link" />
      </div>

      {/* Distance-readable banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-github-fill text-xl w-5 h-5 flex items-center justify-center ${unavailable ? 'text-amber-400' : 'text-emerald-400'}`}></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-100">
            {unavailable
              ? 'GITHUB STATUS UNKNOWN'
              : summary.activeRepos > 0
                ? `${summary.activeRepos} active repositor${summary.activeRepos > 1 ? 'ies' : 'y'}`
                : 'No active repositories'}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {unavailable
              ? (data.error ?? 'GitHub could not be reached — no repository state is assumed healthy.')
              : `${summary.publicCount} public · ${summary.privateCount} private · ${summary.updatedToday} pushed today`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Active" value={summary.activeRepos} />
          <SummaryCount label="Archived" value={summary.archivedRepos} />
          <SummaryCount label="Failed" value={summary.buildFailures} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading repositories…</p>
        </div>
      ) : unavailable ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="ri-github-fill"
            title="GitHub unavailable"
            note="The repository registry could not be reached. No repository is shown as healthy while GitHub status is unknown."
          />
        </div>
      ) : repos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="ri-git-repository-line"
            title="No active repositories"
            note="The GitHub registry returned no non-archived, non-fork repositories. Unavailable is never shown as healthy, and no repository state is fabricated."
          />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left: active repo list */}
          <div className="col-span-8 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-2">
              {repos.map((r) => (
                <RepoRow key={r.key} repo={r} />
              ))}
            </div>
          </div>

          {/* Right: failures + relationship */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-red-400">
                  <i className="ri-alarm-warning-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Build Failures</h4>
              </div>
              <div className="p-3">
                {failures.length === 0 ? (
                  <p className="text-[11px] font-label text-foreground-500 py-2">
                    No recorded build failures in the deployment ledger.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {failures.map((f) => (
                      <div key={f.key} className="bg-background-50 border border-red-500/25 rounded-md px-3 py-2.5">
                        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{f.name}</p>
                        <p className="text-[11px] font-label text-foreground-600 mt-1">
                          {f.deploymentBranch ? `${f.deploymentBranch} · ` : ''}
                          {f.latestCommit ? `${f.latestCommit} · ` : ''}
                          {f.buildStatus ?? 'failed'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-3">
              <p className="text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">Repository Relationship</p>
              <div className="space-y-1.5 text-[11px] font-label text-foreground-500">
                <div className="flex items-center justify-between">
                  <span>Active repos</span>
                  <span className="text-foreground-300 tabular-nums">{summary.activeRepos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Archived / fork</span>
                  <span className="text-foreground-300 tabular-nums">{summary.archivedRepos} / {summary.forkRepos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Deployment linked</span>
                  <span className="text-foreground-300 tabular-nums">{summary.deploymentLinked}</span>
                </div>
              </div>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                Relationship derives only from the deployment ledger (github_repo). Repos without a deployment record are shown as not linked — never guessed.
              </p>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-3">
              <p className="text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">Data Scope</p>
              <p className="text-[10px] font-label text-foreground-500 leading-tight">
                Pull requests, workflow runs, and security/dependency alerts are not surfaced here — the existing GitHub integration exposes repository metadata only. GitHub remains the source of truth for those states.
              </p>
            </section>
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
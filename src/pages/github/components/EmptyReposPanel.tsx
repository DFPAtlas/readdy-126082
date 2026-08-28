import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface EmptyRepoResult {
  full_name: string;
  owner: string;
  repo: string;
  created_at: string;
  updated_at: string;
  size_kb: number;
  default_branch: string;
  commit_count: number;
  initial_commit_message: string | null;
  file_count: number;
  files: string[];
  readme: string | null;
  package_name: string | null;
  html_title: string | null;
}

interface InspectionResult {
  owner: string;
  orgs: string[];
  total_repos: number;
  empty_repo_count: number;
  results: EmptyRepoResult[];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function extractProjectId(repo: string): string | null {
  const m = repo.match(/^readdy-([a-f0-9]{6})$/i);
  return m ? m[1].toLowerCase() : null;
}

function identitySignal(r: EmptyRepoResult): string {
  const parts: string[] = [];
  if (r.package_name) parts.push(`package.json name: ${r.package_name}`);
  if (r.html_title) parts.push(`index.html title: ${r.html_title}`);
  if (r.readme) {
    const firstLine = r.readme.trim().split('\n')[0].trim();
    if (firstLine) parts.push(`README: ${firstLine.slice(0, 80)}`);
  }
  if (r.initial_commit_message && r.initial_commit_message.trim() !== 'Initial commit') {
    parts.push(`commit: ${r.initial_commit_message.slice(0, 80)}`);
  }
  return parts.length ? parts.join(' · ') : 'No identity signals found';
}

function EmptyRepoRow({ r }: { r: EmptyRepoResult }) {
  const projectId = extractProjectId(r.repo);
  const hasSignals = r.readme || r.package_name || r.html_title || r.file_count > 0;
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground-100">{r.full_name || r.repo}</span>
            {r.owner && (
              <span className="text-[10px] font-label px-1.5 py-0.5 rounded-full bg-foreground-500/10 text-foreground-500 whitespace-nowrap">
                {r.owner}
              </span>
            )}
            {projectId && (
              <span className="text-[10px] font-label px-1.5 py-0.5 rounded-full bg-accent-500/10 text-accent-400 whitespace-nowrap">
                Readdy project: {projectId}
              </span>
            )}
            {hasSignals ? (
              <span className="text-[10px] font-label px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                Partial push
              </span>
            ) : (
              <span className="text-[10px] font-label px-1.5 py-0.5 rounded-full bg-secondary-500/15 text-secondary-300 whitespace-nowrap">
                Bare repo
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-500 mt-1.5">{identitySignal(r)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-background-200/40 text-xs">
        <div>
          <p className="text-foreground-600">Created</p>
          <p className="text-foreground-300 mt-0.5">{fmtDate(r.created_at)}</p>
        </div>
        <div>
          <p className="text-foreground-600">Updated</p>
          <p className="text-foreground-300 mt-0.5">{fmtDate(r.updated_at)}</p>
        </div>
        <div>
          <p className="text-foreground-600">Commits</p>
          <p className="text-foreground-300 mt-0.5">{r.commit_count}</p>
        </div>
        <div>
          <p className="text-foreground-600">Files</p>
          <p className="text-foreground-300 mt-0.5">{r.file_count}</p>
        </div>
      </div>

      {r.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {r.files.slice(0, 12).map((f) => (
            <span key={f} className="text-[10px] text-foreground-500 bg-background-200/50 px-1.5 py-0.5 rounded whitespace-nowrap">
              {f}
            </span>
          ))}
          {r.files.length > 12 && (
            <span className="text-[10px] text-foreground-600 whitespace-nowrap">+{r.files.length - 12} more</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmptyReposPanel() {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const runInspection = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('inspect-github-empty-repos');
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data as InspectionResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to inspect repositories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runInspection();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground-50">Empty Repository Forensics</h2>
          <p className="text-sm text-foreground-500 mt-1">
            Sweeps for size-0 repos and extracts the Readdy project ID plus any identity signals left behind.
          </p>
        </div>
        <button
          onClick={runInspection}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-100 border border-background-200/60 text-sm text-foreground-300 hover:text-foreground-100 hover:border-background-300/60 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <i className="ri-radar-line text-base w-4 h-4 flex items-center justify-center"></i>
          {loading ? 'Inspecting…' : 'Run inspection'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
              <div className="h-3 w-40 bg-background-300/40 rounded mb-3"></div>
              <div className="h-3 w-full bg-background-300/40 rounded"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-10 bg-background-100 border border-background-200/60 rounded-lg">
          <i className="ri-alert-line text-2xl text-foreground-500 mb-3"></i>
          <p className="text-sm text-foreground-400 mb-1">Couldn't run the inspection.</p>
          <p className="text-xs text-foreground-600 mb-4 max-w-md text-center">{error}</p>
          <button
            onClick={runInspection}
            className="bg-accent-500 text-background-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : result ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-400"></span>
              Account: <span className="text-foreground-300">{result.owner}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary-400"></span>
              Total repos: <span className="text-foreground-300">{result.total_repos}</span>
            </span>
            {result.orgs && result.orgs.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Orgs: <span className="text-foreground-300">{result.orgs.join(', ')}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Empty repos: <span className="text-foreground-300">{result.empty_repo_count}</span>
            </span>
          </div>

          {result.results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-background-100 border border-background-200/60 rounded-lg">
              <i className="ri-checkbox-circle-line text-2xl text-emerald-400 mb-3"></i>
              <p className="text-sm text-foreground-400">No size-0 repositories found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {result.results.map((r) => (
                <EmptyRepoRow key={r.repo} r={r} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
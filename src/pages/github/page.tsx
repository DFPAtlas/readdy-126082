import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  private: boolean;
  updated_at: string;
  created_at: string;
  topics: string[];
  default_branch: string;
}

const languageColors: Record<string, string> = {
  TypeScript: 'bg-sky-400',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-emerald-400',
  Java: 'bg-orange-400',
  Go: 'bg-cyan-400',
  Rust: 'bg-amber-400',
  Ruby: 'bg-red-400',
  PHP: 'bg-violet-400',
  'C#': 'bg-green-400',
  'C++': 'bg-pink-400',
  C: 'bg-gray-400',
  HTML: 'bg-orange-400',
  CSS: 'bg-purple-400',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-purple-400',
  Dart: 'bg-cyan-400',
  Shell: 'bg-green-400',
  Vue: 'bg-emerald-400',
  Svelte: 'bg-orange-400',
  Jupyter: 'bg-orange-400',
  Solidity: 'bg-gray-400',
};

function languageDot(language: string | null) {
  if (!language) return 'bg-secondary-400';
  return languageColors[language] ?? 'bg-secondary-400';
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
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

function RepoCard({ repo }: { repo: Repo }) {
  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex flex-col hover:border-accent-500/40 transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <i className="ri-git-repository-line text-base text-foreground-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
          <span className="text-sm font-medium text-foreground-100 truncate group-hover:text-accent-400 transition-colors">
            {repo.name}
          </span>
        </div>
        <span
          className={`text-[10px] font-label px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
            repo.private
              ? 'bg-secondary-500/15 text-secondary-300'
              : 'bg-accent-500/15 text-accent-400'
          }`}
        >
          {repo.private ? 'Private' : 'Public'}
        </span>
      </div>

      <p className="text-xs text-foreground-500 mt-2 line-clamp-2 flex-1">
        {repo.description || 'No description provided.'}
      </p>

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {repo.topics.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] text-accent-300 bg-accent-500/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-background-200/40 text-xs text-foreground-500">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${languageDot(repo.language)}`}></span>
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <i className="ri-star-line text-xs w-3 h-3 flex items-center justify-center"></i>
          {repo.stargazers_count}
        </span>
        <span className="flex items-center gap-1">
          <i className="ri-git-branch-line text-xs w-3 h-3 flex items-center justify-center"></i>
          {repo.forks_count}
        </span>
        <span className="ml-auto whitespace-nowrap text-foreground-600">Updated {timeAgo(repo.updated_at)}</span>
      </div>
    </a>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100">{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
      <div className="h-3 w-28 bg-background-300/40 rounded mb-3"></div>
      <div className="h-3 w-full bg-background-300/40 rounded mb-2"></div>
      <div className="h-3 w-2/3 bg-background-300/40 rounded"></div>
    </div>
  );
}

export default function GitHubPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');

  const loadRepos = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('list-github-repos');
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setRepos((data?.repos as Repo[]) ?? []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load repositories.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const filtered = useMemo(() => {
    return repos
      .filter((r) => {
        if (filter === 'public' && r.private) return false;
        if (filter === 'private' && !r.private) return false;
        return true;
      })
      .filter((r) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false) ||
          (r.language?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [repos, query, filter]);

  const totalStars = useMemo(() => repos.reduce((s, r) => s + r.stargazers_count, 0), [repos]);
  const totalForks = useMemo(() => repos.reduce((s, r) => s + r.forks_count, 0), [repos]);
  const publicCount = repos.filter((r) => !r.private).length;
  const privateCount = repos.filter((r) => r.private).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">GitHub Repositories</h1>
          <p className="text-sm text-foreground-500 mt-1">Your repositories, pulled live from GitHub.</p>
        </div>
        <button
          onClick={loadRepos}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-100 border border-background-200/60 text-sm text-foreground-300 hover:text-foreground-100 hover:border-background-300/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
          Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Repositories" value={repos.length} icon="ri-git-repository-line" accent="bg-accent-500/10 text-accent-400" />
          <StatCard label="Total Stars" value={totalStars} icon="ri-star-line" accent="bg-yellow-500/10 text-yellow-400" />
          <StatCard label="Total Forks" value={totalForks} icon="ri-git-branch-line" accent="bg-emerald-500/10 text-emerald-400" />
          <StatCard label="Public / Private" value={publicCount + privateCount} icon="ri-lock-line" accent="bg-secondary-500/10 text-secondary-300" />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-500 w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repos by name, description, or language…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-background-100 border border-background-200/60 rounded-md text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 px-1 py-1 bg-background-100 border border-background-200/60 rounded-full">
          {(['all', 'public', 'private'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors cursor-pointer capitalize ${
                filter === f
                  ? 'bg-accent-500 text-background-950 font-medium'
                  : 'text-foreground-400 hover:text-foreground-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-background-100 border border-background-200/60 rounded-lg">
          <i className="ri-github-fill text-3xl text-foreground-500 mb-3"></i>
          <p className="text-sm text-foreground-400 mb-1">Couldn't load your repositories.</p>
          <p className="text-xs text-foreground-600 mb-4 max-w-md text-center">{error}</p>
          <button
            onClick={loadRepos}
            className="bg-accent-500 text-background-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-background-100 border border-background-200/60 rounded-lg">
          <i className="ri-inbox-line text-3xl text-foreground-500 mb-3"></i>
          <p className="text-sm text-foreground-400">
            {repos.length === 0 ? 'No repositories found for this account.' : 'No repositories match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((repo) => <RepoCard key={repo.id} repo={repo} />)}
        </div>
      )}
    </div>
  );
}
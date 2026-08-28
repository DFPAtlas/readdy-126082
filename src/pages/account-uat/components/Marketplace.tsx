import { useMemo, useState } from 'react';
import type { UatJob, UatProject, UatTester } from '@/pages/admin/website-uat/types';
import {
  DEVICES,
  BROWSERS,
  DEVICE_LABELS,
  BROWSER_LABELS,
  EXPERIENCE_LEVEL_LABELS,
} from '@/pages/admin/website-uat/marketplace';
import JobCard from './JobCard';
import EmptyState from './EmptyState';

const EXPERIENCE_FILTERS = ['beginner', 'intermediate', 'advanced'];

const DURATION_OPTIONS = [
  { value: '', label: 'Any duration' },
  { value: 'under30', label: 'Under 30 min' },
  { value: '30to60', label: '30–60 min' },
  { value: 'over60', label: 'Over 60 min' },
];

interface Props {
  jobs: UatJob[];
  projectById: Map<string, UatProject>;
  tester: UatTester | null;
}

const selectClass =
  'bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-300 cursor-pointer focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-400/30';

export default function Marketplace({ jobs, projectById, tester }: Props) {
  const [device, setDevice] = useState('');
  const [browser, setBrowser] = useState('');
  const [duration, setDuration] = useState('');
  const [reward, setReward] = useState('');
  const [experience, setExperience] = useState('');

  const currency = jobs[0]?.currency ?? 'GBP';
  const symbol = currency === 'GBP' ? '£' : `${currency} `;
  const rewardOptions = [
    { value: '', label: 'Any reward' },
    { value: 'under20', label: `Under ${symbol}20` },
    { value: '20to50', label: `${symbol}20–${symbol}50` },
    { value: 'over50', label: `Over ${symbol}50` },
  ];

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (device && !(job.required_devices ?? []).includes(device)) return false;
      if (browser && !(job.required_browsers ?? []).includes(browser)) return false;
      if (experience && (job.required_experience_level ?? 'any') !== experience) return false;
      if (duration) {
        const m = job.estimated_minutes_max ?? job.estimated_minutes_min ?? 0;
        if (duration === 'under30' && m > 30) return false;
        if (duration === '30to60' && (m <= 30 || m > 60)) return false;
        if (duration === 'over60' && m <= 60) return false;
      }
      if (reward) {
        const r = job.reward_amount_minor ?? 0;
        if (reward === 'under20' && r >= 2000) return false;
        if (reward === '20to50' && (r < 2000 || r > 5000)) return false;
        if (reward === 'over50' && r <= 5000) return false;
      }
      return true;
    });
  }, [jobs, device, browser, duration, reward, experience]);

  const hasActiveFilters = Boolean(device || browser || duration || reward || experience);

  const clearFilters = () => {
    setDevice('');
    setBrowser('');
    setDuration('');
    setReward('');
    setExperience('');
  };

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon="ri-compass-3-line"
        title="No tests available right now"
        description="New UAT opportunities will appear here when published."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          className={selectClass}
          aria-label="Filter by device"
        >
          <option value="">All devices</option>
          {DEVICES.map((d) => (
            <option key={d} value={d}>
              {DEVICE_LABELS[d]}
            </option>
          ))}
        </select>

        <select
          value={browser}
          onChange={(e) => setBrowser(e.target.value)}
          className={selectClass}
          aria-label="Filter by browser"
        >
          <option value="">Any browser</option>
          {BROWSERS.map((b) => (
            <option key={b} value={b}>
              {BROWSER_LABELS[b]}
            </option>
          ))}
        </select>

        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className={selectClass}
          aria-label="Filter by duration"
        >
          {DURATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          className={selectClass}
          aria-label="Filter by reward"
        >
          {rewardOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className={selectClass}
          aria-label="Filter by experience level"
        >
          <option value="">Any level</option>
          {EXPERIENCE_FILTERS.map((x) => (
            <option key={x} value={x}>
              {EXPERIENCE_LEVEL_LABELS[x]}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors px-2 py-2 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-close-circle-line w-4 h-4 flex items-center justify-center"></i>
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-foreground-500">
        Showing {filtered.length} of {jobs.length} test{jobs.length === 1 ? '' : 's'}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="ri-filter-3-line"
          title="No tests match your filters"
          description="Try adjusting or clearing your filters to see more opportunities."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} project={projectById.get(job.project_id)} tester={tester} />
          ))}
        </div>
      )}
    </div>
  );
}
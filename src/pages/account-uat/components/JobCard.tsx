import { Link } from 'react-router-dom';
import type { UatJob, UatProject, UatTester } from '@/pages/admin/website-uat/types';
import {
  formatMinorCurrency,
  remainingSlots,
  EXPERIENCE_LEVEL_LABELS,
  DEVICE_LABELS,
  BROWSER_LABELS,
} from '@/pages/admin/website-uat/marketplace';
import { formatDate } from '../types';

const EXP_ORDER: Record<string, number> = { any: 0, beginner: 1, intermediate: 2, advanced: 3 };

// Tester devices/browsers are stored as free-text (e.g. "iPhone 15", "Chrome"),
// not the job enum values. These keyword maps provide a lightweight, non-AI
// heuristic for whether a tester's listed setup covers a required device/browser.
const DEVICE_KEYWORDS: Record<string, string[]> = {
  desktop: ['desktop'],
  laptop: ['laptop', 'macbook', 'notebook'],
  iphone: ['iphone'],
  android_phone: ['android', 'galaxy', 'pixel', 'samsung'],
  ipad: ['ipad'],
  android_tablet: ['galaxy tab', 'android tablet'],
};

const BROWSER_KEYWORDS: Record<string, string[]> = {
  chrome: ['chrome'],
  safari: ['safari'],
  firefox: ['firefox'],
  edge: ['edge'],
};

function covers(testerValues: string[], keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = testerValues.map((v) => v.toLowerCase());
  return keywords.some((k) => haystack.some((h) => h.includes(k)));
}

interface Eligibility {
  matches: boolean;
  missingDevices: string[];
  missingBrowsers: string[];
  experienceGap: boolean;
  requiredExperience: string;
  hasRequirements: boolean;
}

function getEligibility(tester: UatTester | null, job: UatJob): Eligibility | null {
  if (!tester) return null;
  const requiredDevices = job.required_devices ?? [];
  const requiredBrowsers = job.required_browsers ?? [];
  const requiredExperience =
    job.required_experience_level && job.required_experience_level !== 'any'
      ? job.required_experience_level
      : 'any';

  const missingDevices = requiredDevices.filter(
    (d) => !covers(tester.devices ?? [], DEVICE_KEYWORDS[d] ?? [d]),
  );
  const missingBrowsers = requiredBrowsers.filter(
    (b) => !covers(tester.browsers ?? [], BROWSER_KEYWORDS[b] ?? [b]),
  );
  const experienceGap =
    requiredExperience !== 'any' &&
    (EXP_ORDER[tester.experience_level] ?? 0) < (EXP_ORDER[requiredExperience] ?? 0);

  const hasRequirements =
    requiredDevices.length > 0 || requiredBrowsers.length > 0 || requiredExperience !== 'any';

  return {
    matches: missingDevices.length === 0 && missingBrowsers.length === 0 && !experienceGap,
    missingDevices,
    missingBrowsers,
    experienceGap,
    requiredExperience,
    hasRequirements,
  };
}

function placesLabel(slots: number): string {
  if (slots <= 0) return 'No places left';
  if (slots === 1) return 'Last place available';
  return `${slots} places available`;
}

interface Props {
  job: UatJob;
  project?: UatProject;
  tester: UatTester | null;
}

export default function JobCard({ job, project, tester }: Props) {
  const slots = remainingSlots(job);
  const devices = (job.required_devices ?? []).map((d) => DEVICE_LABELS[d] ?? d).filter(Boolean);
  const browsers = (job.required_browsers ?? []).map((b) => BROWSER_LABELS[b] ?? b).filter(Boolean);
  const closingAt = job.application_closes_at ?? job.deadline;
  const eligibility = getEligibility(tester, job);

  const duration =
    job.estimated_minutes_min != null && job.estimated_minutes_max != null
      ? `${job.estimated_minutes_min}–${job.estimated_minutes_max} min`
      : job.estimated_minutes_max != null
        ? `Up to ${job.estimated_minutes_max} min`
        : null;

  const showRequirements =
    devices.length > 0 ||
    browsers.length > 0 ||
    (job.required_experience_level && job.required_experience_level !== 'any');

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold text-foreground-50">{job.title}</h3>
          <p className="text-sm text-foreground-500 mt-0.5">{project?.name ?? '—'}</p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-lg font-heading font-semibold text-foreground-100">
            {formatMinorCurrency(job.reward_amount_minor, job.currency)}
          </p>
          <p className="text-xs text-foreground-500">reward</p>
        </div>
      </div>

      {job.public_summary && (
        <p className="text-sm text-foreground-400 mt-3 leading-relaxed">{job.public_summary}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-400">
        {duration && (
          <span className="flex items-center gap-1.5">
            <i className="ri-timer-line w-4 h-4 flex items-center justify-center"></i>
            {duration}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <i className="ri-group-line w-4 h-4 flex items-center justify-center"></i>
          {placesLabel(slots)}
        </span>
        {closingAt && (
          <span className="flex items-center gap-1.5">
            <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
            Closes {formatDate(closingAt)}
          </span>
        )}
      </div>

      {showRequirements && (
        <div className="mt-3 flex flex-wrap gap-2">
          {devices.map((d) => (
            <span
              key={d}
              className="text-[11px] font-label px-2 py-1 rounded-full bg-secondary-500/10 text-secondary-300 whitespace-nowrap"
            >
              {d}
            </span>
          ))}
          {browsers.map((b) => (
            <span
              key={b}
              className="text-[11px] font-label px-2 py-1 rounded-full bg-secondary-500/10 text-secondary-300 whitespace-nowrap"
            >
              {b}
            </span>
          ))}
          {job.required_experience_level && job.required_experience_level !== 'any' && (
            <span className="text-[11px] font-label px-2 py-1 rounded-full bg-background-200/60 text-foreground-500 whitespace-nowrap">
              {EXPERIENCE_LEVEL_LABELS[job.required_experience_level] ?? job.required_experience_level} testers
            </span>
          )}
        </div>
      )}

      {eligibility && eligibility.hasRequirements && (
        <div className="mt-3 flex flex-wrap gap-2">
          {eligibility.matches ? (
            <span className="text-[11px] font-label px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 whitespace-nowrap inline-flex items-center gap-1">
              <i className="ri-check-line w-3 h-3 flex items-center justify-center"></i>
              Matches your profile
            </span>
          ) : (
            <>
              {eligibility.missingDevices.map((d) => (
                <span
                  key={`d-${d}`}
                  className="text-[11px] font-label px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 whitespace-nowrap"
                >
                  Requires {DEVICE_LABELS[d] ?? d}
                </span>
              ))}
              {eligibility.missingBrowsers.map((b) => (
                <span
                  key={`b-${b}`}
                  className="text-[11px] font-label px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 whitespace-nowrap"
                >
                  Requires {BROWSER_LABELS[b] ?? b}
                </span>
              ))}
              {eligibility.experienceGap && (
                <span className="text-[11px] font-label px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 whitespace-nowrap">
                  {EXPERIENCE_LEVEL_LABELS[eligibility.requiredExperience] ?? eligibility.requiredExperience} testers only
                </span>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Link
          to={`/account/uat/job/${job.id}`}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
        >
          View Test
        </Link>
      </div>
    </div>
  );
}
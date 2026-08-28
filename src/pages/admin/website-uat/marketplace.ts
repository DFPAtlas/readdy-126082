import type { UatJob } from './types';

// ── Marketplace / publication constants (Prompt 01) ─────────────────────

export const MARKETPLACE_STATUSES = [
  'draft',
  'ready',
  'published',
  'paused',
  'full',
  'closed',
  'cancelled',
] as const;
export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];

export const VISIBILITIES = ['marketplace', 'invite_only', 'internal'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const CLAIM_MODES = ['instant', 'approval_required'] as const;
export type ClaimMode = (typeof CLAIM_MODES)[number];

export const EXPERIENCE_LEVELS = ['any', 'beginner', 'intermediate', 'advanced'] as const;

export const DEVICES = [
  'desktop',
  'laptop',
  'android_phone',
  'iphone',
  'android_tablet',
  'ipad',
] as const;

export const BROWSERS = ['chrome', 'edge', 'firefox', 'safari'] as const;

export const EVIDENCE_REQUIREMENT_TAGS = [
  'notes_on_fail',
  'screenshot_on_fail',
  'video_on_fail',
  'device_information',
  'browser_information',
] as const;

/**
 * Defaults applied to a UAT job when the marketplace columns are absent
 * (legacy records created before Prompt 01). Safe non-public behaviour.
 */
export const MARKETPLACE_DEFAULTS = {
  marketplace_status: 'draft' as const,
  visibility: 'internal' as const,
  claim_mode: 'approval_required' as const,
  reward_amount_minor: 0,
  currency: 'GBP',
  tester_slots_filled: 0,
  evidence_requirement_tags: [] as string[],
};

// ── Reusable query/visibility helpers ────────────────────────────────────

interface MarketplaceVisibleInput {
  marketplace_status?: string | null;
  visibility?: string | null;
  application_opens_at?: string | null;
  application_closes_at?: string | null;
  max_testers?: number | null;
  tester_slots_filled?: number | null;
  reserve_count?: number | null;
}

/**
 * Determines whether a UAT job is currently eligible for public marketplace
 * display. This is the single source of truth for the "marketplace-visible"
 * predicate. It performs NO mutation and only reads safe metadata.
 *
 * Visibility requires all of:
 *   - marketplace_status === 'published'
 *   - visibility === 'marketplace'
 *   - opens_at reached (or empty)
 *   - closes_at not passed (or empty)
 *   - available slots remain
 */
export function isMarketplaceVisible(job: MarketplaceVisibleInput): boolean {
  if ((job.marketplace_status ?? MARKETPLACE_DEFAULTS.marketplace_status) !== 'published') return false;
  if ((job.visibility ?? MARKETPLACE_DEFAULTS.visibility) !== 'marketplace') return false;

  const now = Date.now();

  if (job.application_opens_at) {
    const opensAt = new Date(job.application_opens_at).getTime();
    if (Number.isFinite(opensAt) && opensAt > now) return false;
  }

  if (job.application_closes_at) {
    const closesAt = new Date(job.application_closes_at).getTime();
    if (Number.isFinite(closesAt) && closesAt < now) return false;
  }

  const total = job.max_testers ?? 0;
  const filled = allocatedSlots({
    max_testers: job.max_testers ?? 0,
    tester_slots_filled: job.tester_slots_filled ?? MARKETPLACE_DEFAULTS.tester_slots_filled,
    reserve_count: job.reserve_count ?? 0,
  });
  if (total > 0 && filled >= total) return false;

  return true;
}

/** Returns the number of currently allocated tester places (filled or reserved). */
export function allocatedSlots(
  job: Pick<UatJob, 'max_testers' | 'tester_slots_filled'> & { reserve_count?: number | null },
): number {
  return Math.max(job.tester_slots_filled ?? 0, job.reserve_count ?? 0);
}

/** Returns the number of remaining open tester slots (0 if full). */
export function remainingSlots(
  job: Pick<UatJob, 'max_testers' | 'tester_slots_filled'> & { reserve_count?: number | null },
): number {
  const total = job.max_testers ?? 0;
  return Math.max(0, total - allocatedSlots(job));
}

/**
 * Formats an integer minor-unit reward (e.g. 2500 → "£25.00").
 * Never used for payment processing — display only.
 */
export function formatMinorCurrency(minor: number, currency: string): string {
  const symbol = currency === 'GBP' ? '£' : `${currency} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

// ── Human-readable labels (Prompt 02) ───────────────────────────────────

export const MARKETPLACE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  published: 'Published',
  paused: 'Paused',
  full: 'Full',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const VISIBILITY_LABELS: Record<string, string> = {
  marketplace: 'Tester Marketplace',
  invite_only: 'Invite Only',
  internal: 'Internal Only',
};

export const CLAIM_MODE_LABELS: Record<string, string> = {
  instant: 'Instant Claim',
  approval_required: 'Approval Required',
};

export const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  any: 'Any',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Desktop',
  laptop: 'Laptop',
  android_phone: 'Android Phone',
  iphone: 'iPhone',
  android_tablet: 'Android Tablet',
  ipad: 'iPad',
};

export const BROWSER_LABELS: Record<string, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
};

export const EVIDENCE_REQUIREMENT_LABELS: Record<string, string> = {
  notes_on_fail: 'Notes required on FAIL',
  screenshot_on_fail: 'Screenshot required on FAIL',
  video_on_fail: 'Video required on FAIL',
  device_information: 'Capture device information',
  browser_information: 'Capture browser information',
};

/** Rating scale options supported by the existing tester system (1–5, 0.5 steps). */
export const MINIMUM_RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

// ── Currency helpers (display only — never payment processing) ──────────

/** Converts a whole-pounds/decimal GBP value into integer minor units (e.g. 25.00 → 2500). */
export function poundsToMinor(pounds: number): number {
  return Math.round(pounds * 100);
}

/** Converts integer minor units back to pounds (e.g. 2500 → 25). */
export function minorToPounds(minor: number): number {
  return minor / 100;
}

/** Maximum tester reward budget = reward per tester × total tester places. Display only. */
export function maxRewardBudget(rewardMinor: number, slots: number): number {
  return rewardMinor * slots;
}

// ── datetime-local helpers ──────────────────────────────────────────────

/** Converts an ISO timestamp to a browser-local `datetime-local` input value. */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a `datetime-local` input value back to an ISO timestamp (or null if empty). */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ── Publication lifecycle helpers (Prompt 03) ───────────────────────────

export const MARKETPLACE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-foreground-500/10 text-foreground-400',
  ready: 'bg-sky-500/10 text-sky-400',
  published: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-400',
  full: 'bg-orange-500/10 text-orange-400',
  closed: 'bg-foreground-500/10 text-foreground-500',
  cancelled: 'bg-red-500/10 text-red-400',
};

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  hint?: string;
}

/**
 * Builds the publication-readiness checklist for a UAT job. This is the
 * single source of truth for whether configuration is complete enough to
 * publish. It performs NO mutation and reads only safe metadata.
 */
export function buildReadinessChecks(job: UatJob, testCaseCount: number, now: number = Date.now()): ReadinessCheck[] {
  const title = (job.title ?? '').trim();
  const summary = (job.public_summary ?? '').trim();
  const reward = job.reward_amount_minor ?? 0;
  const slots = job.max_testers ?? 0;
  const minMin = job.estimated_minutes_min;
  const maxMin = job.estimated_minutes_max;
  const timeValid = minMin != null && minMin > 0 && maxMin != null && maxMin >= minMin;
  const opensAt = job.application_opens_at ? new Date(job.application_opens_at).getTime() : null;
  const closesAt = job.application_closes_at ? new Date(job.application_closes_at).getTime() : null;
  const windowValid = !(
    opensAt != null && closesAt != null &&
    Number.isFinite(opensAt) && Number.isFinite(closesAt) && closesAt <= opensAt
  );
  const notExpired = !(closesAt != null && Number.isFinite(closesAt) && closesAt < now);

  return [
    { key: 'title', label: 'Title configured', passed: title.length > 0 },
    { key: 'summary', label: 'Summary configured', passed: summary.length > 0 },
    { key: 'reward', label: 'Reward configured', passed: reward > 0 },
    { key: 'currency', label: 'Currency configured', passed: (job.currency ?? '').trim().length > 0 },
    { key: 'slots', label: 'Tester places configured', passed: slots >= 1, hint: slots >= 1 ? `${slots} place${slots === 1 ? '' : 's'}` : undefined },
    { key: 'time', label: 'Testing time configured', passed: timeValid },
    { key: 'test_cases', label: 'UAT test cases', passed: testCaseCount > 0, hint: `${testCaseCount} test case${testCaseCount === 1 ? '' : 's'}` },
    { key: 'visibility', label: 'Visibility selected', passed: (VISIBILITIES as readonly string[]).includes(job.visibility ?? '') },
    { key: 'claim_mode', label: 'Claim mode selected', passed: (CLAIM_MODES as readonly string[]).includes(job.claim_mode ?? '') },
    { key: 'window', label: 'Availability window valid', passed: windowValid },
    { key: 'not_expired', label: 'Closing date not passed', passed: notExpired },
  ];
}

export function isReadyToPublish(job: UatJob, testCaseCount: number, now: number = Date.now()): boolean {
  return buildReadinessChecks(job, testCaseCount, now).every((c) => c.passed);
}

/** Formats an ISO timestamp for admin display (e.g. "26 Aug 2026, 09:00"). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export type MarketplaceVisibilityState =
  | 'not_published'
  | 'not_public'
  | 'scheduled'
  | 'visible'
  | 'ended'
  | 'full'
  | 'paused'
  | 'closed'
  | 'cancelled';

/**
 * Human-readable marketplace availability for the admin status card.
 * Keeps publication state and actual availability as distinct concepts.
 */
export function marketplaceVisibilityLabel(
  job: UatJob,
  now: number = Date.now(),
): { state: MarketplaceVisibilityState; label: string } {
  const status = job.marketplace_status ?? 'draft';
  if (status === 'paused') return { state: 'paused', label: 'Paused' };
  if (status === 'closed') return { state: 'closed', label: 'Closed' };
  if (status === 'cancelled') return { state: 'cancelled', label: 'Cancelled' };
  if (status === 'full') return { state: 'full', label: 'Full — no places remaining' };
  if (status !== 'published') return { state: 'not_published', label: 'Not published' };

  if ((job.visibility ?? 'internal') !== 'marketplace') {
    return { state: 'not_public', label: `Not public — ${VISIBILITY_LABELS[job.visibility] ?? 'internal'}` };
  }

  if (remainingSlots(job) <= 0) return { state: 'full', label: 'Full — no places remaining' };

  const opensAt = job.application_opens_at ? new Date(job.application_opens_at).getTime() : null;
  if (opensAt != null && Number.isFinite(opensAt) && opensAt > now) {
    return { state: 'scheduled', label: `Scheduled — opens ${formatDateTime(job.application_opens_at)}` };
  }

  const closesAt = job.application_closes_at ? new Date(job.application_closes_at).getTime() : null;
  if (closesAt != null && Number.isFinite(closesAt) && closesAt < now) {
    return { state: 'ended', label: 'Listing window ended' };
  }

  return { state: 'visible', label: 'Visible' };
}
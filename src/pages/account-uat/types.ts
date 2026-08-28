/**
 * Tester-facing UAT account helpers.
 *
 * These live separately from the DFP Command admin types so the tester surface
 * stays decoupled from internal tooling. The data entity shapes (UatJob,
 * UatAssignment, UatReward, UatTester) are reused from the existing admin types.
 */

/** Tester-facing access classification derived from the stored tester status. */
export type TesterAccessState =
  | 'loading'
  | 'not_signed_in'
  | 'not_a_tester'
  | 'pending'
  | 'suspended'
  | 'inactive'
  | 'error'
  | 'approved';

const PENDING_STATUSES = ['pending', 'onboarding', 'under_review'];
const SUSPENDED_STATUSES = ['suspended'];
const INACTIVE_STATUSES = ['inactive', 'archived', 'rejected'];

/**
 * Maps the stored `uat_testers.status` to a tester-facing access state.
 * Only `approved` / `active` testers are eligible for the full dashboard,
 * mirroring `app_private.current_uat_tester_id()`.
 */
export function classifyTesterStatus(status: string): TesterAccessState {
  if (status === 'approved' || status === 'active') return 'approved';
  if (PENDING_STATUSES.includes(status)) return 'pending';
  if (SUSPENDED_STATUSES.includes(status)) return 'suspended';
  return 'inactive';
}

/** Normalises the reward ledger status so legacy `pending` rows map onto the
 * `pending_review` display bucket used across the admin reward status maps. */
export function normalizeRewardStatus(status: string | null | undefined): string {
  if (!status) return 'pending_review';
  if (status === 'pending') return 'pending_review';
  return status;
}

/**
 * Tester-facing review status labels. Kept separate from the admin
 * `REVIEW_STATUS_LABELS` so DFP "approved" reads as "Accepted" to the tester,
 * matching the submission (not reward) lifecycle.
 */
export const TESTER_REVIEW_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Awaiting Review',
  changes_requested: 'More Information Required',
  approved: 'Accepted',
  rejected: 'Rejected',
};

export const TESTER_REVIEW_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-500/10 text-yellow-400',
  changes_requested: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
};

/** Formats an ISO timestamp as a short, human-readable date (e.g. "26 Aug 2026"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
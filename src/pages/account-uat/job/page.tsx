import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTester } from '@/components/feature/TesterAuthGuard';
import type { UatJob, UatProject, UatAssignment, UatJobApplication } from '@/pages/admin/website-uat/types';
import {
  formatMinorCurrency,
  remainingSlots,
  isMarketplaceVisible,
  DEVICE_LABELS,
  BROWSER_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  CLAIM_MODE_LABELS,
  EVIDENCE_REQUIREMENT_LABELS,
} from '@/pages/admin/website-uat/marketplace';
import { formatDate } from '../types';

type ActionState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'assigned'; assignmentId: string }
  | { kind: 'applied' }
  | { kind: 'error'; message: string };

/** Friendly mapping for the server-side claim/apply rejection reasons. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('no tester places remaining') || m.includes('place')) {
    return 'This test is no longer available.';
  }
  if (m.includes('not publicly available') || m.includes('not open') || m.includes('not currently')) {
    return 'This test is no longer available.';
  }
  if (m.includes('has closed') || m.includes('expired')) {
    return 'This test has closed.';
  }
  if (m.includes('not opened yet')) {
    return 'This test is not open yet.';
  }
  if (m.includes('already have an active assignment') || m.includes('already assigned')) {
    return 'You are already assigned to this test.';
  }
  if (m.includes('pending application')) {
    return 'You already have a pending application for this test.';
  }
  if (m.includes('requires approval') || m.includes('does not require an application')) {
    return 'This test has a different application flow. Please refresh the page.';
  }
  return message;
}

/**
 * Tester-facing UAT job detail with secure claim / apply.
 *
 * Reads only safe listing fields. Claiming is performed entirely server-side
 * via the existing `claim_uat_job_instant` (instant) and `apply_uat_job`
 * (approval_required) SECURITY DEFINER RPCs, which atomically re-check the
 * marketplace window, eligibility, duplicate assignments and capacity. No
 * browser-side slot logic, no overbooking, no credential exposure.
 */
export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { tester } = useTester();

  const [job, setJob] = useState<UatJob | null>(null);
  const [project, setProject] = useState<UatProject | null>(null);
  const [existingAssignment, setExistingAssignment] = useState<UatAssignment | null>(null);
  const [pendingApplication, setPendingApplication] = useState<UatJobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<ActionState>({ kind: 'idle' });

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: j, error: je } = await supabase
          .from('uat_jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();
        if (je) throw je;
        if (cancelled) return;
        if (!j || !isMarketplaceVisible(j as UatJob)) {
          setJob(null);
          setError('This test is not currently available.');
          return;
        }
        setJob(j as UatJob);

        const [pRes, aRes, appRes] = await Promise.all([
          supabase.from('uat_projects').select('*').eq('id', (j as UatJob).project_id).maybeSingle(),
          tester
            ? supabase
                .from('uat_assignments')
                .select('*')
                .eq('job_id', jobId)
                .eq('tester_id', tester.id)
                .not('status', 'in', '(rejected,expired,cancelled)')
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          tester
            ? supabase
                .from('uat_job_applications')
                .select('*')
                .eq('job_id', jobId)
                .eq('tester_id', tester.id)
                .eq('status', 'pending')
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (cancelled) return;
        setProject((pRes.data as UatProject) ?? null);
        setExistingAssignment((aRes.data as UatAssignment) ?? null);
        setPendingApplication((appRes.data as UatJobApplication) ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, tester]);

  const handleClaim = async () => {
    if (!job) return;
    setAction({ kind: 'busy' });
    const { data, error: err } = await supabase.rpc('claim_uat_job_instant', { p_job_id: job.id });
    if (err) {
      setAction({ kind: 'error', message: friendlyError(err.message) });
      return;
    }
    const assignmentId = data as string | null;
    if (!assignmentId) {
      setAction({ kind: 'error', message: 'Unable to claim this test. Please try again.' });
      return;
    }
    setExistingAssignment({
      id: assignmentId,
      status: 'reserved',
      agreed_reward_amount_minor: job.reward_amount_minor,
      currency: job.currency,
    } as UatAssignment);
    setAction({ kind: 'assigned', assignmentId });
  };

  const handleApply = async () => {
    if (!job) return;
    setAction({ kind: 'busy' });
    const { data, error: err } = await supabase.rpc('apply_uat_job', { p_job_id: job.id });
    if (err) {
      setAction({ kind: 'error', message: friendlyError(err.message) });
      return;
    }
    const applicationId = data as string | null;
    if (!applicationId) {
      setAction({ kind: 'error', message: 'Unable to apply for this test. Please try again.' });
      return;
    }
    setPendingApplication({
      id: applicationId,
      status: 'pending',
    } as UatJobApplication);
    setAction({ kind: 'applied' });
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-28 bg-background-300/40 rounded"></div>
        <div className="h-44 bg-background-300/30 rounded-lg"></div>
        <div className="h-24 bg-background-300/30 rounded-lg"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-foreground-400 text-sm mb-4">{error || 'Test not found.'}</p>
        <Link
          to="/uat"
          className="bg-accent-500 text-background-950 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
        >
          Back to tests
        </Link>
      </div>
    );
  }

  const slots = remainingSlots(job);
  const devices = (job.required_devices ?? []).map((d) => DEVICE_LABELS[d] ?? d).filter(Boolean);
  const browsers = (job.required_browsers ?? []).map((b) => BROWSER_LABELS[b] ?? b).filter(Boolean);
  const evidenceTags = (job.evidence_requirement_tags ?? [])
    .map((t) => EVIDENCE_REQUIREMENT_LABELS[t] ?? t)
    .filter(Boolean);
  const opensAt = job.application_opens_at;
  const closesAt = job.application_closes_at ?? job.deadline;
  const isInstant = job.claim_mode === 'instant';

  const duration =
    job.estimated_minutes_min != null && job.estimated_minutes_max != null
      ? `${job.estimated_minutes_min}–${job.estimated_minutes_max} min`
      : job.estimated_minutes_max != null
        ? `Up to ${job.estimated_minutes_max} min`
        : '—';

  const meta: { label: string; value: string }[] = [
    { label: 'Estimated time', value: duration },
    { label: 'Places remaining', value: slots <= 0 ? 'Full' : slots === 1 ? 'Last place' : `${slots}` },
    { label: 'Opens', value: opensAt ? formatDate(opensAt) : 'Now' },
    { label: 'Closes', value: formatDate(closesAt) },
    {
      label: 'Experience',
      value:
        job.required_experience_level && job.required_experience_level !== 'any'
          ? EXPERIENCE_LEVEL_LABELS[job.required_experience_level] ?? job.required_experience_level
          : 'Any',
    },
    { label: 'Application', value: CLAIM_MODE_LABELS[job.claim_mode] ?? job.claim_mode },
  ];

  return (
    <div className="space-y-6">
      <Link
        to="/uat"
        className="inline-flex items-center gap-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer"
      >
        <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
        Back to tests
      </Link>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-heading font-bold text-foreground-50">{job.title}</h1>
            <p className="text-sm text-foreground-500 mt-1">{project?.name ?? '—'}</p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-2xl font-heading font-bold text-foreground-100">
              {formatMinorCurrency(job.reward_amount_minor, job.currency)}
            </p>
            <p className="text-xs text-foreground-500">reward</p>
          </div>
        </div>

        {job.public_summary && (
          <p className="mt-5 text-sm text-foreground-400 leading-relaxed">{job.public_summary}</p>
        )}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {meta.map((m) => (
            <div key={m.label}>
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">
                {m.label}
              </p>
              <p className="text-sm text-foreground-200 mt-1">{m.value}</p>
            </div>
          ))}
        </div>

        {(devices.length > 0 || browsers.length > 0) && (
          <div className="mt-6">
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-2">Requirements</p>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
        )}
      </div>

      {job.test_instructions && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-3">Tester instructions</h2>
          <p className="text-sm text-foreground-400 leading-relaxed whitespace-pre-wrap">{job.test_instructions}</p>
        </div>
      )}

      {(job.evidence_requirements || evidenceTags.length > 0) && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-3">Evidence expectations</h2>
          {job.evidence_requirements && (
            <p className="text-sm text-foreground-400 leading-relaxed whitespace-pre-wrap">{job.evidence_requirements}</p>
          )}
          {evidenceTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceTags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] font-label px-2 py-1 rounded-full bg-accent-500/10 text-accent-300 whitespace-nowrap"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <ClaimPanel
        isInstant={isInstant}
        rewardMinor={job.reward_amount_minor}
        currency={job.currency}
        deadline={closesAt}
        existingAssignment={existingAssignment}
        pendingApplication={pendingApplication}
        action={action}
        onClaim={handleClaim}
        onApply={handleApply}
        onViewAssignment={() => navigate(`/account/uat/assignment/${existingAssignment?.id}`)}
      />
    </div>
  );
}

function ClaimPanel({
  isInstant,
  rewardMinor,
  currency,
  deadline,
  existingAssignment,
  pendingApplication,
  action,
  onClaim,
  onApply,
  onViewAssignment,
}: {
  isInstant: boolean;
  rewardMinor: number;
  currency: string;
  deadline: string | null;
  existingAssignment: UatAssignment | null;
  pendingApplication: UatJobApplication | null;
  action: ActionState;
  onClaim: () => void;
  onApply: () => void;
  onViewAssignment: () => void;
}) {
  // Already assigned (either detected on load, or just claimed).
  if (existingAssignment) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-check-line text-emerald-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground-50">
                {action.kind === 'assigned' ? 'Test Assigned' : 'You are already assigned to this test.'}
              </h2>
              {action.kind === 'assigned' && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground-400">
                    <span className="text-foreground-500 whitespace-nowrap">Reward:</span>
                    <span className="text-foreground-100 font-medium">
                      {formatMinorCurrency(rewardMinor, currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-400">
                    <span className="text-foreground-500 whitespace-nowrap">Deadline:</span>
                    <span className="text-foreground-100 font-medium">{formatDate(deadline)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onViewAssignment}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            Go to My Test
          </button>
        </div>
      </div>
    );
  }

  // Already applied (approval_required) — no claim button.
  if (pendingApplication) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
            <i className="ri-time-line text-amber-400 text-xl w-5 h-5 flex items-center justify-center"></i>
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground-50">Application Pending</h2>
            <p className="text-sm text-foreground-500 mt-1">
              Your application has been submitted and is awaiting DFP review. You'll be notified of the outcome.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const busy = action.kind === 'busy';
  const claimError = action.kind === 'error' ? action.message : '';

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="font-heading text-base font-semibold text-foreground-50">
            {isInstant ? 'Claim this test' : 'Apply for this test'}
          </h2>
          <p className="text-sm text-foreground-500 mt-1">
            {isInstant
              ? 'You will be assigned immediately if a place is available.'
              : 'Submit an application — DFP will review it before a place is confirmed.'}
          </p>
          {claimError && (
            <p className="mt-3 inline-flex items-start gap-2 text-sm text-red-400">
              <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center mt-0.5"></i>
              {claimError}
            </p>
          )}
        </div>
        <button
          onClick={isInstant ? onClaim : onApply}
          disabled={busy}
          className={`font-semibold text-sm px-6 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            busy
              ? 'bg-foreground-500/20 text-foreground-500 cursor-not-allowed'
              : 'bg-accent-500 hover:bg-accent-400 text-background-950'
          }`}
        >
          {busy ? 'Please wait…' : isInstant ? 'Claim Test' : 'Apply for Test'}
        </button>
      </div>
    </div>
  );
}
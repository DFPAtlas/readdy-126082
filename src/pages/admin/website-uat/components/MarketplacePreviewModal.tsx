import Modal from '@/components/base/Modal';
import type { UatJob } from '../types';
import {
  CLAIM_MODE_LABELS,
  DEVICE_LABELS,
  BROWSER_LABELS,
  EVIDENCE_REQUIREMENT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  formatMinorCurrency,
  formatDateTime,
  remainingSlots,
} from '../marketplace';

interface Props {
  open: boolean;
  job: UatJob | null;
  onClose: () => void;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-foreground-500">{label}:</span>
      <span className="text-foreground-200 ml-1">{value}</span>
    </div>
  );
}

export default function MarketplacePreviewModal({ open, job, onClose }: Props) {
  if (!job) return null;

  const reward = formatMinorCurrency(job.reward_amount_minor ?? 0, job.currency ?? 'GBP');
  const total = job.max_testers ?? 0;
  const remaining = remainingSlots(job);
  const timeLabel =
    job.estimated_minutes_min != null && job.estimated_minutes_max != null
      ? `${job.estimated_minutes_min}–${job.estimated_minutes_max} minutes`
      : job.estimated_minutes_min != null
        ? `~${job.estimated_minutes_min} minutes`
        : 'Not specified';

  const devices = job.required_devices?.length
    ? job.required_devices.map((d) => DEVICE_LABELS[d] ?? d).join(', ')
    : 'No specific requirement';
  const browsers = job.required_browsers?.length
    ? job.required_browsers.map((b) => BROWSER_LABELS[b] ?? b).join(', ')
    : 'No specific requirement';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preview Listing"
      className="max-w-2xl"
      lockScroll={true}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {/* ── Tester-facing card ── */}
        <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
          <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-3">What approved testers will see</p>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-foreground-500 uppercase tracking-wide">{job.project_name ?? 'DFP UAT Project'}</p>
              <h3 className="text-base font-semibold text-foreground-50 mt-1">{job.title || 'Untitled UAT'}</h3>
            </div>

            {job.public_summary && <p className="text-sm text-foreground-300 leading-relaxed">{job.public_summary}</p>}
            {job.test_instructions && <p className="text-xs text-foreground-500 leading-relaxed">{job.test_instructions}</p>}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-accent-500/15 text-accent-400 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">{reward}</span>
              <span className="bg-background-100 border border-background-300/60 text-foreground-300 text-xs px-3 py-1.5 rounded-full whitespace-nowrap">{timeLabel}</span>
              <span className="bg-background-100 border border-background-300/60 text-foreground-300 text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
                {remaining} of {total} places left
              </span>
            </div>
          </div>
        </div>

        {/* ── Details grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <Detail label="Tester experience" value={EXPERIENCE_LEVEL_LABELS[job.required_experience_level] ?? job.required_experience_level} />
          <Detail label="Minimum rating" value={job.minimum_tester_rating != null ? `${job.minimum_tester_rating}+` : 'No minimum'} />
          <Detail label="Devices" value={devices} />
          <Detail label="Browsers" value={browsers} />
          <Detail label="Claim mode" value={CLAIM_MODE_LABELS[job.claim_mode] ?? job.claim_mode} />
          <Detail label="Opens" value={formatDateTime(job.application_opens_at) || 'Immediately on publish'} />
          <Detail label="Closes" value={formatDateTime(job.application_closes_at) || 'Until full or closed'} />
        </div>

        {/* ── Evidence expectations ── */}
        <div>
          <p className="text-xs font-semibold text-foreground-300 mb-2">Evidence expectations</p>
          {job.evidence_requirement_tags?.length ? (
            <ul className="space-y-1">
              {job.evidence_requirement_tags.map((t) => (
                <li key={t} className="flex items-center gap-2 text-xs text-foreground-400">
                  <i className="ri-checkbox-circle-line text-accent-400 w-4 h-4 flex items-center justify-center"></i>
                  {EVIDENCE_REQUIREMENT_LABELS[t] ?? t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-foreground-500">No specific evidence requirements.</p>
          )}
        </div>

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
          <p className="text-[10px] text-foreground-500">
            Safe preview only — internal credentials, environment passwords, customer information and internal notes are never shown to testers.
          </p>
        </div>
      </div>
    </Modal>
  );
}
import { useState } from 'react';
import type { Project } from '../types';
import { formatDate, formatRelative } from '../utils';
import type { ProjectOperationsData } from '../useProjectOperations';
import type { ProjectDeploymentData } from '../useProjectDeployment';
import type { MonitoringIncident } from '../monitoringTypes';
import type { ReviewType } from '../operationsTypes';
import { REVIEW_TYPE_LABELS } from '../operationsTypes';
import Modal from '@/components/base/Modal';
import CreateBugModal, { type CreateBugDefaults } from './CreateBugModal';
import CreateChangeRequestModal from './CreateChangeRequestModal';

interface OperationsReviewPanelProps {
  project: Project;
  operations: ProjectOperationsData;
  deployment: ProjectDeploymentData;
  monitoringStatusLabel: string;
  monitoringIncidents: MonitoringIncident[];
  supportOpen: number;
  supportCritical: number;
  criticalBugs: number;
  budgetStatusLabel: string;
  backlogCount: number;
  onPlanMaintenance: () => void;
  onRefresh: () => void;
}

export default function OperationsReviewPanel({
  project,
  operations,
  deployment,
  monitoringStatusLabel,
  monitoringIncidents,
  supportOpen,
  supportCritical,
  criticalBugs,
  budgetStatusLabel,
  backlogCount,
  onPlanMaintenance,
  onRefresh,
}: OperationsReviewPanelProps) {
  const [showReview, setShowReview] = useState(false);
  const [bugDefaults, setBugDefaults] = useState<CreateBugDefaults | null>(null);
  const [changeDefaults, setChangeDefaults] = useState<{
    title: string;
    description: string;
    priority: string;
    origin: string;
  } | null>(null);

  const isLive = project.status === 'live' || project.launched_at != null;

  const postLaunchReview = operations.reviews.find(
    (r) => r.review_type === 'POST_LAUNCH' && r.status === 'COMPLETED',
  );
  const lastReview = operations.reviews
    .filter((r) => r.status === 'COMPLETED')
    .sort((a, b) => new Date(b.review_date ?? b.created_at).getTime() - new Date(a.review_date ?? a.created_at).getTime())[0] ?? null;

  // Current release: accepted → verified → rolled back, else unknown.
  const accepted = deployment.deployments.find((d) => d.production_accepted);
  const verified = deployment.deployments.find((d) => d.status === 'VERIFIED');
  const rolledBack = deployment.deployments.find((d) => d.status === 'ROLLED_BACK');
  const currentRelease = accepted ?? verified ?? rolledBack ?? null;
  const currentReleaseSha = currentRelease
    ? (currentRelease.deployed_sha ?? currentRelease.github_sha).slice(0, 8)
    : 'Unknown';

  const openIncidents = monitoringIncidents.filter((i) => !i.resolved_at).length;

  const snapshotRows: { label: string; value: string }[] = [
    { label: 'Launch Date', value: project.launched_at ? formatDate(project.launched_at) : 'Not launched' },
    { label: 'Current Release', value: currentRelease ? `SHA ${currentReleaseSha}` : 'None recorded' },
    { label: 'Operational Health', value: monitoringStatusLabel },
    { label: 'Open Incidents', value: String(openIncidents) },
    { label: 'Open Critical Issues', value: String(criticalBugs) },
    { label: 'Support Load', value: `${supportOpen} open · ${supportCritical} critical` },
    { label: 'Budget Position', value: budgetStatusLabel || 'Unknown' },
    { label: 'Improvement Backlog', value: String(backlogCount) },
  ];

  const hasRecentReview = lastReview != null;

  return (
    <div className="space-y-6">
      {/* ── Post-Launch Review ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            <i className="ri-file-list-3-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Post-Launch Review
          </h4>
          {isLive && (
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-play-line w-4 h-4 flex items-center justify-center"></i>
              Start Review
            </button>
          )}
        </div>

        {!isLive ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-4">
            <p className="text-sm text-foreground-500">Project has not launched yet — post-launch review is not applicable.</p>
          </div>
        ) : (
          <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
            {snapshotRows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-foreground-400">{r.label}</span>
                <span className="text-sm text-foreground-200 text-right truncate">{r.value}</span>
              </div>
            ))}
          </div>
        )}

        {isLive && !postLaunchReview && (
          <p className="text-[10px] text-amber-400 mt-1.5">No post-launch review recorded.</p>
        )}
        {postLaunchReview && (
          <p className="text-[10px] text-emerald-400 mt-1.5">
            Post-launch review completed {formatRelative(postLaunchReview.review_date ?? postLaunchReview.created_at)}.
          </p>
        )}
      </section>

      {/* ── Monthly Operations Review ──────────────────────────────────────── */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-calendar-check-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Operational Review
        </h4>
        {!hasRecentReview ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-4">
            <p className="text-sm text-foreground-500">No operational review recorded.</p>
          </div>
        ) : (
          <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-foreground-400">Last Review</span>
              <span className="text-sm text-foreground-200">{formatRelative(lastReview.review_date ?? lastReview.created_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-foreground-400">Review Type</span>
              <span className="text-sm text-foreground-200">{REVIEW_TYPE_LABELS[lastReview.review_type]}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-foreground-400">Open Actions</span>
              <span className="text-sm text-foreground-200">{lastReview.recommended_actions ? 'Recorded' : 'None recorded'}</span>
            </div>
            {lastReview.summary && <p className="text-xs text-foreground-500 px-4 py-2.5 line-clamp-2">{lastReview.summary}</p>}
          </div>
        )}
      </section>

      {/* ── Review actions (from most recent completed review) ─────────────── */}
      {lastReview && (
        <section>
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
            <i className="ri-play-list-add-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Review Actions
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBugDefaults({ title: `Review follow-up: ${lastReview.review_type}`, description: lastReview.recommended_actions ?? lastReview.summary ?? '', severity: 'medium', source: 'project' })}
              className="text-xs text-red-400 hover:text-red-300 border border-background-200/60 rounded-full px-3 py-1.5 whitespace-nowrap cursor-pointer"
            >
              Create Bug
            </button>
            <button
              type="button"
              onClick={() => setChangeDefaults({ title: `Improvement from ${lastReview.review_type.toLowerCase()} review`, description: lastReview.recommended_actions ?? lastReview.summary ?? '', priority: 'medium', origin: 'post_launch_review' })}
              className="text-xs text-sky-400 hover:text-sky-300 border border-background-200/60 rounded-full px-3 py-1.5 whitespace-nowrap cursor-pointer"
            >
              Create Change Request
            </button>
            <button
              type="button"
              onClick={onPlanMaintenance}
              className="text-xs text-accent-400 hover:text-accent-300 border border-background-200/60 rounded-full px-3 py-1.5 whitespace-nowrap cursor-pointer"
            >
              Plan Maintenance
            </button>
          </div>
        </section>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showReview && (
        <ReviewWorkspaceModal
          open
          onClose={() => setShowReview(false)}
          onSubmit={operations.createReview}
          snapshotRows={snapshotRows}
          projectName={project.project_name}
        />
      )}
      {bugDefaults && (
        <CreateBugModal
          open
          onClose={() => setBugDefaults(null)}
          onCreated={() => {
            setBugDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={bugDefaults}
          originLabel="Review"
        />
      )}
      {changeDefaults && (
        <CreateChangeRequestModal
          open
          onClose={() => setChangeDefaults(null)}
          onCreated={() => {
            setChangeDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={{ ...changeDefaults, origin: changeDefaults.origin }}
          originLabel="Review"
        />
      )}
    </div>
  );
}

// ─── Review workspace modal ────────────────────────────────────────────────

interface ReviewWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    reviewType: ReviewType;
    summary?: string | null;
    whatWorked?: string | null;
    whatFailed?: string | null;
    lessonsLearned?: string | null;
    recommendedActions?: string | null;
    status?: 'COMPLETED';
  }) => Promise<string | null>;
  snapshotRows: { label: string; value: string }[];
  projectName: string;
}

function ReviewWorkspaceModal({ open, onClose, onSubmit, snapshotRows, projectName }: ReviewWorkspaceModalProps) {
  const [summary, setSummary] = useState('');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatFailed, setWhatFailed] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [recommendedActions, setRecommendedActions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    const err = await onSubmit({
      reviewType: 'POST_LAUNCH',
      summary: summary.trim() || null,
      whatWorked: whatWorked.trim() || null,
      whatFailed: whatFailed.trim() || null,
      lessonsLearned: lessonsLearned.trim() || null,
      recommendedActions: recommendedActions.trim() || null,
      status: 'COMPLETED',
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post-Launch Review"
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            {saving ? 'Saving...' : 'Complete Review'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center gap-2 text-xs text-foreground-500">
          <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-foreground-500/10 text-foreground-400 uppercase whitespace-nowrap">
            Project Snapshot
          </span>
          <span>{projectName}</span>
        </div>

        <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
          {snapshotRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-xs text-foreground-400">{r.label}</span>
              <span className="text-xs text-foreground-200 text-right truncate">{r.value}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <Field label="What Worked" value={whatWorked} onChange={setWhatWorked} />
          <Field label="What Failed" value={whatFailed} onChange={setWhatFailed} />
          <Field label="Lessons Learned" value={lessonsLearned} onChange={setLessonsLearned} />
          <Field label="Recommended Actions" value={recommendedActions} onChange={setRecommendedActions} />
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Overall review summary..."
              rows={2}
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
            />
          </div>
        </div>

        <p className="text-[10px] text-foreground-600">
          Recommendations are notes only — nothing is auto-executed. Use Review Actions afterwards to create Bug / Change / Maintenance records.
        </p>
      </div>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label}...`}
        rows={2}
        className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
      />
    </div>
  );
}
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, SectionKey } from '../types';
import { formatDate, formatRelative } from '../utils';
import type { ProjectIntegration } from '../infrastructureTypes';
import {
  GATE_LABELS,
  GATE_ICONS,
  GATE_STATE_LABELS,
  GATE_STATE_STYLES,
  DECISION_LABELS,
  DECISION_STYLES,
  APPROVAL_LABELS,
  buildLaunchSnapshot,
  type LaunchEvaluation,
  type LaunchGate,
  type LaunchApproval,
  type ApprovalDecision,
} from '../launchTypes';
import type { ProjectLaunchData } from '../useProjectLaunch';

interface LaunchSectionProps {
  project: Project;
  integration: ProjectIntegration | null;
  evaluation: LaunchEvaluation;
  launch: ProjectLaunchData;
  onRefresh: () => void;
}

const APPROVAL_STYLES: Record<ApprovalDecision, string> = {
  NOT_REQUESTED: 'bg-foreground-500/10 text-foreground-500',
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400',
  REJECTED: 'bg-red-500/10 text-red-400',
  SUPERSEDED: 'bg-foreground-500/10 text-foreground-600',
};

export default function LaunchSection({
  project,
  integration,
  evaluation,
  launch,
  onRefresh,
}: LaunchSectionProps) {
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const approval = launch.latest;
  const pendingApproval = approval?.decision === 'PENDING' ? approval : null;

  const hasUnknownGate = evaluation.gates.some((g) => g.state === 'UNKNOWN');
  const canRequest = evaluation.blockerCount === 0 && !hasUnknownGate;

  const conditionsChanged =
    pendingApproval != null && evaluation.blockerCount > 0;

  const handleRequest = async () => {
    setActionError('');
    setActionBusy(true);
    const snapshot = buildLaunchSnapshot(evaluation.gates, project, integration);
    const err = await launch.requestApproval(snapshot, evaluation.latestSha);
    if (err) setActionError(err);
    setActionBusy(false);
  };

  const handleDecide = async () => {
    if (!pendingDecision || !pendingApproval) return;
    setActionError('');
    setActionBusy(true);
    const err = await launch.decide(pendingApproval.id, pendingDecision, notes);
    if (err) setActionError(err);
    else {
      setPendingDecision(null);
      setNotes('');
    }
    setActionBusy(false);
  };

  const rollbackState: 'READY' | 'PARTIAL' | 'NOT_CONFIGURED' =
    evaluation.lastKnownGoodSha ? 'PARTIAL' : 'NOT_CONFIGURED';

  return (
    <div className="p-6 space-y-8">
      {/* ── Header / final decision ─────────────────────────────────────── */}
      <section>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-heading font-bold text-foreground-50">Project Launch Control</h3>
              {project.status === 'live' ? (
                <span className="text-xs font-label px-2.5 py-1 rounded uppercase font-bold bg-emerald-500 text-background-950">
                  Live
                </span>
              ) : (
                <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${DECISION_STYLES[evaluation.decision]}`}>
                  {DECISION_LABELS[evaluation.decision]}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground-500 mt-2 max-w-2xl">
              Is this project ready to go live? A formal gate over build, code, testing,
              infrastructure, commercial and operational state — approval is always a
              deliberate human decision.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 flex items-center gap-2 text-xs font-label text-foreground-300 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-4 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Re-Evaluate Launch
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <MetaCard label="Target Launch">
            {project.target_launch_date ? (
              <span className="text-sm text-foreground-200">{formatDate(project.target_launch_date)}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </MetaCard>
          <MetaCard label="Production Domain">
            {evaluation.productionDomain ? (
              <span className="text-sm text-foreground-200 font-mono truncate block">{evaluation.productionDomain}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </MetaCard>
          <MetaCard label="Gates Passed">
            <span className="text-sm text-foreground-200">
              {evaluation.passedCount} / {evaluation.totalCount}
            </span>
          </MetaCard>
          <MetaCard label="Last Approval">
            {approval ? (
              <span className="text-sm text-foreground-200">{APPROVAL_LABELS[approval.decision]}</span>
            ) : (
              <span className="text-sm text-foreground-600">None</span>
            )}
          </MetaCard>
          <MetaCard label="Latest Approved SHA">
            {evaluation.latestSha ? (
              <span className="text-sm font-mono text-foreground-200 truncate block">{evaluation.latestSha.slice(0, 8)}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not tracked</span>
            )}
          </MetaCard>
          <MetaCard label="Last Known Good SHA">
            {evaluation.lastKnownGoodSha ? (
              <span className="text-sm font-mono text-foreground-200 truncate block">{evaluation.lastKnownGoodSha.slice(0, 8)}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </MetaCard>
        </div>
      </section>

      {/* ── Data unavailable banner ────────────────────────────────────── */}
      {!evaluation.anySourceAvailable && launch.error == null && (
        <Banner tone="warning" icon="ri-cloud-off-line">
          Launch data unavailable — the backend is not connected, so gates cannot be evaluated honestly.
        </Banner>
      )}
      {launch.error && (
        <Banner tone="warning" icon="ri-cloud-off-line">
          {launch.error}
        </Banner>
      )}

      {/* ── Critical / blocker banner ──────────────────────────────────── */}
      {evaluation.blockers.length > 0 && (
        <section>
          <SectionHeading icon="ri-alert-line" title="Launch Blockers" />
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-3">
            {evaluation.blockers.map((b) => (
              <div key={b.key} className="flex items-start gap-3">
                <i className="ri-error-warning-fill text-red-400 w-4 h-4 flex items-center justify-center mt-0.5"></i>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-label text-red-300 uppercase tracking-wide">{b.source}</span>
                    <span className="text-xs font-semibold text-red-200">{b.label}</span>
                  </div>
                  <p className="text-xs text-red-300/80 mt-0.5">{b.reason}</p>
                </div>
                {b.deepLink && (
                  <Link to={b.deepLink.to} className="text-xs text-red-200 underline whitespace-nowrap shrink-0 mt-0.5 cursor-pointer">
                    {b.deepLink.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Gates grid ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-checkbox-multiple-line" title="Launch Gates" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {evaluation.gates.map((g) => (
            <GateCard key={g.key} gate={g} />
          ))}
        </div>
      </section>

      {/* ── Warnings ───────────────────────────────────────────────────── */}
      {evaluation.warnings.length > 0 && (
        <section>
          <SectionHeading icon="ri-alert-line" title="Launch Warnings" />
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg divide-y divide-amber-500/10">
            {evaluation.warnings.map((w) => (
              <div key={w.key} className="flex items-start gap-3 px-4 py-3">
                <i className="ri-alert-line text-amber-400 w-4 h-4 flex items-center justify-center mt-0.5"></i>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-amber-200">{w.source}</span>
                  <p className="text-xs text-amber-300/80 mt-0.5">{w.reason}</p>
                </div>
                {w.deepLink && (
                  <Link to={w.deepLink.to} className="text-xs text-amber-200 underline whitespace-nowrap shrink-0 mt-0.5 cursor-pointer">
                    {w.deepLink.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Approval controls ──────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-check-double-line" title="Launch Approval" />
        <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
          <p className="text-sm text-foreground-400 leading-relaxed mb-4">
            Passing gates does <span className="text-foreground-200 font-semibold">not</span> approve
            launch. A human / authorised operator must explicitly approve. Approval does not deploy —
            it only permits the deployment process to proceed.
          </p>

          {pendingApproval && conditionsChanged && (
            <Banner tone="danger" icon="ri-error-warning-line">
              Launch conditions have changed since approval was requested — re-evaluate before deciding.
            </Banner>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!approval || approval.decision === 'REJECTED' || approval.decision === 'SUPERSEDED' ? (
              <button
                type="button"
                onClick={handleRequest}
                disabled={!canRequest || actionBusy}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  canRequest
                    ? 'bg-primary-500 hover:bg-primary-600 text-background-50 dark:text-foreground-950'
                    : 'bg-background-200/60 text-foreground-600 cursor-not-allowed'
                }`}
              >
                <i className="ri-send-plane-line w-4 h-4 flex items-center justify-center"></i>
                Request Launch Approval
              </button>
            ) : approval.decision === 'PENDING' ? (
              <>
                <span className="text-xs font-label text-yellow-400 bg-yellow-500/10 rounded-full px-3 py-1.5 whitespace-nowrap">Approval Pending</span>
                <button
                  type="button"
                  onClick={() => setPendingDecision('APPROVED')}
                  disabled={conditionsChanged || actionBusy}
                  className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    conditionsChanged
                      ? 'bg-background-200/60 text-foreground-600 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-background-950'
                  }`}
                >
                  <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                  Approve Launch
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDecision('REJECTED')}
                  disabled={actionBusy}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-close-line w-4 h-4 flex items-center justify-center"></i>
                  Reject Launch
                </button>
              </>
            ) : (
              <span className={`text-xs font-label px-3 py-1.5 rounded-full whitespace-nowrap ${APPROVAL_STYLES[approval.decision]}`}>
                {APPROVAL_LABELS[approval.decision]}
                {approval.decision === 'APPROVED' ? ' — Awaiting Deployment' : ''}
              </span>
            )}
          </div>

          {!canRequest && !pendingApproval && (
            <p className="text-[11px] text-foreground-600 mt-3">
              Request is disabled until there are no hard blockers{hasUnknownGate ? ' and no gate is in an unknown state' : ''}.
            </p>
          )}

          {pendingDecision && (
            <div className="mt-4 border-t border-background-200/60 pt-4">
              <p className="text-sm text-foreground-300 mb-2">
                {pendingDecision === 'APPROVED' ? 'Approve launch' : 'Reject launch'} — provide decision notes.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Reason for this decision…"
                className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 resize-none"
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleDecide}
                  disabled={!notes.trim() || actionBusy}
                  className={`text-sm font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    pendingDecision === 'APPROVED' ? 'bg-emerald-500 hover:bg-emerald-600 text-background-950' : 'bg-red-500 hover:bg-red-600 text-background-950'
                  } ${!notes.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Confirm {pendingDecision === 'APPROVED' ? 'Approval' : 'Rejection'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingDecision(null); setNotes(''); }}
                  className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <p className="text-xs text-red-400 mt-3">{actionError}</p>
          )}
        </div>
      </section>

      {/* ── Approval history ───────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-history-line" title="Launch Approval History" />
        {launch.approvals.length === 0 ? (
          <p className="text-sm text-foreground-500 bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            No launch approval recorded yet.
          </p>
        ) : (
          <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
            {launch.approvals.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${APPROVAL_STYLES[a.decision]}`}>
                    {APPROVAL_LABELS[a.decision]}
                  </span>
                  <span className="text-[11px] text-foreground-500">
                    Requested {formatRelative(a.requested_at) ?? formatDate(a.requested_at)}
                  </span>
                  {a.decided_at && (
                    <span className="text-[11px] text-foreground-500">
                      · Decided {formatRelative(a.decided_at) ?? formatDate(a.decided_at)}
                    </span>
                  )}
                  {a.github_sha && (
                    <span className="text-[11px] font-mono text-foreground-500">SHA {a.github_sha.slice(0, 8)}</span>
                  )}
                </div>
                {a.decision_notes && (
                  <p className="text-xs text-foreground-400 mt-1.5">{a.decision_notes}</p>
                )}
                {a.evaluation_snapshot?.gates && (
                  <p className="text-[11px] text-foreground-600 mt-1.5">
                    {a.evaluation_snapshot.gates.filter((g) => g.state === 'PASS').length} /
                    {' '}{a.evaluation_snapshot.gates.filter((g) => g.state !== 'NOT_REQUIRED').length} gates passed at request
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Rollback readiness + deployment placeholder ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionHeading icon="ri-arrow-go-back-line" title="Rollback Readiness" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5 space-y-3">
            <Row label="Last Known Good SHA" value={evaluation.lastKnownGoodSha ? evaluation.lastKnownGoodSha.slice(0, 8) : 'Not set'} />
            <Row label="Current Approved SHA" value={evaluation.latestSha ? evaluation.latestSha.slice(0, 8) : 'Not tracked'} />
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">Status</span>
              <span className={`text-[11px] font-label px-2 py-0.5 rounded-full ${rollbackState === 'READY' ? 'bg-emerald-500/10 text-emerald-400' : rollbackState === 'PARTIAL' ? 'bg-amber-500/10 text-amber-400' : 'bg-foreground-500/10 text-foreground-500'}`}>
                {rollbackState}
              </span>
            </div>
            <p className="text-[11px] text-foreground-600">
              Rollback is not executed here. Readiness is honest: SHA alone is only PARTIAL without
              a production backup/snapshot and runbook.
            </p>
          </div>
        </section>

        <section>
          <SectionHeading icon="ri-rocket-2-line" title="Deployment" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5 space-y-3">
            {project.status === 'live' ? (
              <>
                <Row label="Status" value="Live" />
                <Row label="Production" value={evaluation.productionDomain ? 'Configured' : 'Not configured'} />
              </>
            ) : approval?.decision === 'APPROVED' ? (
              <>
                <Row label="Status" value="Approved for Deployment" />
                <Row label="Deployment" value="Not Started" />
                <Row label="Production" value={evaluation.productionDomain ? 'Configured' : 'Not configured'} />
              </>
            ) : (
              <p className="text-sm text-foreground-500">Not yet approved for deployment.</p>
            )}
            <p className="text-[11px] text-foreground-600">
              Deployment, production verification and acceptance are managed in the Deployment section.
              Approval does not deploy.
            </p>
            <Link
              to={`/projects/${project.project_slug}?section=deployment`}
              className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              Open Deployment Control
              <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
      <i className={`${icon} w-4 h-4 flex items-center justify-center text-foreground-400`}></i>
      {title}
    </h4>
  );
}

function MetaCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 min-w-0">
      <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5 whitespace-nowrap">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GateCard({ gate }: { gate: LaunchGate }) {
  const counts = [
    gate.critical != null && gate.critical > 0 ? `Critical ${gate.critical}` : null,
    gate.high != null && gate.high > 0 ? `High ${gate.high}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-background-200/60 flex items-center justify-center shrink-0">
          <i className={`${GATE_ICONS[gate.key]} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
        </div>
        <span className="text-sm text-foreground-200 flex-1 truncate">{GATE_LABELS[gate.key]}</span>
        <span className={`text-[10px] font-label px-2 py-0.5 rounded border whitespace-nowrap ${GATE_STATE_STYLES[gate.state]}`}>
          {GATE_STATE_LABELS[gate.state]}
        </span>
      </div>
      <p className="text-[11px] text-foreground-500 mt-2.5">{gate.detail}</p>
      {counts.length > 0 && (
        <p className="text-[10px] text-foreground-500 mt-1.5">{counts.join(' · ')}</p>
      )}
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: 'warning' | 'danger'; icon: string; children: React.ReactNode }) {
  const cls =
    tone === 'danger'
      ? 'bg-red-500/10 border-red-500/20 text-red-200'
      : 'bg-amber-500/10 border-amber-500/20 text-amber-200';
  return (
    <div className={`flex items-center gap-2.5 border rounded-lg px-4 py-3 ${cls}`}>
      <i className={`${icon} w-4 h-4 flex items-center justify-center shrink-0`}></i>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-200 text-right font-mono">{value}</span>
    </div>
  );
}
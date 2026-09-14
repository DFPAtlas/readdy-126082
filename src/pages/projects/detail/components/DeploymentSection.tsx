import { useState } from 'react';
import type { Project } from '../types';
import { formatDate, formatRelative } from '../utils';
import type { ProjectIntegration } from '../infrastructureTypes';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUS_STYLES,
  PRE_DEPLOY_LABELS,
  PRE_DEPLOY_STYLES,
  type DeploymentEvaluation,
  type ProjectDeployment,
  type PreDeploymentCheck,
} from '../deploymentTypes';
import type { ProjectDeploymentData } from '../useProjectDeployment';
import type { LaunchApproval } from '../launchTypes';
import type { MonitoringSummary } from '../monitoringUtils';
import type { ProjectMonitoringData } from '../useProjectMonitoring';
import {
  evaluateVerification,
  VERIFICATION_STATE_LABELS,
  VERIFICATION_STATE_STYLES,
  type VerificationCheck,
} from '../verificationTypes';
import ReleaseAcceptanceSection from './ReleaseAcceptanceSection';

const VERIFICATION_OVERALL_LABELS = {
  PASS: 'Verification Passed',
  FAIL: 'Verification Failed',
  INCOMPLETE: 'Verification Incomplete',
} as const;

const VERIFICATION_OVERALL_STYLES = {
  PASS: 'bg-emerald-500 text-background-950',
  FAIL: 'bg-red-500 text-background-950',
  INCOMPLETE: 'bg-yellow-500 text-background-950',
} as const;

interface DeploymentSectionProps {
  project: Project;
  integration: ProjectIntegration | null;
  evaluation: DeploymentEvaluation;
  deployment: ProjectDeploymentData;
  monitoring: ProjectMonitoringData;
  monitoringSummary: MonitoringSummary;
  launchApproval: LaunchApproval | null;
  onRefresh: () => void;
}

export default function DeploymentSection({
  project,
  integration,
  evaluation,
  deployment,
  monitoring,
  monitoringSummary,
  launchApproval,
  onRefresh,
}: DeploymentSectionProps) {
  const [confirmStart, setConfirmStart] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<ProjectDeployment | null>(null);
  const [failTarget, setFailTarget] = useState<ProjectDeployment | null>(null);
  const [deployedSha, setDeployedSha] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [providerRef, setProviderRef] = useState('');
  const [failReason, setFailReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [verifyFailOpen, setVerifyFailOpen] = useState(false);
  const [verifyFailReason, setVerifyFailReason] = useState('');

  const active = deployment.active;
  const activeStatus = active ? active.status : null;
  const approval = evaluation.approvedRelease;

  const verification = active
    ? evaluateVerification({
        project,
        integration,
        deployment: active,
        approval: launchApproval,
        websites: monitoring.websites,
        supabaseMonitors: monitoring.supabaseMonitors,
        alerts: monitoring.alerts,
        alertsLoadFailed: Boolean(monitoring.errors.alerts),
        monitoringLoadFailed: Object.keys(monitoring.errors).length > 0,
        monitoringSummary,
      })
    : null;

  const handleStart = async () => {
    setActionError('');
    setActionBusy(true);
    const err = await deployment.startDeployment({
      launchApprovalId: evaluation.approvalId ?? '',
      headSha: evaluation.latestSha,
      lastKnownGoodSha: evaluation.lastKnownGoodSha,
      productionUrl: evaluation.productionUrl,
      deploymentMethod: evaluation.deploymentMethod,
      provider: evaluation.provider,
    });
    if (err) setActionError(err);
    else setConfirmStart(false);
    setActionBusy(false);
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.markCompleted(completeTarget.id, deployedSha, completeNotes, providerRef);
    if (err) setActionError(err);
    else {
      setCompleteTarget(null);
      setDeployedSha('');
      setCompleteNotes('');
      setProviderRef('');
    }
    setActionBusy(false);
  };

  const handleFail = async () => {
    if (!failTarget) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.markFailed(failTarget.id, failReason);
    if (err) setActionError(err);
    else {
      setFailTarget(null);
      setFailReason('');
    }
    setActionBusy(false);
  };

  const handleStartVerification = async () => {
    if (!active) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.startVerification(active.id);
    if (err) setActionError(err);
    setActionBusy(false);
  };

  const handleVerify = async () => {
    if (!active || !verification) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.markVerified(active.id, verification.snapshot);
    if (err) setActionError(err);
    else setConfirmVerify(false);
    setActionBusy(false);
  };

  const handleFailVerification = async () => {
    if (!active) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.markFailed(active.id, verifyFailReason, 'Production verification failed');
    if (err) setActionError(err);
    else {
      setVerifyFailOpen(false);
      setVerifyFailReason('');
    }
    setActionBusy(false);
  };

  return (
    <div className="p-6 space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-heading font-bold text-foreground-50">Deployment Control</h3>
              {activeStatus ? (
                <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${DEPLOYMENT_STATUS_STYLES[activeStatus]}`}>
                  {DEPLOYMENT_STATUS_LABELS[activeStatus]}
                </span>
              ) : (
                <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${evaluation.eligible ? 'bg-emerald-500 text-background-950' : 'bg-red-500 text-background-950'}`}>
                  {evaluation.eligible ? 'Ready to Deploy' : 'Blocked'}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground-500 mt-2 max-w-2xl">
              A safe, audited deployment gate locked to a valid launch approval and its approved
              SHA. This view tracks the deployment workflow only — it never deploys, pushes, or
              alters production.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 flex items-center gap-2 text-xs font-label text-foreground-300 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-4 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Refresh Status
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <MetaCard label="Production URL">
            {evaluation.productionUrl ? (
              <span className="text-sm text-foreground-200 font-mono truncate block">{evaluation.productionUrl}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </MetaCard>
          <MetaCard label="Launch Approval">
            {approval ? (
              <span className="text-sm text-foreground-200">Approved</span>
            ) : (
              <span className="text-sm text-foreground-600">Required</span>
            )}
          </MetaCard>
          <MetaCard label="Approved SHA">
            {evaluation.approvedSha ? (
              <span className="text-sm font-mono text-foreground-200 truncate block">{evaluation.approvedSha.slice(0, 8)}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not recorded</span>
            )}
          </MetaCard>
          <MetaCard label="Current SHA">
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
          <MetaCard label="Current Production SHA">
            {active?.github_sha ? (
              <span className="text-sm font-mono text-foreground-200 truncate block">{active.github_sha.slice(0, 8)}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not deployed</span>
            )}
          </MetaCard>
        </div>
      </section>

      {/* ── Data unavailable / error ───────────────────────────────────── */}
      {!deployment.configured && deployment.error == null && (
        <Banner tone="warning" icon="ri-cloud-off-line">
          Deployment data unavailable — the backend is not connected, so deployment records cannot be
          loaded or written.
        </Banner>
      )}
      {deployment.error && (
        <Banner tone="warning" icon="ri-cloud-off-line">
          {deployment.error}
        </Banner>
      )}

      {/* ── CODE CHANGED AFTER APPROVAL ────────────────────────────────── */}
      {evaluation.codeChangedAfterApproval && (
        <section>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <i className="ri-git-close-pull-request-line text-red-400 w-5 h-5 flex items-center justify-center"></i>
              <div>
                <p className="text-sm font-semibold text-red-200">CODE CHANGED AFTER APPROVAL</p>
                <p className="text-xs text-red-300/80 mt-0.5">
                  Deployment blocked — the approved SHA no longer matches. A new launch evaluation is required.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Blockers ───────────────────────────────────────────────────── */}
      {evaluation.blockers.length > 0 && (
        <section>
          <SectionHeading icon="ri-alert-line" title="Deployment Blockers" />
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2.5">
            {evaluation.blockers.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <i className="ri-error-warning-fill text-red-400 w-4 h-4 flex items-center justify-center mt-0.5"></i>
                <p className="text-xs text-red-200">{b}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pre-deployment checks ──────────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-checkbox-multiple-line" title="Pre-Deployment Check" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {evaluation.preChecks.map((c) => (
            <PreCheckCard key={c.key} check={c} />
          ))}
        </div>
      </section>

      {/* ── Approved release ───────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-git-commit-line" title="Approved Release" />
        {approval ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
              <Row label="Repository" value={approval.repository ?? 'Not tracked'} mono={false} />
              <Row label="Branch" value={approval.branch ?? 'Not tracked'} mono={false} />
              <CopyRow label="Full SHA" value={approval.sha} />
              <CopyRow label="Short SHA" value={approval.shortSha} />
              <Row label="Approved At" value={approval.approvedAt ? formatDate(approval.approvedAt) : 'Unknown'} mono={false} />
              <Row label="Approved By" value={approval.approvedBy ?? 'Unknown'} mono={false} />
              <Row label="Last Known Good SHA" value={approval.lastKnownGoodSha ? approval.lastKnownGoodSha.slice(0, 8) : 'Not set'} />
            </div>
            {approval.commitMessage && (
              <p className="text-xs text-foreground-400 mt-3 italic">{approval.commitMessage}</p>
            )}
            <p className="text-[11px] text-foreground-600 mt-3">
              Deployment is locked to this approved SHA — a newer HEAD is never deployed automatically.
            </p>
          </div>
        ) : (
          <p className="text-sm text-foreground-500 bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            No approved release — a valid launch approval with an approved SHA is required.
          </p>
        )}
      </section>

      {/* ── Deployment method + start ──────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-rocket-2-line" title="Start Deployment" />
        <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className="text-[11px] font-label text-foreground-400 uppercase tracking-wide">Method</span>
            <span className="text-sm text-foreground-200">{evaluation.deploymentMethod}</span>
            {evaluation.provider && (
              <span className="text-[11px] text-foreground-500 bg-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">{evaluation.provider}</span>
            )}
          </div>
          <p className="text-xs text-foreground-500 mb-4">
            No protected deployment connector exists yet — manual deployment is required. This view
            tracks the workflow only; the operator performs the actual deployment outside DFP Command.
          </p>

          {active ? (
            <Banner tone="warning" icon="ri-timer-line">
              Production deployment already in progress — one active production deployment per project.
            </Banner>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmStart(true)}
              disabled={!evaluation.eligible || actionBusy}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                evaluation.eligible
                  ? 'bg-primary-500 hover:bg-primary-600 text-background-50 dark:text-foreground-950'
                  : 'bg-background-200/60 text-foreground-600 cursor-not-allowed'
              }`}
            >
              <i className="ri-rocket-2-line w-4 h-4 flex items-center justify-center"></i>
              Start Deployment
            </button>
          )}

          {confirmStart && !active && (
            <div className="mt-4 border-t border-background-200/60 pt-4">
              <p className="text-sm text-foreground-300 mb-3">Confirm deployment — review before starting.</p>
              <div className="bg-background-100 border border-background-200/60 rounded-md p-4 space-y-2 mb-4">
                <ConfirmRow label="Project" value={project.project_name} />
                <ConfirmRow label="Production URL" value={evaluation.productionUrl ?? 'Not set'} />
                <ConfirmRow label="Approved SHA" value={evaluation.approvedSha ? evaluation.approvedSha.slice(0, 8) : '—'} />
                <ConfirmRow label="Last Known Good SHA" value={evaluation.lastKnownGoodSha ? evaluation.lastKnownGoodSha.slice(0, 8) : 'Not set'} />
                <ConfirmRow label="Deployment Method" value={evaluation.deploymentMethod} />
                <ConfirmRow label="Warnings" value={evaluation.blockers.length === 0 ? 'None' : `${evaluation.blockers.length} blocker(s)`} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={actionBusy}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-background-50 dark:text-foreground-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {actionBusy ? 'Starting…' : 'Confirm & Start'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmStart(false)}
                  className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionError && <p className="text-xs text-red-400 mt-3">{actionError}</p>}
        </div>
      </section>

      {/* ── Current deployment ─────────────────────────────────────────── */}
      {active && (
        <section>
          <SectionHeading icon="ri-arrow-right-circle-line" title="Current Deployment" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${DEPLOYMENT_STATUS_STYLES[active.status]}`}>
                {DEPLOYMENT_STATUS_LABELS[active.status]}
              </span>
              <span className="text-xs font-mono text-foreground-400">SHA {active.github_sha.slice(0, 8)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              <Row label="Production URL" value={active.production_url ?? 'Not set'} mono={false} />
              <Row label="Method" value={active.deployment_method ?? 'Manual'} mono={false} />
              <Row label="Started" value={active.started_at ? formatRelative(active.started_at) ?? formatDate(active.started_at) : '—'} mono={false} />
              <Row label="Operator" value={active.started_by ?? 'Unknown'} mono={false} />
              {active.completed_at && <Row label="Completed" value={formatDate(active.completed_at)} mono={false} />}
              {active.failure_reason && <Row label="Failure" value={active.failure_reason} mono={false} />}
            </div>

            {active.status === 'DEPLOYING' && (
              <div className="flex items-center gap-2 flex-wrap mt-5 pt-4 border-t border-background-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setCompleteTarget(active);
                    setDeployedSha(active.github_sha);
                  }}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Mark Deployment Completed
                </button>
                <button
                  type="button"
                  onClick={() => setFailTarget(active)}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Mark Deployment Failed
                </button>
              </div>
            )}

            {completeTarget && (
              <div className="mt-4 border-t border-background-200/60 pt-4 space-y-3">
                <p className="text-sm text-foreground-300">Mark deployment completed — the deployed SHA must equal the approved SHA.</p>
                <input
                  value={deployedSha}
                  onChange={(e) => setDeployedSha(e.target.value)}
                  placeholder="Actual deployed SHA"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 font-mono"
                />
                <textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Deployment notes…"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 resize-none"
                />
                <input
                  value={providerRef}
                  onChange={(e) => setProviderRef(e.target.value)}
                  placeholder="Provider reference (optional)"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={!deployedSha.trim() || actionBusy}
                    className={`text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer ${!deployedSha.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {actionBusy ? 'Saving…' : 'Confirm Completion'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompleteTarget(null)}
                    className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {failTarget && (
              <div className="mt-4 border-t border-background-200/60 pt-4 space-y-3">
                <p className="text-sm text-foreground-300">Mark deployment failed — provide a failure reason.</p>
                <textarea
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Failure reason…"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFail}
                    disabled={!failReason.trim() || actionBusy}
                    className={`text-sm font-semibold px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer ${!failReason.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {actionBusy ? 'Saving…' : 'Confirm Failure'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFailTarget(null)}
                    className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Production verification ───────────────────────────────────── */}
      {active && active.status === 'DEPLOYED' && (
        <section>
          <SectionHeading icon="ri-shield-check-line" title="Production Verification" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <p className="text-sm text-foreground-300 mb-4">
              The release is deployed but not yet verified. Production verification confirms the
              deployed release is operating correctly before acceptance.
            </p>
            <button
              type="button"
              onClick={handleStartVerification}
              disabled={actionBusy}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-background-50 dark:text-foreground-950 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center"></i>
              Start Production Verification
            </button>
            {actionError && <p className="text-xs text-red-400 mt-3">{actionError}</p>}
          </div>
        </section>
      )}

      {active && active.status === 'VERIFYING' && verification && (
        <section>
          <SectionHeading icon="ri-shield-check-line" title="Production Verification" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {verification.checks.map((c) => (
              <VerifyCheckCard key={c.key} check={c} />
            ))}
          </div>

          <div className="mt-4 bg-background-50 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${VERIFICATION_OVERALL_STYLES[verification.overall]}`}>
                {VERIFICATION_OVERALL_LABELS[verification.overall]}
              </span>
              <span className="text-xs text-foreground-400">
                {verification.passed} passed · {verification.warnings} warning{verification.warnings === 1 ? '' : 's'} · {verification.failed} failed · {verification.unknown} unknown
              </span>
            </div>
            {verification.overall === 'INCOMPLETE' && (
              <p className="text-xs text-foreground-500 mt-2">
                Unknown mandatory checks must be resolved before the deployment can be verified.
              </p>
            )}
          </div>

          {verification.overall === 'FAIL' && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <i className="ri-error-warning-fill text-red-400 w-5 h-5 flex items-center justify-center"></i>
                <div>
                  <p className="text-sm font-semibold text-red-200">PRODUCTION VERIFICATION FAILED</p>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    One or more mandatory checks failed. The deployment cannot be marked verified.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {verification.overall === 'PASS' && (
              <button
                type="button"
                onClick={() => setConfirmVerify(true)}
                disabled={actionBusy}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-verified-badge-line w-4 h-4 flex items-center justify-center"></i>
                Mark Deployment Verified
              </button>
            )}
            <button
              type="button"
              onClick={() => setVerifyFailOpen(true)}
              disabled={actionBusy}
              className="text-sm font-semibold px-4 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer"
            >
              Mark Deployment Failed
            </button>
          </div>

          {confirmVerify && verification.overall === 'PASS' && (
            <div className="mt-4 border-t border-background-200/60 pt-4">
              <p className="text-sm text-foreground-300 mb-3">
                Confirm verification — SHA {active.github_sha.slice(0, 8)} will be recorded as verified.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={actionBusy}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {actionBusy ? 'Saving…' : 'Confirm Verification'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmVerify(false)}
                  className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {verifyFailOpen && (
            <div className="mt-4 border-t border-background-200/60 pt-4 space-y-3">
              <p className="text-sm text-foreground-300">Record verification failure — provide a reason.</p>
              <textarea
                value={verifyFailReason}
                onChange={(e) => setVerifyFailReason(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Failure reason…"
                className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFailVerification}
                  disabled={!verifyFailReason.trim() || actionBusy}
                  className={`text-sm font-semibold px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer ${!verifyFailReason.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {actionBusy ? 'Saving…' : 'Confirm Failure'}
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyFailOpen(false)}
                  className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionError && <p className="text-xs text-red-400 mt-3">{actionError}</p>}
        </section>
      )}

      {/* ── Acceptance, current production release & rollback (13C) ───── */}
      <ReleaseAcceptanceSection
        project={project}
        integration={integration}
        evaluation={evaluation}
        deployment={deployment}
        monitoring={monitoring}
        monitoringSummary={monitoringSummary}
      />

      {/* ── Deployment history ─────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="ri-history-line" title="Deployment History" />
        {deployment.deployments.length === 0 ? (
          <p className="text-sm text-foreground-500 bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            No deployment records yet.
          </p>
        ) : (
          <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
            {deployment.deployments.map((d) => {
              const rolledBackBy = deployment.deployments.find((x) => x.rollback_of_deployment_id === d.id);
              const rolledBackOf = d.rollback_of_deployment_id
                ? deployment.deployments.find((x) => x.id === d.rollback_of_deployment_id)
                : null;
              return (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${DEPLOYMENT_STATUS_STYLES[d.status]}`}>
                      {DEPLOYMENT_STATUS_LABELS[d.status]}
                    </span>
                    <span className="text-[11px] font-mono text-foreground-500">SHA {d.github_sha.slice(0, 8)}</span>
                    <span className="text-[11px] text-foreground-500">{d.environment}</span>
                    {d.deployment_method && <span className="text-[11px] text-foreground-500">{d.deployment_method}</span>}
                    {d.production_accepted && (
                      <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 whitespace-nowrap">Accepted</span>
                    )}
                    {rolledBackOf && (
                      <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 whitespace-nowrap">
                        Rollback of {rolledBackOf.github_sha.slice(0, 8)}
                      </span>
                    )}
                    {rolledBackBy && (
                      <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 whitespace-nowrap">
                        Rolled Back By {rolledBackBy.github_sha.slice(0, 8)}
                      </span>
                    )}
                    <span className="text-[11px] text-foreground-600 ml-auto">
                      {d.started_at ? formatRelative(d.started_at) ?? formatDate(d.started_at) : formatDate(d.created_at)}
                    </span>
                  </div>
                  {d.failure_reason && (
                    <p className="text-xs text-red-300/80 mt-1.5">{d.failure_reason}</p>
                  )}
                  {d.rollback_reason && (
                    <p className="text-xs text-amber-300/80 mt-1.5">Rollback reason: {d.rollback_reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
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

function PreCheckCard({ check }: { check: PreDeploymentCheck }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-foreground-200 flex-1 truncate">{check.label}</span>
        <span className={`text-[10px] font-label px-2 py-0.5 rounded border whitespace-nowrap ${PRE_DEPLOY_STYLES[check.state]}`}>
          {PRE_DEPLOY_LABELS[check.state]}
        </span>
      </div>
      <p className="text-[11px] text-foreground-500 mt-2 break-words">{check.detail}</p>
    </div>
  );
}

function VerifyCheckCard({ check }: { check: VerificationCheck }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-foreground-200 flex-1 truncate">{check.label}</span>
        <span className={`text-[10px] font-label px-2 py-0.5 rounded border whitespace-nowrap ${VERIFICATION_STATE_STYLES[check.state]}`}>
          {VERIFICATION_STATE_LABELS[check.state]}
        </span>
      </div>
      <p className="text-[11px] text-foreground-500 mt-2 break-words">{check.detail}</p>
    </div>
  );
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-sm text-foreground-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — non-critical
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm text-foreground-200 text-right font-mono truncate">{value}</span>
        <button
          type="button"
          onClick={copy}
          title="Copy SHA"
          className="shrink-0 w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-accent-400 transition-colors cursor-pointer"
        >
          <i className={`${copied ? 'ri-check-line text-emerald-400' : 'ri-file-copy-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
        </button>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-200 text-right font-mono">{value}</span>
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
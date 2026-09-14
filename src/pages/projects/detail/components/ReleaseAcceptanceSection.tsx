// ============================================================================
// DFP COMMAND 13C — RELEASE ACCEPTANCE + ROLLBACK — PRESENTATIONAL SECTION
// ============================================================================
// Renders the 13C portion of the Deployment Control view:
//   * Production acceptance (a VERIFIED release → the official production
//     version, updating Last Known Good after explicit confirmation),
//   * Current Production Release (accepted),
//   * Rollback (prepare → start → manual redeploy → re-verify → complete),
//     reusing the 13B verification engine — never a Git history rewrite.
// All mutations go through useProjectDeployment; this file only presents and
// confirms. Incident / bug links reuse the existing Support and Bugs flows.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';
import { formatDate } from '../utils';
import type { ProjectIntegration } from '../infrastructureTypes';
import type { DeploymentEvaluation, ProjectDeployment } from '../deploymentTypes';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUS_STYLES,
  latestAcceptedDeployment,
  rollbackTargetFor,
} from '../deploymentTypes';
import type { ProjectDeploymentData } from '../useProjectDeployment';
import type { MonitoringSummary } from '../monitoringUtils';
import type { ProjectMonitoringData } from '../useProjectMonitoring';
import {
  evaluateVerification,
  VERIFICATION_STATE_LABELS,
  VERIFICATION_STATE_STYLES,
  type VerificationCheck,
  type VerificationOverall,
} from '../verificationTypes';

const OVERALL_LABELS: Record<VerificationOverall, string> = {
  PASS: 'Verification Passed',
  FAIL: 'Verification Failed',
  INCOMPLETE: 'Verification Incomplete',
};

const OVERALL_STYLES: Record<VerificationOverall, string> = {
  PASS: 'bg-emerald-500 text-background-950',
  FAIL: 'bg-red-500 text-background-950',
  INCOMPLETE: 'bg-yellow-500 text-background-950',
};

interface ReleaseAcceptanceSectionProps {
  project: Project;
  integration: ProjectIntegration | null;
  evaluation: DeploymentEvaluation;
  deployment: ProjectDeploymentData;
  monitoring: ProjectMonitoringData;
  monitoringSummary: MonitoringSummary;
}

function snapshotWarnings(snapshot: Record<string, unknown> | null): number {
  if (!snapshot) return 0;
  const keys = [
    'monitoringResult',
    'criticalAlertResult',
    'backendResult',
    'runtimeResult',
    'aiResult',
    'applicationHealthResult',
  ];
  return keys.filter((k) => snapshot[k] === 'WARNING').length;
}

export default function ReleaseAcceptanceSection({
  project,
  integration,
  evaluation,
  deployment,
  monitoring,
  monitoringSummary,
}: ReleaseAcceptanceSectionProps) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptNotes, setAcceptNotes] = useState('');
  const [rollbackConfirm, setRollbackConfirm] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackSha, setRollbackSha] = useState('');
  const [verifyFailOpen, setVerifyFailOpen] = useState(false);
  const [verifyFailReason, setVerifyFailReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const { deployments } = deployment;
  const chronological = [...deployments].reverse();

  const accepted = latestAcceptedDeployment(deployments);
  const verifiedAwaiting =
    deployments.find((d) => d.status === 'VERIFIED' && !d.production_accepted) ?? null;
  const failedLatest = deployments.find((d) => d.status === 'FAILED') ?? null;
  const rollbackRecord = deployments.find((d) => d.status === 'ROLLING_BACK') ?? null;

  const rollbackTarget = failedLatest ? rollbackTargetFor(failedLatest, deployments) : null;
  const canRollback = failedLatest != null && rollbackTarget?.sha != null;

  const rollbackVerification = rollbackRecord
    ? evaluateVerification({
        project,
        integration,
        deployment: rollbackRecord,
        approval: null,
        websites: monitoring.websites,
        supabaseMonitors: monitoring.supabaseMonitors,
        alerts: monitoring.alerts,
        alertsLoadFailed: Boolean(monitoring.errors.alerts),
        monitoringLoadFailed: Object.keys(monitoring.errors).length > 0,
        monitoringSummary,
      })
    : null;

  const acceptedNum = accepted ? chronological.findIndex((d) => d.id === accepted.id) + 1 : 0;

  const handleAccept = async () => {
    if (!verifiedAwaiting) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.acceptProduction(verifiedAwaiting.id, acceptNotes);
    if (err) setActionError(err);
    else {
      setAcceptOpen(false);
      setAcceptNotes('');
    }
    setActionBusy(false);
  };

  const handleStartRollback = async () => {
    if (!failedLatest || !rollbackTarget?.sha) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.startRollback({
      ofDeploymentId: failedLatest.id,
      reason: rollbackReason,
    });
    if (err) setActionError(err);
    else {
      setRollbackConfirm(false);
      setRollbackReason('');
    }
    setActionBusy(false);
  };

  const handleEnterRollbackSha = async () => {
    if (!rollbackRecord) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.enterRollbackDeployedSha(rollbackRecord.id, rollbackSha);
    if (err) setActionError(err);
    else setRollbackSha('');
    setActionBusy(false);
  };

  const handleMarkRolledBack = async () => {
    if (!rollbackRecord || !rollbackVerification) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.markRolledBack(rollbackRecord.id, rollbackVerification.snapshot);
    if (err) setActionError(err);
    setActionBusy(false);
  };

  const handleFailRollback = async () => {
    if (!rollbackRecord) return;
    setActionError('');
    setActionBusy(true);
    const err = await deployment.markFailed(rollbackRecord.id, verifyFailReason, 'Rollback failed');
    if (err) setActionError(err);
    else {
      setVerifyFailOpen(false);
      setVerifyFailReason('');
    }
    setActionBusy(false);
  };

  return (
    <div className="space-y-8">
      {/* ── Acceptance ─────────────────────────────────────────────────── */}
      {verifiedAwaiting && (
        <section>
          <SectionHeading icon="ri-check-double-line" title="Production Acceptance" />
          <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-lg p-5">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <i className="ri-verified-badge-fill text-emerald-400 w-5 h-5 flex items-center justify-center"></i>
              <span className="text-sm font-semibold text-emerald-300">Verified — Awaiting Acceptance</span>
            </div>
            <p className="text-sm text-foreground-300 mb-4">
              Verification proves the release works. Acceptance confirms this release is now the
              official production version — a separate, deliberate operator action.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
              <Row label="Project" value={project.project_name} mono={false} />
              <Row label="Production URL" value={verifiedAwaiting.production_url ?? 'Not set'} mono={false} />
              <Row label="Verified SHA" value={(verifiedAwaiting.deployed_sha ?? verifiedAwaiting.github_sha).slice(0, 8)} />
              <Row label="Previous Production SHA" value={verifiedAwaiting.previous_production_sha ? verifiedAwaiting.previous_production_sha.slice(0, 8) : 'None'} />
              <Row label="Current Last Known Good SHA" value={verifiedAwaiting.last_known_good_sha ? verifiedAwaiting.last_known_good_sha.slice(0, 8) : 'Not set'} />
              <Row label="Deployment Method" value={verifiedAwaiting.deployment_method ?? 'Manual'} mono={false} />
              <Row label="Verified At" value={verifiedAwaiting.verified_at ? formatDate(verifiedAwaiting.verified_at) : '—'} mono={false} />
              <Row label="Verified By" value={verifiedAwaiting.verified_by ?? 'Unknown'} mono={false} />
              <Row label="Monitoring Status" value={monitoringSummary.productionLabel} mono={false} />
              <Row label="Warnings" value={String(snapshotWarnings(verifiedAwaiting.verification_snapshot))} mono={false} />
            </div>

            {!acceptOpen ? (
              <button
                type="button"
                onClick={() => setAcceptOpen(true)}
                disabled={actionBusy}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                Accept Production Deployment
              </button>
            ) : (
              <div className="border-t border-emerald-500/20 pt-4 space-y-3">
                <p className="text-sm text-foreground-300">
                  Accept this release as the official production version — Last Known Good SHA will
                  update to the accepted SHA after this confirmation.
                </p>
                <textarea
                  value={acceptNotes}
                  onChange={(e) => setAcceptNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Acceptance notes (optional)…"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-emerald-500/40 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={actionBusy}
                    className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {actionBusy ? 'Accepting…' : 'Confirm Acceptance'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAcceptOpen(false)}
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
      )}

      {/* ── Current production release ────────────────────────────────── */}
      {accepted && (
        <section>
          <SectionHeading icon="ri-award-line" title="Current Production Release" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                Live / Accepted
              </span>
              <span className="text-xs font-mono text-foreground-400">Deployment #{acceptedNum}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              <CopyRow label="SHA" value={accepted.deployed_sha ?? accepted.github_sha} />
              <Row label="Production URL" value={accepted.production_url ?? 'Not set'} mono={false} />
              <Row label="Accepted At" value={accepted.accepted_at ? formatDate(accepted.accepted_at) : '—'} mono={false} />
              <Row label="Accepted By" value={accepted.accepted_by ?? 'Unknown'} mono={false} />
              <Row label="Monitoring State" value={monitoringSummary.productionLabel} mono={false} />
              <Row label="Last Known Good" value="Yes" mono={false} />
            </div>
            {accepted.acceptance_notes && (
              <p className="text-xs text-foreground-400 mt-3 italic">{accepted.acceptance_notes}</p>
            )}
          </div>
        </section>
      )}

      {/* ── Rollback (prepare) ─────────────────────────────────────────── */}
      {failedLatest && !rollbackRecord && (
        <section>
          <SectionHeading icon="ri-arrow-go-back-line" title="Rollback" />
          {canRollback ? (
            <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
              <div className="flex items-start gap-3 mb-4">
                <i className="ri-alert-line text-orange-400 w-5 h-5 flex items-center justify-center mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-foreground-100">A deployment has failed</p>
                  <p className="text-xs text-foreground-500 mt-0.5">
                    A known-good SHA is available — a rollback redeploys that release. Rollback never
                    rewrites Git history.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
                <Row label="Failed SHA" value={(failedLatest.deployed_sha ?? failedLatest.github_sha).slice(0, 8)} />
                <Row label="Rollback SHA" value={rollbackTarget?.sha ? rollbackTarget.sha.slice(0, 8) : '—'} />
                <Row label="Rollback Source" value={rollbackTarget?.source ?? 'None'} mono={false} />
                <Row label="Production URL" value={failedLatest.production_url ?? 'Not set'} mono={false} />
                <Row label="Reason" value={failedLatest.failure_reason ?? 'Deployment failed'} mono={false} />
              </div>

              {!rollbackConfirm ? (
                <button
                  type="button"
                  onClick={() => setRollbackConfirm(true)}
                  disabled={actionBusy}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-arrow-go-back-line w-4 h-4 flex items-center justify-center"></i>
                  Prepare Rollback
                </button>
              ) : (
                <div className="border-t border-background-200/60 pt-4 space-y-3">
                  <p className="text-sm text-foreground-300">Confirm rollback — provide an explicit reason.</p>
                  <textarea
                    value={rollbackReason}
                    onChange={(e) => setRollbackReason(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Rollback reason (required)…"
                    className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-orange-500/40 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartRollback}
                      disabled={!rollbackReason.trim() || actionBusy}
                      className={`text-sm font-semibold px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer ${!rollbackReason.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {actionBusy ? 'Starting…' : 'Start Rollback'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRollbackConfirm(false)}
                      className="text-sm text-foreground-500 hover:text-foreground-300 px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-background-200/60">
                <Link to="/support-tickets" className="text-xs text-foreground-400 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer">
                  Create Incident
                </Link>
                <span className="text-foreground-700">·</span>
                <Link to="/bugs" className="text-xs text-foreground-400 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer">
                  Create Project Bug
                </Link>
              </div>
              {actionError && <p className="text-xs text-red-400 mt-3">{actionError}</p>}
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-5">
              <p className="text-sm text-amber-200">
                No known-good rollback SHA is available. A rollback cannot be prepared without a
                previous production or last-known-good SHA.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Rollback in progress ───────────────────────────────────────── */}
      {rollbackRecord && (
        <section>
          <SectionHeading icon="ri-arrow-go-back-line" title="Rollback In Progress" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${DEPLOYMENT_STATUS_STYLES[rollbackRecord.status]}`}>
                {DEPLOYMENT_STATUS_LABELS[rollbackRecord.status]}
              </span>
              <span className="text-xs font-mono text-foreground-400">
                Target SHA {rollbackRecord.rollback_sha?.slice(0, 8)}
              </span>
            </div>

            <div className="mb-4 bg-background-100 border border-background-200/60 rounded-md p-4">
              <p className="text-[11px] font-label text-foreground-400 uppercase tracking-wide mb-2">
                Manual rollback checklist
              </p>
              <ol className="space-y-1.5 text-xs text-foreground-400 list-decimal list-inside">
                <li>Confirm rollback SHA.</li>
                <li>Redeploy the known-good release.</li>
                <li>Do not alter Git history.</li>
                <li>Confirm the provider reports completion.</li>
                <li>Return to DFP Command.</li>
                <li>Enter the actual deployed rollback SHA (must match target).</li>
                <li>Run Production Verification again.</li>
              </ol>
            </div>

            {!rollbackRecord.deployed_sha && (
              <div className="space-y-3">
                <input
                  value={rollbackSha}
                  onChange={(e) => setRollbackSha(e.target.value)}
                  placeholder="Actual deployed rollback SHA"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 font-mono"
                />
                <button
                  type="button"
                  onClick={handleEnterRollbackSha}
                  disabled={!rollbackSha.trim() || actionBusy}
                  className={`text-sm font-semibold px-4 py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-background-50 dark:text-foreground-950 transition-colors whitespace-nowrap cursor-pointer ${!rollbackSha.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Record Deployed Rollback SHA
                </button>
              </div>
            )}

            {rollbackRecord.deployed_sha && rollbackVerification && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {rollbackVerification.checks.map((c) => (
                    <VerifyCheckCard key={c.key} check={c} />
                  ))}
                </div>
                <div className="mt-4 bg-background-100 border border-background-200/60 rounded-lg p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-label px-2.5 py-1 rounded uppercase font-bold ${OVERALL_STYLES[rollbackVerification.overall]}`}>
                      {OVERALL_LABELS[rollbackVerification.overall]}
                    </span>
                    <span className="text-xs text-foreground-400">
                      {rollbackVerification.passed} passed · {rollbackVerification.failed} failed · {rollbackVerification.unknown} unknown
                    </span>
                  </div>
                </div>

                {rollbackVerification.overall === 'FAIL' && (
                  <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <i className="ri-error-warning-fill text-red-400 w-5 h-5 flex items-center justify-center"></i>
                      <div>
                        <p className="text-sm font-semibold text-red-200">ROLLBACK VERIFICATION FAILED</p>
                        <p className="text-xs text-red-300/80 mt-0.5">
                          Production state remains CRITICAL / UNKNOWN. Do not assume restoration succeeded.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {rollbackVerification.overall === 'PASS' && (
                    <button
                      type="button"
                      onClick={handleMarkRolledBack}
                      disabled={actionBusy}
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-check-double-line w-4 h-4 flex items-center justify-center"></i>
                      Mark Rollback Complete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVerifyFailOpen(true)}
                    disabled={actionBusy}
                    className="text-sm font-semibold px-4 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Mark Rollback Failed
                  </button>
                </div>
              </>
            )}

            {verifyFailOpen && (
              <div className="mt-4 border-t border-background-200/60 pt-4 space-y-3">
                <p className="text-sm text-foreground-300">Record rollback failure — provide a reason.</p>
                <textarea
                  value={verifyFailReason}
                  onChange={(e) => setVerifyFailReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Rollback failure reason…"
                  className="w-full text-sm bg-background-100 border border-background-200/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFailRollback}
                    disabled={!verifyFailReason.trim() || actionBusy}
                    className={`text-sm font-semibold px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-background-950 transition-colors whitespace-nowrap cursor-pointer ${!verifyFailReason.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Confirm Rollback Failure
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

            <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-background-200/60">
              <Link to="/support-tickets" className="text-xs text-foreground-400 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer">
                Create Incident
              </Link>
            </div>
            {actionError && <p className="text-xs text-red-400 mt-3">{actionError}</p>}
          </div>
        </section>
      )}

      {!verifiedAwaiting && !accepted && !failedLatest && !rollbackRecord && (
        <section>
          <p className="text-sm text-foreground-500 bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            No release awaiting acceptance and no rollback required.
          </p>
        </section>
      )}
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

function VerifyCheckCard({ check }: { check: VerificationCheck }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
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
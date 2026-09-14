import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import type { ProjectUatData } from '../useProjectUat';
import type { BuildStatusSummary } from '../buildUtils';
import type { ProjectIntegration } from '../infrastructureTypes';
import type { UatSummary } from '../uatTypes';
import { UAT_STATUS_COLORS, GONOGO_COLORS } from '../uatTypes';
import { APPROVAL_STATUS_COLORS } from '@/pages/admin/website-uat/types';
import ConnectUatProjectModal from './ConnectUatProjectModal';
import UatProjectFormModal from '@/pages/admin/website-uat/components/UatProjectFormModal';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import {
  UatCurrentRunPanel,
  UatDefectsPanel,
  UatEvidencePanel,
  UatReportsPanel,
  UatTesterActivityPanel,
} from './UatPanels';

interface UatSectionProps {
  project: Project;
  uat: ProjectUatData;
  buildSummary: BuildStatusSummary;
  integration: ProjectIntegration | null;
}

type CheckState = 'PASS' | 'FAIL' | 'PENDING' | 'NOT CONFIGURED' | 'UNKNOWN';

const CHECK_STATE_COLORS: Record<CheckState, string> = {
  PASS: 'text-emerald-400',
  FAIL: 'text-red-400',
  PENDING: 'text-yellow-400',
  'NOT CONFIGURED': 'text-foreground-500',
  UNKNOWN: 'text-foreground-500',
};

interface LaunchCheck {
  label: string;
  state: CheckState;
  detail: string;
}

function launchChecks(
  buildSummary: BuildStatusSummary,
  summary: UatSummary,
  integration: ProjectIntegration | null,
): LaunchCheck[] {
  const noChecklist = buildSummary.readinessState === 'NO CHECKLIST' || buildSummary.readinessState == null;
  const buildReady = buildSummary.readinessState === 'READY';
  const appr = summary.approvalStatus;

  return [
    {
      label: 'Build checklist complete',
      state: noChecklist ? 'NOT CONFIGURED' : buildReady ? 'PASS' : 'FAIL',
      detail: noChecklist ? 'No checklist' : `${buildSummary.progressPercent}%`,
    },
    {
      label: 'No launch blockers',
      state: noChecklist ? 'NOT CONFIGURED' : buildSummary.openBlockers === 0 ? 'PASS' : 'FAIL',
      detail: `${buildSummary.openBlockers} blocker${buildSummary.openBlockers === 1 ? '' : 's'}`,
    },
    {
      label: 'UAT executed',
      state: summary.hasResults ? 'PASS' : summary.hasRun ? 'PENDING' : 'NOT CONFIGURED',
      detail: summary.hasResults ? `${summary.completedExecutable} completed tests` : 'No completed tests',
    },
    {
      label: 'Required tests passed',
      state: summary.requiredTotal === 0 ? 'UNKNOWN' : summary.requiredPassed === summary.requiredTotal ? 'PASS' : 'FAIL',
      detail: summary.requiredTotal > 0 ? `${summary.requiredPassed}/${summary.requiredTotal}` : 'No required tests defined',
    },
    {
      label: 'No critical UAT defects',
      state: summary.criticalDefects === 0 ? 'PASS' : 'FAIL',
      detail: `${summary.criticalDefects}`,
    },
    {
      label: 'UAT approval granted',
      state: appr === 'approved' ? 'PASS' : appr === 'rejected' ? 'FAIL' : appr === 'pending' ? 'PENDING' : 'NOT CONFIGURED',
      detail: appr ?? 'Not requested',
    },
    {
      label: 'GitHub configured',
      state: integration?.github_repository ? 'PASS' : 'NOT CONFIGURED',
      detail: integration?.github_repository ?? 'Not configured',
    },
    {
      label: 'Production infrastructure',
      state: integration?.production_provider || integration?.production_url ? 'PASS' : 'NOT CONFIGURED',
      detail: integration?.production_url || integration?.production_provider || 'Not configured',
    },
    {
      label: 'Monitoring configured',
      state: integration?.monitoring_provider ? 'PASS' : 'NOT CONFIGURED',
      detail: integration?.monitoring_provider ?? 'Not configured',
    },
  ];
}

export default function UatSection({ project, uat, buildSummary, integration }: UatSectionProps) {
  const [showConnect, setShowConnect] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const { summary, data } = uat;

  // ── Loading ──
  if (uat.loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-5 bg-background-200/60 rounded w-40"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-background-200/40 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (uat.error) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <i className="ri-error-warning-line text-2xl text-red-400 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">UAT data unavailable</h3>
        <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">{uat.error}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={uat.refresh}
            className="bg-background-200/60 border border-background-300/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
          <Link
            to="/admin/website-uat"
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Open Global UAT
          </Link>
        </div>
      </div>
    );
  }

  // ── Not configured ──
  if (!summary.linked) {
    return (
      <>
        <div className="px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-clipboard-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">UAT Not Configured</h3>
          <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">
            No UAT project is linked to this Digital Footprint project yet. Connect an existing UAT project or create a
            new one to see test runs, defects, evidence and launch approval here.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowConnect(true)}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-link w-4 h-4 flex items-center justify-center inline-block mr-1.5"></i>
              Connect UAT Project
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="bg-background-200/60 border border-background-300/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line w-4 h-4 flex items-center justify-center inline-block mr-1.5"></i>
              Create UAT Project
            </button>
            <Link
              to="/admin/website-uat"
              className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer no-underline"
            >
              Open Global UAT
            </Link>
          </div>
        </div>

        <ConnectUatProjectModal
          open={showConnect}
          projectId={project.id}
          projectName={project.project_name}
          onClose={() => setShowConnect(false)}
          onConnect={uat.connect}
        />
        <UatProjectFormModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            uat.refresh();
          }}
          defaultName={project.project_name}
          defaultInternalProjectId={project.id}
        />
      </>
    );
  }

  const uatProject = summary.uatProject!;
  const passRateLabel =
    summary.passRate == null ? 'No completed tests' : `${Math.round(summary.passRate * 100)}%`;

  return (
    <div className="p-6 space-y-6">
      {/* Header / deep links */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-heading font-bold text-foreground-50">{uatProject.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${UAT_STATUS_COLORS[summary.uatStatus]}`}>
              {summary.uatStatus.replace('_', ' ')}
            </span>
            {uatProject.status && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-foreground-500/10 text-foreground-500">
                {(uatProject.status || '').replace('_', ' ')}
              </span>
            )}
          </div>
          {uatProject.objective && <p className="text-sm text-foreground-500 mt-1 max-w-2xl line-clamp-2">{uatProject.objective}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/admin/website-uat?tab=register&project=${uatProject.id}`}
            className="text-xs text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer no-underline"
          >
            Open UAT Project
          </Link>
          <button
            type="button"
            onClick={() => setShowDisconnect(true)}
            className="text-xs text-foreground-400 hover:text-red-400 bg-background-50 border border-background-200/60 hover:border-red-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* GO/NO-GO + approval */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-5 flex items-center gap-5">
          <div className={`w-24 h-24 rounded-2xl flex items-center justify-center shrink-0 ${GONOGO_COLORS[summary.goNoGo]}`}>
            <span className="text-xl font-heading font-bold tracking-wide">{summary.goNoGo}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Launch Decision</p>
            <h4 className="text-base font-heading font-bold text-foreground-50 mb-1.5">{summary.goNoGo}</h4>
            <div className="flex items-center gap-3 text-xs text-foreground-500 flex-wrap">
              <span>Pass rate {passRateLabel}</span>
              <span>{summary.criticalDefects} critical defect{summary.criticalDefects === 1 ? '' : 's'}</span>
              <span>Approval {summary.approvalStatus ?? 'Not requested'}</span>
            </div>
          </div>
        </div>

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Launch Approval</h4>
            {summary.approval ? (
              <Link
                to={`/admin/website-uat/approval/${summary.approval.id}`}
                className="text-xs text-accent-400 hover:text-accent-300 no-underline whitespace-nowrap"
              >
                View Approval
              </Link>
            ) : (
              <Link to="/admin/website-uat?tab=approval" className="text-xs text-accent-400 hover:text-accent-300 no-underline whitespace-nowrap">
                Open Approvals
              </Link>
            )}
          </div>
          {summary.approval ? (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${APPROVAL_STATUS_COLORS[summary.approval.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                  {summary.approval.status}
                </span>
                {summary.approval.decided_at && (
                  <span className="text-xs text-foreground-500">Decided {new Date(summary.approval.decided_at).toLocaleDateString()}</span>
                )}
              </div>
              {summary.approval.decision_reason ? (
                <p className="text-xs text-foreground-500 line-clamp-2">{summary.approval.decision_reason}</p>
              ) : (
                <p className="text-xs text-foreground-600">No decision notes recorded.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground-500">No approval requested yet.</p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="UAT Status" value={summary.uatStatus.replace('_', ' ')} />
        <SummaryCard label="Current Test Run" value={summary.currentRun?.title || 'None'} />
        <SummaryCard label="Pass Rate" value={passRateLabel} tone={summary.passRate == null ? undefined : summary.passRate >= 0.9 ? 'text-emerald-400' : summary.passRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'} />
        <SummaryCard label="Tests Passed" value={String(summary.testsPassed)} tone="text-emerald-400" />
        <SummaryCard label="Tests Failed" value={String(summary.testsFailed)} tone="text-red-400" />
        <SummaryCard label="Tests Blocked" value={String(summary.testsBlocked)} tone="text-orange-400" />
        <SummaryCard label="Open Defects" value={String(summary.openDefects)} tone={summary.openDefects > 0 ? 'text-red-400' : undefined} />
        <SummaryCard label="Critical Defects" value={String(summary.criticalDefects)} tone={summary.criticalDefects > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <SummaryCard label="Approval" value={summary.approvalStatus || 'Not requested'} />
        <SummaryCard label="Evidence" value={String(summary.evidenceCount)} />
      </div>

      {/* Critical defects banner */}
      {summary.criticalDefects > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <i className="ri-alert-fill text-xl text-red-400 w-6 h-6 flex items-center justify-center"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-300">LAUNCH BLOCKED</p>
            <p className="text-xs text-red-400/80">
              {summary.criticalDefects} unresolved critical defect{summary.criticalDefects === 1 ? '' : 's'} must be resolved before launch.
            </p>
          </div>
        </div>
      )}

      {/* Build → UAT cross panel + launch readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
            <i className="ri-git-branch-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Build → UAT
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <CrossItem label="Build Readiness" value={`${buildSummary.progressPercent}%`} />
            <CrossItem label="UAT" value={summary.uatStatus.replace('_', ' ')} />
            <CrossItem label="Critical Defects" value={String(summary.criticalDefects)} />
            <CrossItem label="Launch Approval" value={summary.approvalStatus || 'Not requested'} />
          </div>
        </div>

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
            <i className="ri-rocket-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Launch Readiness
          </h4>
          <div className="grid gap-1.5">
            {launchChecks(buildSummary, summary, integration).map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-3 py-1 border-b border-background-200/60 last:border-0">
                <span className="text-xs text-foreground-300">{c.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground-500">{c.detail}</span>
                  <span className={`text-[10px] font-label font-semibold uppercase ${CHECK_STATE_COLORS[c.state]}`}>{c.state}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current run */}
      <UatCurrentRunPanel summary={summary} data={data} />

      {/* Defects */}
      <UatDefectsPanel data={data} />

      {/* Evidence / reports / tester activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UatEvidencePanel data={data} />
        <UatReportsPanel data={data} />
      </div>
      <UatTesterActivityPanel data={data} />

      {/* Modals */}
      <ConfirmDialog
        open={showDisconnect}
        onClose={() => setShowDisconnect(false)}
        title="Disconnect UAT Project"
        message={`Unlink "${uatProject.name}" from this project? The UAT project and all its data will remain intact — only the association is removed.`}
        confirmLabel={uat.saving ? 'Disconnecting...' : 'Disconnect'}
        confirmVariant="accent"
        onConfirm={async () => {
          await uat.disconnect(uatProject.id);
          setShowDisconnect(false);
        }}
        loading={uat.saving}
      />
    </div>
  );
}

// ─── Small building blocks ──────────────────────────────────────

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-3 min-w-0">
      <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5 whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-bold ${tone || 'text-foreground-100'} truncate`} title={value}>{value}</p>
    </div>
  );
}

function CrossItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-foreground-100">{value}</p>
    </div>
  );
}
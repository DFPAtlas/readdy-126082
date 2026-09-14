// ============================================================================
// DFP COMMAND 16A — PROJECT GITHUB (CANONICAL INTEGRATION READ)
// ============================================================================
// Reads the project's source-control identity from the SAME canonical record
// (internal_project_integrations) that Infrastructure, Monitoring, Launch,
// Deployment and Operations consume. Latest / last-known-good SHA are NOT
// duplicated here — they are deployment/approval history sourced from Launch
// Control and passed in as read-only values.
import type { Project } from '../types';
import type { IntegrationState, ProjectIntegration } from '../infrastructureTypes';
import { INTEGRATION_STATE_COLORS, INTEGRATION_STATE_LABELS } from '../infrastructureTypes';
import { configured, integrationState } from '../infrastructureUtils';

interface GitHubSectionProps {
  project: Project;
  integration: ProjectIntegration | null;
  unavailable: boolean;
  latestSha: string | null;
  lastKnownGoodSha: string | null;
  onEdit: () => void;
}

export default function GitHubSection({
  project,
  integration,
  unavailable,
  latestSha,
  lastKnownGoodSha,
  onEdit,
}: GitHubSectionProps) {
  const repoConfigured = configured(integration?.github_repository);
  const state: IntegrationState = integrationState(integration?.github_repository, unavailable);

  const hasAnyDetail =
    configured(integration?.github_owner) ||
    configured(integration?.github_url) ||
    configured(integration?.github_default_branch);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">GitHub</h3>
          <p className="text-sm text-foreground-500 mt-1">
            Source-control identity for {project.project_name} — read from the single canonical integration record.
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-pencil-line w-4 h-4 flex items-center justify-center"></i>
          Edit Integration
        </button>
      </div>

      {/* Unavailable state */}
      {unavailable && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-6 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <i className="ri-cloud-off-line text-2xl text-amber-400 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-100 mb-1">Integration data unavailable</h4>
          <p className="text-sm text-foreground-500 max-w-md mx-auto">
            The project&apos;s integration record could not be loaded. This is not the same as an unconfigured project.
          </p>
        </div>
      )}

      {/* Not configured */}
      {!unavailable && !repoConfigured && (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-github-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-100 mb-1">No repository configured</h4>
          <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">
            No GitHub repository is mapped to this project yet. Add one through the shared integration record.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Configure Repository
          </button>
        </div>
      )}

      {/* Configured */}
      {!unavailable && repoConfigured && (
        <>
          {/* Connection summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Repository" value={integration?.github_repository ?? '—'} mono />
            <SummaryCard label="Owner" value={integration?.github_owner ?? '—'} mono />
            <SummaryCard label="Default Branch" value={integration?.github_default_branch ?? '—'} mono />
            <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
              <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2 whitespace-nowrap">Connection State</p>
              <StateBadge state={state} />
            </div>
          </div>

          {/* Repository details */}
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center">
                <i className="ri-git-repository-line text-sm text-foreground-400 w-4 h-4 flex items-center justify-center"></i>
              </div>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Repository</h4>
              {integration?.github_url && (
                <a
                  href={integration.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Open Repository
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <FieldRow label="Repository" value={integration?.github_repository} mono />
              <FieldRow label="Owner" value={integration?.github_owner} mono />
              <FieldRow label="Default Branch" value={integration?.github_default_branch} mono />
              <FieldRow label="URL" value={integration?.github_url} mono />
            </div>
          </div>

          {/* SHA (read-only, from Launch Control) */}
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center">
                <i className="ri-git-commit-line text-sm text-foreground-400 w-4 h-4 flex items-center justify-center"></i>
              </div>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Deployment SHA</h4>
            </div>
            <p className="text-xs text-foreground-500 mb-4">
              Sourced from Launch Control / Deployment history — not stored in the integration record.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
                <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-1">Latest Approved SHA</p>
                <p className="text-sm font-mono text-foreground-200 truncate">{latestSha ? latestSha.slice(0, 12) : 'Not recorded'}</p>
              </div>
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
                <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-1">Last Known Good SHA</p>
                <p className="text-sm font-mono text-foreground-200 truncate">{lastKnownGoodSha ? lastKnownGoodSha.slice(0, 12) : 'Not recorded'}</p>
              </div>
            </div>
          </div>

          {!hasAnyDetail && (
            <p className="text-xs text-foreground-500">
              Only the repository name is configured — owner, URL and default branch can be added via Edit Integration.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────

function SummaryCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2 whitespace-nowrap">{label}</p>
      <p className={`text-sm text-foreground-100 truncate ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  );
}

function StateBadge({ state }: { state: IntegrationState }) {
  return (
    <span className={`inline-block text-[10px] font-label px-2 py-0.5 rounded-full border whitespace-nowrap ${INTEGRATION_STATE_COLORS[state]}`}>
      {INTEGRATION_STATE_LABELS[state]}
    </span>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm text-foreground-200 truncate ${mono ? 'font-mono' : ''}`} title={value ?? undefined}>
        {value || '—'}
      </p>
    </div>
  );
}
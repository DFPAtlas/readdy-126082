import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Project } from '../types';
import type { InfraState, ProjectIntegration } from '../infrastructureTypes';
import { INFRA_STATE_COLORS } from '../infrastructureTypes';
import { completeness, configured, integrationConflicts } from '../infrastructureUtils';
import type { ProjectInfrastructureData } from '../useProjectInfrastructure';
import { formatDate } from '../utils';
import ConfigureInfrastructureModal from './ConfigureInfrastructureModal';

interface InfrastructureSectionProps {
  project: Project;
  infra: ProjectInfrastructureData;
}

export default function InfrastructureSection({ project, infra }: InfrastructureSectionProps) {
  const [showConfigure, setShowConfigure] = useState(false);

  const integration = infra.integration;
  const comp = completeness(integration, project.domain_live);
  const conflicts = integrationConflicts(integration, project.domain_live, project.domain_staging);

  const githubConfigured = configured(integration?.github_repository) || configured(integration?.github_owner) || configured(integration?.github_url);
  const readdyConfigured = configured(integration?.readdy_project_id) || configured(integration?.readdy_project_url);
  const supabaseConfigured = configured(integration?.supabase_project_ref) || configured(integration?.supabase_project_name);
  const productionConfigured = configured(integration?.production_provider) || configured(integration?.production_url);
  const stagingConfigured = configured(integration?.staging_provider) || configured(integration?.staging_url);
  const dnsConfigured = configured(integration?.dns_provider) || configured(integration?.dns_zone);
  const runtimeConfigured = configured(integration?.runtime_node) || configured(integration?.runtime_environment);
  const monitoringConfigured = configured(integration?.monitoring_provider) || configured(integration?.monitoring_target);

  const summaryCards: { label: string; icon: string; state: InfraState; detail: string }[] = [
    { label: 'Production', icon: 'ri-global-line', state: productionConfigured ? 'CONFIGURED' : 'NOT CONFIGURED', detail: productionConfigured ? (integration?.production_url ?? integration?.production_provider ?? 'Configured') : 'No mapping' },
    { label: 'Staging', icon: 'ri-stack-line', state: stagingConfigured ? 'CONFIGURED' : 'NOT CONFIGURED', detail: stagingConfigured ? (integration?.staging_url ?? integration?.staging_provider ?? 'Configured') : 'Optional' },
    { label: 'Supabase', icon: 'ri-database-2-line', state: supabaseConfigured ? 'CONFIGURED' : 'NOT CONFIGURED', detail: supabaseConfigured ? (integration?.supabase_project_ref ?? integration?.supabase_project_name ?? 'Configured') : 'No mapping' },
    { label: 'DNS', icon: 'ri-earth-line', state: dnsConfigured ? 'CONFIGURED' : 'NOT CONFIGURED', detail: dnsConfigured ? (integration?.dns_provider ?? 'Configured') : 'No provider' },
    { label: 'Runtime', icon: 'ri-cpu-line', state: runtimeConfigured ? 'CONFIGURED' : 'NOT CONFIGURED', detail: runtimeConfigured ? (integration?.runtime_node ?? 'Configured') : 'No mapping' },
    { label: 'Monitoring', icon: 'ri-pulse-line', state: monitoringConfigured ? 'CONFIGURED' : 'NOT CONFIGURED', detail: monitoringConfigured ? `${integration?.monitoring_provider ?? 'Configured'} · Verification Unknown` : 'No mapping' },
  ];

  const lastCheck = integration?.last_infrastructure_check_at;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Infrastructure</h3>
          <p className="text-sm text-foreground-500 mt-1">
            Operational identity for {project.project_name} — domains, Supabase, hosting, DNS, runtime and monitoring.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfigure(true)}
          className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-settings-3-line w-4 h-4 flex items-center justify-center"></i>
          Edit Integrations
        </button>
      </div>

      {/* Error state */}
      {infra.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-6 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-red-400 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-100 mb-1">Infrastructure data unavailable.</h4>
          <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">
            The infrastructure mapping could not be loaded for this project.
          </p>
          <button
            type="button"
            onClick={infra.refresh}
            className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {!infra.error && infra.loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-background-50 border border-background-200/60 rounded-lg"></div>
            ))}
          </div>
          <div className="h-40 bg-background-50 border border-background-200/60 rounded-lg"></div>
        </div>
      )}

      {!infra.error && !infra.loading && (
        <>
          {/* Configuration conflicts (never silently overwritten) */}
          {conflicts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <i className="ri-alert-line text-lg text-amber-400 w-5 h-5 flex items-center justify-center"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-heading font-semibold text-amber-300">Configuration Conflict</p>
                  <ul className="mt-2 space-y-1.5">
                    {conflicts.map((c) => (
                      <li key={c.field} className="text-xs text-foreground-300">
                        <span className="font-label text-foreground-200">{c.label}:</span> {c.message}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-foreground-500 mt-2">
                    The canonical value is preserved. Resolve the disagreement by editing integrations — nothing is
                    silently overwritten.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{card.label}</span>
                  <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center">
                    <i className={`${card.icon} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
                  </div>
                </div>
                <StatusBadge state={card.state} />
                <p className="text-xs text-foreground-500 mt-2 truncate" title={card.detail}>{card.detail}</p>
              </div>
            ))}
          </div>

          {/* Completeness + Missing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Infrastructure Completeness</h4>
                <span className="text-xs text-foreground-500">configuration only</span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-heading font-bold text-foreground-50">
                  {comp.requiredConfigured}
                  <span className="text-foreground-500 text-lg"> / {comp.requiredTotal}</span>
                </span>
                <span className="text-xs text-foreground-500 mb-1.5">Core Integrations Configured</span>
              </div>
              <div className="h-2 bg-background-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-300"
                  style={{ width: `${comp.requiredTotal > 0 ? Math.round((comp.requiredConfigured / comp.requiredTotal) * 100) : 0}%` }}
                ></div>
              </div>
              {comp.optionalConfigured > 0 && (
                <p className="text-xs text-foreground-500 mt-3">
                  + {comp.optionalConfigured} optional integration configured (staging).
                </p>
              )}
            </div>

            <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Missing Configuration</h4>
              {comp.missing.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <i className="ri-check-double-line w-5 h-5 flex items-center justify-center"></i>
                  All core integrations are configured.
                </div>
              ) : (
                <ul className="space-y-2">
                  {comp.missing.map((item) => (
                    <li key={item.key} className="flex items-center gap-2.5 text-sm text-foreground-300">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
                      <span>{item.label} not configured</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Domains */}
          <Panel title="Domains" icon="ri-global-line">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <DomainCard
                label="Production Domain"
                domain={project.domain_live}
                state={configured(project.domain_live) ? 'CONFIGURED' : 'NOT CONFIGURED'}
                lastChecked={lastCheck}
              />
              <DomainCard
                label="Staging Domain"
                domain={project.domain_staging}
                state={configured(project.domain_staging) ? 'CONFIGURED' : 'NOT CONFIGURED'}
                lastChecked={lastCheck}
              />
            </div>
          </Panel>

          {/* Source Control & Readdy (canonical) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="GitHub"
              icon="ri-github-line"
              actions={integration?.github_url ? <ExternalButton href={integration.github_url} label="Open Repo" /> : undefined}
            >
              {githubConfigured ? (
                <div className="space-y-3">
                  <FieldRow label="Repository" value={integration?.github_repository} mono />
                  <FieldRow label="Owner" value={integration?.github_owner} mono />
                  <FieldRow label="Default Branch" value={integration?.github_default_branch} mono />
                  <FieldRow label="State" value="Configured" />
                </div>
              ) : (
                <EmptyNote text="No GitHub repository is mapped to this project." />
              )}
            </Panel>

            <Panel
              title="Readdy"
              icon="ri-cloud-line"
              actions={integration?.readdy_project_url ? <ExternalButton href={integration.readdy_project_url} label="Open Readdy" /> : undefined}
            >
              {readdyConfigured ? (
                <div className="space-y-3">
                  <FieldRow label="Project ID" value={integration?.readdy_project_id} mono />
                  <FieldRow label="Project URL" value={integration?.readdy_project_url} mono />
                  <FieldRow label="Sync State" value="Configured — verification unknown" />
                </div>
              ) : (
                <EmptyNote text="No Readdy project is mapped. Status: Not Configured." />
              )}
            </Panel>
          </div>

          {/* Supabase */}
          <Panel
            title="Supabase"
            icon="ri-database-2-line"
            actions={
              <>
                <CopyButton text={integration?.supabase_project_ref ?? ''} disabled={!integration?.supabase_project_ref} label="Copy Project Ref" />
                {integration?.supabase_dashboard_url && (
                  <ExternalButton href={integration.supabase_dashboard_url} label="Open Supabase" />
                )}
              </>
            }
          >
            {supabaseConfigured ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                <FieldRow label="Project Name" value={integration?.supabase_project_name} />
                <FieldRow label="Project Ref" value={integration?.supabase_project_ref} mono />
                <FieldRow label="Region" value={integration?.supabase_region} />
                <FieldRow label="State" value="Configured — Verification Unavailable" />
                <FieldRow label="Last Check" value={lastCheck ? formatDate(lastCheck) : 'Not checked'} />
              </div>
            ) : (
              <EmptyNote text="No Supabase project has been mapped to this site yet." />
            )}
          </Panel>

          {/* Production + Staging */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Production"
              icon="ri-global-line"
              actions={
                <>
                  <CopyButton text={integration?.production_url ?? ''} disabled={!integration?.production_url} label="Copy URL" />
                  {integration?.production_url && <ExternalButton href={integration.production_url} label="Open Production" />}
                </>
              }
            >
              {productionConfigured ? (
                <div className="space-y-3">
                  <FieldRow label="Provider" value={integration?.production_provider} />
                  <FieldRow label="Environment ID" value={integration?.production_environment_id} mono />
                  <FieldRow label="URL" value={integration?.production_url} mono />
                  <FieldRow label="Status" value="Configured" />
                  <FieldRow label="Last Verified" value={lastCheck ? formatDate(lastCheck) : 'Not verified'} />
                </div>
              ) : (
                <EmptyNote text="Production hosting is not configured." />
              )}
            </Panel>

            <Panel
              title="Staging"
              icon="ri-stack-line"
              actions={
                <>
                  <CopyButton text={integration?.staging_url ?? ''} disabled={!integration?.staging_url} label="Copy URL" />
                  {integration?.staging_url && <ExternalButton href={integration.staging_url} label="Open Staging" />}
                </>
              }
            >
              {stagingConfigured ? (
                <div className="space-y-3">
                  <FieldRow label="Provider" value={integration?.staging_provider} />
                  <FieldRow label="Environment ID" value={integration?.staging_environment_id} mono />
                  <FieldRow label="URL" value={integration?.staging_url} mono />
                  <FieldRow label="Status" value="Configured" />
                  <FieldRow label="Last Verified" value={lastCheck ? formatDate(lastCheck) : 'Not verified'} />
                </div>
              ) : (
                <EmptyNote text="No staging environment configured. This is optional." />
              )}
            </Panel>
          </div>

          {/* DNS + Runtime */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="DNS"
              icon="ri-earth-line"
              actions={
                <>
                  <CopyButton text={integration?.dns_zone ?? ''} disabled={!integration?.dns_zone} label="Copy Zone" />
                  {project.domain_live && <ExternalButton href={`https://${project.domain_live}`} label="Open Domain" />}
                </>
              }
            >
              {dnsConfigured ? (
                <div className="space-y-3">
                  <FieldRow label="DNS Provider" value={integration?.dns_provider} />
                  <FieldRow label="Zone" value={integration?.dns_zone} mono />
                  <FieldRow label="Production Domain" value={project.domain_live} mono />
                  <FieldRow label="Staging Domain" value={project.domain_staging} mono />
                  <FieldRow label="Status" value="Configured" />
                </div>
              ) : (
                <EmptyNote text="DNS mapping is not configured. No DNS changes are made by DFP Command." />
              )}
            </Panel>

            <Panel title="Runtime" icon="ri-cpu-line">
              {runtimeConfigured ? (
                <div className="space-y-3">
                  <FieldRow label="Runtime Node" value={integration?.runtime_node} mono />
                  <FieldRow label="Runtime Environment" value={integration?.runtime_environment} />
                  <FieldRow label="Status" value="Configured" />
                  <FieldRow label="Last Check" value={lastCheck ? formatDate(lastCheck) : 'Not checked'} />
                </div>
              ) : (
                <EmptyNote text="Runtime mapping is not configured. This is an association only — no runtime services are started or stopped." />
              )}
            </Panel>
          </div>

          {/* Monitoring */}
          <Panel
            title="Monitoring"
            icon="ri-pulse-line"
            actions={
              integration?.monitoring_dashboard_url ? (
                <ExternalButton href={integration.monitoring_dashboard_url} label="Open Monitoring" />
              ) : undefined
            }
          >
            {monitoringConfigured ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                <FieldRow label="Provider" value={integration?.monitoring_provider} />
                <FieldRow label="Target" value={integration?.monitoring_target} mono />
                <FieldRow label="Status" value="Configured — Verification Unknown" />
                <FieldRow label="Last Check" value={lastCheck ? formatDate(lastCheck) : 'Not checked'} />
              </div>
            ) : (
              <EmptyNote text="No monitoring source is linked to this project yet." />
            )}
          </Panel>

          {/* Notes */}
          {integration?.infrastructure_notes && (
            <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-foreground-400 leading-relaxed whitespace-pre-wrap">{integration.infrastructure_notes}</p>
            </div>
          )}
        </>
      )}

      {/* Configure modal */}
      <ConfigureInfrastructureModal
        open={showConfigure}
        onClose={() => setShowConfigure(false)}
        integration={integration}
        saving={infra.saving}
        onSave={infra.save}
      />
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────

function StatusBadge({ state }: { state: InfraState }) {
  return (
    <span className={`inline-block text-[10px] font-label px-2 py-0.5 rounded-full border whitespace-nowrap ${INFRA_STATE_COLORS[state]}`}>
      {state}
    </span>
  );
}

function Panel({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center">
            <i className={`${icon} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
          </div>
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {children}
    </div>
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

function DomainCard({
  label,
  domain,
  state,
  lastChecked,
}: {
  label: string;
  domain: string | null | undefined;
  state: InfraState;
  lastChecked: string | null | undefined;
}) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <StatusBadge state={state} />
      </div>
      {domain ? (
        <>
          <p className="text-sm font-mono text-foreground-100 truncate mb-3">{domain}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <ExternalButton href={`https://${domain}`} label="Open Site" />
            <CopyButton text={domain} label="Copy" />
          </div>
          <p className="text-[10px] text-foreground-500 mt-2">
            Last checked: {lastChecked ? formatDate(lastChecked) : 'Not checked'}
          </p>
        </>
      ) : (
        <p className="text-sm text-foreground-500">Not Configured</p>
      )}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground-500">
      <i className="ri-information-line w-4 h-4 flex items-center justify-center text-foreground-600"></i>
      {text}
    </div>
  );
}

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
    >
      <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
      {label}
    </a>
  );
}

function CopyButton({ text, label, disabled }: { text: string; label: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !text}
      className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
      {copied ? 'Copied' : label}
    </button>
  );
}
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ChangeEvent, ReactNode } from 'react';
import type { InfraFormFields, ProjectIntegration } from '../infrastructureTypes';
import { INFRA_SUGGESTIONS } from '../infrastructureTypes';
import { isValidUrl } from '../infrastructureUtils';

interface ConfigureInfrastructureModalProps {
  open: boolean;
  onClose: () => void;
  integration: ProjectIntegration | null;
  saving: boolean;
  onSave: (fields: InfraFormFields) => Promise<string | null>;
}

const EMPTY: InfraFormFields = {
  github_repository: '',
  github_owner: '',
  github_url: '',
  github_default_branch: '',
  readdy_project_id: '',
  readdy_project_url: '',
  supabase_project_ref: '',
  supabase_project_name: '',
  supabase_dashboard_url: '',
  supabase_region: '',
  production_provider: '',
  production_url: '',
  production_environment_id: '',
  staging_provider: '',
  staging_url: '',
  staging_environment_id: '',
  dns_provider: '',
  dns_zone: '',
  runtime_node: '',
  runtime_environment: '',
  monitoring_provider: '',
  monitoring_target: '',
  monitoring_dashboard_url: '',
  infrastructure_notes: '',
};

export default function ConfigureInfrastructureModal({
  open,
  onClose,
  integration,
  saving,
  onSave,
}: ConfigureInfrastructureModalProps) {
  const [form, setForm] = useState<InfraFormFields>(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      github_repository: integration?.github_repository ?? '',
      github_owner: integration?.github_owner ?? '',
      github_url: integration?.github_url ?? '',
      github_default_branch: integration?.github_default_branch ?? '',
      readdy_project_id: integration?.readdy_project_id ?? '',
      readdy_project_url: integration?.readdy_project_url ?? '',
      supabase_project_ref: integration?.supabase_project_ref ?? '',
      supabase_project_name: integration?.supabase_project_name ?? '',
      supabase_dashboard_url: integration?.supabase_dashboard_url ?? '',
      supabase_region: integration?.supabase_region ?? '',
      production_provider: integration?.production_provider ?? '',
      production_url: integration?.production_url ?? '',
      production_environment_id: integration?.production_environment_id ?? '',
      staging_provider: integration?.staging_provider ?? '',
      staging_url: integration?.staging_url ?? '',
      staging_environment_id: integration?.staging_environment_id ?? '',
      dns_provider: integration?.dns_provider ?? '',
      dns_zone: integration?.dns_zone ?? '',
      runtime_node: integration?.runtime_node ?? '',
      runtime_environment: integration?.runtime_environment ?? '',
      monitoring_provider: integration?.monitoring_provider ?? '',
      monitoring_target: integration?.monitoring_target ?? '',
      monitoring_dashboard_url: integration?.monitoring_dashboard_url ?? '',
      infrastructure_notes: integration?.infrastructure_notes ?? '',
    });
  }, [open, integration]);

  const set = (key: keyof InfraFormFields) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const validate = (): string | null => {
    const urlFields: [keyof InfraFormFields, string][] = [
      ['github_url', 'GitHub Repository URL'],
      ['readdy_project_url', 'Readdy Project URL'],
      ['supabase_dashboard_url', 'Supabase Dashboard URL'],
      ['production_url', 'Production URL'],
      ['staging_url', 'Staging URL'],
      ['monitoring_dashboard_url', 'Monitoring Dashboard URL'],
    ];
    for (const [key, label] of urlFields) {
      if (form[key] && !isValidUrl(form[key])) return `${label} must be a valid URL (start with http:// or https://).`;
    }

    if (form.supabase_project_ref && /\s/.test(form.supabase_project_ref)) {
      return 'Supabase Project Ref must not contain spaces.';
    }
    if (form.readdy_project_id && /\s/.test(form.readdy_project_id)) {
      return 'Readdy Project ID must not contain spaces.';
    }
    const idFields: [keyof InfraFormFields, string][] = [
      ['production_environment_id', 'Production Environment ID'],
      ['staging_environment_id', 'Staging Environment ID'],
    ];
    for (const [key, label] of idFields) {
      if (form[key] && !/^[a-zA-Z0-9_-]+$/.test(form[key])) {
        return `${label} may only contain letters, numbers, dashes and underscores.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    const err = await onSave(form);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>

      <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-xl w-full max-w-3xl shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] z-10 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-background-400/60 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-heading font-semibold text-foreground-50">Edit Project Integrations</h3>
            <p className="text-xs text-foreground-500 mt-0.5">
              One canonical mapping for this project&apos;s source control, Readdy, backend, hosting, DNS, runtime and
              monitoring identity. No secrets are stored.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-foreground-300 hover:text-foreground-50 hover:bg-background-400/50 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Source Control — GitHub */}
          <Group icon="ri-github-line" title="Source Control — GitHub">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Repository" full>
                <input type="text" value={form.github_repository} onChange={set('github_repository')} placeholder="e.g. guardianhub/guardianhub" className={inputClass} />
              </Field>
              <Field label="Owner">
                <input type="text" value={form.github_owner} onChange={set('github_owner')} placeholder="e.g. guardianhub" className={inputClass} />
              </Field>
              <Field label="Default Branch">
                <input type="text" value={form.github_default_branch} onChange={set('github_default_branch')} placeholder="e.g. main" className={inputClass} />
              </Field>
              <Field label="Repository URL">
                <input type="text" value={form.github_url} onChange={set('github_url')} placeholder="https://github.com/owner/repo" className={inputClass} />
              </Field>
            </div>
          </Group>

          {/* Readdy */}
          <Group icon="ri-cloud-line" title="Readdy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Project ID">
                <input type="text" value={form.readdy_project_id} onChange={set('readdy_project_id')} placeholder="e.g. guardianhub-prod" className={inputClass} />
              </Field>
              <Field label="Project URL">
                <input type="text" value={form.readdy_project_url} onChange={set('readdy_project_url')} placeholder="https://..." className={inputClass} />
              </Field>
            </div>
            <p className="text-[10px] text-foreground-600 mt-2">
              Readdy sync state is reported as Configured / Not Configured only — no live Readdy verification is
              invented here.
            </p>
          </Group>

          {/* Supabase */}
          <Group icon="ri-database-2-line" title="Backend — Supabase">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Project Name">
                <input type="text" value={form.supabase_project_name} onChange={set('supabase_project_name')} placeholder="e.g. GuardianHub Production" className={inputClass} />
              </Field>
              <Field label="Project Ref">
                <input type="text" value={form.supabase_project_ref} onChange={set('supabase_project_ref')} placeholder="e.g. abcdefghijklmno" className={inputClass} />
              </Field>
              <Field label="Region">
                <DatalistInput id="infra-supabase-region" value={form.supabase_region} onChange={set('supabase_region')} placeholder="e.g. eu-west-1" suggestions={INFRA_SUGGESTIONS.supabaseRegion} />
              </Field>
              <Field label="Dashboard URL">
                <input type="text" value={form.supabase_dashboard_url} onChange={set('supabase_dashboard_url')} placeholder="https://supabase.com/dashboard/project/..." className={inputClass} />
              </Field>
            </div>
          </Group>

          {/* Production */}
          <Group icon="ri-global-line" title="Production Hosting">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Provider">
                <DatalistInput id="infra-prod-provider" value={form.production_provider} onChange={set('production_provider')} placeholder="e.g. Readdy" suggestions={INFRA_SUGGESTIONS.productionProvider} />
              </Field>
              <Field label="Environment ID">
                <input type="text" value={form.production_environment_id} onChange={set('production_environment_id')} placeholder="e.g. prod-guardianhub" className={inputClass} />
              </Field>
              <Field label="URL" full>
                <input type="text" value={form.production_url} onChange={set('production_url')} placeholder="https://guardianhub.uk" className={inputClass} />
              </Field>
            </div>
          </Group>

          {/* Staging */}
          <Group icon="ri-stack-line" title="Staging Hosting">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Provider">
                <DatalistInput id="infra-staging-provider" value={form.staging_provider} onChange={set('staging_provider')} placeholder="e.g. Coolify" suggestions={INFRA_SUGGESTIONS.stagingProvider} />
              </Field>
              <Field label="Environment ID">
                <input type="text" value={form.staging_environment_id} onChange={set('staging_environment_id')} placeholder="e.g. staging-guardianhub" className={inputClass} />
              </Field>
              <Field label="URL" full>
                <input type="text" value={form.staging_url} onChange={set('staging_url')} placeholder="https://staging.guardianhub.uk" className={inputClass} />
              </Field>
            </div>
          </Group>

          {/* DNS */}
          <Group icon="ri-earth-line" title="DNS">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Provider">
                <DatalistInput id="infra-dns-provider" value={form.dns_provider} onChange={set('dns_provider')} placeholder="e.g. Cloudflare" suggestions={INFRA_SUGGESTIONS.dnsProvider} />
              </Field>
              <Field label="Zone">
                <input type="text" value={form.dns_zone} onChange={set('dns_zone')} placeholder="e.g. guardianhub.uk" className={inputClass} />
              </Field>
            </div>
          </Group>

          {/* Runtime */}
          <Group icon="ri-cpu-line" title="Runtime">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Runtime Node">
                <DatalistInput id="infra-runtime-node" value={form.runtime_node} onChange={set('runtime_node')} placeholder="e.g. atlas-hal-runtime-01" suggestions={INFRA_SUGGESTIONS.runtimeNode} />
              </Field>
              <Field label="Runtime Environment">
                <DatalistInput id="infra-runtime-env" value={form.runtime_environment} onChange={set('runtime_environment')} placeholder="e.g. Production" suggestions={INFRA_SUGGESTIONS.runtimeEnvironment} />
              </Field>
            </div>
          </Group>

          {/* Monitoring */}
          <Group icon="ri-pulse-line" title="Monitoring">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Provider">
                <DatalistInput id="infra-monitoring-provider" value={form.monitoring_provider} onChange={set('monitoring_provider')} placeholder="e.g. LibreNMS" suggestions={INFRA_SUGGESTIONS.monitoringProvider} />
              </Field>
              <Field label="Target">
                <input type="text" value={form.monitoring_target} onChange={set('monitoring_target')} placeholder="e.g. guardianhub.uk" className={inputClass} />
              </Field>
              <Field label="Dashboard URL" full>
                <input type="text" value={form.monitoring_dashboard_url} onChange={set('monitoring_dashboard_url')} placeholder="https://..." className={inputClass} />
              </Field>
            </div>
          </Group>

          {/* AI Site — managed elsewhere */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-background-200/60 flex items-center justify-center">
                <i className="ri-robot-2-line text-xs text-foreground-400 w-3.5 h-3.5 flex items-center justify-center"></i>
              </div>
              <h4 className="text-xs font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Site</h4>
            </div>
            <p className="text-xs text-foreground-500">
              AI site assignment is managed in AI Operations, not here — there is a single canonical relationship.
            </p>
            <Link
              to="/ai-operations/sites"
              className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 mt-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Open AI Operations
            </Link>
          </div>

          {/* Notes */}
          <Group icon="ri-sticky-note-line" title="Notes">
            <textarea
              value={form.infrastructure_notes}
              onChange={(e) => setForm((prev) => ({ ...prev, infrastructure_notes: e.target.value }))}
              placeholder="Internal notes about this project's infrastructure..."
              rows={3}
              maxLength={500}
              className={`${inputClass} resize-none`}
            ></textarea>
          </Group>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-background-400/60 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-full text-sm font-medium text-foreground-400 hover:text-foreground-200 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Integrations'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none focus:border-accent-500/40 transition-colors';

function Group({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-background-200/60 flex items-center justify-center">
          <i className={`${icon} text-xs text-foreground-400 w-3.5 h-3.5 flex items-center justify-center`}></i>
        </div>
        <h4 className="text-xs font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-medium text-foreground-400">{label}</label>
      {children}
    </div>
  );
}

function DatalistInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  suggestions: string[];
}) {
  return (
    <>
      <input
        type="text"
        list={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClass}
      />
      <datalist id={id}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
import type { InfraFormFields, IntegrationState, ProjectIntegration } from './infrastructureTypes';

export function configured(value: string | null | undefined): boolean {
  return value != null && value.trim() !== '';
}

export function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Shared status derivation (DFP COMMAND 16A §8).
// A single helper so "Configured / Not Configured / Unavailable" mean the same
// thing in Overview, Infrastructure, Monitoring, GitHub and everywhere else.
// "Unavailable" (loading failed) is deliberately distinct from "Not Configured".
// ────────────────────────────────────────────────────────────────────────────
export function integrationState(
  configuredValue: string | null | undefined,
  unavailable: boolean,
): IntegrationState {
  if (unavailable) return 'UNAVAILABLE';
  return configured(configuredValue) ? 'CONFIGURED' : 'NOT CONFIGURED';
}

export interface CoreItem {
  key: string;
  label: string;
  configured: boolean;
  required: boolean;
}

export function coreItems(
  integration: ProjectIntegration | null,
  liveDomain: string | null | undefined,
): CoreItem[] {
  return [
    { key: 'production_domain', label: 'Production Domain', configured: configured(liveDomain), required: true },
    { key: 'github', label: 'GitHub Repository', configured: configured(integration?.github_repository), required: true },
    { key: 'readdy', label: 'Readdy Project ID', configured: configured(integration?.readdy_project_id), required: true },
    { key: 'supabase', label: 'Supabase Project Ref', configured: configured(integration?.supabase_project_ref), required: true },
    {
      key: 'production',
      label: 'Production Hosting',
      configured: configured(integration?.production_provider) || configured(integration?.production_url),
      required: true,
    },
    { key: 'dns', label: 'DNS Provider', configured: configured(integration?.dns_provider), required: true },
    { key: 'monitoring', label: 'Monitoring', configured: configured(integration?.monitoring_provider), required: true },
    {
      key: 'staging',
      label: 'Staging Hosting',
      configured: configured(integration?.staging_provider) || configured(integration?.staging_url),
      required: false,
    },
  ];
}

export interface CompletenessResult {
  items: CoreItem[];
  requiredConfigured: number;
  requiredTotal: number;
  optionalConfigured: number;
  missing: CoreItem[];
}

/** Configuration completeness only — NOT infrastructure health. */
export function completeness(
  integration: ProjectIntegration | null,
  liveDomain: string | null | undefined,
): CompletenessResult {
  const items = coreItems(integration, liveDomain);
  const required = items.filter((i) => i.required);
  return {
    items,
    requiredConfigured: required.filter((i) => i.configured).length,
    requiredTotal: required.length,
    optionalConfigured: items.filter((i) => !i.required && i.configured).length,
    missing: required.filter((i) => !i.configured),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Conflict detection (DFP COMMAND 16A §19).
// Derived warnings where two valid sources disagree. Never silently pick one —
// the canonical value is preserved and the disagreement is surfaced.
// ────────────────────────────────────────────────────────────────────────────
export interface IntegrationConflict {
  field: string;
  label: string;
  message: string;
}

function normalizedHost(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function integrationConflicts(
  integration: ProjectIntegration | null,
  liveDomain: string | null | undefined,
  stagingDomain: string | null | undefined,
): IntegrationConflict[] {
  if (!integration) return [];
  const conflicts: IntegrationConflict[] = [];

  // Production URL mismatch — canonical hosting vs canonical project domain.
  if (
    configured(integration.production_url) &&
    configured(liveDomain) &&
    normalizedHost(integration.production_url!) !== normalizedHost(liveDomain!)
  ) {
    conflicts.push({
      field: 'production_url',
      label: 'Production URL',
      message: `Production URL (${integration.production_url}) differs from the project live domain (${liveDomain}).`,
    });
  }

  // Staging URL mismatch.
  if (
    configured(integration.staging_url) &&
    configured(stagingDomain) &&
    normalizedHost(integration.staging_url!) !== normalizedHost(stagingDomain!)
  ) {
    conflicts.push({
      field: 'staging_url',
      label: 'Staging URL',
      message: `Staging URL (${integration.staging_url}) differs from the project staging domain (${stagingDomain}).`,
    });
  }

  // GitHub repository mismatch — owner should be consistent with the repo name.
  if (
    configured(integration.github_owner) &&
    configured(integration.github_repository) &&
    !integration.github_repository!.toLowerCase().startsWith(`${integration.github_owner!.toLowerCase()}/`)
  ) {
    conflicts.push({
      field: 'github_repository',
      label: 'GitHub Repository',
      message: `Repository (${integration.github_repository}) does not match the configured owner (${integration.github_owner}).`,
    });
  }

  return conflicts;
}

function sectionChanged(
  existingVals: (string | null | undefined)[],
  newVals: string[],
): 'new' | 'updated' | null {
  const hadAny = existingVals.some((v) => configured(v));
  const hasAny = newVals.some((v) => v.trim() !== '');
  if (!hasAny) return null;
  return hadAny ? 'updated' : 'new';
}

/** Meaningful activity-log messages derived from what actually changed. */
export function activityMessages(existing: ProjectIntegration | null, fields: InfraFormFields): string[] {
  const msgs: string[] = [];

  const github = sectionChanged(
    [existing?.github_repository, existing?.github_owner, existing?.github_url],
    [fields.github_repository, fields.github_owner, fields.github_url],
  );
  if (github) msgs.push(github === 'new' ? 'GitHub repository linked' : 'GitHub repository changed');

  const readdy = sectionChanged(
    [existing?.readdy_project_id, existing?.readdy_project_url],
    [fields.readdy_project_id, fields.readdy_project_url],
  );
  if (readdy) msgs.push(readdy === 'new' ? 'Readdy project linked' : 'Readdy mapping changed');

  const supabase = sectionChanged(
    [existing?.supabase_project_ref, existing?.supabase_project_name],
    [fields.supabase_project_ref, fields.supabase_project_name],
  );
  if (supabase) msgs.push(supabase === 'new' ? 'Supabase project linked' : 'Supabase project updated');

  const production = sectionChanged(
    [existing?.production_provider, existing?.production_url],
    [fields.production_provider, fields.production_url],
  );
  if (production) msgs.push(production === 'new' ? 'Production hosting configured' : 'Production host changed');

  const staging = sectionChanged(
    [existing?.staging_provider, existing?.staging_url],
    [fields.staging_provider, fields.staging_url],
  );
  if (staging) msgs.push(staging === 'new' ? 'Staging environment configured' : 'Staging environment updated');

  const dns = sectionChanged(
    [existing?.dns_provider, existing?.dns_zone],
    [fields.dns_provider, fields.dns_zone],
  );
  if (dns) msgs.push(dns === 'new' ? 'DNS mapping configured' : 'DNS mapping updated');

  const runtime = sectionChanged(
    [existing?.runtime_node, existing?.runtime_environment],
    [fields.runtime_node, fields.runtime_environment],
  );
  if (runtime) msgs.push(runtime === 'new' ? 'Runtime mapping configured' : 'Runtime mapping changed');

  const monitoring = sectionChanged(
    [existing?.monitoring_provider, existing?.monitoring_target],
    [fields.monitoring_provider, fields.monitoring_target],
  );
  if (monitoring) msgs.push(monitoring === 'new' ? 'Monitoring mapping configured' : 'Monitoring mapping changed');

  if (msgs.length === 0) {
    msgs.push(existing ? 'Integration mapping updated' : 'Integration mapping configured');
  }
  return msgs;
}
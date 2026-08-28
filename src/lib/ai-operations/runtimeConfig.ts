// ============================================================================
// AI Operations — Runtime configuration readiness (Phase 3 Prompt 03).
//
// Safe server-side secret-PRESENCE verification. The `runtime-config` Edge
// Function returns only `configured = true/false` per allowlisted system — it
// never returns values, partial values, prefixes, suffixes, lengths, or a raw
// environment dump. The browser can only request a fixed allowlist of system
// slugs; no arbitrary secret name or URL can be probed.
//
// This module provides the shared config contract, the authenticated invoke
// helper, and the deterministic readiness derivation (config presence + safe
// runtime health → Ready / Configured-not-verified / Missing / Unreachable /
// Auth-failed / Not-testable / Blocked).
// ============================================================================

import { supabase } from '@/lib/supabase';

// --- Result contract ----------------------------------------------------------

export interface ConfigResult {
  systemSlug: string;
  requiredConfig: string[];
  configured: boolean;
  presentConfig: string[];
  missingConfig: string[];
  safeTestSupported: boolean;
  blocker: string | null;
  lastChecked: string;
}

export interface ConfigCheckResponse {
  config: ConfigResult[];
}

// --- Readiness model ----------------------------------------------------------

export type ConfigReadinessState =
  | 'ready'
  | 'configured_not_verified'
  | 'missing_config'
  | 'unreachable'
  | 'auth_failed'
  | 'not_testable'
  | 'blocked';

export const CONFIG_SYSTEM_LABELS: Record<string, string> = {
  supabase: 'Supabase',
  n8n: 'n8n',
  ollama: 'Ollama',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  resend: 'Email (Resend)',
  stripe: 'Stripe',
  github: 'GitHub',
  scheduler: 'Scheduler',
  readdy: 'Readdy',
  monitoring: 'Monitoring',
  notifications: 'Notifications',
  site_api: 'Site API',
};

export const CONFIG_READINESS_META: Record<
  ConfigReadinessState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  ready: { label: 'Ready', tone: 'emerald' },
  configured_not_verified: { label: 'Configured / Not Verified', tone: 'secondary' },
  missing_config: { label: 'Missing Configuration', tone: 'amber' },
  unreachable: { label: 'Unreachable', tone: 'red' },
  auth_failed: { label: 'Authentication Failed', tone: 'red' },
  not_testable: { label: 'Not Testable', tone: 'secondary' },
  blocked: { label: 'Blocked', tone: 'secondary' },
};

/** Minimal health surface needed for readiness (from a session result or the
 *  latest persisted state). Never implies inference/execution health. */
export interface ConfigHealthInput {
  status: string;
  authenticated: boolean | null;
  reachable: boolean;
}

/**
 * Deterministic readiness derivation. A system is Ready only when required
 * server-side config exists AND a safe health test has passed (and, where
 * relevant, authentication passed). Never marked Ready from registry status
 * alone.
 */
export function deriveReadiness(
  config: ConfigResult,
  health: ConfigHealthInput | null,
): ConfigReadinessState {
  if (!config.safeTestSupported) {
    return config.systemSlug === 'readdy' ? 'not_testable' : 'blocked';
  }
  if (!config.configured) return 'missing_config';
  if (!health) return 'configured_not_verified';
  if (health.authenticated === false) return 'auth_failed';
  if (health.status === 'healthy') return 'ready';
  if (health.status === 'degraded' || health.status === 'unavailable') return 'unreachable';
  return 'configured_not_verified';
}

// --- Authenticated invoke -----------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg =
      (err as { message?: string }).message ??
      (err as { error_description?: string }).error_description ??
      '';
    if (/not authorized|unauthorized|jwt|invalid.*token|403|401/i.test(msg)) {
      return 'You are not authorized to run configuration checks.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the configuration service. Please try again.';
    }
  }
  return 'Unable to complete the configuration check. Please try again.';
}

export async function runRuntimeConfigCheck(): Promise<{
  data: ConfigResult[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('runtime-config', {
      body: {},
    });
    if (error) {
      return { data: null, error: sanitiseError(error) };
    }
    if (!data || !Array.isArray((data as ConfigCheckResponse).config)) {
      return { data: null, error: 'The configuration service returned an unexpected response.' };
    }
    return { data: (data as ConfigCheckResponse).config, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}
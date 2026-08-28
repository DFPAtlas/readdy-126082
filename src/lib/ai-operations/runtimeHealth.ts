// ============================================================================
// AI Operations — Runtime connectivity & health (Phase 3 Prompt 01).
//
// Health / connectivity verification ONLY. All sensitive checks execute in the
// `runtime-health` Edge Function (server-side); the browser never holds provider
// secrets and can only request checks for a fixed allowlist of system slugs.
//
// This module provides the shared result contract, the authenticated invoke
// helper, and the pure mapping from live registry rows (ai_tool_connections +
// ai_model_providers) to the allowlisted system adapters.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type {
  AiToolConnectionRow,
  AiModelProviderRow,
} from '@/lib/ai-operations/types';

// --- Result contract ----------------------------------------------------------

export type RuntimeHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'not_configured'
  | 'not_testable'
  | 'unknown';

export interface RuntimeHealthResult {
  connectionKey: string;
  system: string;
  checkedAt: string;
  status: RuntimeHealthStatus;
  latencyMs: number | null;
  reachable: boolean;
  authenticated: boolean | null;
  configurationState: string;
  errorCategory: string | null;
  safeMessage: string;
  source: 'runtime' | 'registry';
}

export interface RuntimeHealthSweep {
  checkedAt: string;
  total: number;
  counts: Record<string, number>;
  summary: string;
}

export interface RuntimeHealthResponse {
  results: RuntimeHealthResult[];
  sweep: RuntimeHealthSweep;
}

export interface HealthTarget {
  system: string;
  connectionKey: string;
}

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg =
      (err as { message?: string }).message ??
      (err as { error_description?: string }).error_description ??
      '';
    if (/not authorized|unauthorized|jwt|invalid.*token|403|401/i.test(msg)) {
      return 'You are not authorized to run health checks.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the health service. Please try again.';
    }
  }
  return 'Unable to complete the health check. Please try again.';
}

// --- Authenticated invoke -----------------------------------------------------

export async function runRuntimeHealthCheck(
  targets: HealthTarget[],
): Promise<{ data: RuntimeHealthResponse | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('runtime-health', {
      body: { targets },
    });
    if (error) {
      return { data: null, error: sanitiseError(error) };
    }
    if (!data || !Array.isArray((data as RuntimeHealthResponse).results)) {
      return { data: null, error: 'The health service returned an unexpected response.' };
    }
    return { data: data as RuntimeHealthResponse, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Registry → system adapter mapping ---------------------------------------

// Tool connection category → allowlisted system slug. Categories without a safe
// server-side adapter are intentionally absent (reported as not testable).
const CONNECTION_CATEGORY_SYSTEM: Record<string, string> = {
  database: 'supabase',
  automation: 'n8n',
  email: 'resend',
  billing: 'stripe',
  repository: 'github',
  website_builder: 'readdy',
  monitoring: 'monitoring',
  notifications: 'notifications',
  site_api: 'site_api',
};

export function resolveConnectionSystem(connection: AiToolConnectionRow): string | null {
  return resolveCategorySystem(connection.category);
}

export function resolveCategorySystem(category: string | null | undefined): string | null {
  return CONNECTION_CATEGORY_SYSTEM[category ?? ''] ?? null;
}

export function resolveProviderSystem(provider: AiModelProviderRow): string | null {
  const type = (provider.provider_type ?? '').toLowerCase();
  const name = (provider.name ?? '').toLowerCase();
  if (type === 'local') return 'ollama';
  if (name.includes('openai')) return 'openai';
  if (name.includes('anthropic') || name.includes('claude')) return 'anthropic';
  return null;
}

// --- UI row model -------------------------------------------------------------

export interface RuntimeHealthRow {
  key: string;
  name: string;
  kind: 'connection' | 'provider';
  system: string | null;
  category: string;
  environment: string | null;
  registryStatus: string | null;
  registryHealth: string | null;
  configurationState: string | null;
  result: RuntimeHealthResult | null;
}

export function buildRuntimeHealthRows(
  connections: AiToolConnectionRow[],
  providers: AiModelProviderRow[],
  results: Record<string, RuntimeHealthResult>,
): RuntimeHealthRow[] {
  const connectionRows: RuntimeHealthRow[] = connections.map((c) => {
    const system = resolveConnectionSystem(c);
    return {
      key: c.connection_key,
      name: c.name,
      kind: 'connection',
      system,
      category: c.category ?? 'other',
      environment: c.environment ?? null,
      registryStatus: c.status ?? null,
      registryHealth: c.health ?? null,
      configurationState: c.configuration_state ?? null,
      result: results[c.connection_key] ?? null,
    };
  });

  const providerRows: RuntimeHealthRow[] = providers.map((p) => {
    const system = resolveProviderSystem(p);
    return {
      key: p.provider_key,
      name: p.name,
      kind: 'provider',
      system,
      category: p.provider_type ?? 'other',
      environment: p.environment ?? null,
      registryStatus: p.status ?? null,
      registryHealth: p.health ?? null,
      configurationState: null,
      result: results[p.provider_key] ?? null,
    };
  });

  // Connections first (grouped by testability), then providers.
  const testableFirst = (a: RuntimeHealthRow, b: RuntimeHealthRow): number => {
    const aRank = a.system ? 0 : 1;
    const bRank = b.system ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  };

  return [...connectionRows.sort(testableFirst), ...providerRows.sort(testableFirst)];
}

// --- Status presentation ------------------------------------------------------

export const HEALTH_STATUS_META: Record<
  RuntimeHealthStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  healthy: { label: 'Healthy', tone: 'emerald' },
  degraded: { label: 'Degraded', tone: 'amber' },
  unavailable: { label: 'Unavailable', tone: 'red' },
  not_configured: { label: 'Not Configured', tone: 'secondary' },
  not_testable: { label: 'Not Testable', tone: 'secondary' },
  unknown: { label: 'Unknown', tone: 'secondary' },
};
// ============================================================================
// AI Operations — Diagnostic Runtime Emergency Freeze client (Phase 3 Prompt 24C).
//
// The operator-facing client for the `diagnostic-runtime-emergency-freeze`
// control. The browser only ever reads status or invokes the three documented
// `runtime-bridge-control` operations — it NEVER supplies actor, role, control
// state, execution_allowed, affected message/run IDs, engaged_by or released_by.
// The server (verify_jwt=true + internal_role()) remains fully authoritative.
//
// This is governance ONLY. Nothing here executes an agent, n8n workflow, model
// or tool, and engaging/releasing the freeze never enables production.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Types ---------------------------------------------------------------------

/** Safe, server-derived freeze status (containment counts + latest affected keys). */
export interface DiagnosticRuntimeFreezeStatus {
  engaged: boolean;
  engagedAt: string | null;
  engagedBy: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  pendingMessagesInvalidated: number;
  inflightMessagesDetected: number;
  latestAffectedRunKey: string | null;
  latestAffectedCorrelationId: string | null;
  normalExecutionBlocked: boolean;
  masterKillSwitchOn: boolean;
  productionEnabled: boolean;
}

/** Result of engaging the freeze (owner/admin). */
export interface FreezeEngageResult {
  accepted: boolean;
  alreadyEngaged: boolean;
  engaged: boolean;
  engagedAt: string | null;
  engagedBy: string | null;
  pendingMessagesInvalidated: number;
  inflightMessagesDetected: number;
  latestAffectedRunKey: string | null;
  normalExecutionBlocked: boolean;
  masterKillSwitchOn: boolean;
  productionEnabled: boolean;
  message: string;
}

/** Result of releasing the freeze (owner only). */
export interface FreezeReleaseResult {
  accepted: boolean;
  alreadyReleased: boolean;
  engaged: boolean;
  releasedAt: string | null;
  releasedBy: string | null;
  normalExecutionBlocked: boolean;
  masterKillSwitchOn: boolean;
  productionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------
//
// Only safe, operator-facing messages are ever surfaced. Raw Edge Function
// error dumps are never shown.

function extractDetail(err: unknown): string {
  if (err && typeof err === 'object') {
    const ctx = (err as { context?: { error?: string; message?: string; detail?: string } }).context;
    const msg = (err as { message?: string }).message ?? '';
    return ctx?.error ?? ctx?.message ?? ctx?.detail ?? msg;
  }
  return '';
}

function sanitiseError(err: unknown): string {
  const detail = extractDetail(err);
  if (/owner role required to release/i.test(detail)) {
    return 'Only the owner may release the emergency runtime freeze.';
  }
  if (/owner or admin role required to engage/i.test(detail)) {
    return 'Only an owner or admin may engage the emergency runtime freeze.';
  }
  if (/runtime_emergency_freeze_engaged/i.test(detail)) {
    return 'Diagnostic runtime execution is currently frozen — new runtime dispatches are blocked.';
  }
  if (/unauthorized|401/i.test(detail)) {
    return 'You must be signed in to manage the emergency runtime freeze.';
  }
  if (/internal staff access required/i.test(detail)) {
    return 'Internal staff access is required to manage the emergency runtime freeze.';
  }
  if (/freeze_control_resolve_failed/i.test(detail)) {
    return 'The emergency freeze control could not be resolved.';
  }
  if (/network|fetch|failed to fetch/i.test(detail)) {
    return 'Unable to reach the emergency freeze control endpoint.';
  }
  return 'Unable to manage the emergency runtime freeze.';
}

// --- Normalisers ---------------------------------------------------------------

function mapStatus(raw: Record<string, unknown> | null | undefined): DiagnosticRuntimeFreezeStatus {
  return {
    engaged: raw?.engaged === true,
    engagedAt: (raw?.engagedAt as string) ?? null,
    engagedBy: (raw?.engagedBy as string) ?? null,
    releasedAt: (raw?.releasedAt as string) ?? null,
    releasedBy: (raw?.releasedBy as string) ?? null,
    pendingMessagesInvalidated:
      typeof raw?.pendingMessagesInvalidated === 'number' ? raw.pendingMessagesInvalidated : 0,
    inflightMessagesDetected:
      typeof raw?.inflightMessagesDetected === 'number' ? raw.inflightMessagesDetected : 0,
    latestAffectedRunKey: (raw?.latestAffectedRunKey as string) ?? null,
    latestAffectedCorrelationId: (raw?.latestAffectedCorrelationId as string) ?? null,
    normalExecutionBlocked: raw?.normalExecutionBlocked !== false,
    masterKillSwitchOn: raw?.masterKillSwitchOn !== false,
    productionEnabled: raw?.productionEnabled === true,
  };
}

// --- Data access ---------------------------------------------------------------

/** Read the current freeze status (any internal role, server-authoritative). */
export async function getDiagnosticRuntimeFreezeStatus(): Promise<AiOpsResult<DiagnosticRuntimeFreezeStatus>> {
  try {
    const { data, error } = await supabase.functions.invoke('runtime-bridge-control', {
      body: { operation: 'get_diagnostic_runtime_freeze_status' },
    });
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The emergency freeze status endpoint returned no result.' };
    if (data.error) return { data: null, error: sanitiseError(data.error) };
    return { data: mapStatus(data as Record<string, unknown>), error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Engage the freeze (owner/admin). Contains pending + in-flight sandbox work. */
export async function engageDiagnosticRuntimeFreeze(): Promise<AiOpsResult<FreezeEngageResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<FreezeEngageResult>(
      'runtime-bridge-control',
      { body: { operation: 'engage_diagnostic_runtime_freeze' } },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The emergency freeze engage endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Release the freeze (owner only). Never replays previously rejected work. */
export async function releaseDiagnosticRuntimeFreeze(): Promise<AiOpsResult<FreezeReleaseResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<FreezeReleaseResult>(
      'runtime-bridge-control',
      { body: { operation: 'release_diagnostic_runtime_freeze' } },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The emergency freeze release endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}
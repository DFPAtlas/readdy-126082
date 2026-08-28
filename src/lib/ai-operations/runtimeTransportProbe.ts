// ============================================================================
// AI Operations — Private runtime dry-run transport probe (Phase 3 Prompt 10).
//
// Verifies the complete cloud → HAL → cloud control-message transport path
// WITHOUT introducing any execution capability. The browser calls the
// authenticated `runtime-bridge-control` Edge Function (verify_jwt=true), which
// is the only place a probe can be queued. The probe itself is a non-executing
// `runtime_transport_probe` message; HAL replies with a signed
// `runtime_transport_probe_ack`. This proves transport only — it never executes
// n8n, performs Ollama inference, runs an agent, creates a run, or calls a tool.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Types ---------------------------------------------------------------------

export type TransportProbeStatus = 'pending' | 'delivered' | 'acknowledged' | 'expired' | 'rejected';

/** Result of queueing a dry-run transport probe. */
export interface TransportProbeQueued {
  accepted: boolean;
  probeKey: string;
  correlationId: string;
  nodeKey: string;
  nodeName: string | null;
  requestedAt: string;
  expiresAt: string;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single probe's resolved status. */
export interface TransportProbeStatusEntry {
  probeKey: string;
  messageKey: string;
  correlationId: string;
  nodeId: string | null;
  status: string;
  queuedAt: string;
  acknowledgedAt: string | null;
  expiresAt: string;
  expectedNodeKey: string;
  signedAck: boolean;
  ackStatus: string | null;
  ackSummary: string | null;
  roundTripMs: number | null;
}

/** Resolved transport-probe status payload. */
export interface TransportProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: TransportProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized|Unauthorized|401/i.test(detail)) return 'You must be signed in to run a transport probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may send a transport probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage transport probes.';
    if (/stale|heartbeat/i.test(detail)) return 'The bridge node heartbeat is stale — a transport probe cannot be sent right now.';
    if (/handshake/i.test(detail)) return 'The bridge node has not completed a verified handshake yet.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the transport probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the transport probe.';
}

// --- Data access ---------------------------------------------------------------

/** Queue a safe dry-run transport probe (owner/admin only, server-enforced). */
export async function queueTransportProbe(): Promise<AiOpsResult<TransportProbeQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<TransportProbeQueued>('runtime-bridge-control', {
      body: { operation: 'queue_transport_probe' },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The transport probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest transport probe status (any internal role). */
export async function getTransportProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<TransportProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_transport_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<TransportProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The transport probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const TRANSPORT_PROBE_STATUS_META: Record<
  TransportProbeStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  pending: { label: 'Pending', tone: 'secondary' },
  delivered: { label: 'Delivered', tone: 'amber' },
  acknowledged: { label: 'Acknowledged', tone: 'emerald' },
  expired: { label: 'Expired', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
};

/** Derive a display-friendly status from a probe's stored status string. */
export function deriveProbeStatus(status: string | null | undefined): TransportProbeStatus {
  if (status === 'acknowledged') return 'acknowledged';
  if (status === 'delivered') return 'delivered';
  if (status === 'expired') return 'expired';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

/** Human-friendly round-trip latency label (transport only, never "agent latency"). */
export function formatRoundTrip(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
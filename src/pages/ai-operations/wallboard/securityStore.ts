// ============================================================================
// AI Operations — Wallboard Security & Connectivity Data Store.
//
// Read-only monitoring over the security posture of the Digital Footprint group.
// This is a MONITORING-ONLY surface: no security controls, no credential
// exposure, no probing, and no remote actions.
//
// SOURCE AUDIT (Wallboard 27):
//   * Connections (ai_tool_connections), security policies (ai_security_policies)
//     and security alerts (ai_alerts / ai_incidents) are ALREADY loaded by the
//     shared group live-data store — this module does NOT re-fetch them.
//   * The only security source NOT in the shared snapshot is `support_sessions`
//     (privileged support/remote-access sessions), fetched here as an AGGREGATE
//     count by status only. No customer identity, session id, IP or token is
//     ever selected or displayed.
//   * There is NO Tailscale / VPN / OPNsense / firewall / certificate-expiry or
//     failed-login telemetry anywhere in the system — those are surfaced
//     honestly as "not monitored", never fabricated.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Aggregate session summary (privacy-safe counts only) ---------------------

export interface SupportSessionSummary {
  active: number;
  pending: number;
  expired: number;
  revoked: number;
}

export interface SecurityData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether support_sessions was readable (independent of group live data). */
  availability: boolean;
  sessions: SupportSessionSummary;
}

function emptySnapshot(): SecurityData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: false,
    sessions: { active: 0, pending: 0, expired: 0, revoked: 0 },
  };
}

// Map support_sessions.status → aggregate wallboard bucket. `other` (ended/
// failed/access_denied) is intentionally dropped — the wallboard only needs the
// operational aggregate (active / awaiting approval / expired / revoked).
function classify(status: string | null | undefined): keyof SupportSessionSummary | 'other' {
  switch (status) {
    case 'started':
    case 'opened':
    case 'approved':
      return 'active';
    case 'requested':
      return 'pending';
    case 'expired':
      return 'expired';
    case 'revoked':
      return 'revoked';
    default:
      return 'other';
  }
}

// --- External store (module-level) -------------------------------------------

let snapshot: SecurityData = emptySnapshot();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): SecurityData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current security snapshot. */
export function getSecurityData(): SecurityData {
  return snapshot;
}

/** Subscribe to the security snapshot (re-renders on refresh). */
export function useSecurityData(): SecurityData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch ONLY the status column (never customer/user ids, ips, tokens or session
// ids) and aggregate counts client-side. A single failed query must not affect
// the rest of the wallboard.
export async function refreshSecurityData(): Promise<void> {
  const res = await supabase.from('support_sessions').select('status');

  const sessions: SupportSessionSummary = { active: 0, pending: 0, expired: 0, revoked: 0 };
  if (!res.error) {
    for (const row of res.data ?? []) {
      const bucket = classify(row.status);
      if (bucket !== 'other') sessions[bucket] += 1;
    }
  }

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability: !res.error,
    sessions,
  };

  emit();
}
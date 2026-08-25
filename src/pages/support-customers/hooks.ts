import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  TicketAccount,
  CustomerSearchResult,
  Customer360,
  DiagnosticRunSummary,
  DiagnosticDetail,
  ScopeKey,
  SupportRepairAction,
  RepairsOverview,
  RecommendedRepair,
  SupportSession,
  SupportSessionView,
} from '@/types/support-customers';

const configured = Boolean(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
);

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

function readError(e: unknown): string {
  return e instanceof Error ? e.message : 'Request failed';
}

// ---------------------------------------------------------------------------
// Ticket ACCOUNT panel data (auto-resolves the customer on first read).
// ---------------------------------------------------------------------------
export function useTicketAccount(ticketId: string | undefined) {
  const [account, setAccount] = useState<TicketAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!ticketId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_ticket_account', {
        p_ticket_id: ticketId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setAccount(data as TicketAccount);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { account, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Customer search.
// ---------------------------------------------------------------------------
export function useCustomerSearch() {
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const requestIdRef = useRef(0);

  const search = useCallback(async (query: string) => {
    const q = query.trim();
    const id = ++requestIdRef.current;

    if (!q) {
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('support_search_customers_v2', {
        p_query: q,
        p_limit: 30,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setResults((data ?? []) as CustomerSearchResult[]);
      setSearched(true);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, []);

  return { results, loading, error, searched, search };
}

// ---------------------------------------------------------------------------
// Customer 360.
// ---------------------------------------------------------------------------
export function useCustomer360(customerId: string | undefined) {
  const [customer, setCustomer] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!customerId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_customer_360', {
        p_customer_id: customerId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setCustomer(data as Customer360);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { customer, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Action helpers (owner/admin only — enforced server-side).
// ---------------------------------------------------------------------------
export async function linkTicketCustomer(
  ticketId: string,
  customerUserId: string | null,
  organisationId: string | null,
  siteId: string | null,
): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_link_ticket_customer', {
    p_ticket_id: ticketId,
    p_customer_user_id: customerUserId,
    p_organisation_id: organisationId ?? null,
    p_site_id: siteId ?? null,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Customer linked', data };
}

export async function unlinkTicketCustomer(ticketId: string): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_unlink_ticket_customer', {
    p_ticket_id: ticketId,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Customer link removed', data };
}

export async function requestDiagnostic(
  customerId: string,
  siteId: string | null,
  userId: string | null,
  ticketId: string | null,
): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_request_diagnostic', {
    p_customer_id: customerId,
    p_site_id: siteId ?? null,
    p_user_id: userId ?? null,
    p_ticket_id: ticketId ?? null,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Diagnostics requested', data };
}

export async function refreshAccountData(ticketId: string): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_resolve_ticket_customer', {
    p_ticket_id: ticketId,
    p_action: 'manual_refresh',
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Account data refreshed', data };
}

// ---------------------------------------------------------------------------
// Automated Account Diagnostics (Prompt 11)
// ---------------------------------------------------------------------------

const DIAGNOSTIC_LIST_SELECT =
  'id,status,requested_by,started_at,completed_at,summary,error_message,diagnostic_scope,created_at';

export interface RunDiagnosticPayload {
  customer_id: string | null;
  organisation_id?: string | null;
  site_id?: string | null;
  user_id?: string | null;
  ticket_id?: string | null;
  scope: ScopeKey[];
}

/**
 * Lists diagnostic runs for a ticket or customer, with realtime refresh so
 * queued/running runs update the UI as n8n posts results back.
 */
export function useDiagnosticRuns(filter: { customerId?: string; ticketId?: string }) {
  const { customerId, ticketId } = filter;
  const [runs, setRuns] = useState<DiagnosticRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!customerId && !ticketId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('support_diagnostic_runs')
        .select(DIAGNOSTIC_LIST_SELECT)
        .order('created_at', { ascending: false })
        .limit(50);
      if (ticketId) query = query.eq('ticket_id', ticketId);
      if (customerId) query = query.eq('customer_id', customerId);
      const { data, error: qErr } = await query;
      if (id !== requestIdRef.current) return;
      if (qErr) throw qErr;
      setRuns((data ?? []) as DiagnosticRunSummary[]);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [customerId, ticketId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Realtime — subscribe to diagnostic runs for this ticket/customer.
  useEffect(() => {
    if (!configured) return;
    const filterStr = ticketId
      ? `ticket_id=eq.${ticketId}`
      : customerId
        ? `customer_id=eq.${customerId}`
        : null;
    if (!filterStr) return;

    const channel = supabase
      .channel(`support-diagnostic-runs-${ticketId ?? customerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_diagnostic_runs', filter: filterStr },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [customerId, ticketId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { runs, loading, error, refresh };
}

/**
 * Fetches a single diagnostic run's full result (logs a diagnostic_viewed event).
 * While the run is queued/running this keeps polling so the UI transitions to
 * the completed result (with result_data) as soon as n8n posts it back, without
 * requiring a manual page reload. Polling stops the moment the run is completed
 * or failed.
 */
export function useDiagnosticDetail(runId: string | null) {
  const [detail, setDetail] = useState<DiagnosticDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!runId) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }
    const id = ++requestIdRef.current;
    let cancelled = false;
    let pollTimer: number | null = null;

    const fetchDetail = async (initial: boolean) => {
      if (cancelled) return;
      if (initial) setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('support_get_diagnostic', {
          p_run_id: runId,
        });
        if (cancelled || id !== requestIdRef.current) return;
        if (rpcError) throw rpcError;
        const d = data as DiagnosticDetail;
        setDetail(d);
        // Keep polling only while the run is still in-flight.
        if (d.status === 'queued' || d.status === 'running') {
          pollTimer = window.setTimeout(() => {
            void fetchDetail(false);
          }, 3000);
        }
      } catch (e: unknown) {
        if (cancelled || id !== requestIdRef.current) return;
        setError(readError(e));
      } finally {
        if (!cancelled && id === requestIdRef.current) setLoading(false);
      }
    };

    void fetchDetail(true);

    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
    };
  }, [runId]);

  return { detail, loading, error };
}

/** Launches a diagnostic run via the server-side n8n dispatch endpoint. */
export async function runDiagnostic(payload: RunDiagnosticPayload): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('support-diagnostics-run', {
      body: payload,
    });
    if (error) {
      return { success: false, message: error.message || 'Diagnostic request failed.' };
    }
    const d = (data ?? {}) as { status?: string; message?: string };
    if (d.status === 'not_configured') {
      return { success: false, message: d.message || 'n8n support diagnostics are not configured.' };
    }
    if (d.status === 'failed') {
      return { success: false, message: d.message || 'Diagnostics failed to start.' };
    }
    return { success: true, message: d.message || 'Diagnostics started.', data };
  } catch (e: unknown) {
    return { success: false, message: readError(e) };
  }
}

/** Checks whether the n8n diagnostic integration is configured (no secrets exposed). */
export async function getDiagnosticConfigStatus(): Promise<{
  configured: boolean;
  reachable: boolean;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('support-diagnostics-run', {
      body: { action: 'status' },
    });
    if (error) {
      return { configured: false, reachable: false };
    }
    const d = (data ?? {}) as { configured?: boolean };
    return { configured: Boolean(d.configured), reachable: true };
  } catch {
    return { configured: false, reachable: false };
  }
}

// ============================================================================
// Human-Approved Account Repair Actions (Prompt 12)
// ============================================================================

function mapRepair(raw: Record<string, unknown>): SupportRepairAction {
  return {
    id: raw.id as string,
    ticket_id: (raw.ticket_id as string | null) ?? null,
    customer_id: (raw.customer_id as string | null) ?? null,
    customer_name: (raw.customer_name as string | null) ?? null,
    customer_email: (raw.customer_email as string | null) ?? null,
    site_id: (raw.site_id as string | null) ?? null,
    site_name: (raw.site_name as string | null) ?? null,
    user_id: (raw.user_id as string | null) ?? null,
    diagnostic_run_id: (raw.diagnostic_run_id as string | null) ?? null,
    action_type: raw.action_type as string,
    risk_level: raw.risk_level as SupportRepairAction['risk_level'],
    status: raw.status as SupportRepairAction['status'],
    reason: (raw.reason as string | null) ?? null,
    problem_detected: (raw.problem_detected as string | null) ?? null,
    requested_change: (raw.requested_change as string | null) ?? null,
    current_value: (raw.current_value as string | null) ?? null,
    proposed_value: (raw.proposed_value as string | null) ?? null,
    security_related: raw.security_related === true,
    requested_by: (raw.requested_by as string | null) ?? null,
    requested_by_name: (raw.requested_by_name as string | null) ?? null,
    approved_by: (raw.approved_by as string | null) ?? null,
    approved_by_name: (raw.approved_by_name as string | null) ?? null,
    rejected_by: (raw.rejected_by as string | null) ?? null,
    rejection_reason: (raw.rejection_reason as string | null) ?? null,
    created_at: raw.created_at as string,
    approved_at: (raw.approved_at as string | null) ?? null,
    executed_at: (raw.executed_at as string | null) ?? null,
    completed_at: (raw.completed_at as string | null) ?? null,
    failed_at: (raw.failed_at as string | null) ?? null,
    previous_state: (raw.previous_state as string | null) ?? null,
    new_state: (raw.new_state as string | null) ?? null,
    verification: (raw.verification as SupportRepairAction['verification']) ?? null,
    result_summary: (raw.result_summary as string | null) ?? null,
    error_message: (raw.error_message as string | null) ?? null,
  };
}

/** Lists repairs for a ticket, with realtime refresh as n8n posts results back. */
export function useTicketRepairs(ticketId: string | undefined) {
  const [repairs, setRepairs] = useState<SupportRepairAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!ticketId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_ticket_repairs', {
        p_ticket_id: ticketId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      setRepairs(rows.map(mapRepair));
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!configured || !ticketId) return;
    const channel = supabase
      .channel(`support-repairs-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_repair_actions', filter: `ticket_id=eq.${ticketId}` },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [ticketId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { repairs, loading, error, refresh };
}

/** Lists repairs for a customer (Customer 360). */
export function useCustomerRepairs(customerId: string | undefined) {
  const [repairs, setRepairs] = useState<SupportRepairAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!customerId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_customer_repairs', {
        p_customer_id: customerId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      setRepairs(rows.map(mapRepair));
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!configured || !customerId) return;
    const channel = supabase
      .channel(`support-customer-repairs-${customerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_repair_actions', filter: `customer_id=eq.${customerId}` },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [customerId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { repairs, loading, error, refresh };
}

/** Repair queue + dashboard indicators for managers. */
export function useRepairsOverview() {
  const [overview, setOverview] = useState<RepairsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_repairs_overview');
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      const d = (data ?? {}) as {
        metrics?: Record<string, number>;
        pending_approval?: Record<string, unknown>[];
        executing?: Record<string, unknown>[];
        failed?: Record<string, unknown>[];
        recently_completed?: Record<string, unknown>[];
      };
      setOverview({
        metrics: {
          awaiting_approval: d.metrics?.awaiting_approval ?? 0,
          executing: d.metrics?.executing ?? 0,
          failed: d.metrics?.failed ?? 0,
          completed_today: d.metrics?.completed_today ?? 0,
          medium_pending: d.metrics?.medium_pending ?? 0,
        },
        pending_approval: (d.pending_approval ?? []).map(mapRepair),
        executing: (d.executing ?? []).map(mapRepair),
        failed: (d.failed ?? []).map(mapRepair),
        recently_completed: (d.recently_completed ?? []).map(mapRepair),
      });
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!configured) return;
    const channel = supabase
      .channel('support-repairs-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_repair_actions' }, () =>
        setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { overview, loading, error, refresh };
}

export interface RequestRepairPayload {
  ticketId: string | null;
  customerId: string | null;
  siteId: string | null;
  userId: string | null;
  diagnosticRunId: string | null;
  recommendation?: RecommendedRepair | null;
}

export async function requestRepair(payload: RequestRepairPayload): Promise<ActionResult> {
  const rec = payload.recommendation ?? null;
  const { data, error } = await supabase.rpc('support_request_repair', {
    p_ticket_id: payload.ticketId ?? null,
    p_customer_id: payload.customerId ?? null,
    p_site_id: payload.siteId ?? null,
    p_user_id: payload.userId ?? null,
    p_diagnostic_run_id: payload.diagnosticRunId ?? null,
    p_action_type: rec?.action_type ?? null,
    p_problem_detected: rec?.problem_detected ?? null,
    p_reason: rec?.reason ?? null,
    p_requested_change: rec?.requested_change ?? null,
    p_current_value: rec?.current_value ?? null,
    p_proposed_value: rec?.proposed_value ?? null,
    p_recommended_by: null,
    p_security_related: rec?.security_related ?? false,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Repair requested for approval', data };
}

/** Approve + execute a repair via the server-side n8n dispatch (owner/admin). */
export async function approveAndExecuteRepair(repairId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('support-repair-run', {
      body: { repair_action_id: repairId },
    });
    if (error) {
      return { success: false, message: error.message || 'Repair execution failed.' };
    }
    const d = (data ?? {}) as { status?: string; message?: string };
    if (d.status === 'blocked') {
      return { success: false, message: d.message || 'This repair cannot be executed.' };
    }
    return { success: true, message: d.message || 'Repair approved.', data };
  } catch (e: unknown) {
    return { success: false, message: readError(e) };
  }
}

export async function rejectRepair(repairId: string, reason: string): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_reject_repair', {
    p_repair_id: repairId,
    p_reason: reason,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Repair rejected', data };
}

export async function cancelRepair(repairId: string): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_cancel_repair', {
    p_repair_id: repairId,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Repair cancelled', data };
}

/** Checks whether the n8n repair integration is configured (no secrets exposed). */
export async function getRepairConfigStatus(): Promise<{
  configured: boolean;
  reachable: boolean;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('support-repair-run', {
      body: { action: 'status' },
    });
    if (error) return { configured: false, reachable: false };
    const d = (data ?? {}) as { configured?: boolean };
    return { configured: Boolean(d.configured), reachable: true };
  } catch {
    return { configured: false, reachable: false };
  }
}

// ============================================================================
// Secure Temporary Support Session (Prompt 13)
// ============================================================================

function mapSession(raw: Record<string, unknown>): SupportSession {
  return {
    id: raw.id as string,
    customer_id: (raw.customer_id as string | null) ?? null,
    customer_name: (raw.customer_name as string | null) ?? null,
    customer_email: (raw.customer_email as string | null) ?? null,
    user_id: (raw.user_id as string | null) ?? null,
    site_id: (raw.site_id as string | null) ?? null,
    site_name: (raw.site_name as string | null) ?? null,
    ticket_id: (raw.ticket_id as string | null) ?? null,
    ticket_number: (raw.ticket_number as string | null) ?? null,
    requested_by: raw.requested_by as string,
    requested_by_name: (raw.requested_by_name as string | null) ?? null,
    approved_by: (raw.approved_by as string | null) ?? null,
    approved_by_name: (raw.approved_by_name as string | null) ?? null,
    session_type: (raw.session_type as SupportSession['session_type']) ?? 'read_only',
    status: raw.status as SupportSession['status'],
    reason: (raw.reason as string | null) ?? null,
    created_at: raw.created_at as string,
    approved_at: (raw.approved_at as string | null) ?? null,
    started_at: (raw.started_at as string | null) ?? null,
    expires_at: (raw.expires_at as string | null) ?? null,
    ended_at: (raw.ended_at as string | null) ?? null,
    ended_by: (raw.ended_by as string | null) ?? null,
    ended_by_name: (raw.ended_by_name as string | null) ?? null,
    revoked_by: (raw.revoked_by as string | null) ?? null,
    revoked_by_name: (raw.revoked_by_name as string | null) ?? null,
    revocation_reason: (raw.revocation_reason as string | null) ?? null,
    access_scope: Array.isArray(raw.access_scope) ? (raw.access_scope as string[]) : null,
    duration_minutes: (raw.duration_minutes as number) ?? 30,
  };
}

/** Lists support sessions for a ticket, with realtime refresh. */
export function useTicketSessions(ticketId: string | undefined) {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!ticketId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_ticket_sessions', {
        p_ticket_id: ticketId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      setSessions(rows.map(mapSession));
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!configured || !ticketId) return;
    const channel = supabase
      .channel(`support-sessions-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_sessions', filter: `ticket_id=eq.${ticketId}` },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [ticketId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { sessions, loading, error, refresh };
}

/** Lists support sessions for a customer (Customer 360). */
export function useCustomerSessions(customerId: string | undefined) {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!customerId) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_customer_sessions', {
        p_customer_id: customerId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      setSessions(rows.map(mapSession));
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!configured || !customerId) return;
    const channel = supabase
      .channel(`support-customer-sessions-${customerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_sessions', filter: `customer_id=eq.${customerId}` },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [customerId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { sessions, loading, error, refresh };
}

export interface CreateSessionPayload {
  customerId: string;
  userId?: string | null;
  siteId?: string | null;
  ticketId?: string | null;
  reason: string;
  durationMinutes: number;
  accessScope: string[];
}

export interface CreateSessionResult extends ActionResult {
  session?: SupportSession;
  code?: string;
}

/** Creates + starts a read-only support session (server-side validated). */
export async function createSupportSession(payload: CreateSessionPayload): Promise<CreateSessionResult> {
  const { data, error } = await supabase.rpc('support_create_session', {
    p_customer_id: payload.customerId,
    p_user_id: payload.userId ?? null,
    p_site_id: payload.siteId ?? null,
    p_ticket_id: payload.ticketId ?? null,
    p_reason: payload.reason,
    p_duration_minutes: payload.durationMinutes,
    p_access_scope: payload.accessScope,
  });
  if (error) return { success: false, message: readError(error) };

  const d = (data ?? {}) as { ok?: boolean; code?: string; message?: string; session?: Record<string, unknown> };
  if (d.ok === false) {
    return { success: false, message: d.message ?? 'Support session could not be started.', code: d.code };
  }
  const session = d.session ? mapSession(d.session) : undefined;
  return { success: true, message: 'Support session started.', session };
}

/** Ends an active support session. */
export async function endSupportSession(sessionId: string): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_end_session', { p_session_id: sessionId });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Support session ended', data };
}

/** Revokes another staff member's active support session (requires reason). */
export async function revokeSupportSession(sessionId: string, reason: string): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('support_revoke_session', {
    p_session_id: sessionId,
    p_reason: reason,
  });
  if (error) return { success: false, message: readError(error) };
  return { success: true, message: 'Support session revoked', data };
}

/**
 * Loads the read-only View-as-Customer projection for an active session.
 * Enforces expiry/active/ownership server-side. Refetches on a timer so an
 * expired session stops returning data on the next protected request.
 */
export function useSupportSessionView(sessionId: string | undefined) {
  const [view, setView] = useState<SupportSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const id = ++requestIdRef.current;
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_get_session_view', {
        p_session_id: sessionId,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setView(data as SupportSessionView);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(readError(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, reloadKey]);

  // Periodic revalidation so expiry / revocation is enforced without relying
  // solely on the frontend countdown.
  useEffect(() => {
    if (!sessionId) return;
    const t = window.setInterval(() => setReloadKey((k) => k + 1), 30_000);
    return () => window.clearInterval(t);
  }, [sessionId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { view, loading, error, refresh };
}

/** Logs which section staff viewed inside a support session (audit only). */
export async function logSessionSectionView(sessionId: string, section: string): Promise<void> {
  try {
    await supabase.rpc('support_log_session_view', { p_session_id: sessionId, p_section: section });
  } catch {
    // Audit logging must never break the support view.
  }
}
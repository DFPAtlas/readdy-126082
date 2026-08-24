-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 11 — AUTOMATED ACCOUNT DIAGNOSTICS + n8n
-- ============================================================================
-- Extends the Prompt 10 diagnostic foundation with the read-only n8n
-- diagnostic workflow. No existing ticket/auth/RLS/audit behaviour is changed.
--
-- Database changes:
--   1. support_diagnostic_runs.diagnostic_scope  — the scope requested by staff.
--   2. support_get_ticket_diagnostics(ticket_id) — list runs linked to a ticket.
--   3. support_get_diagnostic(run_id)            — full run + result for staff.
--
-- The server-side n8n dispatch and the n8n result callback are implemented as
-- two Edge Functions (support-diagnostics-run, support-diagnostics-result) and
-- are NOT part of this migration. They read N8N_SUPPORT_DIAGNOSTIC_URL and
-- N8N_SUPPORT_SHARED_SECRET from Supabase Secrets — never from the client.
-- ============================================================================

ALTER TABLE public.support_diagnostic_runs
  ADD COLUMN IF NOT EXISTS diagnostic_scope text;

-- ---------------------------------------------------------------------------
-- List diagnostic runs linked to a support ticket.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_ticket_diagnostics(p_ticket_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := public.internal_role();
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', d.id,
             'status', d.status,
             'requested_by', d.requested_by,
             'started_at', d.started_at,
             'completed_at', d.completed_at,
             'summary', d.summary,
             'error_message', d.error_message,
             'diagnostic_scope', d.diagnostic_scope,
             'created_at', d.created_at
           ) ORDER BY d.created_at DESC)
      FROM public.support_diagnostic_runs d
     WHERE d.ticket_id = p_ticket_id
  ), '[]'::jsonb);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Fetch a single diagnostic run (with structured result) for staff viewing.
-- Logs a diagnostic_viewed audit event. Never returns secrets or tokens.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_diagnostic(p_run_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := public.internal_role();
  v_run  public.support_diagnostic_runs%ROWTYPE;
  v_customer_name text;
  v_site_name text;
  v_requested_by_name text;
  v_duration_ms bigint;
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_run FROM public.support_diagnostic_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'RUN_NOT_FOUND';
  END IF;

  SELECT s.site_name INTO v_site_name
    FROM public.internal_support_sites s WHERE s.id = v_run.site_id;

  SELECT coalesce(p.full_name, p.display_name, p.email) INTO v_customer_name
    FROM public.profiles p WHERE p.id = v_run.customer_id;

  SELECT coalesce(p.full_name, p.email) INTO v_requested_by_name
    FROM public.profiles p WHERE p.id = v_run.requested_by;

  IF v_run.started_at IS NOT NULL AND v_run.completed_at IS NOT NULL THEN
    v_duration_ms := greatest(
      (extract(epoch FROM (v_run.completed_at - v_run.started_at)) * 1000)::bigint, 0
    );
  END IF;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_run.customer_id, v_run.ticket_id, v_run.site_id,
     'diagnostic_viewed', jsonb_build_object('run_id', p_run_id));

  RETURN jsonb_build_object(
    'id', v_run.id,
    'status', v_run.status,
    'customer_id', v_run.customer_id,
    'customer_name', v_customer_name,
    'site_id', v_run.site_id,
    'site_name', v_site_name,
    'user_id', v_run.user_id,
    'ticket_id', v_run.ticket_id,
    'requested_by', v_run.requested_by,
    'requested_by_name', v_requested_by_name,
    'diagnostic_scope', v_run.diagnostic_scope,
    'started_at', v_run.started_at,
    'completed_at', v_run.completed_at,
    'duration_ms', v_duration_ms,
    'summary', v_run.summary,
    'error_message', v_run.error_message,
    'result_data', v_run.result_data,
    'created_at', v_run.created_at
  );
END;
$function$;
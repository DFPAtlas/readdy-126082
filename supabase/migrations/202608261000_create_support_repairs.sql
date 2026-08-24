-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 12 — HUMAN-APPROVED ACCOUNT REPAIR ACTIONS
-- ============================================================================
-- Extends the Prompt 10/11 support platform with secure, human-approved repair
-- actions. No existing ticket/auth/RLS/audit/diagnostic behaviour is weakened.
--
-- Principle: DIAGNOSE -> RECOMMEND -> HUMAN APPROVAL -> SECURE EXECUTION ->
--            VERIFY -> AUDIT
--
-- Repair actions are read-only-ish controlled changes. HIGH/CRITICAL action
-- types are recognised but are NEVER executable through this workflow — the
-- request RPC rejects them ("Manual administrative process required").
--
-- Execution is performed server-side by two Edge Functions
-- (support-repair-run, support-repair-result) which read
-- N8N_SUPPORT_REPAIR_URL / N8N_SUPPORT_SHARED_SECRET from Supabase Secrets.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SUPPORT REPAIR ACTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_repair_actions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id          uuid,
  customer_id        uuid,
  site_id            uuid,
  user_id            uuid,
  diagnostic_run_id  uuid,
  action_type        text NOT NULL,
  risk_level         text NOT NULL,
  status             text NOT NULL DEFAULT 'draft',
  reason             text,
  problem_detected   text,
  requested_change   text,
  current_value      text,
  proposed_value     text,
  security_related   boolean NOT NULL DEFAULT false,
  recommended_by     uuid,
  requested_by       uuid NOT NULL,
  approved_by        uuid,
  rejected_by        uuid,
  rejection_reason   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  approved_at        timestamptz,
  executed_at        timestamptz,
  completed_at       timestamptz,
  failed_at          timestamptz,
  request_payload    jsonb,
  previous_state     text,
  new_state          text,
  verification       jsonb,
  result_summary     text,
  error_message      text,
  retry_of           uuid,
  CONSTRAINT support_repair_actions_status_check
    CHECK (status IN ('draft','pending_approval','approved','executing','completed','failed','rejected','cancelled')),
  CONSTRAINT support_repair_actions_risk_check
    CHECK (risk_level IN ('low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS support_repair_actions_customer_idx
  ON public.support_repair_actions (customer_id);
CREATE INDEX IF NOT EXISTS support_repair_actions_ticket_idx
  ON public.support_repair_actions (ticket_id);
CREATE INDEX IF NOT EXISTS support_repair_actions_status_idx
  ON public.support_repair_actions (status);
CREATE INDEX IF NOT EXISTS support_repair_actions_created_idx
  ON public.support_repair_actions (created_at DESC);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_repair_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_repair_actions_select
  ON public.support_repair_actions FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_repair_actions_insert
  ON public.support_repair_actions FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_repair_actions_update
  ON public.support_repair_actions FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_repair_actions_delete
  ON public.support_repair_actions FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner','admin'));

-- ---------------------------------------------------------------------------
-- Shared JSON serialiser (resolves names server-side, never secrets).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_repair_to_jsonb(p_id uuid)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', r.id,
    'ticket_id', r.ticket_id,
    'customer_id', r.customer_id,
    'customer_name', (SELECT coalesce(p.full_name, p.display_name, p.email)
                      FROM public.profiles p WHERE p.id = r.customer_id),
    'customer_email', (SELECT p.email FROM public.profiles p WHERE p.id = r.customer_id),
    'site_id', r.site_id,
    'site_name', (SELECT s.site_name FROM public.internal_support_sites s WHERE s.id = r.site_id),
    'user_id', r.user_id,
    'diagnostic_run_id', r.diagnostic_run_id,
    'action_type', r.action_type,
    'risk_level', r.risk_level,
    'status', r.status,
    'reason', r.reason,
    'problem_detected', r.problem_detected,
    'requested_change', r.requested_change,
    'current_value', r.current_value,
    'proposed_value', r.proposed_value,
    'security_related', r.security_related,
    'requested_by', r.requested_by,
    'requested_by_name', (SELECT coalesce(p.full_name, p.email)
                          FROM public.profiles p WHERE p.id = r.requested_by),
    'approved_by', r.approved_by,
    'approved_by_name', (SELECT coalesce(p.full_name, p.email)
                         FROM public.profiles p WHERE p.id = r.approved_by),
    'rejected_by', r.rejected_by,
    'rejection_reason', r.rejection_reason,
    'created_at', r.created_at,
    'approved_at', r.approved_at,
    'executed_at', r.executed_at,
    'completed_at', r.completed_at,
    'failed_at', r.failed_at,
    'previous_state', r.previous_state,
    'new_state', r.new_state,
    'verification', r.verification,
    'result_summary', r.result_summary,
    'error_message', r.error_message
  )
  FROM public.support_repair_actions r
  WHERE r.id = p_id;
$function$;

-- ---------------------------------------------------------------------------
-- Fetch a single repair action (full record) for staff.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_repair(p_repair_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.internal_role() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_repair_actions WHERE id = p_repair_id) THEN
    RAISE EXCEPTION 'REPAIR_NOT_FOUND';
  END IF;
  RETURN public.support_repair_to_jsonb(p_repair_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Request a repair (creates a pending_approval record). Only LOW / MEDIUM
-- action types are accepted — HIGH / CRITICAL are rejected server-side.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_request_repair(
  p_ticket_id uuid,
  p_customer_id uuid,
  p_site_id uuid,
  p_user_id uuid,
  p_diagnostic_run_id uuid,
  p_action_type text,
  p_problem_detected text,
  p_reason text,
  p_requested_change text,
  p_current_value text,
  p_proposed_value text,
  p_recommended_by uuid,
  p_security_related boolean
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := public.internal_role();
  v_risk text;
  v_id   uuid;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  CASE p_action_type
    WHEN 'resend_verification_email'      THEN v_risk := 'low';
    WHEN 'resend_password_reset_email'    THEN v_risk := 'low';
    WHEN 'retry_failed_email'             THEN v_risk := 'low';
    WHEN 'refresh_account_sync'           THEN v_risk := 'low';
    WHEN 'retry_failed_webhook'           THEN v_risk := 'low';
    WHEN 'rebuild_customer_mapping'       THEN v_risk := 'low';
    WHEN 'clear_safe_application_cache'   THEN v_risk := 'low';
    WHEN 'unlock_login'                   THEN v_risk := 'medium';
    WHEN 'reactivate_account'             THEN v_risk := 'medium';
    WHEN 'refresh_permissions'            THEN v_risk := 'medium';
    WHEN 'refresh_subscription_status'    THEN v_risk := 'medium';
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_ACTION';
  END CASE;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'CUSTOMER_REQUIRED';
  END IF;

  INSERT INTO public.support_repair_actions
    (ticket_id, customer_id, site_id, user_id, diagnostic_run_id,
     action_type, risk_level, status, reason, problem_detected,
     requested_change, current_value, proposed_value, security_related,
     recommended_by, requested_by)
  VALUES
    (p_ticket_id, p_customer_id, p_site_id, p_user_id, p_diagnostic_run_id,
     p_action_type, v_risk, 'pending_approval', p_reason, p_problem_detected,
     p_requested_change, p_current_value, p_proposed_value,
     COALESCE(p_security_related, false), p_recommended_by, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), p_customer_id, p_ticket_id, p_site_id, 'repair_requested',
     jsonb_build_object('repair_id', v_id, 'action_type', p_action_type, 'risk_level', v_risk));

  RETURN public.support_repair_to_jsonb(v_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- List repairs linked to a support ticket.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_ticket_repairs(p_ticket_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.internal_role() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.created_at DESC)
      FROM public.support_repair_actions r
     WHERE r.ticket_id = p_ticket_id
  ), '[]'::jsonb);
END;
$function$;

-- ---------------------------------------------------------------------------
-- List repairs linked to a customer (Customer 360).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_customer_repairs(p_customer_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.internal_role() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.created_at DESC)
      FROM public.support_repair_actions r
     WHERE r.customer_id = p_customer_id
  ), '[]'::jsonb);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Reject a pending repair (requires reason). A rejected action never executes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_reject_repair(p_repair_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role   text := public.internal_role();
  v_repair public.support_repair_actions%ROWTYPE;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_repair FROM public.support_repair_actions WHERE id = p_repair_id;
  IF v_repair.id IS NULL THEN
    RAISE EXCEPTION 'REPAIR_NOT_FOUND';
  END IF;
  IF v_repair.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'INVALID_STATE';
  END IF;

  UPDATE public.support_repair_actions
     SET status = 'rejected', rejected_by = auth.uid(),
         rejected_at = now(), rejection_reason = p_reason
   WHERE id = p_repair_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_repair.customer_id, v_repair.ticket_id, v_repair.site_id,
     'repair_rejected', jsonb_build_object('repair_id', p_repair_id, 'reason', p_reason));

  RETURN public.support_repair_to_jsonb(p_repair_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Cancel a draft / pending repair.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_cancel_repair(p_repair_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role   text := public.internal_role();
  v_repair public.support_repair_actions%ROWTYPE;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_repair FROM public.support_repair_actions WHERE id = p_repair_id;
  IF v_repair.id IS NULL THEN
    RAISE EXCEPTION 'REPAIR_NOT_FOUND';
  END IF;
  IF v_repair.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'INVALID_STATE';
  END IF;

  UPDATE public.support_repair_actions SET status = 'cancelled' WHERE id = p_repair_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_repair.customer_id, v_repair.ticket_id, v_repair.site_id,
     'repair_cancelled', jsonb_build_object('repair_id', p_repair_id));

  RETURN public.support_repair_to_jsonb(p_repair_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Repair queue + dashboard indicators for managers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_repairs_overview()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pending   jsonb;
  v_executing jsonb;
  v_failed    jsonb;
  v_recent    jsonb;
  v_metrics   jsonb;
BEGIN
  IF public.internal_role() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_pending := COALESCE((
    SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.created_at ASC)
      FROM public.support_repair_actions r WHERE r.status = 'pending_approval' LIMIT 100
  ), '[]'::jsonb);

  v_executing := COALESCE((
    SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.executed_at ASC)
      FROM public.support_repair_actions r WHERE r.status = 'executing' LIMIT 100
  ), '[]'::jsonb);

  v_failed := COALESCE((
    SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.failed_at DESC NULLS LAST)
      FROM public.support_repair_actions r WHERE r.status = 'failed' LIMIT 100
  ), '[]'::jsonb);

  v_recent := COALESCE((
    SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.completed_at DESC)
      FROM public.support_repair_actions r
     WHERE r.status = 'completed' AND r.completed_at >= (now() - interval '7 days') LIMIT 100
  ), '[]'::jsonb);

  v_metrics := jsonb_build_object(
    'awaiting_approval', (SELECT count(*) FROM public.support_repair_actions WHERE status = 'pending_approval'),
    'executing',         (SELECT count(*) FROM public.support_repair_actions WHERE status = 'executing'),
    'failed',            (SELECT count(*) FROM public.support_repair_actions WHERE status = 'failed'),
    'completed_today',   (SELECT count(*) FROM public.support_repair_actions
                          WHERE status = 'completed' AND completed_at >= date_trunc('day', now())),
    'medium_pending',    (SELECT count(*) FROM public.support_repair_actions
                          WHERE status = 'pending_approval' AND risk_level = 'medium')
  );

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'pending_approval', v_pending,
    'executing', v_executing,
    'failed', v_failed,
    'recently_completed', v_recent
  );
END;
$function$;
-- ============================================================================
-- DFP COMMAND — PROMPT 14 — Staff Roles + Approval Matrix
--
-- Adds operational support roles (owner / admin / support_manager /
-- support_agent / developer / viewer), a central server-side permission
-- helper, a staff↔site access mapping, and server-enforced staff management
-- RPCs. Disabled staff lose all access (internal_role() returns NULL).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Staff account status (active / disabled)
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_user_roles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Staff ↔ site access mapping (ROLE + SITE ACCESS = EFFECTIVE ACCESS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_staff_site_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  site_id    uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_site_access_user
  ON public.internal_staff_site_access(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_site_access_site
  ON public.internal_staff_site_access(site_id);

-- ---------------------------------------------------------------------------
-- 3. internal_role() now only returns a role for ACTIVE staff.
--    Disabled staff => NULL => every "role IS NULL" gate blocks them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT role FROM public.internal_user_roles
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION app_private.internal_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT role FROM public.internal_user_roles
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Central permission helper: internal_has_permission(permission)
--    Replaces scattered "role IN ('owner','admin')" checks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_has_permission(perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_user_roles r
    WHERE r.user_id = auth.uid()
      AND r.status = 'active'
      AND (
        r.role = 'owner'
        OR perm = ANY (
          CASE r.role
            WHEN 'admin' THEN ARRAY[
              'support.tickets.view','support.tickets.reply','support.tickets.assign',
              'support.tickets.priority','support.tickets.escalate',
              'support.customers.view','support.customers.search',
              'support.diagnostics.view','support.diagnostics.run','support.diagnostics.retry',
              'support.repairs.view','support.repairs.request','support.repairs.approve.low',
              'support.repairs.approve.medium','support.repairs.reject','support.repairs.cancel',
              'support.repairs.execute',
              'support.sessions.view','support.sessions.start','support.sessions.end','support.sessions.revoke',
              'support.audit.view',
              'support.integrations.view','support.integrations.manage',
              'support.metrics.view',
              'staff.view','staff.manage','staff.roles.manage'
            ]::text[]
            WHEN 'support_manager' THEN ARRAY[
              'support.tickets.view','support.tickets.reply','support.tickets.assign',
              'support.tickets.priority','support.tickets.escalate',
              'support.customers.view','support.customers.search',
              'support.diagnostics.view','support.diagnostics.run','support.diagnostics.retry',
              'support.repairs.view','support.repairs.request','support.repairs.approve.low',
              'support.repairs.approve.medium','support.repairs.reject','support.repairs.cancel',
              'support.repairs.execute',
              'support.sessions.view','support.sessions.start','support.sessions.end','support.sessions.revoke',
              'support.audit.view',
              'support.metrics.view'
            ]::text[]
            WHEN 'support_agent' THEN ARRAY[
              'support.tickets.view','support.tickets.reply','support.tickets.escalate',
              'support.customers.view','support.customers.search',
              'support.diagnostics.view','support.diagnostics.run',
              'support.repairs.view','support.repairs.request',
              'support.sessions.view','support.sessions.start','support.sessions.end',
              'support.metrics.view'
            ]::text[]
            WHEN 'developer' THEN ARRAY[
              'support.tickets.view','support.tickets.reply',
              'support.customers.view',
              'support.diagnostics.view','support.diagnostics.run',
              'support.repairs.view','support.repairs.request'
            ]::text[]
            WHEN 'viewer' THEN ARRAY[
              'support.tickets.view','support.customers.view','support.customers.search',
              'support.diagnostics.view','support.repairs.view','support.sessions.view',
              'support.metrics.view'
            ]::text[]
            ELSE ARRAY[]::text[]
          END
        )
      )
  );
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Site access helper — owner/admin/support_manager are unrestricted;
--    other roles must hold an explicit site assignment.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_has_site_access(p_site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_user_roles r
    WHERE r.user_id = auth.uid() AND r.status = 'active'
      AND (
        r.role IN ('owner','admin','support_manager')
        OR EXISTS (
          SELECT 1 FROM public.internal_staff_site_access a
          WHERE a.user_id = r.user_id AND a.site_id = p_site_id
        )
      )
  );
$fn$;

-- ---------------------------------------------------------------------------
-- 5b. RLS on staff↔site access (requires internal_has_permission above).
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_staff_site_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_site_access_select ON public.internal_staff_site_access;
CREATE POLICY staff_site_access_select ON public.internal_staff_site_access
  FOR SELECT USING (public.internal_has_permission('staff.view'));

DROP POLICY IF EXISTS staff_site_access_insert ON public.internal_staff_site_access;
CREATE POLICY staff_site_access_insert ON public.internal_staff_site_access
  FOR INSERT WITH CHECK (public.internal_has_permission('staff.manage'));

DROP POLICY IF EXISTS staff_site_access_update ON public.internal_staff_site_access;
CREATE POLICY staff_site_access_update ON public.internal_staff_site_access
  FOR UPDATE USING (public.internal_has_permission('staff.manage'));

DROP POLICY IF EXISTS staff_site_access_delete ON public.internal_staff_site_access;
CREATE POLICY staff_site_access_delete ON public.internal_staff_site_access
  FOR DELETE USING (public.internal_has_permission('staff.manage'));

-- ---------------------------------------------------------------------------
-- 6. Staff list for assignment dropdowns — all ACTIVE staff (any role).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_list_staff()
RETURNS TABLE(user_id uuid, email text, full_name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT r.user_id,
         u.email,
         COALESCE((u.raw_user_meta_data->>'full_name')::text,
                  (u.raw_user_meta_data->>'name')::text),
         r.role
  FROM public.internal_user_roles r
  JOIN auth.users u ON u.id = r.user_id
  WHERE r.status = 'active'
  ORDER BY
    CASE r.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      WHEN 'support_manager' THEN 2
      WHEN 'support_agent' THEN 3
      WHEN 'developer' THEN 4
      ELSE 5
    END,
    u.email ASC;
$fn$;

-- ---------------------------------------------------------------------------
-- 7. Full staff directory for staff administration (owner/admin only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_list_staff_full()
RETURNS TABLE(
  user_id uuid, email text, full_name text, role text, status text,
  created_at timestamptz, last_sign_in_at timestamptz,
  site_ids uuid[], site_names text[]
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT r.user_id,
         u.email,
         COALESCE((u.raw_user_meta_data->>'full_name')::text,
                  (u.raw_user_meta_data->>'name')::text),
         r.role,
         r.status,
         r.created_at,
         u.last_sign_in_at,
         COALESCE(a.site_ids, ARRAY[]::uuid[]),
         COALESCE(a.site_names, ARRAY[]::text[])
  FROM public.internal_user_roles r
  JOIN auth.users u ON u.id = r.user_id
  LEFT JOIN LATERAL (
    SELECT array_agg(sa.site_id ORDER BY sa.site_id) AS site_ids,
           array_agg(s.site_name ORDER BY s.site_name) AS site_names
    FROM public.internal_staff_site_access sa
    LEFT JOIN public.internal_support_sites s ON s.id = sa.site_id
    WHERE sa.user_id = r.user_id
  ) a ON true
  WHERE public.internal_has_permission('staff.view')
  ORDER BY
    CASE r.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      WHEN 'support_manager' THEN 2
      WHEN 'support_agent' THEN 3
      WHEN 'developer' THEN 4
      ELSE 5
    END,
    u.email ASC;
$fn$;

-- ---------------------------------------------------------------------------
-- 8. Site directory for the site-access editor (owner/admin only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_list_support_sites()
RETURNS TABLE(id uuid, site_name text, site_slug text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT s.id, s.site_name, s.site_slug, s.is_active
  FROM public.internal_support_sites s
  WHERE public.internal_has_permission('staff.view')
  ORDER BY s.site_name ASC;
$fn$;

-- ---------------------------------------------------------------------------
-- 9. Change staff role (escalation + last-owner protection).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_change_staff_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor_role  text := public.internal_role();
  v_target      public.internal_user_roles%ROWTYPE;
  v_owner_count int;
BEGIN
  IF NOT public.internal_has_permission('staff.roles.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_new_role NOT IN ('owner','admin','support_manager','support_agent','developer','viewer') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  SELECT * INTO v_target FROM public.internal_user_roles WHERE user_id = p_target_user_id;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND';
  END IF;

  -- No self role changes (prevents self-escalation).
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_CHANGE_OWN_ROLE';
  END IF;

  -- Only the owner may touch the owner role / grant owner.
  IF v_actor_role <> 'owner' AND (v_target.role = 'owner' OR p_new_role = 'owner') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Last-owner protection.
  IF v_target.role = 'owner' AND p_new_role <> 'owner' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.internal_user_roles
    WHERE role = 'owner' AND status = 'active';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'LAST_OWNER';
    END IF;
  END IF;

  UPDATE public.internal_user_roles
     SET role = p_new_role, updated_at = now()
   WHERE user_id = p_target_user_id;

  INSERT INTO public.support_customer_activity (staff_user_id, action, metadata)
  VALUES (auth.uid(), 'staff_role_changed',
    jsonb_build_object('target_user_id', p_target_user_id,
                       'old_role', v_target.role, 'new_role', p_new_role));

  RETURN jsonb_build_object('ok', true, 'role', p_new_role);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 10. Enable / disable staff account (last-owner + self protections).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_set_staff_status(
  p_target_user_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_target      public.internal_user_roles%ROWTYPE;
  v_owner_count int;
BEGIN
  IF NOT public.internal_has_permission('staff.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_status NOT IN ('active','disabled') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT * INTO v_target FROM public.internal_user_roles WHERE user_id = p_target_user_id;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND';
  END IF;

  IF p_target_user_id = auth.uid() AND p_status = 'disabled' THEN
    RAISE EXCEPTION 'CANNOT_DISABLE_SELF';
  END IF;

  IF v_target.role = 'owner' AND p_status = 'disabled' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.internal_user_roles
    WHERE role = 'owner' AND status = 'active';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'LAST_OWNER';
    END IF;
  END IF;

  UPDATE public.internal_user_roles
     SET status = p_status,
         disabled_at = CASE WHEN p_status = 'disabled' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE user_id = p_target_user_id;

  INSERT INTO public.support_customer_activity (staff_user_id, action, metadata)
  VALUES (auth.uid(),
    CASE WHEN p_status = 'disabled' THEN 'staff_account_disabled' ELSE 'staff_account_enabled' END,
    jsonb_build_object('target_user_id', p_target_user_id));

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 11. Replace staff site access (owner/admin only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_set_staff_site_access(
  p_target_user_id uuid,
  p_site_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_target public.internal_user_roles%ROWTYPE;
  v_old   text[];
  v_new   text[];
BEGIN
  IF NOT public.internal_has_permission('staff.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_target FROM public.internal_user_roles WHERE user_id = p_target_user_id;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND';
  END IF;

  SELECT array_agg(s.site_name ORDER BY s.site_name)
    INTO v_old
    FROM public.internal_staff_site_access a
    LEFT JOIN public.internal_support_sites s ON s.id = a.site_id
   WHERE a.user_id = p_target_user_id;

  DELETE FROM public.internal_staff_site_access WHERE user_id = p_target_user_id;

  IF p_site_ids IS NOT NULL THEN
    INSERT INTO public.internal_staff_site_access (user_id, site_id)
    SELECT p_target_user_id, x.site_id
    FROM unnest(p_site_ids) AS x(site_id)
    WHERE x.site_id IS NOT NULL
    ON CONFLICT (user_id, site_id) DO NOTHING;
  END IF;

  SELECT array_agg(s.site_name ORDER BY s.site_name)
    INTO v_new
    FROM public.internal_staff_site_access a
    LEFT JOIN public.internal_support_sites s ON s.id = a.site_id
   WHERE a.user_id = p_target_user_id;

  INSERT INTO public.support_customer_activity (staff_user_id, action, metadata)
  VALUES (auth.uid(), 'staff_site_access_changed',
    jsonb_build_object('target_user_id', p_target_user_id,
                       'old_sites', COALESCE(to_jsonb(v_old), '[]'::jsonb),
                       'new_sites', COALESCE(to_jsonb(v_new), '[]'::jsonb)));

  RETURN jsonb_build_object('ok', true, 'site_ids', p_site_ids);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 12. Update existing support RPC gates to use central permissions.
-- ---------------------------------------------------------------------------

-- Repair request: anyone with request permission (owner/admin/manager/agent/developer).
CREATE OR REPLACE FUNCTION public.support_request_repair(p_ticket_id uuid, p_customer_id uuid, p_site_id uuid, p_user_id uuid, p_diagnostic_run_id uuid, p_action_type text, p_problem_detected text, p_reason text, p_requested_change text, p_current_value text, p_proposed_value text, p_recommended_by uuid, p_security_related boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_risk text;
  v_id   uuid;
BEGIN
  IF NOT public.internal_has_permission('support.repairs.request') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_site_id IS NOT NULL AND NOT public.internal_has_site_access(p_site_id) THEN
    RAISE EXCEPTION 'SITE_ACCESS_DENIED';
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
    ELSE RAISE EXCEPTION 'UNSUPPORTED_ACTION';
  END CASE;
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'CUSTOMER_REQUIRED'; END IF;

  INSERT INTO public.support_repair_actions
    (ticket_id, customer_id, site_id, user_id, diagnostic_run_id, action_type,
     risk_level, status, reason, problem_detected, requested_change, current_value,
     proposed_value, security_related, recommended_by, requested_by)
  VALUES
    (p_ticket_id, p_customer_id, p_site_id, p_user_id, p_diagnostic_run_id, p_action_type,
     v_risk, 'pending_approval', p_reason, p_problem_detected, p_requested_change, p_current_value,
     p_proposed_value, COALESCE(p_security_related, false), p_recommended_by, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), p_customer_id, p_ticket_id, p_site_id, 'repair_requested',
     jsonb_build_object('repair_id', v_id, 'action_type', p_action_type, 'risk_level', v_risk));

  RETURN public.support_repair_to_jsonb(v_id);
END;
$function$;

-- Repair reject: owner/admin/manager.
CREATE OR REPLACE FUNCTION public.support_reject_repair(p_repair_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_repair public.support_repair_actions%ROWTYPE;
BEGIN
  IF NOT public.internal_has_permission('support.repairs.reject') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_repair FROM public.support_repair_actions WHERE id = p_repair_id;
  IF v_repair.id IS NULL THEN RAISE EXCEPTION 'REPAIR_NOT_FOUND'; END IF;
  IF v_repair.status <> 'pending_approval' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  UPDATE public.support_repair_actions
     SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = p_reason
   WHERE id = p_repair_id;
  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_repair.customer_id, v_repair.ticket_id, v_repair.site_id,
     'repair_rejected', jsonb_build_object('repair_id', p_repair_id, 'reason', p_reason));
  RETURN public.support_repair_to_jsonb(p_repair_id);
END;
$function$;

-- Repair cancel: owner/admin/manager.
CREATE OR REPLACE FUNCTION public.support_cancel_repair(p_repair_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_repair public.support_repair_actions%ROWTYPE;
BEGIN
  IF NOT public.internal_has_permission('support.repairs.cancel') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_repair FROM public.support_repair_actions WHERE id = p_repair_id;
  IF v_repair.id IS NULL THEN RAISE EXCEPTION 'REPAIR_NOT_FOUND'; END IF;
  IF v_repair.status NOT IN ('draft','pending_approval') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  UPDATE public.support_repair_actions SET status = 'cancelled' WHERE id = p_repair_id;
  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_repair.customer_id, v_repair.ticket_id, v_repair.site_id,
     'repair_cancelled', jsonb_build_object('repair_id', p_repair_id));
  RETURN public.support_repair_to_jsonb(p_repair_id);
END;
$function$;

-- Diagnostic request: owner/admin/manager/agent/developer.
CREATE OR REPLACE FUNCTION public.support_request_diagnostic(p_customer_id uuid, p_site_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_ticket_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_run_id uuid;
BEGIN
  IF NOT public.internal_has_permission('support.diagnostics.run') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_site_id IS NOT NULL AND NOT public.internal_has_site_access(p_site_id) THEN
    RAISE EXCEPTION 'SITE_ACCESS_DENIED';
  END IF;

  INSERT INTO public.support_diagnostic_runs
    (customer_id, site_id, user_id, ticket_id, status, requested_by)
  VALUES
    (p_customer_id, p_site_id, p_user_id, p_ticket_id, 'queued', auth.uid())
  RETURNING id INTO v_run_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, organisation_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), p_customer_id, NULL, p_ticket_id, p_site_id, 'diagnostic_requested',
     jsonb_build_object('run_id', v_run_id));

  RETURN jsonb_build_object('status', 'queued', 'run_id', v_run_id);
END;
$function$;

-- Session create: owner/admin/manager/agent.
CREATE OR REPLACE FUNCTION public.support_create_session(p_customer_id uuid, p_user_id uuid, p_site_id uuid, p_ticket_id uuid, p_reason text, p_duration_minutes integer, p_access_scope jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_duration int := COALESCE(p_duration_minutes, 30);
  v_id       uuid;
  v_scope    jsonb;
BEGIN
  IF NOT public.internal_has_permission('support.sessions.start') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_site_id IS NOT NULL AND NOT public.internal_has_site_access(p_site_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SITE_ACCESS_DENIED',
      'message', 'You do not have access to this site.');
  END IF;

  IF p_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CUSTOMER_REQUIRED',
      'message', 'Customer identity must be resolved before starting a support session.');
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
      'message', 'A support reason is required.');
  END IF;

  IF v_duration NOT IN (15,30,60) THEN
    v_duration := 30;
  END IF;

  IF p_site_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internal_support_sites s
    WHERE s.id = p_site_id AND s.view_as_customer_supported = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VIEW_AS_CUSTOMER_UNSUPPORTED',
      'message', 'Support Session unavailable for this product. Diagnostics are still available.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_customer_activity a
    WHERE a.customer_user_id = p_customer_id
      AND (
        a.action = 'security_hold'
        OR (a.action IN ('repair_requested','repair_approved','repair_reviewed')
            AND a.metadata->>'security_related' = 'true')
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SECURITY_REVIEW_REQUIRED',
      'message', 'SECURITY REVIEW ACCOUNT — support sessions require elevated approval and cannot be started here.');
  END IF;

  v_scope := COALESCE(p_access_scope, jsonb_build_array(
    'profile','dashboard','account_status','subscription_summary','site_data','activity','support_context'
  ));

  INSERT INTO public.support_sessions
    (customer_id, user_id, site_id, ticket_id, requested_by, approved_by,
     session_type, status, reason, approved_at, started_at, expires_at,
     access_scope, duration_minutes)
  VALUES
    (p_customer_id, p_user_id, p_site_id, p_ticket_id, auth.uid(), auth.uid(),
     'read_only', 'active', p_reason, now(), now(), now() + make_interval(mins => v_duration),
     v_scope, v_duration)
  RETURNING id INTO v_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), p_customer_id, p_ticket_id, p_site_id, 'support_session_requested',
     jsonb_build_object('session_id', v_id, 'duration_minutes', v_duration));

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), p_customer_id, p_ticket_id, p_site_id, 'support_session_started',
     jsonb_build_object('session_id', v_id));

  RETURN jsonb_build_object('ok', true, 'session', public.support_session_to_jsonb(v_id));
END;
$function$;

-- Session end: owner/admin/manager/agent (agent may end own sessions only).
CREATE OR REPLACE FUNCTION public.support_end_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role    text := public.internal_role();
  v_session public.support_sessions%ROWTYPE;
BEGIN
  IF NOT public.internal_has_permission('support.sessions.end') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_session FROM public.support_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATE';
  END IF;
  -- Agents can only end their own sessions; managers/admin/owner can end any.
  IF v_role = 'support_agent' AND v_session.requested_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  UPDATE public.support_sessions
     SET status = 'ended', ended_at = now(), ended_by = auth.uid()
   WHERE id = p_session_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_session.customer_id, v_session.ticket_id, v_session.site_id,
     'support_session_ended', jsonb_build_object('session_id', p_session_id));

  RETURN public.support_session_to_jsonb(p_session_id);
END;
$function$;

-- Session revoke: owner/admin/manager (NOT agents).
CREATE OR REPLACE FUNCTION public.support_revoke_session(p_session_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session public.support_sessions%ROWTYPE;
BEGIN
  IF NOT public.internal_has_permission('support.sessions.revoke') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;
  SELECT * INTO v_session FROM public.support_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATE';
  END IF;

  UPDATE public.support_sessions
     SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid(),
         revocation_reason = p_reason
   WHERE id = p_session_id;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_session.customer_id, v_session.ticket_id, v_session.site_id,
     'support_session_revoked',
     jsonb_build_object('session_id', p_session_id, 'reason', p_reason));

  RETURN public.support_session_to_jsonb(p_session_id);
END;
$function$;

-- Customer search: support.customers.search.
CREATE OR REPLACE FUNCTION public.support_search_customers(p_query text, p_limit integer DEFAULT 30)
RETURNS TABLE(customer_id uuid, email text, full_name text, organisation_name text, products text, role text, status text, match_field text, user_id_short text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
  v_is_uuid boolean;
BEGIN
  IF NOT public.internal_has_permission('support.customers.search') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_is_uuid := v_q ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  INSERT INTO public.support_customer_activity (staff_user_id, action, metadata)
  VALUES (auth.uid(), 'customer_searched', jsonb_build_object('query', v_q));

  IF v_q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT p.id AS cid, 'user_id'::text AS mf, 1 AS rnk
      FROM public.profiles p
     WHERE v_is_uuid AND (p.id::text = v_q OR p.auth_user_id::text = v_q)
    UNION ALL
    SELECT p.id AS cid, 'ticket'::text AS mf, 2 AS rnk
      FROM public.internal_support_tickets t
      JOIN public.profiles p ON p.id = t.customer_user_id OR p.auth_user_id = t.customer_user_id
     WHERE lower(t.ticket_number) = v_q
    UNION ALL
    SELECT p.id AS cid, 'email'::text AS mf, 3 AS rnk
      FROM public.profiles p
     WHERE lower(p.email) LIKE '%' || v_q || '%'
    UNION ALL
    SELECT p.id AS cid, 'name'::text AS mf, 4 AS rnk
      FROM public.profiles p
     WHERE lower(concat_ws(' ', p.full_name, p.display_name, p.first_name, p.last_name)) LIKE '%' || v_q || '%'
    UNION ALL
    SELECT c.user_id AS cid, 'organisation'::text AS mf, 5 AS rnk
      FROM public.clients c
     WHERE c.user_id IS NOT NULL
       AND lower(concat_ws(' ', c.company_name, c.trading_name, c.contact_name)) LIKE '%' || v_q || '%'
    UNION ALL
    SELECT c.user_id AS cid, 'site'::text AS mf, 6 AS rnk
      FROM public.client_websites w
      JOIN public.clients c ON c.id = w.client_id
     WHERE c.user_id IS NOT NULL AND lower(w.name) LIKE '%' || v_q || '%'
  ),
  ranked AS (
    SELECT DISTINCT ON (cid) cid, mf, rnk
      FROM matched
     ORDER BY cid, rnk
  )
  SELECT
    r.cid,
    p.email,
    coalesce(p.full_name, p.display_name, concat_ws(' ', p.first_name, p.last_name)),
    (SELECT coalesce(c.trading_name, c.company_name) FROM public.clients c WHERE c.user_id = r.cid ORDER BY c.created_at ASC LIMIT 1),
    (SELECT string_agg(w.name, ', ' ORDER BY w.name) FROM public.client_websites w JOIN public.clients c ON c.id = w.client_id WHERE c.user_id = r.cid),
    p.role,
    p.status,
    r.mf,
    left(r.cid::text, 8)
  FROM ranked r
  JOIN public.profiles p ON p.id = r.cid
  ORDER BY r.rnk ASC, p.email ASC
  LIMIT p_limit;
END;
$function$;

-- Customer 360: support.customers.view.
CREATE OR REPLACE FUNCTION public.support_get_customer_360(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_org public.clients%ROWTYPE;
  v_email_confirmed_at timestamptz;
  v_last_sign_in_at timestamptz;
  v_auth_created_at timestamptz;
  v_products jsonb;
  v_subscriptions jsonb;
  v_tickets jsonb;
  v_activity jsonb;
  v_diagnostics jsonb;
  v_profile_email text;
BEGIN
  IF NOT public.internal_has_permission('support.customers.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_customer_id;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;

  v_profile_email := lower(v_profile.email);

  IF v_profile.auth_user_id IS NOT NULL THEN
    SELECT u.email_confirmed_at, u.last_sign_in_at, u.created_at
      INTO v_email_confirmed_at, v_last_sign_in_at, v_auth_created_at
      FROM auth.users u WHERE u.id = v_profile.auth_user_id;
  END IF;

  SELECT * INTO v_org FROM public.clients c WHERE c.user_id = p_customer_id ORDER BY c.created_at ASC LIMIT 1;
  IF v_org.id IS NULL AND v_profile_email IS NOT NULL THEN
    SELECT * INTO v_org FROM public.clients c WHERE lower(c.email) = v_profile_email ORDER BY c.created_at ASC LIMIT 1;
  END IF;

  v_products := NULL;
  IF v_org.id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
             'id', w.id, 'name', w.name, 'primary_domain', w.primary_domain, 'status', w.status, 'website_type', w.website_type
           ) ORDER BY w.name)
      INTO v_products FROM public.client_websites w WHERE w.client_id = v_org.id;
  END IF;

  v_subscriptions := NULL;
  IF v_org.id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'status', s.status, 'customer_reference', s.stripe_subscription_id, 'billing_cycle', s.billing_cycle
           ) ORDER BY s.created_at DESC)
      INTO v_subscriptions FROM public.subscriptions s WHERE s.client_id = v_org.id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'id', tk.id, 'ticket_number', tk.ticket_number, 'subject', tk.subject,
           'priority', tk.priority, 'status', tk.status, 'assigned_agent', tk.assigned_agent,
           'created_at', tk.created_at, 'site_name', coalesce(s.site_name, 'Unknown site')
         ) ORDER BY tk.created_at DESC)
    INTO v_tickets
    FROM public.internal_support_tickets tk
    LEFT JOIN public.internal_support_sites s ON s.id = tk.site_id
   WHERE tk.id IN (SELECT l.ticket_id FROM public.support_ticket_customer_links l WHERE l.customer_user_id = p_customer_id)
      OR tk.customer_user_id = p_customer_id
      OR tk.customer_user_id = v_profile.auth_user_id
      OR (v_profile_email IS NOT NULL AND lower(tk.customer_email) = v_profile_email);

  SELECT jsonb_agg(jsonb_build_object(
           'id', a.id, 'action', a.action, 'ticket_id', a.ticket_id, 'site_id', a.site_id,
           'metadata', a.metadata, 'created_at', a.created_at
         ) ORDER BY a.created_at DESC)
    INTO v_activity
    FROM (SELECT * FROM public.support_customer_activity WHERE customer_user_id = p_customer_id ORDER BY created_at DESC LIMIT 100) a;

  SELECT jsonb_agg(jsonb_build_object(
           'id', d.id, 'status', d.status, 'requested_by', d.requested_by,
           'started_at', d.started_at, 'completed_at', d.completed_at,
           'summary', d.summary, 'error_message', d.error_message, 'created_at', d.created_at
         ) ORDER BY d.created_at DESC)
    INTO v_diagnostics
    FROM (SELECT * FROM public.support_diagnostic_runs WHERE customer_id = p_customer_id ORDER BY created_at DESC LIMIT 50) d;

  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, organisation_id, action, metadata)
  VALUES
    (auth.uid(), p_customer_id, v_org.id, 'customer_opened',
     jsonb_build_object('has_auth', v_profile.auth_user_id IS NOT NULL));

  RETURN jsonb_build_object(
    'overview', jsonb_build_object(
      'customer_id', p_customer_id,
      'name', coalesce(v_profile.full_name, v_profile.display_name),
      'email', v_profile.email,
      'role', v_profile.role,
      'status', v_profile.status,
      'email_verified', CASE WHEN v_email_confirmed_at IS NOT NULL THEN true WHEN v_profile.id IS NOT NULL THEN false ELSE NULL END,
      'last_login', v_last_sign_in_at,
      'created_at', coalesce(v_profile.created_at, v_auth_created_at)
    ),
    'organisation', CASE WHEN v_org.id IS NOT NULL THEN jsonb_build_object(
      'id', v_org.id, 'name', coalesce(v_org.trading_name, v_org.company_name), 'status', v_org.status
    ) ELSE NULL END,
    'products', v_products,
    'subscriptions', v_subscriptions,
    'tickets', v_tickets,
    'activity', v_activity,
    'diagnostics', v_diagnostics
  );
END;
$function$;

-- Session view: support.sessions.view (requester-ownership still enforced below).
CREATE OR REPLACE FUNCTION public.support_get_session_view(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session public.support_sessions%ROWTYPE;
  v_profile jsonb;
  v_sub     jsonb;
  v_site    jsonb;
  v_tickets jsonb;
BEGIN
  IF NOT public.internal_has_permission('support.sessions.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_session FROM public.support_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.requested_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at <= now() THEN
    UPDATE public.support_sessions SET status = 'expired' WHERE id = p_session_id;
    INSERT INTO public.support_customer_activity
      (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
    VALUES
      (v_session.requested_by, v_session.customer_id, v_session.ticket_id, v_session.site_id,
       'support_session_expired', jsonb_build_object('session_id', p_session_id));
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  SELECT jsonb_build_object(
    'name', COALESCE(p.full_name, p.display_name, p.email),
    'email', p.email,
    'status', p.status,
    'role', p.role,
    'company', COALESCE(p.company_name, p.company),
    'created_at', p.created_at
  )
  INTO v_profile
  FROM public.profiles p WHERE p.id = v_session.customer_id;

  SELECT jsonb_build_object(
    'name', sub.name,
    'status', sub.status,
    'amount', sub.amount,
    'currency', sub.currency,
    'interval', sub.interval,
    'next_billing_date', sub.next_billing_date,
    'billing_cycle', sub.billing_cycle,
    'payment_method', CASE WHEN sub.stripe_subscription_id IS NOT NULL THEN 'Configured' ELSE 'Not available' END
  )
  INTO v_sub
  FROM public.subscriptions sub
  WHERE (sub.client_id = v_session.customer_id OR sub.owner_id = v_session.customer_id)
  ORDER BY sub.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT jsonb_build_object(
    'name', st.site_name,
    'domain', st.domain,
    'is_active', st.is_active
  )
  INTO v_site
  FROM public.internal_support_sites st WHERE st.id = v_session.site_id;

  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
        'ticket_number', t.ticket_number,
        'subject', t.subject,
        'status', t.status,
        'created_at', t.created_at
     ) ORDER BY t.created_at DESC)
     FROM public.internal_support_tickets t
     WHERE t.customer_user_id = v_session.customer_id
     LIMIT 20),
    '[]'::jsonb
  )
  INTO v_tickets;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'status', v_session.status,
      'session_type', v_session.session_type,
      'customer_id', v_session.customer_id,
      'customer_name', (SELECT coalesce(p.full_name, p.display_name, p.email) FROM public.profiles p WHERE p.id = v_session.customer_id),
      'customer_email', (SELECT p.email FROM public.profiles p WHERE p.id = v_session.customer_id),
      'site_id', v_session.site_id,
      'site_name', (SELECT st.site_name FROM public.internal_support_sites st WHERE st.id = v_session.site_id),
      'ticket_id', v_session.ticket_id,
      'ticket_number', (SELECT t.ticket_number FROM public.internal_support_tickets t WHERE t.id = v_session.ticket_id),
      'started_at', v_session.started_at,
      'expires_at', v_session.expires_at,
      'remaining_seconds', GREATEST(0, EXTRACT(EPOCH FROM (v_session.expires_at - now()))::int),
      'reason', v_session.reason,
      'access_scope', v_session.access_scope,
      'requested_by_name', (SELECT coalesce(p.full_name, p.email) FROM public.profiles p WHERE p.id = v_session.requested_by)
    ),
    'profile', v_profile,
    'subscription', v_sub,
    'site', v_site,
    'recent_tickets', v_tickets,
    'diagnostics_count', (SELECT count(*) FROM public.support_diagnostic_runs d WHERE d.customer_id = v_session.customer_id),
    'repairs_count', (SELECT count(*) FROM public.support_repair_actions r WHERE r.customer_id = v_session.customer_id)
  );
END;
$function$;

-- Repairs overview: support.repairs.view.
CREATE OR REPLACE FUNCTION public.support_repairs_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pending jsonb; v_executing jsonb; v_failed jsonb; v_recent jsonb; v_metrics jsonb;
BEGIN
  IF NOT public.internal_has_permission('support.repairs.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  v_pending := COALESCE((SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.created_at ASC)
    FROM public.support_repair_actions r WHERE r.status = 'pending_approval' LIMIT 100), '[]'::jsonb);
  v_executing := COALESCE((SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.executed_at ASC)
    FROM public.support_repair_actions r WHERE r.status = 'executing' LIMIT 100), '[]'::jsonb);
  v_failed := COALESCE((SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.failed_at DESC NULLS LAST)
    FROM public.support_repair_actions r WHERE r.status = 'failed' LIMIT 100), '[]'::jsonb);
  v_recent := COALESCE((SELECT jsonb_agg(public.support_repair_to_jsonb(r.id) ORDER BY r.completed_at DESC)
    FROM public.support_repair_actions r WHERE r.status = 'completed' AND r.completed_at >= (now() - interval '7 days') LIMIT 100), '[]'::jsonb);
  v_metrics := jsonb_build_object(
    'awaiting_approval', (SELECT count(*) FROM public.support_repair_actions WHERE status = 'pending_approval'),
    'executing', (SELECT count(*) FROM public.support_repair_actions WHERE status = 'executing'),
    'failed', (SELECT count(*) FROM public.support_repair_actions WHERE status = 'failed'),
    'completed_today', (SELECT count(*) FROM public.support_repair_actions WHERE status = 'completed' AND completed_at >= date_trunc('day', now())),
    'medium_pending', (SELECT count(*) FROM public.support_repair_actions WHERE status = 'pending_approval' AND risk_level = 'medium')
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
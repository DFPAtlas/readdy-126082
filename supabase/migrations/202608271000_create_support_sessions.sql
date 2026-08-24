-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 13 — SECURE TEMPORARY SUPPORT SESSION
--                                + READ-ONLY VIEW-AS-CUSTOMER
-- ============================================================================
-- Extends the Prompt 10/11/12 support platform with a temporary, read-only,
-- audited, permission-controlled, customer-specific, site-specific support
-- session. No existing ticket/auth/RBac/RLS/audit/diagnostic/repair behaviour
-- is weakened.
--
-- Principles:
--   READ-ONLY · TEMPORARY · AUDITED · PERMISSION-CONTROLLED
--   CUSTOMER-SPECIFIC · SITE-SPECIFIC
--
-- No customer password / password hash / session token / refresh token / MFA
-- secret / API key / card data is ever required, retrieved or displayed.
--
-- The "dedicated short-lived support identity" is the staff member's own
-- Supabase Auth session + this support_sessions record. Every data access is a
-- SECURITY DEFINER RPC that re-checks internal_role() (returns NULL the moment
-- the staff member logs out or loses their role), session.status = 'active',
-- and expires_at > now(). There is no reusable customer token.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SUPPORT SESSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        uuid,
  user_id            uuid,
  site_id            uuid,
  ticket_id          uuid,
  requested_by       uuid NOT NULL,
  approved_by        uuid,
  session_type       text NOT NULL DEFAULT 'read_only',
  status             text NOT NULL DEFAULT 'requested',
  reason             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  approved_at        timestamptz,
  started_at         timestamptz,
  expires_at         timestamptz,
  ended_at           timestamptz,
  ended_by           uuid,
  access_scope       jsonb,
  metadata           jsonb,
  revoked_by         uuid,
  revoked_at         timestamptz,
  revocation_reason  text,
  ip_address         text,
  duration_minutes   int NOT NULL DEFAULT 30,
  CONSTRAINT support_sessions_type_check
    CHECK (session_type IN ('read_only')),
  CONSTRAINT support_sessions_status_check
    CHECK (status IN ('requested','approved','active','expired','ended','rejected','revoked','failed')),
  CONSTRAINT support_sessions_duration_check
    CHECK (duration_minutes IN (15,30,60))
);

CREATE INDEX IF NOT EXISTS support_sessions_customer_idx
  ON public.support_sessions (customer_id);
CREATE INDEX IF NOT EXISTS support_sessions_ticket_idx
  ON public.support_sessions (ticket_id);
CREATE INDEX IF NOT EXISTS support_sessions_status_idx
  ON public.support_sessions (status);
CREATE INDEX IF NOT EXISTS support_sessions_created_idx
  ON public.support_sessions (created_at DESC);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — customers can never read internal session records.
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_sessions_select
  ON public.support_sessions FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_sessions_insert
  ON public.support_sessions FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_sessions_update
  ON public.support_sessions FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_sessions_delete
  ON public.support_sessions FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner','admin'));

-- ---------------------------------------------------------------------------
-- Site connector indicator: whether a product's connector exposes a safe
-- read-only View-as-Customer projection. Default false = unsupported.
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_support_sites
  ADD COLUMN IF NOT EXISTS view_as_customer_supported boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Shared JSON serialiser (resolves names server-side, never secrets).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_session_to_jsonb(p_id uuid)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', s.id,
    'customer_id', s.customer_id,
    'customer_name', (SELECT coalesce(p.full_name, p.display_name, p.email)
                      FROM public.profiles p WHERE p.id = s.customer_id),
    'customer_email', (SELECT p.email FROM public.profiles p WHERE p.id = s.customer_id),
    'user_id', s.user_id,
    'site_id', s.site_id,
    'site_name', (SELECT st.site_name FROM public.internal_support_sites st WHERE st.id = s.site_id),
    'ticket_id', s.ticket_id,
    'ticket_number', (SELECT t.ticket_number FROM public.internal_support_tickets t WHERE t.id = s.ticket_id),
    'requested_by', s.requested_by,
    'requested_by_name', (SELECT coalesce(p.full_name, p.email)
                          FROM public.profiles p WHERE p.id = s.requested_by),
    'approved_by', s.approved_by,
    'approved_by_name', (SELECT coalesce(p.full_name, p.email)
                         FROM public.profiles p WHERE p.id = s.approved_by),
    'session_type', s.session_type,
    'status', s.status,
    'reason', s.reason,
    'created_at', s.created_at,
    'approved_at', s.approved_at,
    'started_at', s.started_at,
    'expires_at', s.expires_at,
    'ended_at', s.ended_at,
    'ended_by', s.ended_by,
    'ended_by_name', (SELECT coalesce(p.full_name, p.email)
                      FROM public.profiles p WHERE p.id = s.ended_by),
    'revoked_by', s.revoked_by,
    'revoked_by_name', (SELECT coalesce(p.full_name, p.email)
                        FROM public.profiles p WHERE p.id = s.revoked_by),
    'revocation_reason', s.revocation_reason,
    'access_scope', s.access_scope,
    'duration_minutes', s.duration_minutes
  )
  FROM public.support_sessions s
  WHERE s.id = p_id;
$function$;

-- ---------------------------------------------------------------------------
-- Create + immediately start a read-only support session (owner/admin).
-- LOW-RISK read-only sessions are self-approved in this initial version.
-- Returns { ok, session } on success or { ok:false, code, message } for soft
-- failures (unsupported product, security-review account).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_create_session(
  p_customer_id uuid,
  p_user_id uuid,
  p_site_id uuid,
  p_ticket_id uuid,
  p_reason text,
  p_duration_minutes int,
  p_access_scope jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role     text := public.internal_role();
  v_duration int := COALESCE(p_duration_minutes, 30);
  v_id       uuid;
  v_scope    jsonb;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
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

  -- Site connector support — unsupported products fail safely.
  IF p_site_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internal_support_sites s
    WHERE s.id = p_site_id AND s.view_as_customer_supported = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VIEW_AS_CUSTOMER_UNSUPPORTED',
      'message', 'Support Session unavailable for this product. Diagnostics are still available.');
  END IF;

  -- Security-review accounts are blocked from normal read-only sessions.
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

  -- Default read-only scope.
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

-- ---------------------------------------------------------------------------
-- Fetch a single session for staff (view permission only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_session(p_session_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.internal_role() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  RETURN public.support_session_to_jsonb(p_session_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- List sessions for a support ticket.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_ticket_sessions(p_ticket_id uuid)
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
    SELECT jsonb_agg(public.support_session_to_jsonb(s.id) ORDER BY s.created_at DESC)
      FROM public.support_sessions s WHERE s.ticket_id = p_ticket_id
  ), '[]'::jsonb);
END;
$function$;

-- ---------------------------------------------------------------------------
-- List sessions for a customer (Customer 360).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_customer_sessions(p_customer_id uuid)
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
    SELECT jsonb_agg(public.support_session_to_jsonb(s.id) ORDER BY s.created_at DESC)
      FROM public.support_sessions s WHERE s.customer_id = p_customer_id
  ), '[]'::jsonb);
END;
$function$;

-- ---------------------------------------------------------------------------
-- End the caller's own active session (or owner/admin ends any session).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_end_session(p_session_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role    text := public.internal_role();
  v_session public.support_sessions%ROWTYPE;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_session FROM public.support_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATE';
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

-- ---------------------------------------------------------------------------
-- Revoke another staff member's active session (owner/admin). Requires reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_revoke_session(p_session_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role    text := public.internal_role();
  v_session public.support_sessions%ROWTYPE;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
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

-- ---------------------------------------------------------------------------
-- READ-ONLY VIEW-AS-CUSTOMER PROJECTION.
-- The single safe server-side data access point for an active support session.
-- Enforces: staff still has a role, session active, not expired, and the
-- requester is the caller (multi-tenant / cross-customer protection).
-- Returns a masked, least-privilege projection only. Never returns secrets.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_get_session_view(p_session_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role    text := public.internal_role();
  v_session public.support_sessions%ROWTYPE;
  v_profile jsonb;
  v_sub     jsonb;
  v_site    jsonb;
  v_tickets jsonb;
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_session FROM public.support_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  -- The caller must be the staff member who opened the session.
  IF v_session.requested_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  -- Server-side expiry (the frontend countdown is cosmetic).
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at <= now() THEN
    UPDATE public.support_sessions SET status = 'expired' WHERE id = p_session_id;
    INSERT INTO public.support_customer_activity
      (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
    VALUES
      (v_session.requested_by, v_session.customer_id, v_session.ticket_id, v_session.site_id,
       'support_session_expired', jsonb_build_object('session_id', p_session_id));
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  -- Least-privilege profile projection (no secrets, no auth_user_id).
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

  -- Masked subscription summary (payment method masked, never stripe ids).
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
      'requested_by_name', (SELECT coalesce(p.full_name, p.email)
                            FROM public.profiles p WHERE p.id = v_session.requested_by)
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

-- ---------------------------------------------------------------------------
-- Log which sections staff viewed during a support session (audit only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_log_session_view(p_session_id uuid, p_section text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session public.support_sessions%ROWTYPE;
BEGIN
  IF public.internal_role() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_session FROM public.support_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL OR v_session.status <> 'active' THEN
    RETURN;
  END IF;
  INSERT INTO public.support_customer_activity
    (staff_user_id, customer_user_id, ticket_id, site_id, action, metadata)
  VALUES
    (auth.uid(), v_session.customer_id, v_session.ticket_id, v_session.site_id,
     'support_session_viewed_section',
     jsonb_build_object('session_id', p_session_id, 'section', p_section));
END;
$function$;
-- ============================================================================
-- P0 COMMAND CENTRE — INVITE-ONLY ACCESS
-- ============================================================================
-- Converts the DFP Command Centre from public self-registration to an
-- invite-only internal application. Role assignment is never decided by the
-- browser: invitations are issued by the owner through a server-side Edge
-- Function (command-centre-invite-user), and the role is granted only when an
-- invited user signs in (accept_invitation, SECURITY DEFINER).
--
-- Scope is strictly limited to Command Centre access (internal_* tables).
-- No customer/public auth used by other DFP products is touched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. NEUTRALISE THE LEGACY SELF-PROVISIONING RPC
--    The previous provision_user_role() auto-granted owner/viewer to any
--    authenticated user. It is replaced with a read-only "get my role"
--    function so it can never grant a role again (DROP is not available here;
--    this is the equivalent safe end-state).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.internal_user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. INVITATION TABLE
--    Records pending invitations. The owner's Edge Function writes these via
--    the service role; the browser can only read/manage them as owner (RLS).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS internal_invitations_email_key
  ON public.internal_invitations (email);

-- ---------------------------------------------------------------------------
-- 3. RLS ON internal_invitations — owner only
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_invitations_select ON public.internal_invitations
  FOR SELECT TO authenticated
  USING (public.internal_role() = 'owner');

CREATE POLICY internal_invitations_insert ON public.internal_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() = 'owner');

CREATE POLICY internal_invitations_update ON public.internal_invitations
  FOR UPDATE TO authenticated
  USING (public.internal_role() = 'owner')
  WITH CHECK (public.internal_role() = 'owner');

CREATE POLICY internal_invitations_delete ON public.internal_invitations
  FOR DELETE TO authenticated
  USING (public.internal_role() = 'owner');

-- ---------------------------------------------------------------------------
-- 4. PREVENT THE OWNER FROM DEMOTING/DELETING THEIR OWN ROW
--    Guards against self-lockout. The owner can manage every other row.
-- ---------------------------------------------------------------------------
ALTER POLICY internal_user_roles_update ON public.internal_user_roles
  USING (public.internal_role() = 'owner' AND user_id <> auth.uid())
  WITH CHECK (public.internal_role() = 'owner' AND user_id <> auth.uid());

ALTER POLICY internal_user_roles_delete ON public.internal_user_roles
  USING (public.internal_role() = 'owner' AND user_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- 5. ACCEPT INVITATION (SECURITY DEFINER)
--    Called when an authenticated user has no role yet. Derives the user and
--    their email from auth.uid() / auth.users (never the browser), finds a
--    pending invitation, and grants the invited role. Returns NULL when there
--    is no valid invitation (=> "no access").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_existing text;
  v_invite record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Existing role always wins (idempotent; never changes or self-promotes).
  SELECT role INTO v_existing
  FROM public.internal_user_roles
  WHERE user_id = v_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Derive email server-side from auth.users (never trust the browser).
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM public.internal_invitations
  WHERE email = lower(v_email)
    AND status = 'pending'
  ORDER BY invited_at DESC
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.internal_user_roles (user_id, role)
  VALUES (v_user_id, v_invite.role);

  UPDATE public.internal_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.role;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. LIST TEAM MEMBERS (SECURITY DEFINER)
--    Returns owner/admin/viewer rows joined to auth.users for email + name.
--    Only the owner gets results (internal_role() = 'owner').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.user_id,
         u.email,
         (u.raw_user_meta_data->>'full_name')::text,
         r.role,
         r.created_at,
         r.updated_at
  FROM public.internal_user_roles r
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE public.internal_role() = 'owner'
  ORDER BY r.created_at ASC;
$$;
-- P0 follow-up: secure server-side role provisioning for the DFP Command Centre.
--
-- Replaces the insecure client-side signup bootstrap (a browser-side
-- `count === 0 ? 'owner' : 'viewer'` check followed by a direct INSERT) with a
-- SECURITY DEFINER RPC that:
--   * derives the user id from auth.uid() (never a browser-supplied id)
--   * atomically decides the bootstrap role (first-ever user -> owner, else viewer)
--   * is idempotent (returns the existing role and never self-promotes)
--   * is backed by database-level uniqueness so there can never be two owners
--     or two role rows for the same user.

-- One role row per user (idempotency + clean `.maybeSingle()` reads).
CREATE UNIQUE INDEX IF NOT EXISTS internal_user_roles_user_id_key
  ON public.internal_user_roles (user_id);

-- At most one owner across the whole Command Centre (closes the bootstrap race).
CREATE UNIQUE INDEX IF NOT EXISTS internal_user_roles_single_owner
  ON public.internal_user_roles (role)
  WHERE role = 'owner';

CREATE OR REPLACE FUNCTION public.provision_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing text;
  v_owner_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_existing
  FROM public.internal_user_roles
  WHERE user_id = v_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.internal_user_roles WHERE role = 'owner') INTO v_owner_exists;

  IF v_owner_exists THEN
    INSERT INTO public.internal_user_roles (user_id, role) VALUES (v_user_id, 'viewer');
    RETURN 'viewer';
  ELSE
    BEGIN
      INSERT INTO public.internal_user_roles (user_id, role) VALUES (v_user_id, 'owner');
      RETURN 'owner';
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO public.internal_user_roles (user_id, role) VALUES (v_user_id, 'viewer');
      RETURN 'viewer';
    END;
  END IF;
END;
$$;
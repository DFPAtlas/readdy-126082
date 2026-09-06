-- ============================================================================
-- P0 COMMAND CENTRE — RLS HARDENING
-- ============================================================================
-- Fixes a CRITICAL authorization flaw: every internal_* table had RLS enabled
-- but with policies equivalent to USING (true) / WITH CHECK (true) for the
-- `authenticated` role — i.e. any signed-in user could read/write/delete all
-- Command Centre business data regardless of their owner/admin/viewer role.
--
-- This migration:
--   1. Creates a SECURITY DEFINER role helper (public.internal_role()).
--   2. Drops all unsafe Command Centre policies.
--   3. Recreates role-aware policies.
--   4. Adds a CHECK constraint restricting roles to owner/admin/viewer.
--   5. Preserves existing data (no DROP/TRUNCATE of tables or rows).
--
-- Scope is strictly limited to public.internal_* tables. No unrelated
-- DFP / Vowora / GarageFlow / Both-Sides / UAT objects are touched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ROLE HELPER
--    Derives the caller's Command Centre role from auth.uid() and
--    internal_user_roles. SECURITY DEFINER so it can read internal_user_roles
--    without recursing through that table's own RLS. Returns only
--    'owner' | 'admin' | 'viewer' | NULL. Does NOT accept a browser-supplied id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.internal_user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.internal_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_role() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. DROP UNSAFE POLICIES
--    Removes every existing policy on internal_* tables (all of which were
--    permissive "true" policies for authenticated). Idempotent.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename LIKE 'internal_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. ROLE DOMAIN CHECK
--    Locks internal_user_roles.role to the three valid values.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.internal_user_roles'::regclass
      AND conname = 'internal_user_roles_role_check'
  ) THEN
    ALTER TABLE public.internal_user_roles
      ADD CONSTRAINT internal_user_roles_role_check
      CHECK (role IN ('owner','admin','viewer'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. OPERATIONAL TABLES (all internal_* except internal_user_roles)
--    - SELECT  : any authenticated user with a role (owner/admin/viewer)
--    - INSERT/UPDATE/DELETE : owner or admin only
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'internal_%'
      AND tablename <> 'internal_user_roles'
  LOOP
    EXECUTE format(
      'CREATE POLICY internal_cc_select ON public.%I FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL)',
      t.tablename
    );
    EXECUTE format(
      'CREATE POLICY internal_cc_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN (''owner'',''admin''))',
      t.tablename
    );
    EXECUTE format(
      'CREATE POLICY internal_cc_update ON public.%I FOR UPDATE TO authenticated USING (public.internal_role() IN (''owner'',''admin'')) WITH CHECK (public.internal_role() IN (''owner'',''admin''))',
      t.tablename
    );
    EXECUTE format(
      'CREATE POLICY internal_cc_delete ON public.%I FOR DELETE TO authenticated USING (public.internal_role() IN (''owner'',''admin''))',
      t.tablename
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. internal_user_roles (SENSITIVE TABLE)
--    - SELECT : owner sees all; any user sees only their own row
--    - INSERT/UPDATE/DELETE : owner only (blocks admin/viewer self-promotion)
-- ---------------------------------------------------------------------------
CREATE POLICY internal_user_roles_select ON public.internal_user_roles
  FOR SELECT TO authenticated
  USING (public.internal_role() = 'owner' OR user_id = auth.uid());

CREATE POLICY internal_user_roles_insert ON public.internal_user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() = 'owner');

CREATE POLICY internal_user_roles_update ON public.internal_user_roles
  FOR UPDATE TO authenticated
  USING (public.internal_role() = 'owner')
  WITH CHECK (public.internal_role() = 'owner');

CREATE POLICY internal_user_roles_delete ON public.internal_user_roles
  FOR DELETE TO authenticated
  USING (public.internal_role() = 'owner');
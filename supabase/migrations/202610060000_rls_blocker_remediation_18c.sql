-- ============================================================================
-- DFP-COMMAND-18C — RLS BLOCKER REMEDIATION
-- ============================================================================
-- Fixes the sensitive RLS bypass surfaced in 18B on the two most sensitive
-- Command Centre tables:
--   internal_projects
--   internal_project_budgets
--
-- PROBLEM (as recorded in 18B):
--   Two overlapping permissive policy families were OR'd together:
--     internal_cc_*        -> internal_role_aal2()  (MFA, but historically no status check)
--     internal_projects_*  -> internal_role()       (active status, but no MFA)
--     internal_budgets_*   -> internal_role()       (active status, but no MFA)
--   Postgres ORs permissive policies, so:
--     * an active role-holder WITHOUT MFA passed via internal_role()
--     * a disabled/suspended role-holder WITH a still-valid session passed via
--       internal_role_aal2() (which lacked a status check)
--
-- FIX:
--   1. internal_role_aal2() now requires BOTH aal2 (MFA) AND status = 'active'.
--      It fails closed to NULL on any missing/invalid context (anonymous,
--      no MFA, non-active status, missing role).
--   2. The legacy internal_projects_* / internal_budgets_* policy set is dropped
--      so there is no internal_role()-only permissive path.
--   3. internal_cc_* policies on these two tables are (re)created against
--      internal_role_aal2(), making the combined check the ONLY path.
--
-- SCOPE: internal_projects + internal_project_budgets ONLY. The five newer
-- lifecycle tables (integrations / launch approvals / deployments / maintenance
-- / reviews) already passed verification and are intentionally untouched.
-- No table or row data is rewritten, truncated, or deleted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Combined helper: active internal role AND AAL2/MFA. Fails closed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_role_aal2()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN (auth.jwt() ->> 'aal') = 'aal2'
      THEN (
        SELECT role FROM public.internal_user_roles
        WHERE user_id = auth.uid()
          AND status = 'active'
        LIMIT 1
      )
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.internal_role_aal2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_role_aal2() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Drop legacy permissive policy set on internal_projects.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS internal_projects_select ON public.internal_projects;
DROP POLICY IF EXISTS internal_projects_insert ON public.internal_projects;
DROP POLICY IF EXISTS internal_projects_update ON public.internal_projects;
DROP POLICY IF EXISTS internal_projects_delete ON public.internal_projects;

-- ---------------------------------------------------------------------------
-- 3. Drop legacy permissive policy set on internal_project_budgets.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS internal_budgets_select ON public.internal_project_budgets;
DROP POLICY IF EXISTS internal_budgets_insert ON public.internal_project_budgets;
DROP POLICY IF EXISTS internal_budgets_update ON public.internal_project_budgets;
DROP POLICY IF EXISTS internal_budgets_delete ON public.internal_project_budgets;

-- ---------------------------------------------------------------------------
-- 4. (Re)create the internal_cc_* combined-check set on internal_projects.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS internal_cc_select ON public.internal_projects;
DROP POLICY IF EXISTS internal_cc_insert ON public.internal_projects;
DROP POLICY IF EXISTS internal_cc_update ON public.internal_projects;
DROP POLICY IF EXISTS internal_cc_delete ON public.internal_projects;

CREATE POLICY internal_cc_select ON public.internal_projects
  FOR SELECT TO authenticated
  USING (public.internal_role_aal2() IS NOT NULL);

CREATE POLICY internal_cc_insert ON public.internal_projects
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role_aal2() IN ('owner', 'admin'));

CREATE POLICY internal_cc_update ON public.internal_projects
  FOR UPDATE TO authenticated
  USING (public.internal_role_aal2() IN ('owner', 'admin'))
  WITH CHECK (public.internal_role_aal2() IN ('owner', 'admin'));

CREATE POLICY internal_cc_delete ON public.internal_projects
  FOR DELETE TO authenticated
  USING (public.internal_role_aal2() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- 5. (Re)create the internal_cc_* combined-check set on internal_project_budgets.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS internal_cc_select ON public.internal_project_budgets;
DROP POLICY IF EXISTS internal_cc_insert ON public.internal_project_budgets;
DROP POLICY IF EXISTS internal_cc_update ON public.internal_project_budgets;
DROP POLICY IF EXISTS internal_cc_delete ON public.internal_project_budgets;

CREATE POLICY internal_cc_select ON public.internal_project_budgets
  FOR SELECT TO authenticated
  USING (public.internal_role_aal2() IS NOT NULL);

CREATE POLICY internal_cc_insert ON public.internal_project_budgets
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role_aal2() IN ('owner', 'admin'));

CREATE POLICY internal_cc_update ON public.internal_project_budgets
  FOR UPDATE TO authenticated
  USING (public.internal_role_aal2() IN ('owner', 'admin'))
  WITH CHECK (public.internal_role_aal2() IN ('owner', 'admin'));

CREATE POLICY internal_cc_delete ON public.internal_project_budgets
  FOR DELETE TO authenticated
  USING (public.internal_role_aal2() IN ('owner', 'admin'));
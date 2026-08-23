-- P0 PROMPT 06 — Align Command Centre authorization with DFP UAT authorization.
--
-- Design (OPTION C): extend the existing app_private.is_admin() gate to also
-- recognise approved Command Centre administrators (internal_user_roles
-- owner/admin). This is a single-point, documented bridge — no data sync, no
-- circular RLS, no weakening of existing tester/staff policies.

-- 1. Bridge: Command Centre owner/admin become UAT administrators.
CREATE OR REPLACE FUNCTION app_private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.admin_profiles a
      WHERE a.id = (SELECT auth.uid()) AND a.active = true
        AND a.role IN ('owner','super_admin','admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.internal_user_roles r
      WHERE r.user_id = (SELECT auth.uid())
        AND r.role IN ('owner','admin')
    )
  );
$function$;

-- 2. DB-backed route-guard check (no sensitive data, authenticated only).
CREATE OR REPLACE FUNCTION public.has_uat_admin_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT app_private.is_admin();
$function$;

REVOKE ALL ON FUNCTION public.has_uat_admin_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_uat_admin_access() TO authenticated;

-- 3. Close read gap: uat_test_case_results was gated only by staff_profiles,
--    so Command Centre (and admin_profiles) admins could not read test results.
CREATE POLICY "admin_read_all_results"
  ON public.uat_test_case_results
  FOR SELECT
  TO authenticated
  USING (app_private.is_admin());
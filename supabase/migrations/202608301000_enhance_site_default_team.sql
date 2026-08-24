-- ============================================================================
-- DFP Command — Prompt 15A: Site Default Support Team control
-- Enhances the existing internal_set_site_default_team() RPC (created in Prompt
-- 15) so that changing a site's fallback team:
--   1. validates the target team is active (rejects inactive/unknown teams), and
--   2. writes an immutable audit event (site_default_team_changed).
--
-- Routing behaviour is unchanged:
--   rule match → matched team
--   no rule    → site default team
--   no default → Needs Review
-- ============================================================================

CREATE OR REPLACE FUNCTION public.internal_set_site_default_team(p_site_id uuid, p_team_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prev_team_id uuid;
  v_prev_team_name text;
  v_new_team_name text;
BEGIN
  IF NOT public.internal_has_permission('staff.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT default_support_team_id INTO v_prev_team_id
    FROM public.internal_support_sites
   WHERE id = p_site_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SITE_NOT_FOUND';
  END IF;

  IF v_prev_team_id IS NOT NULL THEN
    SELECT name INTO v_prev_team_name FROM public.internal_support_teams WHERE id = v_prev_team_id;
  END IF;

  IF p_team_id IS NOT NULL THEN
    SELECT name INTO v_new_team_name
      FROM public.internal_support_teams
     WHERE id = p_team_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEAM_NOT_ACTIVE';
    END IF;
  END IF;

  UPDATE public.internal_support_sites
     SET default_support_team_id = p_team_id, updated_at = now()
   WHERE id = p_site_id;

  INSERT INTO public.support_customer_activity (staff_user_id, site_id, action, metadata)
  VALUES (
    auth.uid(),
    p_site_id,
    'site_default_team_changed',
    jsonb_build_object(
      'previous_team_id', v_prev_team_id,
      'previous_team_name', v_prev_team_name,
      'new_team_id', p_team_id,
      'new_team_name', v_new_team_name
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$function$;
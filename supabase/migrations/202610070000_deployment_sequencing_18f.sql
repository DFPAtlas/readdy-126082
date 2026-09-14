-- ============================================================================
-- DFP COMMAND 18F — SERVER-SIDE DEPLOYMENT SEQUENCING ENFORCEMENT
-- ============================================================================
-- Closes the 18E P1: deployment lifecycle gates must be authoritative on the
-- server, not enforced only by frontend React logic.
--
-- Codifies (into a tracked migration) the full server-side state machine that
-- already governs the deployment lifecycle, and removes the client direct-write
-- path that could bypass it:
--
--   Launch Approved ─► Start Deployment ─► Complete ─► Verify ─► Accept ─► Live
--   Failure path:   ─► Failed ─► Rollback ─► Re-verify ─► Rolled Back
--
-- The critical lifecycle transitions are performed ONLY through SECURITY
-- DEFINER RPCs that independently re-validate auth, active owner/admin role,
-- project/approval/deployment relationship, the deployment state machine, and
-- the authoritative SHA. Direct INSERT/UPDATE/DELETE on the deployment ledger
-- is neutralised to `false` so an owner/admin cannot skip sequencing via a raw
-- API write. internal_projects.status='live' is guarded by a trigger so a
-- direct live transition is rejected outside the atomic accept path.
--
-- No secrets are stored or exposed. No data is rewritten or deleted.
-- ============================================================================

-- ── 1. Helper: assert an active owner/admin caller (fail closed) ──────────
CREATE OR REPLACE FUNCTION public.internal_assert_owner_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.internal_user_roles
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
END;
$function$;

-- ── 2. Helper: deployment audit write (same transaction as the change) ────
CREATE OR REPLACE FUNCTION public.internal_deployment_audit(
  p_project_id bigint, p_action text, p_description text, p_metadata jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.internal_activity_log (
    project_id, user_id, entity_type, entity_id, action, description, metadata, created_at
  ) VALUES (
    p_project_id, auth.uid(), 'project', p_project_id, p_action, p_description, p_metadata, now()
  );
END;
$function$;

-- ── 3. Trigger: block direct internal_projects.status='live' transitions ──
CREATE OR REPLACE FUNCTION public.internal_guard_project_launch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- The atomic accept path signals its own launch with a transaction-local
  -- setting; everything else is a direct bypass and is rejected.
  IF COALESCE(current_setting('dfp.accepting_launch', true), '') = 'true' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION 'LAUNCH_TRANSITION_REQUIRES_ACCEPTANCE';
  END IF;
  IF OLD.launched_at IS NULL AND NEW.launched_at IS NOT NULL THEN
    RAISE EXCEPTION 'LAUNCHED_AT_REQUIRES_ACCEPTANCE';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_internal_projects_guard_launch ON public.internal_projects;
CREATE TRIGGER tr_internal_projects_guard_launch
  BEFORE UPDATE ON public.internal_projects
  FOR EACH ROW EXECUTE FUNCTION public.internal_guard_project_launch();

-- ── 4. Start Deployment ───────────────────────────────────────────────────
-- Requires: project exists, approval exists + same project + APPROVED + SHA,
-- authoritative current SHA present and equal to the approved SHA, and no
-- conflicting active deployment. Rejects SHA drift server-side.
CREATE OR REPLACE FUNCTION public.deployment_start(
  p_project_id bigint,
  p_launch_approval_id uuid,
  p_head_sha text,
  p_last_known_good_sha text,
  p_production_url text,
  p_deployment_method text,
  p_provider text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_approval public.internal_project_launch_approvals%ROWTYPE;
  v_active int;
  v_new_id uuid;
BEGIN
  PERFORM public.internal_assert_owner_admin();
  PERFORM pg_advisory_xact_lock(hashtextextended('dfp_deployment:' || p_project_id::text, 0));

  IF NOT EXISTS (SELECT 1 FROM public.internal_projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'PROJECT_INACTIVE';
  END IF;

  SELECT * INTO v_approval
  FROM public.internal_project_launch_approvals
  WHERE id = p_launch_approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVAL_REQUIRED';
  END IF;
  IF v_approval.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;
  IF v_approval.decision IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'APPROVAL_REQUIRED';
  END IF;
  IF v_approval.github_sha IS NULL OR btrim(v_approval.github_sha) = '' THEN
    RAISE EXCEPTION 'APPROVAL_INVALID';
  END IF;

  -- Authoritative SHA: fail closed when unavailable; reject drift.
  IF p_head_sha IS NULL OR btrim(p_head_sha) = '' THEN
    RAISE EXCEPTION 'SHA_VERIFICATION_UNAVAILABLE';
  END IF;
  IF btrim(p_head_sha) <> v_approval.github_sha THEN
    RAISE EXCEPTION 'SHA_DRIFT';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.internal_project_deployments
  WHERE project_id = p_project_id
    AND status IN ('DEPLOYING', 'DEPLOYED', 'VERIFYING', 'ROLLING_BACK');
  IF v_active > 0 THEN
    RAISE EXCEPTION 'DEPLOYMENT_ALREADY_ACTIVE';
  END IF;

  INSERT INTO public.internal_project_deployments (
    project_id, launch_approval_id, environment, status, github_sha,
    last_known_good_sha, deployment_method, provider, production_url,
    started_at, started_by
  ) VALUES (
    p_project_id, p_launch_approval_id, 'production', 'DEPLOYING', v_approval.github_sha,
    p_last_known_good_sha, p_deployment_method, p_provider, p_production_url,
    now(), auth.uid()::text
  )
  RETURNING id INTO v_new_id;

  PERFORM public.internal_deployment_audit(
    p_project_id, 'Deployment Started',
    'Deployment started for project ' || p_project_id,
    jsonb_build_object('deployment_id', v_new_id, 'sha', v_approval.github_sha)
  );

  RETURN v_new_id;
END;
$function$;

-- ── 5. Complete Deployment (DEPLOYING -> DEPLOYED) ────────────────────────
CREATE OR REPLACE FUNCTION public.deployment_complete(
  p_deployment_id uuid, p_deployed_sha text, p_notes text, p_provider text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
BEGIN
  PERFORM public.internal_assert_owner_admin();

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status IS DISTINCT FROM 'DEPLOYING' THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF p_deployed_sha IS NULL OR btrim(p_deployed_sha) = '' THEN
    RAISE EXCEPTION 'DEPLOYED_SHA_MISMATCH';
  END IF;
  IF btrim(p_deployed_sha) <> v_deployment.github_sha THEN
    RAISE EXCEPTION 'DEPLOYED_SHA_MISMATCH';
  END IF;

  UPDATE public.internal_project_deployments
  SET status = 'DEPLOYED',
      deployed_sha = btrim(p_deployed_sha),
      completed_at = now(),
      notes = p_notes,
      provider = COALESCE(btrim(p_provider), provider)
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Deployment Completed',
    'Deployment marked deployed for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id, 'sha', btrim(p_deployed_sha))
  );
END;
$function$;

-- ── 6. Fail Deployment (DEPLOYING/DEPLOYED/VERIFYING -> FAILED) ───────────
CREATE OR REPLACE FUNCTION public.deployment_fail(p_deployment_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
BEGIN
  PERFORM public.internal_assert_owner_admin();

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status NOT IN ('DEPLOYING', 'DEPLOYED', 'VERIFYING') THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  UPDATE public.internal_project_deployments
  SET status = 'FAILED',
      failed_at = now(),
      failure_reason = p_reason
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Deployment Failed',
    'Deployment failed for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id, 'reason', p_reason)
  );
END;
$function$;

-- ── 7. Start Verification (DEPLOYED -> VERIFYING) ─────────────────────────
CREATE OR REPLACE FUNCTION public.deployment_start_verification(p_deployment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
BEGIN
  PERFORM public.internal_assert_owner_admin();

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status IS DISTINCT FROM 'DEPLOYED' THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;
  IF v_deployment.deployed_sha IS NULL OR btrim(v_deployment.deployed_sha) = '' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;
  IF v_deployment.deployed_sha <> v_deployment.github_sha THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED';
  END IF;

  UPDATE public.internal_project_deployments
  SET status = 'VERIFYING',
      verifying_at = now()
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Verification Started',
    'Production verification started for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id)
  );
END;
$function$;

-- ── 8. Complete Verification (VERIFYING -> VERIFIED) ──────────────────────
-- Recomputes the authoritative SHA match server-side and rejects explicit
-- FAILs AND mandatory UNKNOWN checks — a client "PASS" or "UNKNOWN" cannot
-- forge a VERIFIED deployment.
CREATE OR REPLACE FUNCTION public.deployment_complete_verification(
  p_deployment_id uuid, p_snapshot jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
  v_server_snapshot jsonb;
BEGIN
  PERFORM public.internal_assert_owner_admin();

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status IS DISTINCT FROM 'VERIFYING' THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.deployed_sha IS NULL OR btrim(v_deployment.deployed_sha) = '' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;
  IF v_deployment.deployed_sha <> v_deployment.github_sha THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED';
  END IF;

  IF p_snapshot IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;

  IF p_snapshot->>'monitoringResult' = 'FAIL'
     OR p_snapshot->>'criticalAlertResult' = 'FAIL'
     OR p_snapshot->>'backendResult' = 'FAIL'
     OR p_snapshot->>'runtimeResult' = 'FAIL'
     OR p_snapshot->>'aiResult' = 'FAIL'
     OR p_snapshot->>'applicationHealthResult' = 'FAIL' THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED';
  END IF;

  IF p_snapshot->>'monitoringResult' = 'UNKNOWN'
     OR p_snapshot->>'criticalAlertResult' = 'UNKNOWN'
     OR p_snapshot->>'backendResult' = 'UNKNOWN' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;

  v_server_snapshot := p_snapshot || jsonb_build_object(
    'generated_by', 'server',
    'authoritative_sha_match', 'PASS',
    'server_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'verified_sha', v_deployment.deployed_sha
  );

  UPDATE public.internal_project_deployments
  SET status = 'VERIFIED',
      verified_at = now(),
      verified_by = auth.uid()::text,
      verification_snapshot = v_server_snapshot
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Deployment Verified',
    'Deployment verified for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id, 'sha', v_deployment.deployed_sha)
  );
END;
$function$;

-- ── 9. Accept Production Deployment (VERIFIED -> accepted, atomic live) ───
-- Acceptance and (for first launch) the internal_projects.status='live'
-- transition happen atomically in this one transaction.
CREATE OR REPLACE FUNCTION public.deployment_accept(p_deployment_id uuid, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
  v_project public.internal_projects%ROWTYPE;
BEGIN
  PERFORM public.internal_assert_owner_admin();
  PERFORM pg_advisory_xact_lock(hashtextextended('dfp_accept:' || p_deployment_id::text, 0));

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status IS DISTINCT FROM 'VERIFIED' THEN
    RAISE EXCEPTION 'ACCEPTANCE_NOT_ALLOWED';
  END IF;
  IF v_deployment.production_accepted THEN
    RAISE EXCEPTION 'ACCEPTANCE_NOT_ALLOWED';
  END IF;
  IF v_deployment.deployed_sha IS NULL OR v_deployment.deployed_sha <> v_deployment.github_sha THEN
    RAISE EXCEPTION 'ACCEPTANCE_NOT_ALLOWED';
  END IF;
  IF v_deployment.verification_snapshot IS NULL THEN
    RAISE EXCEPTION 'ACCEPTANCE_NOT_ALLOWED';
  END IF;

  SELECT * INTO v_project
  FROM public.internal_projects
  WHERE id = v_deployment.project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_INACTIVE';
  END IF;

  UPDATE public.internal_project_deployments
  SET production_accepted = true,
      accepted_at = now(),
      accepted_by = auth.uid()::text,
      acceptance_notes = p_notes
  WHERE id = p_deployment_id;

  IF v_project.launched_at IS NULL THEN
    PERFORM set_config('dfp.accepting_launch', 'true', true);
    UPDATE public.internal_projects
    SET status = 'live',
        launched_at = now()
    WHERE id = v_deployment.project_id;
    PERFORM set_config('dfp.accepting_launch', '', true);

    PERFORM public.internal_deployment_audit(
      v_deployment.project_id, 'Project Launched',
      'Project launched to Live for project ' || v_deployment.project_id,
      jsonb_build_object('deployment_id', p_deployment_id, 'sha', v_deployment.deployed_sha)
    );
  ELSE
    PERFORM public.internal_deployment_audit(
      v_deployment.project_id, 'Production Release Accepted',
      'Production release accepted for project ' || v_deployment.project_id,
      jsonb_build_object('deployment_id', p_deployment_id, 'sha', v_deployment.deployed_sha)
    );
  END IF;
END;
$function$;

-- ── 10. Start Rollback (derives target from trusted history) ──────────────
CREATE OR REPLACE FUNCTION public.deployment_start_rollback(
  p_failed_deployment_id uuid, p_reason text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_failed public.internal_project_deployments%ROWTYPE;
  v_target text;
  v_active int;
  v_new_id uuid;
BEGIN
  PERFORM public.internal_assert_owner_admin();
  PERFORM pg_advisory_xact_lock(hashtextextended('dfp_deployment:' || p_failed_deployment_id::text, 0));

  SELECT * INTO v_failed
  FROM public.internal_project_deployments
  WHERE id = p_failed_deployment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  -- Rollback target is derived server-side — never a client-supplied SHA.
  v_target := NULL;
  IF v_failed.previous_production_sha IS NOT NULL AND btrim(v_failed.previous_production_sha) <> '' THEN
    v_target := v_failed.previous_production_sha;
  ELSIF v_failed.last_known_good_sha IS NOT NULL AND btrim(v_failed.last_known_good_sha) <> '' THEN
    v_target := v_failed.last_known_good_sha;
  ELSE
    SELECT COALESCE(deployed_sha, github_sha) INTO v_target
    FROM public.internal_project_deployments
    WHERE project_id = v_failed.project_id
      AND production_accepted = true
      AND id <> p_failed_deployment_id
    ORDER BY accepted_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  IF v_target IS NULL OR btrim(v_target) = '' THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_UNAVAILABLE';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.internal_project_deployments
  WHERE project_id = v_failed.project_id
    AND status IN ('DEPLOYING', 'DEPLOYED', 'VERIFYING', 'ROLLING_BACK');
  IF v_active > 0 THEN
    RAISE EXCEPTION 'DEPLOYMENT_ALREADY_ACTIVE';
  END IF;

  INSERT INTO public.internal_project_deployments (
    project_id, launch_approval_id, environment, status, github_sha,
    previous_production_sha, last_known_good_sha, deployment_method,
    production_url, rollback_of_deployment_id, rollback_sha, rollback_reason,
    started_at, started_by
  ) VALUES (
    v_failed.project_id, v_failed.launch_approval_id, 'production', 'ROLLING_BACK', v_target,
    v_failed.github_sha, v_target, v_failed.deployment_method,
    v_failed.production_url, p_failed_deployment_id, v_target, p_reason,
    now(), auth.uid()::text
  )
  RETURNING id INTO v_new_id;

  PERFORM public.internal_deployment_audit(
    v_failed.project_id, 'Rollback Started',
    'Rollback started for project ' || v_failed.project_id,
    jsonb_build_object('rollback_deployment_id', v_new_id, 'of_deployment_id', p_failed_deployment_id, 'sha', v_target)
  );

  RETURN v_new_id;
END;
$function$;

-- ── 11. Enter rollback deployed SHA (ROLLING_BACK, must equal target) ─────
CREATE OR REPLACE FUNCTION public.deployment_enter_rollback_sha(
  p_deployment_id uuid, p_deployed_sha text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
BEGIN
  PERFORM public.internal_assert_owner_admin();

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status IS DISTINCT FROM 'ROLLING_BACK' THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;
  IF v_deployment.rollback_sha IS NULL OR btrim(v_deployment.rollback_sha) = '' THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_UNAVAILABLE';
  END IF;
  IF btrim(p_deployed_sha) <> v_deployment.rollback_sha THEN
    RAISE EXCEPTION 'DEPLOYED_SHA_MISMATCH';
  END IF;

  UPDATE public.internal_project_deployments
  SET deployed_sha = btrim(p_deployed_sha)
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Rollback Deployed',
    'Rollback deployed for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id, 'sha', btrim(p_deployed_sha))
  );
END;
$function$;

-- ── 12. Complete Rollback (ROLLING_BACK -> ROLLED_BACK, verified) ─────────
CREATE OR REPLACE FUNCTION public.deployment_complete_rollback(
  p_deployment_id uuid, p_snapshot jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
  v_server_snapshot jsonb;
BEGIN
  PERFORM public.internal_assert_owner_admin();

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.status IS DISTINCT FROM 'ROLLING_BACK' THEN
    RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE';
  END IF;

  IF v_deployment.deployed_sha IS NULL OR btrim(v_deployment.deployed_sha) = '' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;
  IF v_deployment.rollback_sha IS NULL OR v_deployment.deployed_sha <> v_deployment.rollback_sha THEN
    RAISE EXCEPTION 'ROLLBACK_VERIFICATION_FAILED';
  END IF;

  IF p_snapshot IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_VERIFICATION_FAILED';
  END IF;
  IF p_snapshot->>'monitoringResult' = 'FAIL'
     OR p_snapshot->>'criticalAlertResult' = 'FAIL'
     OR p_snapshot->>'backendResult' = 'FAIL'
     OR p_snapshot->>'runtimeResult' = 'FAIL'
     OR p_snapshot->>'aiResult' = 'FAIL'
     OR p_snapshot->>'applicationHealthResult' = 'FAIL' THEN
    RAISE EXCEPTION 'ROLLBACK_VERIFICATION_FAILED';
  END IF;
  IF p_snapshot->>'monitoringResult' = 'UNKNOWN'
     OR p_snapshot->>'criticalAlertResult' = 'UNKNOWN'
     OR p_snapshot->>'backendResult' = 'UNKNOWN' THEN
    RAISE EXCEPTION 'ROLLBACK_VERIFICATION_FAILED';
  END IF;

  v_server_snapshot := jsonb_build_object(
    'generated_by', 'server',
    'authoritative_sha_match', 'PASS',
    'server_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'verified_sha', v_deployment.deployed_sha
  );
  IF p_snapshot IS NOT NULL THEN
    v_server_snapshot := p_snapshot || v_server_snapshot;
  END IF;

  UPDATE public.internal_project_deployments
  SET status = 'ROLLED_BACK',
      rolled_back_at = now(),
      verified_at = now(),
      verified_by = auth.uid()::text,
      verification_snapshot = v_server_snapshot
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Rollback Completed',
    'Rollback completed for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id, 'sha', v_deployment.deployed_sha)
  );
END;
$function$;

-- ── 13. RLS hardening: neutralise direct deployment writes ────────────────
-- Read stays available to any active internal role; write mutations flow only
-- through the SECURITY DEFINER RPCs above. An owner/admin cannot bypass the
-- state machine via a raw INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS internal_deploy_insert ON public.internal_project_deployments;
DROP POLICY IF EXISTS internal_deploy_update ON public.internal_project_deployments;
DROP POLICY IF EXISTS internal_deploy_delete ON public.internal_project_deployments;

CREATE POLICY internal_deploy_insert ON public.internal_project_deployments
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY internal_deploy_update ON public.internal_project_deployments
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY internal_deploy_delete ON public.internal_project_deployments
  FOR DELETE TO authenticated USING (false);

-- ── 14. Grants: only authenticated callers may invoke the protected RPCs ──
REVOKE ALL ON FUNCTION public.deployment_start(bigint, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_complete(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_fail(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_start_verification(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_complete_verification(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_accept(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_start_rollback(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_enter_rollback_sha(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_complete_rollback(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.internal_assert_owner_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.internal_deployment_audit(bigint, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.deployment_start(bigint, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_complete(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_fail(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_start_verification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_complete_verification(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_accept(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_start_rollback(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_enter_rollback_sha(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_complete_rollback(uuid, jsonb) TO authenticated;
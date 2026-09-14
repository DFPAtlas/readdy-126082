-- ============================================================================
-- DFP COMMAND 18F2 — AUTHORITATIVE SERVER EVIDENCE (DEPLOYMENT)
-- ============================================================================
-- Closes the two P1 trust boundaries left by Command 18F:
--
--   1. deployment_start(... p_head_sha ...) trusted the BROWSER's claim of the
--      current GitHub HEAD. It only checked the browser value equalled the
--      approval SHA — it never queried GitHub. An owner/admin could therefore
--      "confirm" a SHA match even after GitHub HEAD had drifted.
--
--   2. deployment_complete_verification(... p_snapshot ...) read PASS / FAIL /
--      UNKNOWN check results straight from the browser JSON and merely stamped
--      `generated_by = 'server'` on top of the client's claims. An owner/admin
--      could send an all-PASS snapshot and force VERIFIED.
--
-- Remediation model (fail closed, no client-editable trust):
--   * The current GitHub SHA is resolved SERVER-SIDE by the `deployment-start`
--     Edge Function using GITHUB_ACCESS_TOKEN (secret storage only, never
--     returned/logged). The browser has no input that can change the result.
--   * Production verification is performed SERVER-SIDE by the `deployment-verify`
--     Edge Function over authoritative stored telemetry (freshness-checked).
--     Only that engine may transition VERIFYING -> VERIFIED.
--   * The two RPCs become service_role-only (EXECUTE revoked from authenticated
--     / anonymous) and consume the server-generated result.
--   * `verification_authoritative` (boolean, service_role-writable only) marks a
--     server-generated snapshot; `deployment_accept` refuses legacy / forged
--     snapshots (§15/§16 — no auto-satisfaction of pre-remediation snapshots).
--   * BEFORE INSERT / BEFORE UPDATE guards stop an owner/admin from bypassing
--     the engine by writing status = 'VERIFIED' directly.
--
-- Scope: deployment sequencing evidence ONLY. Rollback, providers and the rest
-- of Deployment Control are deliberately untouched.
-- ============================================================================

-- ── 1. Authoritative verification marker column ────────────────────────────
-- Only the server-side verification engine (service_role) may set this true.
-- Legacy / client-generated snapshots remain false and are rejected at accept.
ALTER TABLE public.internal_project_deployments
  ADD COLUMN IF NOT EXISTS verification_authoritative boolean NOT NULL DEFAULT false;

-- ── 2. deployment_start — server-resolved SHA (no browser p_head_sha) ───────
-- p_head_sha is the CURRENT repository HEAD resolved server-side by the
-- deployment-start Edge Function. The browser never supplies it.
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
  -- Only the server-side deployment-start Edge Function may call this RPC.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'DEPLOYMENT_REQUIRES_SERVER_AUTHORITY';
  END IF;
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

  -- Authoritative SHA gate. No fall-back to any browser / cached / LKG value.
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

-- ── 3. deployment_complete_verification — authoritative server snapshot ────
CREATE OR REPLACE FUNCTION public.deployment_complete_verification(
  p_deployment_id uuid,
  p_snapshot jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deployment public.internal_project_deployments%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'DEPLOYMENT_REQUIRES_SERVER_AUTHORITY';
  END IF;

  SELECT * INTO v_deployment
  FROM public.internal_project_deployments
  WHERE id = p_deployment_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE'; END IF;
  IF v_deployment.status IS DISTINCT FROM 'VERIFYING' THEN RAISE EXCEPTION 'INVALID_DEPLOYMENT_STATE'; END IF;
  IF v_deployment.deployed_sha IS NULL OR btrim(v_deployment.deployed_sha) = '' THEN RAISE EXCEPTION 'VERIFICATION_INCOMPLETE'; END IF;
  IF v_deployment.deployed_sha <> v_deployment.github_sha THEN RAISE EXCEPTION 'VERIFICATION_FAILED'; END IF;
  IF p_snapshot IS NULL THEN RAISE EXCEPTION 'VERIFICATION_INCOMPLETE'; END IF;

  -- The snapshot must be the SERVER-generated authoritative result produced by
  -- the deployment-verify Edge Function. Client JSON is never accepted.
  IF p_snapshot->>'generated_by' IS DISTINCT FROM 'server' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;
  IF p_snapshot->>'authoritative' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;
  IF p_snapshot->>'snapshot_version' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'VERIFICATION_INCOMPLETE';
  END IF;
  IF p_snapshot->>'overall' IS DISTINCT FROM 'PASS' THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED';
  END IF;

  UPDATE public.internal_project_deployments
  SET status = 'VERIFIED',
      verified_at = now(),
      verified_by = auth.uid()::text,
      verification_snapshot = p_snapshot,
      verification_authoritative = true
  WHERE id = p_deployment_id;

  PERFORM public.internal_deployment_audit(
    v_deployment.project_id, 'Production Verified',
    'Production verified for project ' || v_deployment.project_id,
    jsonb_build_object('deployment_id', p_deployment_id, 'sha', v_deployment.deployed_sha)
  );
END;
$function$;

-- ── 4. deployment_accept — refuse legacy / forged snapshots ────────────────
-- Replaces the 18F body with one that additionally requires authoritative
-- (server-generated) verification evidence. Legacy client-generated snapshots
-- no longer satisfy acceptance and require re-verification.
CREATE OR REPLACE FUNCTION public.deployment_accept(
  p_deployment_id uuid,
  p_notes text
)
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

  -- Authoritative evidence required. Legacy (client-generated) snapshots and
  -- forged JSON are rejected here; only the server-side verification engine
  -- sets verification_authoritative = true.
  IF v_deployment.verification_authoritative IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFICATION_REQUIRED';
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

-- ── 5. Restrict RPC execution to the server-side Edge Functions ────────────
-- The browser must never call these directly with fabricated evidence.
REVOKE ALL ON FUNCTION public.deployment_start(bigint, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deployment_complete_verification(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deployment_start(bigint, uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deployment_complete_verification(uuid, jsonb) TO service_role;

-- ── 6. Evidence guards — stop owner/admin bypassing the server engine ──────
-- Defense-in-depth: even though the RPCs are service_role-only, an owner/admin
-- with table-level INSERT/UPDATE (RLS) could otherwise write status = 'VERIFIED'
-- directly. These triggers make that impossible outside the engine.
CREATE OR REPLACE FUNCTION public.internal_deployment_evidence_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' AND NEW.status IN ('DEPLOYING', 'VERIFIED') THEN
      RAISE EXCEPTION 'DEPLOYMENT_REQUIRES_SERVER_AUTHORITY';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'VERIFIED' AND OLD.status IS DISTINCT FROM 'VERIFIED' THEN
        RAISE EXCEPTION 'VERIFICATION_REQUIRED';
      END IF;
      IF NEW.verification_authoritative IS DISTINCT FROM OLD.verification_authoritative
         AND NEW.verification_authoritative IS TRUE THEN
        RAISE EXCEPTION 'VERIFICATION_REQUIRED';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS internal_project_deployments_evidence_guard
  ON public.internal_project_deployments;

CREATE TRIGGER internal_project_deployments_evidence_guard
BEFORE INSERT OR UPDATE ON public.internal_project_deployments
FOR EACH ROW EXECUTE FUNCTION public.internal_deployment_evidence_guard();
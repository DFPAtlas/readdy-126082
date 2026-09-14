-- ============================================================================
-- DFP COMMAND 13A — PROJECT DEPLOYMENT CONTROL — DEPLOYMENT RECORD
-- ============================================================================
-- Adds a safe, audited project deployment ledger that is LOCKED to a valid
-- Launch Approval (DFP Command 12) and an approved GitHub SHA.
--
-- Deployment Control is an AGGREGATOR + RECORD KEEPER. It never deploys, never
-- triggers Readdy, never pushes GitHub, never changes DNS, and never restarts
-- runtimes. It only:
--   * evaluates whether a project is eligible to deploy (read-time), and
--   * creates/tracks deployment records through a manual, audited flow.
--
-- KEY RELATIONSHIPS:
--   * project_id          -> internal_projects.id (bigint, soft reference —
--                            matches internal_project_integrations /
--                            internal_project_launch_approvals pattern; no
--                            hard FK, see DFP Command 09 note).
--   * launch_approval_id  -> internal_project_launch_approvals.id (uuid, soft
--                            reference). A deployment is always tied to the
--                            launch approval that authorised it.
--
-- STATUS MODEL (spec §3 — "LIVE" is NOT a deployment status):
--   PLANNED / READY / BLOCKED / DEPLOYING / DEPLOYED / VERIFYING / VERIFIED /
--   FAILED / CANCELLED.
--
-- SAFETY / SCOPE:
--   * Additive only — no existing Project Command Centre section changes.
--   * "DEPLOYED" is NOT "VERIFIED" and NOT "Live". Verification is the next
--     stage (Command 13B). internal_projects.status is never touched here.
--   * github_sha is the APPROVED SHA — a deployment is never allowed to
--     silently move to a newer HEAD.
--   * No secrets stored: no GitHub tokens, Readdy credentials, hosting tokens,
--     SSH keys, service-role keys, or DNS credentials.
--   * RLS matches the established internal admin pattern (owner/admin write,
--     any authenticated role read). No public / anonymous access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.internal_project_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL,
  launch_approval_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','READY','BLOCKED','DEPLOYING','DEPLOYED',
                      'VERIFYING','VERIFIED','FAILED','CANCELLED')),
  github_sha text NOT NULL,
  previous_production_sha text,
  last_known_good_sha text,
  deployment_method text,
  provider text,
  production_url text,
  started_at timestamptz,
  started_by text,
  completed_at timestamptz,
  verified_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_project_deployments_project_id_idx
  ON public.internal_project_deployments (project_id);

CREATE INDEX IF NOT EXISTS internal_project_deployments_launch_approval_idx
  ON public.internal_project_deployments (launch_approval_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Matches the established DFP internal admin pattern. No public / anon access.
ALTER TABLE public.internal_project_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_deploy_select ON public.internal_project_deployments
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_deploy_insert ON public.internal_project_deployments
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_deploy_update ON public.internal_project_deployments
  FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'))
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_deploy_delete ON public.internal_project_deployments
  FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'));
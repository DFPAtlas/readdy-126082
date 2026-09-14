-- ============================================================================
-- DFP COMMAND 13B — PRODUCTION VERIFICATION — ADDITIVE COLUMNS
-- ============================================================================
-- Adds the fields Command 13B needs to move a deployment from DEPLOYED
-- through VERIFYING to VERIFIED, without changing any 13A behaviour.
--
--   * deployed_sha            — the ACTUAL SHA the operator supplied at
--                               "Mark Deployment Completed" (validated in 13A
--                               to equal the approved SHA). Lets verification
--                               honestly distinguish "Approved SHA" from
--                               "Actual Deployed SHA" (and show UNKNOWN when
--                               it was never recorded).
--   * verifying_at            — when production verification started.
--   * verified_by             — the operator who verified the release.
--   * verification_snapshot   — compact JSON of the verification result.
--
-- RLS was already enabled on internal_project_deployments in Command 13A and
-- already matches the internal admin pattern, so no new policies are needed
-- here. No secrets are ever stored in verification_snapshot.
-- ============================================================================

ALTER TABLE public.internal_project_deployments
  ADD COLUMN IF NOT EXISTS deployed_sha text,
  ADD COLUMN IF NOT EXISTS verifying_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verification_snapshot jsonb;
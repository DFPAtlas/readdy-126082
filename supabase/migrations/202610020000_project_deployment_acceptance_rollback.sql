-- ============================================================================
-- DFP COMMAND 13C — PRODUCTION ACCEPTANCE + LAST KNOWN GOOD + ROLLBACK
-- ============================================================================
-- Closes the deployment lifecycle on top of 13A (ledger) and 13B (verification):
--   Launch Approved → Deployment → Verification → Acceptance → Live
--   Failure path:   Failed → Rollback Prepared → Restore → Re-verify → Complete
--
-- ACCEPTANCE (§3) marks a VERIFIED deployment as the official production
-- release WITHOUT changing its status — a separate `production_accepted`
-- boolean plus accepted_at / accepted_by / acceptance_notes. "Approved" is
-- not "deployed", "verified" is not "accepted", and none of them is "Live".
--
-- ROLLBACK (§13) is a NEW deployment record (status ROLLING_BACK) that
-- references the deployment it rolls back via rollback_of_deployment_id
-- (soft reference). It never overwrites the failed record, and never rewrites
-- Git history — rollback is a redeploy of a known-good SHA, not a source
-- rewrite. No GitHub token / credentials / secrets are ever stored.
--
-- STATUS MODEL (§15) adds: ROLLBACK_REQUIRED / ROLLING_BACK / ROLLED_BACK.
-- "LIVE" is STILL not a deployment status — project lifecycle stays separate.
--
-- RLS was already enabled on internal_project_deployments in Command 13A with
-- the internal admin pattern (owner/admin write, any authenticated role read,
-- no anonymous access) — no new policies are required here.
-- ============================================================================

-- 1. Expand the status CHECK to include the rollback lifecycle. The original
--    inline CHECK was auto-named, so resolve it dynamically to stay robust.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.internal_project_deployments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.internal_project_deployments DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.internal_project_deployments
  ADD CONSTRAINT internal_project_deployments_status_check
  CHECK (status IN (
    'PLANNED','READY','BLOCKED','DEPLOYING','DEPLOYED',
    'VERIFYING','VERIFIED','FAILED','CANCELLED',
    'ROLLBACK_REQUIRED','ROLLING_BACK','ROLLED_BACK'
  ));

-- 2. Acceptance columns.
ALTER TABLE public.internal_project_deployments
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by text,
  ADD COLUMN IF NOT EXISTS acceptance_notes text,
  ADD COLUMN IF NOT EXISTS production_accepted boolean NOT NULL DEFAULT false;

-- 3. Rollback columns (soft reference to the deployment being rolled back).
ALTER TABLE public.internal_project_deployments
  ADD COLUMN IF NOT EXISTS rollback_of_deployment_id uuid,
  ADD COLUMN IF NOT EXISTS rollback_sha text,
  ADD COLUMN IF NOT EXISTS rollback_reason text,
  ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz;

CREATE INDEX IF NOT EXISTS internal_project_deployments_rollback_of_idx
  ON public.internal_project_deployments (rollback_of_deployment_id);
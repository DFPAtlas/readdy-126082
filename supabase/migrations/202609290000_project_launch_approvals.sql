-- ============================================================================
-- DFP COMMAND 12 — PROJECT LAUNCH CONTROL — APPROVAL RECORD
-- ============================================================================
-- Introduces a formal, auditable project-level launch approval. This is a
-- DIFFERENT question from UAT approval:
--   * uat_approvals  answers "Did testing approve the release?"
--   * launch approvals answer "Did Digital Footprint approve the WHOLE project
--     to go live?" (build + code + infrastructure + commercial + operations).
--
-- Launch Control itself is a READ-TIME AGGREGATOR over existing systems
-- (Build Process, GitHub/Readdy integration, Infrastructure, UAT, Bugs,
-- Changes, Budget, Support/Incidents, Monitoring, Activity). Nothing here
-- duplicates those sources of truth — this table ONLY stores the approval
-- decision + a compact evaluation snapshot for auditability.
--
-- SAFETY / SCOPE:
--   * Additive only — no existing Project Command Centre section is changed.
--   * project_id is bigint (matches internal_projects.id), consistent with the
--     established Command Centre relationship model (see DFP Command 09 note).
--   * No auto-approval: passing gates NEVER writes an approval. A human /
--     authorised operator must explicitly approve or reject.
--   * "APPROVED" is NOT "deployed" and does NOT touch internal_projects.status.
--   * No secrets are stored (no tokens, no credentials, no raw payloads).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.internal_project_launch_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL,
  decision text NOT NULL DEFAULT 'PENDING'
    CHECK (decision IN ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by text,
  decided_at timestamptz,
  decided_by text,
  decision_notes text,
  -- Compact gate-state snapshot captured at request time (auditability only).
  -- Never contains secrets. Example keys: gates[], productionDomain,
  -- githubRepository, supabaseRef, githubSha, lastKnownGoodSha, evaluatedAt.
  evaluation_snapshot jsonb,
  -- Code version the approval applies to. A non-null SHA lets Launch Control
  -- flag "CODE CHANGED AFTER APPROVAL" when the current SHA later differs.
  github_sha text,
  last_known_good_sha text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_project_launch_approvals_project_id_idx
  ON public.internal_project_launch_approvals (project_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Matches the established DFP internal admin pattern (owner/admin can write,
-- any authenticated user with a role can read). No public / anon access.
ALTER TABLE public.internal_project_launch_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_launch_select ON public.internal_project_launch_approvals
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_launch_insert ON public.internal_project_launch_approvals
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_launch_update ON public.internal_project_launch_approvals
  FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'))
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_launch_delete ON public.internal_project_launch_approvals
  FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'));
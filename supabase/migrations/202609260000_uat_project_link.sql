-- ============================================================================
-- DFP COMMAND 06 — PROJECT ↔ UAT CANONICAL RELATIONSHIP
-- ============================================================================
-- Establishes the canonical link between a Digital Footprint project
-- (internal_projects.id) and its UAT project (uat_projects), so the Project
-- Command Centre can show a selected project's filtered UAT view.
--
-- SAFETY / SCOPE:
--   * internal_projects remains the canonical project registry. The link is a
--     soft reference (internal_project_id -> internal_projects.id, bigint),
--     matching the existing internal_project_integrations pattern.
--   * Names, domains and slugs must NOT be used for permanent linking.
--   * No FK constraint is added (internal_projects is platform-managed and may
--     live outside this migration set); an index is created instead.
--   * The column is nullable so existing UAT projects keep working unchanged.
--   * No RLS changes — uat_projects RLS already governs read/write access.
--   * This migration does NOT touch test runs, results, defects, evidence,
--     approvals or reports.
-- ============================================================================

ALTER TABLE public.uat_projects
  ADD COLUMN IF NOT EXISTS internal_project_id bigint;

CREATE INDEX IF NOT EXISTS uat_projects_internal_project_id_idx
  ON public.uat_projects (internal_project_id);

COMMENT ON COLUMN public.uat_projects.internal_project_id IS
  'Canonical DFP project relationship (internal_projects.id). Names/domains/slugs must not be used for permanent linking.';
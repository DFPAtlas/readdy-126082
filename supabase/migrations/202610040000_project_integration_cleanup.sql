-- ============================================================================
-- DFP COMMAND 16A — PROJECT INTEGRATION REGISTRY CLEANUP
-- ============================================================================
-- Consolidates project integration configuration so every Project Command
-- Centre section reads from the SAME canonical record:
--   internal_project_integrations (established in 202609250000).
--
-- This migration is ADDITIVE ONLY. It:
--   * adds GitHub detail columns (owner / url / default branch) that the
--     existing single `github_repository` field could not represent, and
--     a Readdy project URL.
--   * does NOT add a second GitHub/Readdy/Supabase/hosting/DNS/runtime/
--     monitoring registry, and does NOT add any AI site column (AI site
--     ownership remains canonical in AI Operations).
--   * stores identifiers/configuration ONLY — never tokens, keys, or
--     credentials of any kind.
--   * does not modify, delete, or migrate any existing integration data.
-- ============================================================================

ALTER TABLE public.internal_project_integrations
  ADD COLUMN IF NOT EXISTS github_owner text,
  ADD COLUMN IF NOT EXISTS github_url text,
  ADD COLUMN IF NOT EXISTS github_default_branch text,
  ADD COLUMN IF NOT EXISTS readdy_project_url text;
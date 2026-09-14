-- ============================================================================
-- DFP COMMAND 04 — PROJECT INFRASTRUCTURE INTEGRATION
-- ============================================================================
-- Establishes a single per-project integration record that holds the
-- operational infrastructure identity for each Digital Footprint project:
--   Supabase mapping, Production/Staging hosting, DNS, Runtime, Monitoring.
--
-- SAFETY / SCOPE:
--   * No secrets are stored (no service-role keys, passwords, tokens,
--     credentials, SSH keys, or monitoring tokens).
--   * internal_projects remains the canonical project registry; this table
--     relates via project_id -> internal_projects.id (soft reference).
--   * All new fields are nullable so existing projects keep working.
--   * RLS mirrors the Command Centre owner/admin/viewer pattern defined in
--     202608211200_p0_command_centre_rls.sql (internal_role()).
--   * This migration only ADDS a table; it does not modify or delete any
--     existing integration data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.internal_project_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical project relationship (internal_projects.id).
  project_id bigint NOT NULL,

  -- GitHub / Readdy identity (base integration record).
  github_repository text,
  readdy_project_id text,

  -- Supabase project mapping (identity only, never keys).
  supabase_project_ref text,
  supabase_project_name text,
  supabase_dashboard_url text,
  supabase_region text,

  -- Production hosting.
  production_provider text,
  production_url text,
  production_environment_id text,

  -- Staging hosting.
  staging_provider text,
  staging_url text,
  staging_environment_id text,

  -- DNS mapping (identity only, no credentials, no record automation).
  dns_provider text,
  dns_zone text,

  -- Runtime mapping (association only — never start/stop services).
  runtime_node text,
  runtime_environment text,

  -- Monitoring mapping (identity only, no tokens).
  monitoring_provider text,
  monitoring_target text,
  monitoring_dashboard_url text,

  -- Meta.
  infrastructure_notes text,
  infrastructure_status text,
  last_infrastructure_check_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One integration record per project.
CREATE UNIQUE INDEX IF NOT EXISTS internal_project_integrations_project_id_key
  ON public.internal_project_integrations (project_id);

-- ---------------------------------------------------------------------------
-- RLS — same role-aware pattern as the rest of the Command Centre.
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_project_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_project_integrations_select ON public.internal_project_integrations
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_project_integrations_insert ON public.internal_project_integrations
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY internal_project_integrations_update ON public.internal_project_integrations
  FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY internal_project_integrations_delete ON public.internal_project_integrations
  FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner','admin'));
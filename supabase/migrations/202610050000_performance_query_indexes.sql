-- ============================================================================
-- DFP COMMAND 16C — PERFORMANCE + QUERY CLEANUP — DATABASE INDEXES
-- ============================================================================
-- Additive, minimal indexes for the high-frequency project-scoped query paths
-- used by the Project Command Centre, the Projects Portfolio (15A) and the
-- Executive Dashboard (15B).
--
-- Justification (matches actual query patterns, not speculative):
--   * Portfolio bulk loads use  .in('project_id', allIds)  per source table.
--   * Command Centre detail uses .eq('project_id', projectId) per section.
--   * Activity / incidents / deployments are ordered by created_at and capped.
--
-- Every index below uses IF NOT EXISTS and a distinct name, so it is safe to
-- re-run and will never collide with an existing index. No data is changed,
-- no status meanings are touched, and no RLS/authorization is altered.
-- ============================================================================

-- ── internal_bugs ───────────────────────────────────────────────────────────
-- Filtered by project_id (.in/.eq) + ordered by created_at; severity/status
-- also filter in memory. The existing uat/build/support/maintenance FK indexes
-- do NOT cover the project_id path.
CREATE INDEX IF NOT EXISTS internal_bugs_project_id_idx
  ON public.internal_bugs (project_id, created_at DESC);

-- ── internal_activity_log ───────────────────────────────────────────────────
-- Two distinct access patterns:
--   1. by project_id (portfolio + detail .or() clause) ordered by created_at
--   2. by (entity_type = 'project', entity_id) legacy writes
CREATE INDEX IF NOT EXISTS internal_activity_log_project_id_idx
  ON public.internal_activity_log (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS internal_activity_log_entity_idx
  ON public.internal_activity_log (entity_type, entity_id, created_at DESC);

-- ── Monitoring sources ──────────────────────────────────────────────────────
-- Each is queried per-project (.in/.eq project_id); alerts order by time_detected,
-- incidents by created_at.
CREATE INDEX IF NOT EXISTS internal_monitored_websites_project_id_idx
  ON public.internal_monitored_websites (project_id);

CREATE INDEX IF NOT EXISTS internal_supabase_monitors_project_id_idx
  ON public.internal_supabase_monitors (project_id);

CREATE INDEX IF NOT EXISTS internal_monitoring_incidents_project_id_idx
  ON public.internal_monitoring_incidents (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS internal_monitoring_alerts_project_id_idx
  ON public.internal_monitoring_alerts (project_id, time_detected DESC);

-- Global recent-order paths (Executive Dashboard .order('created_at').limit()).
CREATE INDEX IF NOT EXISTS internal_monitoring_incidents_created_at_idx
  ON public.internal_monitoring_incidents (created_at DESC);

-- ── Build process ───────────────────────────────────────────────────────────
-- Runs are filtered by project_id; items by run_id (ordered by item_order).
CREATE INDEX IF NOT EXISTS internal_build_process_runs_project_id_idx
  ON public.internal_build_process_runs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS internal_build_process_run_items_run_id_idx
  ON public.internal_build_process_run_items (run_id, item_order);

-- ── Budget ──────────────────────────────────────────────────────────────────
-- Three project-scoped tables, each filtered by project_id.
CREATE INDEX IF NOT EXISTS internal_project_budgets_project_id_idx
  ON public.internal_project_budgets (project_id);

CREATE INDEX IF NOT EXISTS internal_project_cost_items_project_id_idx
  ON public.internal_project_cost_items (project_id);

CREATE INDEX IF NOT EXISTS internal_project_recurring_costs_project_id_idx
  ON public.internal_project_recurring_costs (project_id);

-- ── Deployments (global recent) ─────────────────────────────────────────────
-- project_id already indexed; this covers the dashboard's global recent-30.
CREATE INDEX IF NOT EXISTS internal_project_deployments_created_at_idx
  ON public.internal_project_deployments (created_at DESC);
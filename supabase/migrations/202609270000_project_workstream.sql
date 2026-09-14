-- ============================================================================
-- DFP COMMAND 07 — PROJECT WORKSTREAM TRACEABILITY
-- ============================================================================
-- Adds minimal, nullable relationship fields so the Project Command Centre can
-- trace work across its four source systems WITHOUT merging them:
--   * internal_bugs        (project bugs)
--   * uat_feedback         (UAT defects)
--   * internal_build_process_run_items (build blockers)
--   * internal_change_requests         (change requests)
--
-- SAFETY / SCOPE:
--   * Every source table remains its own source of truth. No records are
--     moved, merged, deleted or rewritten.
--   * All new columns are nullable so existing records keep working unchanged.
--   * Soft references only (no FK constraints), matching the established
--     internal_project_integrations / uat_project_link pattern. internal_projects
--     and these tables are platform-managed and may live outside this set.
--   * No RLS changes — existing per-table RLS continues to govern access.
--   * No secrets are stored.
-- ============================================================================

-- ── UAT defect → project bug (soft reference) ───────────────────────────────
-- uat_feedback.id is uuid; internal_bugs.id is bigint. A defect is linked to a
-- project bug when an operator deliberately converts it (duplicate protection).
ALTER TABLE public.uat_feedback
  ADD COLUMN IF NOT EXISTS internal_bug_id bigint;

-- ── internal_bugs source provenance ─────────────────────────────────────────
--   source:        'project' | 'uat' | 'build' (which system created this bug)
--   uat_defect_id: uuid string referencing uat_feedback.id
--   build_run_id / build_item_id: reference to internal_build_process_run_items
--   retest_status: null | 'ready_for_retest' | 'retest_passed' | 'retest_failed'
ALTER TABLE public.internal_bugs
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS uat_defect_id text,
  ADD COLUMN IF NOT EXISTS build_run_id bigint,
  ADD COLUMN IF NOT EXISTS build_item_id bigint,
  ADD COLUMN IF NOT EXISTS retest_status text;

-- ── internal_change_requests origin / traceability ──────────────────────────
--   origin:        'manual' | 'bug' | 'uat' (why the request was raised)
--   source_bug_id: references internal_bugs.id when raised from a bug
ALTER TABLE public.internal_change_requests
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS source_bug_id bigint;

-- ── Indexes for relationship lookups ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS uat_feedback_internal_bug_id_idx
  ON public.uat_feedback (internal_bug_id);

CREATE INDEX IF NOT EXISTS internal_bugs_uat_defect_id_idx
  ON public.internal_bugs (uat_defect_id);

CREATE INDEX IF NOT EXISTS internal_bugs_build_item_id_idx
  ON public.internal_bugs (build_item_id);

CREATE INDEX IF NOT EXISTS internal_change_requests_source_bug_id_idx
  ON public.internal_change_requests (source_bug_id);
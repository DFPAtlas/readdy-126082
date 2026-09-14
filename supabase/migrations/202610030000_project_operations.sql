-- ============================================================================
-- DFP COMMAND 14B — PROJECT OPERATIONS — MAINTENANCE + CONTINUOUS IMPROVEMENT
-- ============================================================================
-- Extends the Project Command Centre with a live-project Operations layer so a
-- launched project never becomes a dead record:
--   * internal_project_maintenance  — planned/audit maintenance records
--   * internal_project_reviews      — post-launch / monthly / quarterly /
--                                      incident / maintenance / release reviews
--
-- SAFETY / SCOPE:
--   * Additive only. No existing Command Centre section is changed, and no
--     existing source system (Bugs, Change Requests, Build Process, Monitoring,
--     Budget, Activity) is replaced or rewritten.
--   * Maintenance records are PLANNING / AUDIT records only. They never
--     restart services, deploy code, change DNS, run migrations, execute
--     agents, close bugs, or approve changes.
--   * project_id is bigint (matches internal_projects.id), consistent with the
--     established Command Centre relationship model (soft reference — no hard
--     FK, see DFP Command 09 note).
--   * Technical debt / improvement backlog REUSE internal_change_requests (via
--     the existing free-text `type` + `origin` columns) — no second issue
--     system is created. New soft-reference columns let a maintenance item
--     retain traceability into a Bug / Change Request it discovered.
--   * RLS matches the established internal admin pattern (owner/admin write,
--     any authenticated role read). No public / anonymous access, and review
--     notes are not exposed publicly.
-- ============================================================================

-- ── Maintenance records ─────────────────────────────────────────────────────
-- maintenance_type: PLANNED / SECURITY / INFRASTRUCTURE / DATABASE /
--                   APPLICATION / AI / MONITORING / DEPENDENCY / GENERAL.
-- status:           PLANNED / READY / IN_PROGRESS / COMPLETED / CANCELLED /
--                   OVERDUE / BLOCKED. ("IN_PROGRESS" is stored with an
--                   underscore so the CHECK stays identifier-friendly; the UI
--                   renders it as "In Progress".)
CREATE TABLE IF NOT EXISTS public.internal_project_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  maintenance_type text
    CHECK (maintenance_type IS NULL OR maintenance_type IN
      ('PLANNED','SECURITY','INFRASTRUCTURE','DATABASE','APPLICATION','AI',
       'MONITORING','DEPENDENCY','GENERAL')),
  status text NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','READY','IN_PROGRESS','COMPLETED','CANCELLED',
                      'OVERDUE','BLOCKED')),
  priority text,
  planned_start timestamptz,
  planned_end timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  owner text,
  notes text,
  -- Soft references so a maintenance item retains traceability to the record
  -- it discovered (or the Bug/Change it already relates to).
  related_bug_id bigint,
  related_change_id bigint,
  related_incident_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_project_maintenance_project_id_idx
  ON public.internal_project_maintenance (project_id);

-- ── Review records ──────────────────────────────────────────────────────────
-- review_type: POST_LAUNCH / MONTHLY / QUARTERLY / INCIDENT / MAINTENANCE /
--              RELEASE.
-- status:      DRAFT / IN_PROGRESS / COMPLETED / CANCELLED.
CREATE TABLE IF NOT EXISTS public.internal_project_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL,
  review_type text NOT NULL
    CHECK (review_type IN ('POST_LAUNCH','MONTHLY','QUARTERLY','INCIDENT',
                           'MAINTENANCE','RELEASE')),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED')),
  review_date timestamptz,
  reviewed_by text,
  summary text,
  what_worked text,
  what_failed text,
  lessons_learned text,
  recommended_actions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_project_reviews_project_id_idx
  ON public.internal_project_reviews (project_id);

-- ── Traceability: maintenance → Bug / Change Request (soft references) ─────
-- A maintenance item that discovers a defect can deliberately create a Bug
-- (source='maintenance') or a Change Request (origin='maintenance'), retaining
-- the maintenance id. Columns are nullable so existing records are unaffected.
ALTER TABLE public.internal_bugs
  ADD COLUMN IF NOT EXISTS maintenance_id bigint;

ALTER TABLE public.internal_change_requests
  ADD COLUMN IF NOT EXISTS maintenance_id bigint;

CREATE INDEX IF NOT EXISTS internal_bugs_maintenance_id_idx
  ON public.internal_bugs (maintenance_id);

CREATE INDEX IF NOT EXISTS internal_change_requests_maintenance_id_idx
  ON public.internal_change_requests (maintenance_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Matches the established DFP internal admin pattern. No public / anon access.
ALTER TABLE public.internal_project_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_maint_select ON public.internal_project_maintenance
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_maint_insert ON public.internal_project_maintenance
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_maint_update ON public.internal_project_maintenance
  FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'))
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_maint_delete ON public.internal_project_maintenance
  FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'));

ALTER TABLE public.internal_project_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_review_select ON public.internal_project_reviews
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_review_insert ON public.internal_project_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_review_update ON public.internal_project_reviews
  FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'))
  WITH CHECK (public.internal_role() IN ('owner', 'admin'));

CREATE POLICY internal_review_delete ON public.internal_project_reviews
  FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner', 'admin'));
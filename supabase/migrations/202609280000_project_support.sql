-- ============================================================================
-- DFP COMMAND 09 — PROJECT SUPPORT + INCIDENT TRACEABILITY
-- ============================================================================
-- Connects the existing central Support system into the Project Command Centre
-- WITHOUT rebuilding or merging any source system.
--
-- KEY FINDING (verified against the real schema):
--   * internal_support_tickets.project_id (bigint) already references
--     internal_projects.id — the canonical project ↔ ticket relationship
--     ALREADY EXISTS. No new project registry, no ticket table changes.
--   * Incidents are aggregated at read time from existing support records
--     (critical/urgent open tickets). No new incident table is created.
--
-- This migration ONLY adds minimal, nullable traceability fields so a Support
-- ticket can be deliberately traced into a project bug or change request:
--   * internal_bugs.support_ticket_id              (uuid → internal_support_tickets.id)
--   * internal_change_requests.support_ticket_id   (uuid → internal_support_tickets.id)
--
-- SAFETY / SCOPE:
--   * Every source table remains its own source of truth. Nothing is moved,
--     merged, deleted or rewritten.
--   * New columns are nullable → existing records keep working unchanged.
--   * Soft references only (no FK constraints), matching the established
--     internal_project_integrations / uat_project_link / project_workstream
--     pattern. internal_support_tickets.id is uuid; internal_bugs.id and
--     internal_change_requests.id are bigint — so the reference lives on the
--     bug/change side (uuid) rather than forcing a type-mismatched FK.
--   * No RLS changes — existing per-table RLS continues to govern access.
--   * No secrets stored, no support history touched, no routing altered.
-- ============================================================================

-- ── Support ticket → project bug (soft reference) ──────────────────────────
-- source already supports 'support' (added in DFP Command 07); support_ticket_id
-- retains traceability back to the originating ticket (uuid string).
ALTER TABLE public.internal_bugs
  ADD COLUMN IF NOT EXISTS support_ticket_id uuid;

-- ── Support ticket → change request (soft reference) ───────────────────────
-- origin already supports 'support'; support_ticket_id retains the link back
-- to the originating ticket (uuid string).
ALTER TABLE public.internal_change_requests
  ADD COLUMN IF NOT EXISTS support_ticket_id uuid;

-- ── Indexes for relationship lookups ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS internal_bugs_support_ticket_id_idx
  ON public.internal_bugs (support_ticket_id);

CREATE INDEX IF NOT EXISTS internal_change_requests_support_ticket_id_idx
  ON public.internal_change_requests (support_ticket_id);
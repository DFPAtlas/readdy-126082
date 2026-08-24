-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 16 — AI TICKET TRIAGE + n8n CLASSIFICATION
-- ============================================================================
-- Extends the Prompt 10–15 support platform with AI-assisted ticket triage.
-- AI only RECOMMENDS classification/routing. Existing permissions, site
-- access, routing rules, security rules and SLA logic remain authoritative.
--
-- Database changes:
--   1. support_ticket_triage — triage run history (queued/running/completed/
--      failed/unavailable) with category, priority/team suggestions,
--      confidence, summary, likely issue, suggested diagnostic/response,
--      security flag and staff feedback.
--   2. support_get_ticket_triage(ticket_id)  — list triage runs for a ticket.
--   3. support_tickets_triage_summary()      — latest triage per ticket (inbox).
--   4. support_apply_ai_suggestion(triage_id) — staff applies AI category/
--      priority/team suggestions with server-side validation (priority is
--      never downgraded; invalid/unauthorised teams are ignored).
--   5. support_record_triage_feedback(...)   — [Helpful]/[Not Helpful] +
--      correctness flags.
--   6. support_mark_triage_response_used(...)— audit when a suggested reply is
--      placed into the ticket editor (never auto-sent).
--
-- The server-side n8n dispatch and the signed result callback are two Edge
-- Functions (support-triage-run, support-triage-result). They read
-- N8N_SUPPORT_TRIAGE_URL and N8N_SUPPORT_SHARED_SECRET from Supabase Secrets.
-- The callback HMAC/signing convention matches support-diagnostics-result and
-- support-repair-result (x-dfp-timestamp + x-dfp-signature).
--
-- n8n workflow (conceptual): "DFP Support — AI Ticket Triage"
--   Webhook → verify HMAC → load safe ticket context → AI classification →
--   validate JSON → apply safety checks → signed callback to support-triage-result.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_ticket_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  category text,
  subcategory text,
  suggested_priority text,
  suggested_team_id uuid,
  confidence text,
  confidence_score numeric,
  summary text,
  likely_issue text,
  suggested_action text,
  suggested_diagnostic text,
  suggested_response text,
  security_related boolean NOT NULL DEFAULT false,
  model_provider text,
  requested_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  feedback_helpful boolean,
  feedback_correct_category boolean,
  feedback_correct_team boolean,
  feedback_correct_priority boolean,
  feedback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_triage_status_check
    CHECK (status IN ('queued','running','completed','failed','unavailable'))
);

CREATE INDEX IF NOT EXISTS support_ticket_triage_ticket_idx
  ON public.support_ticket_triage (ticket_id);
CREATE INDEX IF NOT EXISTS support_ticket_triage_created_idx
  ON public.support_ticket_triage (created_at DESC);

ALTER TABLE public.support_ticket_triage ENABLE ROW LEVEL SECURITY;

-- Readable by any internal staff member (viewer included). Writes happen
-- through SECURITY DEFINER RPCs and the service-role edge functions only.
CREATE POLICY support_ticket_triage_select
  ON public.support_ticket_triage FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Audit events written by this feature (support_customer_activity.action /
-- internal_ticket_events.event_type):
--   ai_triage_requested, ai_triage_completed, ai_triage_failed,
--   ai_category_applied, ai_team_applied, ai_priority_applied,
--   ai_response_used, ai_feedback_recorded
-- ---------------------------------------------------------------------------
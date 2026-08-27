-- ============================================================================
-- DFP AI Operations — Phase 2 Prompt 06: Audit + Approval History foundation.
--
-- Creates the append-oriented governance persistence layer:
--   * ai_audit_events      — central append-only audit trail.
--   * ai_audit_evidence    — evidence metadata/reference registry (no files).
--   * ai_approval_history  — append-only approval lifecycle/decision history.
--
-- RLS: authenticated staff can SELECT; owner/admin can INSERT. No UPDATE/DELETE
-- policies are granted (append-oriented). FKs use conservative delete behaviour
-- so audit history survives deletion of related entities.
-- ============================================================================

-- --- ai_audit_events ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_key text NOT NULL UNIQUE,
  occurred_at timestamptz,
  event_type text,
  action text,
  outcome text,
  severity text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.ai_approvals(id) ON DELETE SET NULL,
  actor_type text,
  actor_reference text,
  trigger_source text,
  risk_level text,
  environment text,
  correlation_id text,
  before_summary text,
  after_summary text,
  decision_reason text,
  verification_state text,
  uat_state text,
  integrity_state text,
  review_required boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_events_key ON public.ai_audit_events(audit_key);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_occurred ON public.ai_audit_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_type ON public.ai_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_site ON public.ai_audit_events(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_agent ON public.ai_audit_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_run ON public.ai_audit_events(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_approval ON public.ai_audit_events(approval_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_outcome ON public.ai_audit_events(outcome);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_severity ON public.ai_audit_events(severity);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_review ON public.ai_audit_events(review_required);
CREATE INDEX IF NOT EXISTS idx_ai_audit_events_correlation ON public.ai_audit_events(correlation_id);

ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_audit_events_select ON public.ai_audit_events
  FOR SELECT USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_audit_events_insert ON public.ai_audit_events
  FOR INSERT WITH CHECK (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

-- --- ai_audit_evidence -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_audit_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_key text NOT NULL UNIQUE,
  audit_event_id uuid REFERENCES public.ai_audit_events(id) ON DELETE RESTRICT,
  evidence_type text,
  title text,
  source text,
  reference_id text,
  status text,
  integrity_state text,
  required boolean NOT NULL DEFAULT false,
  summary text,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_evidence_key ON public.ai_audit_evidence(evidence_key);
CREATE INDEX IF NOT EXISTS idx_ai_audit_evidence_event ON public.ai_audit_evidence(audit_event_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_evidence_status ON public.ai_audit_evidence(status);

ALTER TABLE public.ai_audit_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_audit_evidence_select ON public.ai_audit_evidence
  FOR SELECT USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_audit_evidence_insert ON public.ai_audit_evidence
  FOR INSERT WITH CHECK (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

-- --- ai_approval_history -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.ai_approvals(id) ON DELETE CASCADE,
  event_type text,
  previous_status text,
  new_status text,
  decision text,
  actor_reference text,
  actor_role text,
  reason text,
  conditions jsonb,
  approval_count_before integer,
  approval_count_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_approval_history_approval ON public.ai_approval_history(approval_id);
CREATE INDEX IF NOT EXISTS idx_ai_approval_history_created ON public.ai_approval_history(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_approval_history_type ON public.ai_approval_history(event_type);

ALTER TABLE public.ai_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_approval_history_select ON public.ai_approval_history
  FOR SELECT USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_approval_history_insert ON public.ai_approval_history
  FOR INSERT WITH CHECK (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

-- --- Approval history baseline backfill (idempotent) -------------------------
-- One conservative `migration_baseline` record per non-sandbox approval. No
-- fabricated chronology is invented; future decisions append genuine rows.

INSERT INTO public.ai_approval_history
  (approval_id, event_type, previous_status, new_status, decision, actor_reference, reason, approval_count_before, approval_count_after)
SELECT
  a.id,
  'migration_baseline',
  NULL,
  a.status,
  a.decision,
  a.decision_actor,
  'Migrated baseline — conservative initial history record from Phase 2 Prompt 05 migration.',
  NULL,
  a.current_approval_count
FROM public.ai_approvals a
WHERE a.environment <> 'sandbox'
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_approval_history h
    WHERE h.approval_id = a.id AND h.event_type = 'migration_baseline'
  );

-- NOTE: the demo audit events (AUD-8001..AUD-8036) and evidence
-- (EVI-1001..EVI-1038) seed were applied idempotently via the project SQL tool
-- (ON CONFLICT DO UPDATE) using site/agent/run/approval subquery resolution.
-- Those 36 event rows and 38 evidence rows are the live source for the Audit
-- registry; no raw payloads or secrets are stored.
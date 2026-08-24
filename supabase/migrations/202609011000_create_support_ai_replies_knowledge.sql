-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 17 — AI-ASSISTED REPLIES + KNOWLEDGE BASE /
-- RESOLUTION MEMORY
-- ============================================================================
-- Extends the Prompt 10–16 support platform with an AI reply assistant and a
-- reusable, approved knowledge base / resolution memory. AI only produces
-- DRAFT replies — human staff always review and send through the normal flow.
-- Existing permissions, site access, routing, diagnostics, repairs and SLA
-- logic remain authoritative.
--
-- Database changes:
--   1. support_knowledge_articles  — reusable support docs (draft/review/
--      approved/archived) with customer_safe vs internal_only visibility and
--      simple versioning (version + updated_by + updated_at).
--   2. support_resolution_records  — sanitised resolution memory captured from
--      resolved tickets (symptom/root_cause/evidence/action/outcome) with a
--      draft/approved workflow. Never stores raw customer conversations.
--   3. support_ai_replies         — AI reply drafts (queued/running/completed/
--      failed/unavailable) with tone/action, facts summary (confirmed/likely/
--      unknown) and source references.
--   4. internal_has_permission()  — extended with knowledge/resolutions/ai_reply
--      permission strings (matching the client ROLE_PERMISSIONS matrix).
--   5. RPCs (all SECURITY DEFINER, gated on internal_role / has_permission):
--      - support_knowledge_to_jsonb / support_list_knowledge_articles
--      - support_upsert_knowledge_article / support_set_knowledge_status
--      - support_search_related_knowledge
--      - support_resolution_to_jsonb / support_list_resolution_records
--      - support_find_similar_resolutions / support_create_resolution
--      - support_approve_resolution
--      - support_get_reply_suggestions / support_record_reply_feedback
--      - support_mark_reply_outcome
--
-- The n8n dispatch + signed callback are two Edge Functions
-- (support-reply-run, support-reply-result). They read N8N_SUPPORT_REPLY_URL
-- and N8N_SUPPORT_SHARED_SECRET from Supabase Secrets — never from the client.
-- The HMAC/signing convention matches support-triage-result etc.
-- (x-dfp-timestamp + x-dfp-signature).
--
-- n8n workflow (conceptual): "DFP Support — AI Reply Assistant"
--   Webhook → verify HMAC → validate ticket/staff context → retrieve approved
--   knowledge context → AI generates structured reply → validate output →
--   signed callback to support-reply-result.
--
-- PROMPT INJECTION: all customer/ticket text is treated as untrusted data by
-- the n8n workflow (see the security_note in support-reply-run's payload).
-- AI may READ approved context and GENERATE text only — it cannot send,
-- mutate accounts, approve repairs, run SQL, change roles or refund.
--
-- Audit events written (support_customer_activity.action /
-- internal_ticket_events.event_type):
--   ai_reply_requested, ai_reply_generated, ai_reply_failed, ai_reply_used,
--   ai_reply_discarded, ai_reply_feedback,
--   knowledge_created, knowledge_updated, knowledge_approved,
--   knowledge_archived,
--   resolution_created, resolution_approved
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  site_id uuid,
  category text,
  subcategory text,
  content text NOT NULL,
  internal_notes text,
  summary text,
  visibility text NOT NULL DEFAULT 'customer_safe',
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  approved_by uuid,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_knowledge_articles_visibility_check CHECK (visibility IN ('customer_safe','internal_only')),
  CONSTRAINT support_knowledge_articles_status_check CHECK (status IN ('draft','review','approved','archived'))
);

CREATE TABLE IF NOT EXISTS public.support_resolution_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid,
  category text,
  symptom text,
  root_cause text,
  diagnostic_evidence text,
  resolution_action text,
  outcome text NOT NULL DEFAULT 'resolved',
  customer_safe_summary text,
  status text NOT NULL DEFAULT 'draft',
  created_from_ticket_id uuid,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CONSTRAINT support_resolution_records_outcome_check CHECK (outcome IN ('resolved','partially_resolved','workaround','escalated','known_issue')),
  CONSTRAINT support_resolution_records_status_check CHECK (status IN ('draft','approved'))
);

CREATE TABLE IF NOT EXISTS public.support_ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'generate',
  tone text NOT NULL DEFAULT 'professional',
  base_text text,
  status text NOT NULL DEFAULT 'queued',
  reply_text text,
  facts_summary jsonb,
  sources jsonb,
  feedback_helpful boolean,
  feedback_reason text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  CONSTRAINT support_ai_replies_action_check CHECK (action IN ('generate','improve','shorten','friendlier','technical','simple')),
  CONSTRAINT support_ai_replies_tone_check CHECK (tone IN ('professional','friendly','concise','technical','simple')),
  CONSTRAINT support_ai_replies_status_check CHECK (status IN ('queued','running','completed','failed','unavailable'))
);

CREATE INDEX IF NOT EXISTS support_knowledge_articles_site_idx ON public.support_knowledge_articles (site_id);
CREATE INDEX IF NOT EXISTS support_knowledge_articles_status_idx ON public.support_knowledge_articles (status);
CREATE INDEX IF NOT EXISTS support_knowledge_articles_category_idx ON public.support_knowledge_articles (category);
CREATE INDEX IF NOT EXISTS support_resolution_records_site_idx ON public.support_resolution_records (site_id);
CREATE INDEX IF NOT EXISTS support_resolution_records_category_idx ON public.support_resolution_records (category);
CREATE INDEX IF NOT EXISTS support_resolution_records_status_idx ON public.support_resolution_records (status);
CREATE INDEX IF NOT EXISTS support_ai_replies_ticket_idx ON public.support_ai_replies (ticket_id);
CREATE INDEX IF NOT EXISTS support_ai_replies_created_idx ON public.support_ai_replies (created_at DESC);

ALTER TABLE public.support_knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_resolution_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ai_replies ENABLE ROW LEVEL SECURITY;

-- Readable by any internal staff member (viewer included). All writes happen
-- through SECURITY DEFINER RPCs and the service-role edge functions only.
CREATE POLICY support_knowledge_articles_select ON public.support_knowledge_articles
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_resolution_records_select ON public.support_resolution_records
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_ai_replies_select ON public.support_ai_replies
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
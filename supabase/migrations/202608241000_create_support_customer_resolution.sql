-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 10 — CUSTOMER / USER RESOLUTION FOUNDATION
-- ============================================================================
-- Adds the customer-resolution foundation to the existing central support
-- ticket system. This is an EXTENSION, not a replacement: no existing ticket
-- workflow, auth, staff roles, SLA, notes, attachments, audit, email or
-- AI-agent structure is modified.
--
-- Identity sources are REUSED (never duplicated):
--   * customer / user   -> public.profiles   (id, auth_user_id, email, ...)
--   * organisation      -> public.clients    (company_name, trading_name, ...)
--   * products / sites  -> public.client_websites + internal_support_sites
--   * subscriptions     -> public.subscriptions
--   * auth facts        -> auth.users        (email_confirmed_at, last_sign_in_at)
--
-- New foundation tables (conceptual entities from the prompt):
--   1. support_ticket_customer_links  — ticket <-> customer/site/org link +
--                                       resolution status (resolved/partial/
--                                       unresolved/multiple).
--   2. support_customer_activity      — audit log of customer support actions.
--   3. support_diagnostic_runs        — queued n8n diagnostic records.
--
-- Access control follows the existing convention: `internal_role() IS NOT NULL`
-- for read, `internal_role() IN ('owner','admin')` for mutations. No secrets,
-- tokens, password hashes or payment-card data are ever returned or logged.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TICKET <-> CUSTOMER LINK
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_ticket_customer_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id          uuid NOT NULL UNIQUE REFERENCES public.internal_support_tickets(id) ON DELETE CASCADE,
  customer_user_id   uuid,
  customer_name      text,
  customer_email     text,
  organisation_id    uuid,
  organisation_name  text,
  site_id            uuid REFERENCES public.internal_support_sites(id) ON DELETE SET NULL,
  product            text,
  resolution_status  text NOT NULL DEFAULT 'unresolved',
  link_source        text NOT NULL DEFAULT 'auto',
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_customer_links_status_check
    CHECK (resolution_status IN ('resolved','partial','unresolved','multiple')),
  CONSTRAINT support_ticket_customer_links_source_check
    CHECK (link_source IN ('auto','manual'))
);

CREATE INDEX IF NOT EXISTS support_ticket_customer_links_customer_idx
  ON public.support_ticket_customer_links (customer_user_id);
CREATE INDEX IF NOT EXISTS support_ticket_customer_links_org_idx
  ON public.support_ticket_customer_links (organisation_id);

-- ---------------------------------------------------------------------------
-- 2. CUSTOMER SUPPORT ACTIVITY (audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_customer_activity (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id    uuid,
  customer_user_id uuid,
  organisation_id  uuid,
  ticket_id        uuid,
  site_id          uuid,
  action           text NOT NULL,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_customer_activity_customer_idx
  ON public.support_customer_activity (customer_user_id);
CREATE INDEX IF NOT EXISTS support_customer_activity_ticket_idx
  ON public.support_customer_activity (ticket_id);
CREATE INDEX IF NOT EXISTS support_customer_activity_created_idx
  ON public.support_customer_activity (created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. DIAGNOSTIC RUNS (n8n preparation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_diagnostic_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid,
  site_id        uuid,
  user_id        uuid,
  ticket_id      uuid,
  status         text NOT NULL DEFAULT 'queued',
  requested_by   uuid NOT NULL,
  started_at     timestamptz,
  completed_at   timestamptz,
  summary        text,
  result_data    jsonb,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_diagnostic_runs_status_check
    CHECK (status IN ('queued','running','completed','failed','cancelled'))
);

CREATE INDEX IF NOT EXISTS support_diagnostic_runs_customer_idx
  ON public.support_diagnostic_runs (customer_id);
CREATE INDEX IF NOT EXISTS support_diagnostic_runs_status_idx
  ON public.support_diagnostic_runs (status);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_ticket_customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_customer_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_diagnostic_runs ENABLE ROW LEVEL SECURITY;

-- support_ticket_customer_links
CREATE POLICY support_ticket_customer_links_select
  ON public.support_ticket_customer_links FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_ticket_customer_links_insert
  ON public.support_ticket_customer_links FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_ticket_customer_links_update
  ON public.support_ticket_customer_links FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_ticket_customer_links_delete
  ON public.support_ticket_customer_links FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner','admin'));

-- support_customer_activity
CREATE POLICY support_customer_activity_select
  ON public.support_customer_activity FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_customer_activity_insert
  ON public.support_customer_activity FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IS NOT NULL);
CREATE POLICY support_customer_activity_update
  ON public.support_customer_activity FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_customer_activity_delete
  ON public.support_customer_activity FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner','admin'));

-- support_diagnostic_runs
CREATE POLICY support_diagnostic_runs_select
  ON public.support_diagnostic_runs FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);
CREATE POLICY support_diagnostic_runs_insert
  ON public.support_diagnostic_runs FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_diagnostic_runs_update
  ON public.support_diagnostic_runs FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY support_diagnostic_runs_delete
  ON public.support_diagnostic_runs FOR DELETE TO authenticated
  USING (public.internal_role() IN ('owner','admin'));
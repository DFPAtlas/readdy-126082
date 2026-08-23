-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 01 — DATABASE FOUNDATION
-- ============================================================================
-- Creates a central support-ticket system for the Digital Footprint Command
-- Centre: one database that receives and manages support tickets from every
-- Digital Footprint website (Digital-Footprint.uk, The Forge, LetHub.uk,
-- QuickGuard.uk, Wedora, and future sites).
--
-- Scope is strictly ADDITIVE. This migration only creates new objects:
--   * 6 new tables (internal_support_sites, internal_support_tickets,
--     internal_ticket_messages, internal_ticket_attachments,
--     internal_ticket_events, internal_ticket_sla_rules)
--   * helper functions + triggers
--   * indexes + RLS policies
--   * a private storage bucket
--
-- No existing table, page, route, Edge Function, auth flow, or RLS policy is
-- modified. Internal bugs and change-requests remain separate systems.
--
-- ROLE MODEL: reuses the existing public.internal_role() helper
-- (owner/admin/viewer). Owner + admin manage; viewer is read-only.
--
-- FK TYPE NOTES (verified against the real schema):
--   * internal_projects.id  -> bigint  (so project_id is bigint)
--   * client_websites.id    -> uuid    (so website_id is uuid)
--   * assigned_to / customer_user_id are plain uuid (mirrors
--     internal_user_roles.user_id, which references auth.users without a
--     hard FK constraint).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. REGISTERED SUPPORT SITES
--    Registers every website permitted to send tickets into the centre.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_sites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid    REFERENCES public.client_websites(id) ON DELETE SET NULL,
  project_id    bigint  REFERENCES public.internal_projects(id) ON DELETE SET NULL,
  site_name     text    NOT NULL CHECK (char_length(site_name) BETWEEN 1 AND 200),
  site_slug     text    NOT NULL UNIQUE CHECK (char_length(site_slug) BETWEEN 1 AND 100),
  domain        text    CHECK (domain IS NULL OR char_length(domain) <= 255),
  support_email text    CHECK (support_email IS NULL OR char_length(support_email) <= 255),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_support_sites_website_id_idx
  ON public.internal_support_sites (website_id);
CREATE INDEX IF NOT EXISTS internal_support_sites_project_id_idx
  ON public.internal_support_sites (project_id);

-- ---------------------------------------------------------------------------
-- 2. CENTRAL SUPPORT TICKETS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_tickets (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number          text NOT NULL UNIQUE,
  site_id                uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE RESTRICT,
  project_id             bigint REFERENCES public.internal_projects(id) ON DELETE SET NULL,
  external_reference     text CHECK (external_reference IS NULL OR char_length(external_reference) <= 200),
  customer_user_id       uuid,
  customer_name          text CHECK (customer_name IS NULL OR char_length(customer_name) <= 200),
  customer_email         text NOT NULL CHECK (char_length(customer_email) BETWEEN 3 AND 255),
  customer_phone         text CHECK (customer_phone IS NULL OR char_length(customer_phone) <= 50),
  subject                text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 300),
  description            text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 10000),
  category               text NOT NULL CHECK (category IN ('general','technical','account','billing','access','bug','complaint','feature_request','security','other')),
  priority               text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical')),
  status                 text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','in_progress','waiting_on_customer','waiting_on_staff','resolved','closed','spam')),
  source                 text NOT NULL DEFAULT 'website' CHECK (source IN ('website','email','admin','api','ai_agent','import')),
  assigned_to            uuid,
  assigned_agent         text CHECK (assigned_agent IS NULL OR char_length(assigned_agent) <= 200),
  is_unread              boolean NOT NULL DEFAULT true,
  first_response_at      timestamptz,
  resolved_at            timestamptz,
  closed_at              timestamptz,
  last_customer_reply_at timestamptz,
  last_staff_reply_at    timestamptz,
  last_activity_at       timestamptz NOT NULL DEFAULT now(),
  due_at                 timestamptz,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- De-duplication: a given external reference is unique per site.
CREATE UNIQUE INDEX IF NOT EXISTS internal_support_tickets_site_ext_ref_key
  ON public.internal_support_tickets (site_id, external_reference)
  WHERE external_reference IS NOT NULL AND external_reference <> '';

CREATE INDEX IF NOT EXISTS internal_support_tickets_site_id_idx
  ON public.internal_support_tickets (site_id);
CREATE INDEX IF NOT EXISTS internal_support_tickets_project_id_idx
  ON public.internal_support_tickets (project_id);
CREATE INDEX IF NOT EXISTS internal_support_tickets_status_idx
  ON public.internal_support_tickets (status);
CREATE INDEX IF NOT EXISTS internal_support_tickets_priority_idx
  ON public.internal_support_tickets (priority);
CREATE INDEX IF NOT EXISTS internal_support_tickets_assigned_to_idx
  ON public.internal_support_tickets (assigned_to);
CREATE INDEX IF NOT EXISTS internal_support_tickets_customer_email_idx
  ON public.internal_support_tickets (customer_email);
CREATE INDEX IF NOT EXISTS internal_support_tickets_is_unread_idx
  ON public.internal_support_tickets (is_unread);
CREATE INDEX IF NOT EXISTS internal_support_tickets_created_at_idx
  ON public.internal_support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS internal_support_tickets_last_activity_at_idx
  ON public.internal_support_tickets (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS internal_support_tickets_due_at_idx
  ON public.internal_support_tickets (due_at);

-- ---------------------------------------------------------------------------
-- 3. TICKET MESSAGES
--    A customer-facing reply and a private internal staff note are
--    distinguished by is_internal_note.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid NOT NULL REFERENCES public.internal_support_tickets(id) ON DELETE CASCADE,
  sender_type      text NOT NULL CHECK (sender_type IN ('customer','staff','system','ai_agent')),
  sender_user_id   uuid,
  sender_name      text CHECK (sender_name IS NULL OR char_length(sender_name) <= 200),
  sender_email     text CHECK (sender_email IS NULL OR char_length(sender_email) <= 255),
  message_body     text NOT NULL CHECK (char_length(message_body) BETWEEN 1 AND 20000),
  message_format   text NOT NULL DEFAULT 'plain_text',
  is_internal_note boolean NOT NULL DEFAULT false,
  is_read          boolean NOT NULL DEFAULT false,
  email_message_id text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_ticket_messages_ticket_id_idx
  ON public.internal_ticket_messages (ticket_id);
CREATE INDEX IF NOT EXISTS internal_ticket_messages_created_at_idx
  ON public.internal_ticket_messages (created_at);

-- ---------------------------------------------------------------------------
-- 4. TICKET ATTACHMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid NOT NULL REFERENCES public.internal_support_tickets(id) ON DELETE CASCADE,
  message_id          uuid REFERENCES public.internal_ticket_messages(id) ON DELETE SET NULL,
  file_name           text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  storage_path        text NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 1000),
  mime_type           text CHECK (mime_type IS NULL OR char_length(mime_type) <= 255),
  file_size           bigint,
  uploaded_by         uuid,
  is_customer_visible boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_ticket_attachments_ticket_id_idx
  ON public.internal_ticket_attachments (ticket_id);
CREATE INDEX IF NOT EXISTS internal_ticket_attachments_message_id_idx
  ON public.internal_ticket_attachments (message_id);

-- ---------------------------------------------------------------------------
-- 5. TICKET EVENTS (audit)
--    Preserves status changes, assignments, priority changes, replies,
--    reopening, resolution and closure.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES public.internal_support_tickets(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_type    text NOT NULL,
  event_type    text NOT NULL,
  old_value     jsonb,
  new_value     jsonb,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_ticket_events_ticket_id_idx
  ON public.internal_ticket_events (ticket_id);
CREATE INDEX IF NOT EXISTS internal_ticket_events_created_at_idx
  ON public.internal_ticket_events (created_at);

-- ---------------------------------------------------------------------------
-- 6. SLA RULES
--    first_response_minutes / resolution_minutes drive due_at and later
--    response/resolution tracking.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_sla_rules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  priority               text NOT NULL CHECK (priority IN ('low','normal','high','urgent','critical')),
  first_response_minutes integer NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes     integer NOT NULL CHECK (resolution_minutes > 0),
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- One default (site-agnostic) rule per priority.
CREATE UNIQUE INDEX IF NOT EXISTS internal_ticket_sla_rules_default_priority_key
  ON public.internal_ticket_sla_rules (priority) WHERE site_id IS NULL;

CREATE INDEX IF NOT EXISTS internal_ticket_sla_rules_site_id_idx
  ON public.internal_ticket_sla_rules (site_id);

-- Initial default SLA records.
INSERT INTO public.internal_ticket_sla_rules
  (site_id, priority, first_response_minutes, resolution_minutes, is_active)
VALUES
  (NULL, 'low',      1440, 7200, true),
  (NULL, 'normal',    480, 2880, true),
  (NULL, 'high',      240, 1440, true),
  (NULL, 'urgent',     60,  480, true),
  (NULL, 'critical',   30,  240, true)
ON CONFLICT (priority) WHERE site_id IS NULL DO NOTHING;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Concurrency-safe ticket number sequence. One global sequence means numbers
-- never repeat (the year prefix is derived at insert time; the counter keeps
-- incrementing across years, which keeps every number unique).
CREATE SEQUENCE IF NOT EXISTS public.internal_support_ticket_number_seq
  AS bigint START WITH 1;

-- 1) Generic updated_at maintenance.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2) Generate a human-readable, unique ticket number (e.g. DFP-2026-000001).
--    Concurrency-safe: nextval() is atomic and never depends on the browser.
CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'DFP-' || to_char(now(), 'YYYY') || '-' ||
                        lpad(nextval('public.internal_support_ticket_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Touch last_activity_at when a message or event is added.
CREATE OR REPLACE FUNCTION public.touch_ticket_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.internal_support_tickets
     SET last_activity_at = now()
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

-- 4) Set first_response_at only on the FIRST public staff response.
CREATE OR REPLACE FUNCTION public.set_first_response_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sender_type = 'staff' AND NEW.is_internal_note = false THEN
    UPDATE public.internal_support_tickets
       SET first_response_at = COALESCE(first_response_at, now())
     WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Manage resolved/closed timestamps on status change (and clear them on
--    reopen).
CREATE OR REPLACE FUNCTION public.handle_ticket_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('resolved','closed') THEN
    IF NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
  ELSIF OLD.status IN ('resolved','closed') AND NEW.status NOT IN ('resolved','closed') THEN
    -- Reopened: clear resolution/closure timestamps.
    NEW.resolved_at := NULL;
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Calculate due_at from the active SLA rule on create or priority/site change.
CREATE OR REPLACE FUNCTION public.apply_sla_due_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_first_response integer;
BEGIN
  SELECT first_response_minutes INTO v_first_response
    FROM public.internal_ticket_sla_rules
   WHERE priority = NEW.priority
     AND is_active = true
     AND (site_id = NEW.site_id OR site_id IS NULL)
   ORDER BY site_id NULLS LAST
   LIMIT 1;

  IF v_first_response IS NOT NULL THEN
    NEW.due_at := now() + (v_first_response * interval '1 minute');
  ELSE
    NEW.due_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 7) Record important ticket changes (status / priority / assignment) into
--    internal_ticket_events.
CREATE OR REPLACE FUNCTION public.record_ticket_change_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_actor_type text := CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'staff' END;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.internal_ticket_events
        (ticket_id, actor_user_id, actor_type, event_type, old_value, new_value, description)
      VALUES
        (NEW.id, v_actor, v_actor_type, 'status_changed',
         jsonb_build_object('status', OLD.status),
         jsonb_build_object('status', NEW.status),
         CASE
           WHEN NEW.status IN ('resolved','closed') THEN 'Ticket ' || NEW.status
           WHEN OLD.status IN ('resolved','closed') THEN 'Ticket reopened'
           ELSE 'Status changed from ' || OLD.status || ' to ' || NEW.status
         END);
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.internal_ticket_events
        (ticket_id, actor_user_id, actor_type, event_type, old_value, new_value, description)
      VALUES
        (NEW.id, v_actor, v_actor_type, 'priority_changed',
         jsonb_build_object('priority', OLD.priority),
         jsonb_build_object('priority', NEW.priority),
         'Priority changed from ' || OLD.priority || ' to ' || NEW.priority);
    END IF;

    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.internal_ticket_events
        (ticket_id, actor_user_id, actor_type, event_type, old_value, new_value, description)
      VALUES
        (NEW.id, v_actor, v_actor_type, 'assigned',
         jsonb_build_object('assigned_to', OLD.assigned_to),
         jsonb_build_object('assigned_to', NEW.assigned_to),
         'Assignment changed');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- --- Triggers --------------------------------------------------------------

-- internal_support_sites
CREATE TRIGGER trg_support_sites_updated_at
  BEFORE UPDATE ON public.internal_support_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- internal_support_tickets
CREATE TRIGGER trg_tickets_ticket_number
  BEFORE INSERT ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tickets_timestamps
  BEFORE UPDATE ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_timestamps();

CREATE TRIGGER trg_tickets_sla_due
  BEFORE INSERT OR UPDATE OF priority, site_id ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_sla_due_at();

CREATE TRIGGER trg_tickets_events
  AFTER INSERT OR UPDATE ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.record_ticket_change_events();

-- internal_ticket_messages
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON public.internal_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_messages_last_activity
  AFTER INSERT ON public.internal_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ticket_last_activity();

CREATE TRIGGER trg_messages_first_response
  AFTER INSERT ON public.internal_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_first_response_at();

-- internal_ticket_events
CREATE TRIGGER trg_events_last_activity
  AFTER INSERT ON public.internal_ticket_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_ticket_last_activity();

-- internal_ticket_sla_rules
CREATE TRIGGER trg_sla_updated_at
  BEFORE UPDATE ON public.internal_ticket_sla_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
-- Reuses the existing public.internal_role() helper. Owner + admin manage,
-- viewer is read-only. No anonymous access (all policies are TO authenticated).
-- Website ticket creation happens later through a protected Edge Function.

ALTER TABLE public.internal_support_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_sla_rules ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'internal_support_sites',
    'internal_support_tickets',
    'internal_ticket_messages',
    'internal_ticket_attachments',
    'internal_ticket_events',
    'internal_ticket_sla_rules'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL)',
      t || '_cc', t
    );
    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN (''owner'',''admin''))',
      t || '_cc', t
    );
    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.internal_role() IN (''owner'',''admin'')) WITH CHECK (public.internal_role() IN (''owner'',''admin''))',
      t || '_cc', t
    );
    EXECUTE format(
      'CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.internal_role() IN (''owner'',''admin''))',
      t || '_cc', t
    );
  END LOOP;
END $$;

-- ============================================================================
-- STORAGE — PRIVATE ATTACHMENT BUCKET
-- ============================================================================
-- Private bucket (public = false): no public read, no URL guessing. Customer
-- downloads will use short-lived signed URLs issued by the service role.
-- file_size_limit / allowed_mime_types restrict size and block executables.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-ticket-attachments',
  'support-ticket-attachments',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'image/png','image/jpeg','image/gif','image/webp',
    'application/pdf','text/plain','text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;
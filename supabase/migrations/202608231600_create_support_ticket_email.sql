-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 05 — EMAIL NOTIFICATIONS & INBOUND REPLIES (DB)
-- ============================================================================
-- Adds the database-side pieces for the secure email notification workflow:
--   * internal_ticket_notification_preferences — per-user notification toggles
--   * internal_ticket_notifications        — delivery/failure tracking records
--   * internal_ticket_reply_tokens         — signed, expiring inbound reply tokens
--   * internal_ticket_inbound_events       — inbound webhook replay protection
--   * internal_support_site_settings       — per-site customer-notification toggles
--   * internal_upsert_notification_preferences() — save own preferences
--   * internal_add_customer_reply()        — atomic inbound customer message
--   * internal_enqueue_notification()      — idempotent notification enqueue helper
--   * triggers to enqueue staff notifications (new ticket / urgent / assignment /
--     customer reply)
--
-- Strictly ADDITIVE. No existing table, page, route, Edge Function, auth flow,
-- role model, or RLS policy is modified. Builds on Prompts 01-04.
--
-- ROLE MODEL: reuses public.internal_role() (owner/admin/viewer). Preferences
-- are per-user and editable by their owner. Notification delivery records are
-- readable by owner/admin only; all writes happen through SECURITY DEFINER
-- functions / service-role Edge Functions (which bypass RLS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. NOTIFICATION PREFERENCES (per user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_notification_preferences (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE,
  notify_new_ticket      boolean NOT NULL DEFAULT false,
  notify_customer_reply  boolean NOT NULL DEFAULT false,
  notify_assignment      boolean NOT NULL DEFAULT true,
  notify_overdue         boolean NOT NULL DEFAULT false,
  notify_urgent          boolean NOT NULL DEFAULT false,
  daily_summary          boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. NOTIFICATIONS (delivery / failure tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_notifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id          uuid REFERENCES public.internal_support_tickets(id) ON DELETE CASCADE,
  message_id         uuid REFERENCES public.internal_ticket_messages(id) ON DELETE CASCADE,
  recipient_user_id  uuid,
  recipient_email    text NOT NULL CHECK (char_length(recipient_email) BETWEEN 3 AND 320),
  notification_type  text NOT NULL CHECK (notification_type IN (
                       'new_ticket','customer_reply','staff_reply','assignment',
                       'overdue','urgent_ticket','daily_summary'
                     )),
  provider           text,
  provider_message_id text,
  status             text NOT NULL DEFAULT 'queued' CHECK (status IN (
                       'queued','sending','sent','delivered','failed','cancelled'
                     )),
  attempt_count      integer NOT NULL DEFAULT 0,
  last_error_code    text,
  sent_at            timestamptz,
  delivered_at       timestamptz,
  failed_at          timestamptz,
  idempotency_key    text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_ticket_notifications_ticket_id_idx
  ON public.internal_ticket_notifications (ticket_id);
CREATE INDEX IF NOT EXISTS internal_ticket_notifications_recipient_idx
  ON public.internal_ticket_notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS internal_ticket_notifications_status_idx
  ON public.internal_ticket_notifications (status);
CREATE INDEX IF NOT EXISTS internal_ticket_notifications_provider_msg_idx
  ON public.internal_ticket_notifications (provider_message_id);
CREATE INDEX IF NOT EXISTS internal_ticket_notifications_created_idx
  ON public.internal_ticket_notifications (created_at);

-- ---------------------------------------------------------------------------
-- 3. REPLY TOKENS
--    A cryptographically random token scoped to (ticket, customer email),
--    expiring and revocable. Stored ONLY as a hash. Minted by the reply Edge
--    Function, consumed by the inbound webhook. The token never grants ticket
--    read access by itself.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_reply_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES public.internal_support_tickets(id) ON DELETE CASCADE,
  customer_email text NOT NULL CHECK (char_length(customer_email) BETWEEN 3 AND 320),
  token_hash     text NOT NULL UNIQUE CHECK (char_length(token_hash) >= 16),
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_ticket_reply_tokens_ticket_id_idx
  ON public.internal_ticket_reply_tokens (ticket_id);
CREATE INDEX IF NOT EXISTS internal_ticket_reply_tokens_expires_idx
  ON public.internal_ticket_reply_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- 4. INBOUND EVENTS (webhook replay protection)
--    Deduplicates provider inbound events by their provider message id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_inbound_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE CHECK (char_length(provider_message_id) BETWEEN 1 AND 500),
  ticket_id          uuid REFERENCES public.internal_support_tickets(id) ON DELETE SET NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. SITE SETTINGS (customer-facing notification toggles per site)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_site_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                 uuid NOT NULL UNIQUE REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  notify_ticket_received  boolean NOT NULL DEFAULT true,
  notify_staff_reply      boolean NOT NULL DEFAULT true,
  notify_resolved         boolean NOT NULL DEFAULT true,
  notify_closed           boolean NOT NULL DEFAULT false,
  notify_reopened         boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Idempotent notification enqueue helper. Used by the triggers below and the
-- reply/inbound Edge Functions. Stores only the recipient email + type; the
-- unique idempotency_key prevents duplicate records for the same logical send.
CREATE OR REPLACE FUNCTION public.internal_enqueue_notification(
  p_ticket_id          uuid,
  p_message_id         uuid,
  p_recipient_user_id  uuid,
  p_notification_type  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_key   text;
  v_id    uuid;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_recipient_user_id;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  v_key := encode(extensions.digest(
    p_notification_type || ':' || p_ticket_id::text || ':' ||
    COALESCE(p_message_id::text, '') || ':' || lower(v_email),
    'sha256'
  ), 'hex');

  INSERT INTO public.internal_ticket_notifications (
    ticket_id, message_id, recipient_user_id, recipient_email,
    notification_type, idempotency_key, status
  ) VALUES (
    p_ticket_id, p_message_id, p_recipient_user_id, v_email,
    p_notification_type, v_key, 'queued'
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Upsert the caller's own notification preferences. Requires an authenticated
-- internal user (owner/admin/viewer may all manage their OWN preferences).
CREATE OR REPLACE FUNCTION public.internal_upsert_notification_preferences(
  p_notify_new_ticket     boolean,
  p_notify_customer_reply boolean,
  p_notify_assignment     boolean,
  p_notify_overdue        boolean,
  p_notify_urgent         boolean,
  p_daily_summary         boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.internal_role();
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO public.internal_ticket_notification_preferences (
    user_id, notify_new_ticket, notify_customer_reply, notify_assignment,
    notify_overdue, notify_urgent, daily_summary
  ) VALUES (
    auth.uid(), p_notify_new_ticket, p_notify_customer_reply, p_notify_assignment,
    p_notify_overdue, p_notify_urgent, p_daily_summary
  )
  ON CONFLICT (user_id) DO UPDATE SET
    notify_new_ticket     = EXCLUDED.notify_new_ticket,
    notify_customer_reply = EXCLUDED.notify_customer_reply,
    notify_assignment     = EXCLUDED.notify_assignment,
    notify_overdue        = EXCLUDED.notify_overdue,
    notify_urgent         = EXCLUDED.notify_urgent,
    daily_summary         = EXCLUDED.daily_summary,
    updated_at            = now();

  RETURN jsonb_build_object('status', 'saved');
END;
$$;

REVOKE ALL ON FUNCTION public.internal_upsert_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_upsert_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean
) TO authenticated;

-- Atomic inbound customer reply. Service role only. Validates the sender
-- matches the ticket's customer email, creates the customer message, updates
-- activity/unread/timestamps, reopens resolved/closed tickets, and records an
-- audit event. The customer_reply notification is enqueued by the message
-- trigger (trg_enqueue_customer_reply_notification) automatically.
CREATE OR REPLACE FUNCTION public.internal_add_customer_reply(
  p_ticket_id         uuid,
  p_message_body      text,
  p_sender_email      text,
  p_email_message_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket      public.internal_support_tickets%ROWTYPE;
  v_message_id  uuid;
  v_new_status  text;
BEGIN
  SELECT * INTO v_ticket
    FROM public.internal_support_tickets
   WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF p_message_body IS NULL OR btrim(p_message_body) = '' THEN
    RAISE EXCEPTION 'EMPTY_MESSAGE';
  END IF;
  IF char_length(p_message_body) > 20000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG';
  END IF;

  -- The sender must be the ticket's customer (case-insensitive).
  IF lower(COALESCE(p_sender_email, '')) <> lower(v_ticket.customer_email) THEN
    RAISE EXCEPTION 'SENDER_MISMATCH';
  END IF;

  INSERT INTO public.internal_ticket_messages (
    ticket_id, sender_type, sender_name, sender_email, message_body,
    message_format, is_internal_note, is_read, email_message_id
  ) VALUES (
    p_ticket_id, 'customer', v_ticket.customer_name, v_ticket.customer_email,
    btrim(p_message_body), 'plain_text', false, false, NULLIF(p_email_message_id, '')
  )
  RETURNING id INTO v_message_id;

  -- Reopen resolved/closed tickets on customer reply; always mark unread.
  v_new_status := v_ticket.status;
  IF v_ticket.status IN ('resolved','closed') THEN
    v_new_status := 'open';
  END IF;

  UPDATE public.internal_support_tickets
     SET last_customer_reply_at = now(),
         is_unread             = true,
         status                = v_new_status
   WHERE id = p_ticket_id;

  -- Audit event. The status change (reopen) is separately recorded by the
  -- existing record_ticket_change_events trigger.
  INSERT INTO public.internal_ticket_events (
    ticket_id, actor_type, event_type, description
  ) VALUES (
    p_ticket_id, 'customer', 'customer_reply', 'Customer replied via email'
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'message_id', v_message_id,
    'ticket_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.internal_add_customer_reply(uuid, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_add_customer_reply(uuid, text, text, text)
  TO service_role;

-- ============================================================================
-- TRIGGERS — enqueue staff notifications (queued; the worker sends them)
-- ============================================================================

-- New ticket → new_ticket (or urgent_ticket) for owner + admin.
CREATE OR REPLACE FUNCTION public.trg_enqueue_new_ticket_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_type text := CASE WHEN NEW.priority IN ('urgent','critical') THEN 'urgent_ticket' ELSE 'new_ticket' END;
BEGIN
  FOR r IN SELECT user_id FROM public.internal_user_roles WHERE role IN ('owner','admin')
  LOOP
    PERFORM public.internal_enqueue_notification(NEW.id, NULL, r.user_id, v_type);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_new_notify
  AFTER INSERT ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_new_ticket_notifications();

-- Assignment change → assignment notification for the new assignee.
CREATE OR REPLACE FUNCTION public.trg_enqueue_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    PERFORM public.internal_enqueue_notification(NEW.id, NULL, NEW.assigned_to, 'assignment');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_assign_notify
  AFTER UPDATE OF assigned_to ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_assignment_notification();

-- Customer message (that is NOT the ticket's first message) → customer_reply
-- notification for the assigned staff and the owner/admin team.
CREATE OR REPLACE FUNCTION public.trg_enqueue_customer_reply_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r        record;
  v_count  integer;
  v_assign uuid;
BEGIN
  IF NEW.sender_type <> 'customer' OR NEW.is_internal_note THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.internal_ticket_messages
   WHERE ticket_id = NEW.ticket_id;
  IF v_count <= 1 THEN
    RETURN NEW; -- the initial message, not a reply
  END IF;

  SELECT assigned_to INTO v_assign
    FROM public.internal_support_tickets
   WHERE id = NEW.ticket_id;

  IF v_assign IS NOT NULL THEN
    PERFORM public.internal_enqueue_notification(NEW.ticket_id, NEW.id, v_assign, 'customer_reply');
  END IF;

  FOR r IN SELECT user_id FROM public.internal_user_roles WHERE role IN ('owner','admin')
  LOOP
    PERFORM public.internal_enqueue_notification(NEW.ticket_id, NEW.id, r.user_id, 'customer_reply');
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_customer_reply_notify
  AFTER INSERT ON public.internal_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_customer_reply_notification();

-- ============================================================================
-- updated_at maintenance
-- ============================================================================
CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.internal_ticket_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.internal_ticket_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.internal_support_site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.internal_ticket_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_reply_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_support_site_settings ENABLE ROW LEVEL SECURITY;

-- Preferences: each authenticated user manages their own row.
CREATE POLICY internal_notif_prefs_select
  ON public.internal_ticket_notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY internal_notif_prefs_insert
  ON public.internal_ticket_notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY internal_notif_prefs_update
  ON public.internal_ticket_notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY internal_notif_prefs_delete
  ON public.internal_ticket_notification_preferences
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Notification records: owner/admin read only (writes via service role).
CREATE POLICY internal_notifications_select
  ON public.internal_ticket_notifications
  FOR SELECT TO authenticated USING (public.internal_role() IN ('owner','admin'));

-- Site settings: all internal roles read; owner/admin manage.
CREATE POLICY internal_site_settings_select
  ON public.internal_support_site_settings
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_site_settings_insert
  ON public.internal_support_site_settings
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY internal_site_settings_update
  ON public.internal_support_site_settings
  FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));

-- Reply tokens + inbound events: no authenticated access (service role only).
-- RLS is enabled with zero policies, so browser queries get nothing.
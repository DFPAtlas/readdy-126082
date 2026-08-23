-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 03 — CENTRAL TICKET INBOX (DB SUPPORT)
-- ============================================================================
-- Small, additive DB additions needed by the central inbox UI:
--   1. internal_support_tickets.priority_rank  — a generated sort key so the
--      inbox can sort by priority server-side without pulling every row.
--   2. internal_list_staff()                    — staff (owner/admin) options
--      for the "assigned to" filter + assignment dropdown, readable by any
--      authenticated internal user (owner/admin/viewer).
--   3. internal_create_staff_ticket()           — atomic staff-created ticket
--      (source = 'admin') with first customer message + ticket_created event
--      + safe activity-log entry, in one transaction. Owner/admin only.
--
-- No existing table, page, route, Edge Function, auth flow or RLS policy is
-- modified. Builds on the Prompt 01 / 02 foundations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PRIORITY SORT KEY
--    'critical' > 'urgent' > 'high' > 'normal' > 'low'. A generated column so
--    PostgREST can ORDER BY it without an application-side mapping.
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_support_tickets
  ADD COLUMN IF NOT EXISTS priority_rank smallint
  GENERATED ALWAYS AS (
    CASE priority
      WHEN 'critical' THEN 5
      WHEN 'urgent' THEN 4
      WHEN 'high' THEN 3
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 1
      ELSE 0
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS internal_support_tickets_priority_rank_idx
  ON public.internal_support_tickets (priority_rank);

-- ---------------------------------------------------------------------------
-- 2. LIST STAFF (owner/admin)
--    Returns assignable staff members for any authenticated internal user.
--    SECURITY DEFINER so it can read internal_user_roles + auth.users without
--    tripping the tighter RLS that hides other users' role rows from admins.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_list_staff()
RETURNS TABLE (user_id uuid, email text, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.user_id,
         u.email,
         COALESCE((u.raw_user_meta_data->>'full_name')::text,
                  (u.raw_user_meta_data->>'name')::text),
         r.role
  FROM public.internal_user_roles r
  JOIN auth.users u ON u.id = r.user_id
  WHERE r.role IN ('owner','admin')
  ORDER BY CASE r.role WHEN 'owner' THEN 0 ELSE 1 END, u.email ASC;
$$;

REVOKE ALL ON FUNCTION public.internal_list_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_list_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. CREATE STAFF TICKET
--    Atomic: validates the caller is owner/admin + active site + valid enums,
--    then inserts the ticket (triggers assign ticket_number + SLA due_at),
--    the first customer message, a ticket_created event, and a safe
--    activity-log entry. Rolls back entirely on any failure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_create_staff_ticket(
  p_site_id         uuid,
  p_customer_name   text,
  p_customer_email  text,
  p_customer_phone  text,
  p_subject         text,
  p_description     text,
  p_category        text,
  p_priority        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role          text := public.internal_role();
  v_site          public.internal_support_sites%ROWTYPE;
  v_agent         text;
  v_ticket_id     uuid;
  v_ticket_number text;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_site
    FROM public.internal_support_sites
   WHERE id = p_site_id AND is_active = true;
  IF v_site.id IS NULL THEN
    RAISE EXCEPTION 'SITE_INACTIVE';
  END IF;

  IF p_category NOT IN ('general','technical','account','billing','access','bug','complaint','feature_request','security','other') THEN
    RAISE EXCEPTION 'INVALID_CATEGORY';
  END IF;

  IF p_priority NOT IN ('low','normal','high','urgent','critical') THEN
    RAISE EXCEPTION 'INVALID_PRIORITY';
  END IF;

  SELECT email INTO v_agent FROM auth.users WHERE id = auth.uid();

  -- 1. Ticket (BEFORE INSERT triggers assign ticket_number + due_at).
  INSERT INTO public.internal_support_tickets (
    site_id, customer_name, customer_email, customer_phone, subject, description,
    category, priority, status, source, assigned_to, assigned_agent, is_unread
  ) VALUES (
    p_site_id, p_customer_name, p_customer_email, p_customer_phone, p_subject, p_description,
    p_category, p_priority, 'new', 'admin', auth.uid(), v_agent, false
  )
  RETURNING id, ticket_number INTO v_ticket_id, v_ticket_number;

  -- 2. First customer message (conversation thread's first entry).
  INSERT INTO public.internal_ticket_messages (
    ticket_id, sender_type, sender_name, sender_email, message_body, message_format, is_internal_note, is_read
  ) VALUES (
    v_ticket_id, 'customer', p_customer_name, p_customer_email, p_description, 'plain_text', false, false
  );

  -- 3. ticket_created event.
  INSERT INTO public.internal_ticket_events (
    ticket_id, actor_user_id, actor_type, event_type, description
  ) VALUES (
    v_ticket_id, auth.uid(), 'staff', 'ticket_created', 'Ticket created by staff (admin source)'
  );

  -- 4. Safe activity-log entry (no full message body / extra personal data).
  INSERT INTO public.internal_activity_log (
    project_id, description, entity_type, action, metadata
  ) VALUES (
    v_site.project_id,
    'Support ticket ' || v_ticket_number || ' created by staff from ' || v_site.site_name,
    'support_ticket',
    'created',
    jsonb_build_object(
      'ticket_id', v_ticket_id,
      'ticket_number', v_ticket_number,
      'site_id', p_site_id,
      'site_name', v_site.site_name
    )
  );

  RETURN jsonb_build_object('status','created','ticket_id', v_ticket_id, 'ticket_number', v_ticket_number);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_create_staff_ticket(uuid, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_create_staff_ticket(uuid, text, text, text, text, text, text, text) TO authenticated;
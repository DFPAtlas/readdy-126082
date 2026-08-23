-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 04 — TICKET DETAIL & CONVERSATION (DB)
-- ============================================================================
-- Adds the single secure RPC needed by the conversation workspace:
--   internal_add_staff_reply() — atomic staff reply / internal note with
--   correct timestamp, status-transition and audit handling.
--
-- Builds on Prompts 01-03. Strictly ADDITIVE: no existing table, page, route,
-- Edge Function, auth flow or RLS policy is modified.
--
-- ROLE MODEL: reuses public.internal_role() (owner/admin manage, viewer
-- read-only). The function is SECURITY DEFINER and enforces owner/admin at the
-- server boundary, so viewers can never create replies or internal notes even
-- if they call the function directly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.internal_add_staff_reply(
  p_ticket_id        uuid,
  p_message_body     text,
  p_is_internal_note boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role         text := public.internal_role();
  v_ticket       public.internal_support_tickets%ROWTYPE;
  v_sender_name  text;
  v_sender_email text;
  v_message_id   uuid;
  v_new_status   text;
BEGIN
  -- 1. Only owner/admin may reply or add notes.
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- 2. Validate the body (re-checked here, not just in the browser).
  IF p_message_body IS NULL OR btrim(p_message_body) = '' THEN
    RAISE EXCEPTION 'EMPTY_MESSAGE';
  END IF;
  IF char_length(p_message_body) > 20000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG';
  END IF;

  -- 3. Ticket must exist.
  SELECT * INTO v_ticket
    FROM public.internal_support_tickets
   WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  -- 4. Derive the authenticated staff identity (never trust the client).
  SELECT COALESCE((raw_user_meta_data->>'full_name')::text,
                  (raw_user_meta_data->>'name')::text,
                  email) INTO v_sender_name
    FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_sender_email FROM auth.users WHERE id = auth.uid();

  -- 5. Create the message. The BEFORE/AFTER INSERT triggers handle
  --    last_activity_at (touch) and first_response_at (only on the first
  --    public staff reply).
  INSERT INTO public.internal_ticket_messages (
    ticket_id, sender_type, sender_user_id, sender_name, sender_email,
    message_body, message_format, is_internal_note, is_read
  ) VALUES (
    p_ticket_id, 'staff', auth.uid(), v_sender_name, v_sender_email,
    btrim(p_message_body), 'plain_text', p_is_internal_note, false
  )
  RETURNING id INTO v_message_id;

  -- 6. Public reply: set last_staff_reply_at, transition new -> open, mark read.
  --    Internal note: keep the ticket status untouched.
  IF p_is_internal_note = false THEN
    v_new_status := CASE WHEN v_ticket.status = 'new' THEN 'open' ELSE v_ticket.status END;
    UPDATE public.internal_support_tickets
       SET last_staff_reply_at = now(),
           status             = v_new_status,
           is_unread          = false
     WHERE id = p_ticket_id;
  ELSE
    v_new_status := v_ticket.status;
  END IF;

  -- 7. Audit event (distinct event_type for reply vs internal note).
  INSERT INTO public.internal_ticket_events (
    ticket_id, actor_user_id, actor_type, event_type, description
  ) VALUES (
    p_ticket_id, auth.uid(), 'staff',
    CASE WHEN p_is_internal_note THEN 'internal_note_added' ELSE 'staff_reply' END,
    CASE WHEN p_is_internal_note THEN 'Internal note added' ELSE 'Staff reply sent to customer' END
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'message_id', v_message_id,
    'ticket_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.internal_add_staff_reply(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_add_staff_reply(uuid, text, boolean) TO authenticated;
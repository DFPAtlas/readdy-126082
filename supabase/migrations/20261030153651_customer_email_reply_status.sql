CREATE OR REPLACE FUNCTION public.internal_add_customer_reply(p_ticket_id uuid, p_message_body text, p_sender_email text, p_email_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket      public.internal_support_tickets%ROWTYPE;
  v_message_id  uuid;
  v_new_status  text;
BEGIN
  SELECT * INTO v_ticket
    FROM public.internal_support_tickets
   WHERE id = p_ticket_id FOR UPDATE;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF p_message_body IS NULL OR btrim(p_message_body) = '' THEN
    RAISE EXCEPTION 'EMPTY_MESSAGE';
  END IF;
  IF char_length(p_message_body) > 20000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG';
  END IF;

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

  v_new_status := v_ticket.status;
  IF v_ticket.status = 'waiting_on_customer' THEN
    v_new_status := 'waiting_on_staff';
  ELSIF v_ticket.status IN ('resolved','closed') THEN
    v_new_status := 'open';
  END IF;

  UPDATE public.internal_support_tickets
     SET last_customer_reply_at = now(),
         is_unread             = true,
         status                = v_new_status
   WHERE id = p_ticket_id;

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
$function$
;

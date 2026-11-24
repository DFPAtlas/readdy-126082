-- Convert authenticated QuickGuard email intake into staff-review tickets.
-- Email sender identity remains unverified; no customer account is inferred.
ALTER TABLE public.internal_unverified_email_intake
  ADD COLUMN ticket_id uuid REFERENCES public.internal_support_tickets(id) ON DELETE SET NULL,
  ADD COLUMN ticket_created_at timestamptz;

CREATE FUNCTION public.link_quickguard_intake_ticket(p_intake_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_email public.internal_unverified_email_intake%ROWTYPE;
  v_site public.internal_support_sites%ROWTYPE;
  v_ticket uuid;
  v_body text;
  v_metadata jsonb;
BEGIN
  SELECT * INTO v_email FROM public.internal_unverified_email_intake
    WHERE id = p_intake_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE_NOT_FOUND'; END IF;
  IF v_email.site_slug <> 'quickguard' THEN RAISE EXCEPTION 'INVALID_SITE'; END IF;
  IF v_email.ticket_id IS NOT NULL THEN RETURN v_email.ticket_id; END IF;
  IF v_email.verification_status = 'rejected' THEN RETURN NULL; END IF;
  SELECT * INTO v_site FROM public.internal_support_sites
    WHERE site_slug = 'quickguard' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'SITE_INACTIVE'; END IF;
  IF char_length(v_email.sender_email) > 255
     OR v_email.sender_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR lower(v_email.recipient_email) <> 'support@quickguard.uk'
  THEN RAISE EXCEPTION 'INVALID_EMAIL_FIELDS'; END IF;

  -- Preserve the full text in the initial message (ticket description is limited to 10k).
  v_body := coalesce(nullif(btrim(v_email.body_text), ''), '[Email has no plain-text body]');
  v_metadata := jsonb_build_object(
    'intake_id', v_email.id, 'provider_email_id', v_email.provider_message_id,
    'sender_verification', v_email.verification_status,
    'requires_staff_review', true, 'auto_reply_allowed', false,
    'received_at', v_email.received_at, 'recipient_email', v_email.recipient_email
  );
  INSERT INTO public.internal_support_tickets (
    site_id, project_id, external_reference, customer_email,
    subject, description, category, priority, status, source, metadata,
    routing_status, routing_reason
  ) VALUES (
    v_site.id, v_site.project_id, 'quickguard-email:' || v_email.provider_message_id,
    v_email.sender_email,
    '[Unverified email] ' || left(coalesce(nullif(btrim(v_email.subject), ''), '(No subject)'), 280),
    left('Unverified email sender. Staff review required.' || E'\n\n' || v_body, 10000),
    'general', 'normal', 'new', 'email', v_metadata,
    'needs_review', 'Inbound email sender has not been verified'
  ) RETURNING id INTO v_ticket;

  INSERT INTO public.internal_ticket_messages (
    ticket_id, sender_type, sender_email, message_body, message_format,
    is_internal_note, is_read, email_message_id, metadata
  ) VALUES (
    v_ticket, 'customer', v_email.sender_email, left(v_body, 20000), 'plain_text',
    false, false, v_email.provider_message_id, v_metadata
  );
  INSERT INTO public.internal_ticket_events (
    ticket_id, actor_type, event_type, description, new_value
  ) VALUES (
    v_ticket, 'customer', 'ticket_created',
    'Ticket created from unverified QuickGuard email; staff review required',
    jsonb_build_object('source', 'email', 'intake_id', v_email.id, 'sender_verified', false)
  );
  UPDATE public.internal_unverified_email_intake
    SET ticket_id = v_ticket, ticket_created_at = now() WHERE id = v_email.id;
  RETURN v_ticket;
END;
$function$;
REVOKE ALL ON FUNCTION public.link_quickguard_intake_ticket(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_quickguard_intake_ticket(uuid) TO service_role;

CREATE FUNCTION public.trigger_quickguard_intake_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.link_quickguard_intake_ticket(NEW.id);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.trigger_quickguard_intake_ticket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_quickguard_intake_ticket() TO service_role;

CREATE TRIGGER quickguard_intake_create_ticket
AFTER INSERT ON public.internal_unverified_email_intake
FOR EACH ROW WHEN (NEW.site_slug = 'quickguard' AND NEW.verification_status <> 'rejected')
EXECUTE FUNCTION public.trigger_quickguard_intake_ticket();

COMMENT ON FUNCTION public.link_quickguard_intake_ticket(uuid)
IS 'Service-only atomic intake conversion; row lock and existing provider uniqueness prevent duplicate tickets. Does not authenticate sender or send email.';

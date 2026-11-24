-- Run after the quickguard_email_intake_tickets migration. All test writes roll back.
BEGIN;
SET LOCAL ROLE service_role;
DO $test$
DECLARE
  v_id uuid;
  v_ticket uuid;
  v_repeat uuid;
  v_provider text := gen_random_uuid()::text;
  v_count int;
  v_rejected uuid;
BEGIN
  INSERT INTO public.internal_unverified_email_intake
    (site_slug,provider_message_id,sender_email,recipient_email,subject,body_text,received_at)
  VALUES ('quickguard',v_provider,'qg-connection-test@example.com','support@quickguard.uk',
    'Atomic ticket integration test',repeat('x',20000),now()) RETURNING id,ticket_id INTO v_id,v_ticket;
  -- AFTER triggers do not change INSERT RETURNING, so read committed row state.
  SELECT ticket_id INTO v_ticket FROM public.internal_unverified_email_intake WHERE id=v_id;
  IF v_ticket IS NULL THEN RAISE EXCEPTION 'TEST: missing ticket'; END IF;
  SELECT count(*) INTO v_count FROM public.internal_support_tickets
    WHERE id=v_ticket AND source='email' AND status='new' AND routing_status='needs_review'
      AND customer_user_id IS NULL AND metadata->>'sender_verification'='unverified';
  IF v_count<>1 THEN RAISE EXCEPTION 'TEST: invalid ticket state'; END IF;
  SELECT count(*) INTO v_count FROM public.internal_ticket_messages
    WHERE ticket_id=v_ticket AND char_length(message_body)=20000 AND message_format='plain_text'
      AND is_internal_note=false;
  IF v_count<>1 THEN RAISE EXCEPTION 'TEST: full original message not preserved'; END IF;
  v_repeat := public.link_quickguard_intake_ticket(v_id);
  IF v_repeat<>v_ticket THEN RAISE EXCEPTION 'TEST: retry changed ticket'; END IF;
  INSERT INTO public.internal_unverified_email_intake
    (site_slug,provider_message_id,sender_email,recipient_email,subject,body_text,received_at)
  VALUES ('quickguard',v_provider,'qg-connection-test@example.com','support@quickguard.uk',
    'duplicate','duplicate',now()) ON CONFLICT(site_slug,provider_message_id) DO NOTHING;
  SELECT count(*) INTO v_count FROM public.internal_support_tickets
    WHERE external_reference='quickguard-email:'||v_provider;
  IF v_count<>1 THEN RAISE EXCEPTION 'TEST: duplicate ticket'; END IF;

  INSERT INTO public.internal_unverified_email_intake
    (site_slug,provider_message_id,sender_email,recipient_email,subject,body_text,received_at,verification_status)
  VALUES ('quickguard',gen_random_uuid()::text,'qg-connection-test@example.com','support@quickguard.uk',
    'Rejected test','Rejected',now(),'rejected') RETURNING id INTO v_rejected;
  IF public.link_quickguard_intake_ticket(v_rejected) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST: rejected intake converted';
  END IF;
  IF has_function_privilege('anon','public.link_quickguard_intake_ticket(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.link_quickguard_intake_ticket(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'TEST: public conversion access';
  END IF;
END;
$test$;
ROLLBACK;
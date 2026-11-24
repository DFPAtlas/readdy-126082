-- Requires an existing QuickGuard ticket. All writes are rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $test$
DECLARE
  v_ticket uuid;
  v_email text;
  v_status text;
  v_expected text;
  v_result jsonb;
BEGIN
  SELECT t.id,t.customer_email INTO v_ticket,v_email
    FROM public.internal_support_tickets t
    JOIN public.internal_support_sites s ON s.id=t.site_id
    WHERE s.site_slug='quickguard' ORDER BY t.created_at DESC LIMIT 1;
  IF v_ticket IS NULL THEN RAISE EXCEPTION 'TEST requires a QuickGuard ticket'; END IF;
  FOREACH v_status IN ARRAY ARRAY['waiting_on_customer','resolved','closed','in_progress','waiting_on_staff','spam']
  LOOP
    UPDATE public.internal_support_tickets SET status=v_status WHERE id=v_ticket;
    v_result := public.internal_add_customer_reply(v_ticket,'Reply status regression test',
      v_email,gen_random_uuid()::text);
    v_expected := CASE WHEN v_status='waiting_on_customer' THEN 'waiting_on_staff'
      WHEN v_status IN ('resolved','closed') THEN 'open' ELSE v_status END;
    IF (SELECT status FROM public.internal_support_tickets WHERE id=v_ticket) <> v_expected
      OR v_result->>'ticket_status' <> v_expected THEN
      RAISE EXCEPTION 'TEST failed for status %',v_status;
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.internal_add_customer_reply(v_ticket,'Wrong sender test','wrong-sender@example.invalid',gen_random_uuid()::text);
    RAISE EXCEPTION 'TEST: sender mismatch accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'SENDER_MISMATCH' THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK;
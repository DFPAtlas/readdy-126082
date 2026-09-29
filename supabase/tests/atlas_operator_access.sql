-- Synthetic fixtures only. Run in an isolated schema restored from production.
-- All fixtures and checks roll back. Never run this on production.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.internal_user_roles) OR EXISTS (SELECT 1 FROM public.internal_support_tickets) OR EXISTS (SELECT 1 FROM public.ai_sites) THEN
  RAISE EXCEPTION 'Refusing access test: target must be an empty, isolated schema restore';
 END IF;
END $$;
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id,email) SELECT md5('atlas-test-'||name)::uuid,name||'@example.invalid' FROM unnest(ARRAY['owner','admin','assigned','unassigned','disabled']) name;
INSERT INTO public.internal_user_roles(user_id,role,status) SELECT md5('atlas-test-'||name)::uuid,CASE WHEN name IN ('owner','admin') THEN name ELSE 'viewer' END,CASE WHEN name='disabled' THEN 'disabled' ELSE 'active' END FROM unnest(ARRAY['owner','admin','assigned','unassigned','disabled']) name;
INSERT INTO public.ai_sites(id,site_key,name) SELECT md5('atlas-test-group-'||name)::uuid,'atlas-test-'||name,'Atlas test '||name FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.internal_support_sites(id,site_name,site_slug,ai_site_id) SELECT md5('atlas-test-site-'||name)::uuid,'Atlas test '||name,'atlas-test-'||name,md5('atlas-test-group-'||name)::uuid FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.internal_staff_site_access(user_id,site_id) SELECT md5('atlas-test-'||name)::uuid,md5('atlas-test-site-a')::uuid FROM unnest(ARRAY['assigned','disabled']) name;
INSERT INTO public.internal_support_tickets(id,ticket_number,site_id,customer_name,customer_email,customer_phone,subject,description,category) SELECT md5('atlas-test-ticket-'||name)::uuid,'ATLAS-TEST-'||name,md5('atlas-test-site-'||name)::uuid,'Test Customer '||name,name||'@example.invalid','07700900001','Synthetic access test','Synthetic fixture','technical' FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.internal_ticket_messages(ticket_id,sender_type,message_body) SELECT md5('atlas-test-ticket-'||name)::uuid,'customer','Synthetic message' FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.internal_ticket_attachments(ticket_id,file_name,storage_path) SELECT md5('atlas-test-ticket-'||name)::uuid,'test.txt','atlas-test/'||name FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.internal_ticket_events(ticket_id,actor_type,event_type) SELECT md5('atlas-test-ticket-'||name)::uuid,'system','test' FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.support_ticket_customer_links(ticket_id,customer_email) SELECT md5('atlas-test-ticket-'||name)::uuid,name||'@example.invalid' FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.operator_pads(id,pad_key,label,assigned_user_id,status) VALUES(md5('atlas-test-pad')::uuid,'atlas-test-pad','Synthetic pad',md5('atlas-test-assigned')::uuid,'active');
INSERT INTO public.operator_pad_sites(pad_id,ai_site_id) SELECT md5('atlas-test-pad')::uuid,md5('atlas-test-group-'||name)::uuid FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.operator_interactions(id,ai_site_id,correlation_id,support_ticket_id) SELECT md5('atlas-test-interaction-'||name)::uuid,md5('atlas-test-group-'||name)::uuid,'atlas-test-'||name,md5('atlas-test-ticket-'||name)::uuid FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.operator_ai_handoffs(interaction_id,summary) SELECT md5('atlas-test-interaction-'||name)::uuid,'Synthetic handoff' FROM unnest(ARRAY['a','b']) name;
INSERT INTO public.pbx_tenants(id,reference,name,ai_site_id) VALUES(md5('atlas-test-tenant-b')::uuid,'atlas-test-tenant-b','Synthetic PBX',md5('atlas-test-group-b')::uuid);
INSERT INTO public.pbx_call_logs(id,tenant_id,from_number,to_number,start_time) VALUES(md5('atlas-test-call-b')::uuid,md5('atlas-test-tenant-b')::uuid,'07700900001','07700900002',now());
SET LOCAL session_replication_role = origin;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.operator_interactions(ai_site_id,correlation_id,support_ticket_id) VALUES(md5('atlas-test-group-a')::uuid,'bad-ticket',md5('atlas-test-ticket-b')::uuid);
    RAISE EXCEPTION 'TEST FAIL: cross-site ticket accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Support ticket does not belong%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.operator_interactions(ai_site_id,correlation_id,pbx_call_log_id) VALUES(md5('atlas-test-group-a')::uuid,'bad-call',md5('atlas-test-call-b')::uuid);
    RAISE EXCEPTION 'TEST FAIL: cross-site call accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PBX call does not belong%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.operator_interactions(ai_site_id,correlation_id) VALUES(md5('atlas-test-group-a')::uuid,'atlas-test-a');
    RAISE EXCEPTION 'TEST FAIL: duplicate interaction accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.operator_pad_sites(pad_id,ai_site_id) VALUES(md5('atlas-test-pad')::uuid,md5('atlas-test-group-a')::uuid);
    RAISE EXCEPTION 'TEST FAIL: duplicate assignment accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE who text; expected integer; actual integer; rel text; BEGIN
 FOREACH who IN ARRAY ARRAY['owner','admin','assigned','unassigned','disabled'] LOOP
  PERFORM set_config('request.jwt.claim.sub',md5('atlas-test-'||who)::uuid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',md5('atlas-test-'||who)::uuid,'role','authenticated')::text,true);
  expected := CASE WHEN who IN ('owner','admin') THEN 2 WHEN who='assigned' THEN 1 ELSE 0 END;
  FOREACH rel IN ARRAY ARRAY['internal_support_sites','internal_support_tickets','internal_ticket_messages','internal_ticket_attachments','internal_ticket_events','support_ticket_customer_links','operator_pad_sites','operator_interactions','operator_ai_handoffs'] LOOP
   EXECUTE format('SELECT count(*) FROM public.%I',rel) INTO actual;
   IF actual<>expected THEN RAISE EXCEPTION 'TEST FAIL: % sees % rows in %, expected %',who,actual,rel,expected; END IF;
  END LOOP;
  SELECT count(*) INTO actual FROM public.operator_pads;
  IF actual <> (CASE WHEN who IN ('owner','admin','assigned') THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'TEST FAIL: % pad visibility',who; END IF;
  SELECT count(*) INTO actual FROM public.operator_search_site_ticket_customers(md5('atlas-test-site-a')::uuid,'example');
  IF actual <> (CASE WHEN who IN ('owner','admin','assigned') THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'TEST FAIL: % customer search',who; END IF;
  IF who NOT IN ('owner','admin') AND public.operator_get_site_ticket_context(md5('atlas-test-site-b')::uuid,md5('atlas-test-ticket-b')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'TEST FAIL: % sees foreign ticket context',who; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',md5('atlas-test-assigned')::uuid::text,true);
 IF (SELECT count(*) FROM public.operator_search_site_ticket_customers(md5('atlas-test-site-b')::uuid,'b@example.invalid'))<>0 THEN RAISE EXCEPTION 'TEST FAIL: known foreign email visible'; END IF;
 IF public.operator_get_site_ticket_context(md5('atlas-test-site-a')::uuid,md5('atlas-test-ticket-a')::uuid)->>'customer_email' <> 'a@example.invalid' THEN RAISE EXCEPTION 'TEST FAIL: assigned contact unavailable'; END IF;
 BEGIN
  INSERT INTO public.operator_pads(pad_key,label) VALUES('unauthorised-pad','Forbidden');
  RAISE EXCEPTION 'TEST FAIL: viewer can manage pads';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE rel text; BEGIN
 FOREACH rel IN ARRAY ARRAY['operator_pads','operator_pad_sites','operator_interactions','operator_ai_handoffs'] LOOP
  IF has_table_privilege('anon','public.'||rel,'SELECT') THEN RAISE EXCEPTION 'TEST FAIL: anon table grant %',rel; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.operator_search_site_ticket_customers(uuid,text,integer)','EXECUTE') OR has_function_privilege('anon','public.operator_get_site_ticket_context(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAIL: anon RPC grant'; END IF;
END $$;
SELECT 'PASS: roles, child records, lookup isolation, anonymous grants, cross-site links, uniqueness and viewer writes' AS result;
ROLLBACK;

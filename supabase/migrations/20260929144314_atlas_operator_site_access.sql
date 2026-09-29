-- Restrict central support reads to the site's assigned staff. Owner/admin
-- retain their current global access. Existing write policies are unchanged.
-- All site-specific children derive access from their parent ticket.

create or replace function public.operator_can_access_support_site(p_site_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.internal_user_roles r
    where r.user_id = auth.uid() and r.status = 'active'
      and (
        r.role in ('owner','admin') or exists (
          select 1 from public.internal_staff_site_access access
          where access.user_id = r.user_id and access.site_id = p_site_id
        ))
  );
$$;
revoke all on function public.operator_can_access_support_site(uuid) from public, anon;
grant execute on function public.operator_can_access_support_site(uuid) to authenticated;

create or replace function public.operator_can_access_ticket(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.internal_support_tickets ticket
    where ticket.id = p_ticket_id
      and public.operator_can_access_support_site(ticket.site_id)
  );
$$;
revoke all on function public.operator_can_access_ticket(uuid) from public, anon;
grant execute on function public.operator_can_access_ticket(uuid) to authenticated;

drop policy if exists internal_support_sites_cc_select on public.internal_support_sites;
create policy internal_support_sites_cc_select on public.internal_support_sites
for select to authenticated using (public.operator_can_access_support_site(id));

drop policy if exists internal_support_tickets_cc_select on public.internal_support_tickets;
create policy internal_support_tickets_cc_select on public.internal_support_tickets
for select to authenticated using (public.operator_can_access_support_site(site_id));

drop policy if exists internal_ticket_messages_cc_select on public.internal_ticket_messages;
create policy internal_ticket_messages_cc_select on public.internal_ticket_messages
for select to authenticated using (public.operator_can_access_ticket(ticket_id));

drop policy if exists internal_ticket_attachments_cc_select on public.internal_ticket_attachments;
create policy internal_ticket_attachments_cc_select on public.internal_ticket_attachments
for select to authenticated using (public.operator_can_access_ticket(ticket_id));

drop policy if exists internal_ticket_events_cc_select on public.internal_ticket_events;
create policy internal_ticket_events_cc_select on public.internal_ticket_events
for select to authenticated using (public.operator_can_access_ticket(ticket_id));

drop policy if exists support_ticket_customer_links_select on public.support_ticket_customer_links;
create policy support_ticket_customer_links_select on public.support_ticket_customer_links
for select to authenticated using (public.operator_can_access_ticket(ticket_id));

-- The pad must never call the legacy global customer search/360 RPCs. Those
-- security-definer functions authorise by staff role, not by support site.
-- This lookup exposes only customers already associated with a visible ticket.
create or replace function public.operator_search_site_ticket_customers(
  p_site_id uuid, p_query text, p_limit integer default 20
)
returns table(ticket_id uuid, customer_name text, masked_email text, masked_phone text)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.customer_name,
    case when position('@' in t.customer_email) > 1
      then left(t.customer_email, 1) || '***' || substring(t.customer_email from position('@' in t.customer_email))
      else null end,
    case when length(regexp_replace(coalesce(t.customer_phone, ''), '[^0-9]', '', 'g')) >= 4
      then '••••' || right(regexp_replace(t.customer_phone, '[^0-9]', '', 'g'), 4)
      else null end
  from public.internal_support_tickets t
  where (select auth.uid()) is not null
    and public.operator_can_access_support_site(p_site_id)
    and t.site_id = p_site_id
    and length(trim(coalesce(p_query, ''))) >= 3
    and (
      lower(coalesce(t.customer_name, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(t.customer_email) like '%' || lower(trim(p_query)) || '%'
      or regexp_replace(coalesce(t.customer_phone, ''), '[^0-9]', '', 'g')
         like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%'
         and length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 4
    )
  order by t.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
$$;
revoke all on function public.operator_search_site_ticket_customers(uuid,text,integer) from public, anon;
grant execute on function public.operator_search_site_ticket_customers(uuid,text,integer) to authenticated;

-- Full contact information is returned only for a ticket the operator can
-- already read. The UI must still verify the caller before opening it.
create or replace function public.operator_get_site_ticket_context(p_site_id uuid, p_ticket_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'ticket_id', t.id, 'site_id', t.site_id, 'customer_name', t.customer_name,
    'customer_email', t.customer_email, 'customer_phone', t.customer_phone,
    'subject', t.subject, 'status', t.status, 'priority', t.priority
  )
  from public.internal_support_tickets t
  where (select auth.uid()) is not null
    and public.operator_can_access_support_site(p_site_id)
    and t.site_id = p_site_id and t.id = p_ticket_id;
$$;
revoke all on function public.operator_get_site_ticket_context(uuid,uuid) from public, anon;
grant execute on function public.operator_get_site_ticket_context(uuid,uuid) to authenticated;

-- Existing ticket account panel must enforce the same site boundary before
-- reading account records or automatically resolving a customer link.
CREATE OR REPLACE FUNCTION "public"."support_get_ticket_account"("p_ticket_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_role text := public.internal_role();
  v_link public.support_ticket_customer_links%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_org public.clients%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_email_confirmed_at timestamptz;
  v_last_sign_in_at timestamptz;
  v_auth_created_at timestamptz;
  v_products jsonb;
BEGIN
  IF v_role IS NULL OR NOT public.operator_can_access_ticket(p_ticket_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_link FROM public.support_ticket_customer_links WHERE ticket_id = p_ticket_id;
  IF v_link.id IS NULL THEN
    PERFORM public.support_resolve_ticket_customer(p_ticket_id, 'auto_resolve');
    SELECT * INTO v_link FROM public.support_ticket_customer_links WHERE ticket_id = p_ticket_id;
  END IF;

  IF v_link.customer_user_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_link.customer_user_id;
  END IF;

  IF v_profile.auth_user_id IS NOT NULL THEN
    SELECT u.email_confirmed_at, u.last_sign_in_at, u.created_at
      INTO v_email_confirmed_at, v_last_sign_in_at, v_auth_created_at
      FROM auth.users u WHERE u.id = v_profile.auth_user_id;
  END IF;

  IF v_link.organisation_id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.clients WHERE id = v_link.organisation_id;
  END IF;

  v_products := NULL;
  IF v_org.id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
             'id', w.id, 'name', w.name, 'primary_domain', w.primary_domain, 'status', w.status
           ) ORDER BY w.name)
      INTO v_products
      FROM public.client_websites w
     WHERE w.client_id = v_org.id;
  END IF;

  IF v_org.id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.subscriptions s WHERE s.client_id = v_org.id ORDER BY s.created_at DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ticket_id', p_ticket_id,
    'resolution_status', v_link.resolution_status,
    'link_source', v_link.link_source,
    'customer', jsonb_build_object(
      'customer_id', v_link.customer_user_id,
      'name', coalesce(v_profile.full_name, v_link.customer_name),
      'email', coalesce(v_profile.email, v_link.customer_email),
      'role', v_profile.role,
      'status', v_profile.status,
      'email_verified', CASE WHEN v_email_confirmed_at IS NOT NULL THEN true WHEN v_profile.id IS NOT NULL THEN false ELSE NULL END,
      'last_login', v_last_sign_in_at,
      'created_at', coalesce(v_profile.created_at, v_auth_created_at)
    ),
    'organisation', CASE WHEN v_org.id IS NOT NULL THEN jsonb_build_object(
      'id', v_org.id, 'name', coalesce(v_org.trading_name, v_org.company_name),
      'status', v_org.status, 'client_reference', v_org.client_reference
    ) ELSE NULL END,
    'source_site', jsonb_build_object('site_id', v_link.site_id, 'product', v_link.product),
    'products', v_products,
    'subscription', CASE WHEN v_sub.id IS NOT NULL THEN jsonb_build_object(
      'id', v_sub.id, 'name', v_sub.name, 'status', v_sub.status,
      'customer_reference', v_sub.stripe_subscription_id, 'billing_state', v_sub.billing_cycle
    ) ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.support_get_ticket_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_ticket_account(uuid) TO authenticated;

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

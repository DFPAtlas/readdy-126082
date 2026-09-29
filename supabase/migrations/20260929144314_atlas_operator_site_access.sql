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

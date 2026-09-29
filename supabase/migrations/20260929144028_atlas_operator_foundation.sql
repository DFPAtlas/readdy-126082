-- Atlas Operator Console foundation. Additive: no live PBX routing or data import.
-- ai_sites is the group registry; support and PBX records retain their own IDs.

alter table public.internal_support_sites
  add column if not exists ai_site_id uuid references public.ai_sites(id) on delete restrict;
create unique index if not exists internal_support_sites_ai_site_id_key
  on public.internal_support_sites(ai_site_id) where ai_site_id is not null;

-- Only exact, unambiguous keys are linked. Future site onboarding is explicit.
update public.internal_support_sites s set ai_site_id = a.id
from public.ai_sites a
where s.ai_site_id is null and s.site_slug = a.site_key
  and not exists (
    select 1 from public.internal_support_sites other
    where other.id <> s.id and other.ai_site_id = a.id
  );

alter table public.pbx_tenants
  add column if not exists ai_site_id uuid references public.ai_sites(id) on delete restrict;
create unique index if not exists pbx_tenants_ai_site_id_key
  on public.pbx_tenants(ai_site_id) where ai_site_id is not null;

create table if not exists public.operator_pads (
  id uuid primary key default gen_random_uuid(),
  pad_key text not null unique check (char_length(pad_key) between 3 and 100),
  label text not null check (char_length(label) between 1 and 120),
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'inactive' check (status in ('inactive','active','disabled')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operator_pads_assigned_user_idx on public.operator_pads(assigned_user_id);

create table if not exists public.operator_pad_sites (
  pad_id uuid not null references public.operator_pads(id) on delete cascade,
  ai_site_id uuid not null references public.ai_sites(id) on delete restrict,
  is_favourite boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (pad_id, ai_site_id)
);
create index if not exists operator_pad_sites_site_idx on public.operator_pad_sites(ai_site_id);

create table if not exists public.operator_interactions (
  id uuid primary key default gen_random_uuid(),
  ai_site_id uuid not null references public.ai_sites(id) on delete restrict,
  correlation_id text not null check (char_length(correlation_id) between 1 and 200),
  pbx_call_log_id uuid references public.pbx_call_logs(id) on delete set null,
  support_ticket_id uuid references public.internal_support_tickets(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  state text not null default 'pending' check (state in ('pending','ringing','active','wrap_up','closed','failed')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ai_site_id, correlation_id)
);
create index if not exists operator_interactions_assignee_idx
  on public.operator_interactions(assigned_user_id, created_at desc);
create index if not exists operator_interactions_ticket_idx
  on public.operator_interactions(support_ticket_id) where support_ticket_id is not null;

-- A linked ticket or call must belong to the same group site. The phone
-- service may create the interaction before either linked row is available.
create or replace function public.operator_validate_interaction_links()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.support_ticket_id is not null and not exists (
    select 1 from public.internal_support_tickets ticket
    join public.internal_support_sites site on site.id = ticket.site_id
    where ticket.id = new.support_ticket_id and site.ai_site_id = new.ai_site_id
  ) then
    raise exception 'Support ticket does not belong to interaction site';
  end if;
  if new.pbx_call_log_id is not null and not exists (
    select 1 from public.pbx_call_logs call
    join public.pbx_tenants tenant on tenant.id = call.tenant_id
    where call.id = new.pbx_call_log_id and tenant.ai_site_id = new.ai_site_id
  ) then
    raise exception 'PBX call does not belong to interaction site';
  end if;
  return new;
end;
$$;
revoke all on function public.operator_validate_interaction_links() from public, anon, authenticated;
create trigger operator_interactions_validate_links
before insert or update of ai_site_id, support_ticket_id, pbx_call_log_id
on public.operator_interactions for each row
execute function public.operator_validate_interaction_links();

create table if not exists public.operator_ai_handoffs (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.operator_interactions(id) on delete cascade,
  reason text,
  summary text not null check (char_length(summary) between 1 and 4000),
  facts jsonb not null default '[]'::jsonb check (jsonb_typeof(facts) = 'array'),
  promises jsonb not null default '[]'::jsonb check (jsonb_typeof(promises) = 'array'),
  next_action text,
  transcript_reference text,
  source text not null default 'ai_agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A pad registration is descriptive, never a bearer credential. This helper
-- checks active internal staff membership and the existing site assignment.
create or replace function public.operator_can_access_site(p_ai_site_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.internal_user_roles r
    where r.user_id = auth.uid() and r.status = 'active'
      and (
        r.role in ('owner','admin')
        or exists (
          select 1 from public.internal_staff_site_access access
          join public.internal_support_sites site on site.id = access.site_id
          where access.user_id = r.user_id and site.ai_site_id = p_ai_site_id
        )
      )
  );
$$;
revoke all on function public.operator_can_access_site(uuid) from public, anon;
grant execute on function public.operator_can_access_site(uuid) to authenticated;

alter table public.operator_pads enable row level security;
alter table public.operator_pad_sites enable row level security;
alter table public.operator_interactions enable row level security;
alter table public.operator_ai_handoffs enable row level security;

create policy operator_pads_read on public.operator_pads for select to authenticated
  using (public.internal_role() in ('owner','admin') or
    (status = 'active' and public.internal_role() is not null
      and assigned_user_id = (select auth.uid())));
create policy operator_pads_manage on public.operator_pads for all to authenticated
  using (public.internal_role() in ('owner','admin'))
  with check (public.internal_role() in ('owner','admin'));

create policy operator_pad_sites_read on public.operator_pad_sites for select to authenticated
  using (exists (
    select 1 from public.operator_pads pad
    where pad.id = pad_id and
      (public.internal_role() in ('owner','admin') or
       (pad.status = 'active' and public.internal_role() is not null
        and pad.assigned_user_id = (select auth.uid())
        and public.operator_can_access_site(ai_site_id)))
  ));
create policy operator_pad_sites_manage on public.operator_pad_sites for all to authenticated
  using (public.internal_role() in ('owner','admin'))
  with check (public.internal_role() in ('owner','admin'));

create policy operator_interactions_read on public.operator_interactions for select to authenticated
  using (public.operator_can_access_site(ai_site_id));
create policy operator_interactions_manage on public.operator_interactions for all to authenticated
  using (public.internal_role() in ('owner','admin'))
  with check (public.internal_role() in ('owner','admin'));
create policy operator_ai_handoffs_read on public.operator_ai_handoffs for select to authenticated
  using (exists (
    select 1 from public.operator_interactions interaction
    where interaction.id = interaction_id and public.operator_can_access_site(interaction.ai_site_id)
  ));
create policy operator_ai_handoffs_manage on public.operator_ai_handoffs for all to authenticated
  using (public.internal_role() in ('owner','admin'))
  with check (public.internal_role() in ('owner','admin'));

revoke all on public.operator_pads, public.operator_pad_sites,
  public.operator_interactions, public.operator_ai_handoffs from anon;
grant select, insert, update, delete on public.operator_pads, public.operator_pad_sites,
  public.operator_interactions, public.operator_ai_handoffs to authenticated;

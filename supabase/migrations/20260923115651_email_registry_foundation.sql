-- DFP Comms: non-secret mailbox inventory. Provider credentials live only in
-- the future cloud connector; this public schema never stores them.
create table public.email_domains (
  domain text primary key check (domain = lower(domain) and length(domain) <= 253 and domain !~ '\.\.' and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$'),
  project_name text not null check (length(trim(project_name)) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  domain text not null references public.email_domains(domain) on update cascade on delete restrict,
  email_address text not null unique check (email_address = lower(email_address) and split_part(email_address, '@', 2) = domain and split_part(email_address, '@', 1) ~ '^[a-z0-9][a-z0-9._+%-]*$'),
  display_name text not null default '',
  provider text not null check (provider in ('fasthosts','gmail','microsoft','resend')),
  purpose text not null default 'shared' check (purpose in ('shared','personal','transactional')),
  connection_status text not null default 'not_connected' check (connection_status in ('not_connected','connected','attention')),
  receive_enabled boolean not null default false,
  send_enabled boolean not null default false,
  ai_classify boolean not null default false,
  ai_draft boolean not null default false,
  human_approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_accounts_connection_gate check (
    connection_status = 'connected' or (not receive_enabled and not send_enabled)
  ),
  constraint email_accounts_ai_gate check (not ai_draft or ai_classify)
);
create index email_accounts_domain_idx on public.email_accounts(domain);

alter table public.email_domains enable row level security;
alter table public.email_accounts enable row level security;
revoke all on public.email_domains, public.email_accounts from anon, authenticated;
grant select, insert, update on public.email_domains, public.email_accounts to authenticated;
grant select, insert, update, delete on public.email_domains, public.email_accounts to service_role;

create policy email_domains_staff_read on public.email_domains for select to authenticated
  using ((select public.internal_role()) in ('owner','admin'));
create policy email_domains_staff_insert on public.email_domains for insert to authenticated
  with check ((select public.internal_role()) in ('owner','admin'));
create policy email_domains_staff_update on public.email_domains for update to authenticated
  using ((select public.internal_role()) in ('owner','admin'))
  with check ((select public.internal_role()) in ('owner','admin'));
create policy email_accounts_staff_read on public.email_accounts for select to authenticated
  using ((select public.internal_role()) in ('owner','admin'));
create policy email_accounts_staff_insert on public.email_accounts for insert to authenticated
  with check ((select public.internal_role()) in ('owner','admin'));
create policy email_accounts_staff_update on public.email_accounts for update to authenticated
  using ((select public.internal_role()) in ('owner','admin'))
  with check ((select public.internal_role()) in ('owner','admin'));

-- The cloud connector will change connection_status after verified provider
-- authentication. Browser users may inventory accounts but cannot mark them live.
create function public.email_accounts_protect_connection() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'service_role' and tg_op = 'INSERT' then
    if new.connection_status <> 'not_connected' or new.receive_enabled or new.send_enabled then
      raise exception 'Provider connection must be verified by the cloud connector';
    end if;
  elsif current_user <> 'service_role' and tg_op = 'UPDATE' then
    if (new.connection_status, new.receive_enabled, new.send_enabled) is distinct from
       (old.connection_status, old.receive_enabled, old.send_enabled) then
      raise exception 'Provider connection settings are managed by the cloud connector';
    end if;
  end if;
  return new;
end;
$$;
create trigger email_accounts_connection_guard before insert or update on public.email_accounts
for each row execute function public.email_accounts_protect_connection();
revoke all on function public.email_accounts_protect_connection() from public, anon, authenticated;

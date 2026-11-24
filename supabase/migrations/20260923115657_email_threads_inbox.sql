-- Provider-normalised, read-only inbox for DFP Comms. Only the cloud ingestion
-- service can insert/update messages. This schema does not store raw HTML or
-- attachments; the UI renders body_text as escaped text.
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.email_accounts(id) on delete restrict,
  provider_thread_id text,
  subject text not null default '' check (length(subject) <= 1000),
  preview text not null default '' check (length(preview) <= 500),
  last_message_at timestamptz not null,
  status text not null default 'open' check (status in ('open','waiting_customer','waiting_internal','resolved','closed')),
  priority text not null default 'normal' check (priority in ('urgent','normal','low')),
  unread_count integer not null default 0 check (unread_count >= 0),
  needs_reply boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  unique (account_id, provider_thread_id)
);
create index email_threads_recent_idx on public.email_threads(last_message_at desc, id desc);
create index email_threads_account_recent_idx on public.email_threads(account_id, last_message_at desc);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  account_id uuid not null,
  provider_message_id text not null check (length(provider_message_id) between 1 and 512),
  direction text not null check (direction in ('inbound','outbound')),
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null default '' check (length(subject) <= 1000),
  body_text text not null default '' check (length(body_text) <= 1048576),
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (thread_id, account_id) references public.email_threads(id, account_id) on delete restrict,
  unique (account_id, provider_message_id)
);
create index email_messages_thread_chronological_idx on public.email_messages(thread_id, received_at, id);

alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
revoke all on public.email_threads, public.email_messages from anon, authenticated;
revoke all on public.email_threads, public.email_messages from service_role;
grant select on public.email_threads, public.email_messages to authenticated;
grant select, insert, update on public.email_threads, public.email_messages to service_role;

create policy email_threads_staff_read on public.email_threads for select to authenticated
  using ((select public.internal_role()) in ('owner','admin'));
create policy email_messages_staff_read on public.email_messages for select to authenticated
  using ((select public.internal_role()) in ('owner','admin'));

-- Durable UID cursor and atomic insert for the first (Fasthosts) IMAP reader.
-- Only the server-side service_role may use these operations.
create table public.email_sync_state (
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  folder text not null default 'INBOX' check (folder = 'INBOX'),
  uid_validity text not null check (length(uid_validity) between 1 and 40),
  last_uid bigint not null default 0 check (last_uid >= 0),
  last_success_at timestamptz not null default now(),
  primary key (account_id, folder)
);
alter table public.email_sync_state enable row level security;
revoke all on public.email_sync_state from public, anon, authenticated, service_role;
grant select, insert, update on public.email_sync_state to service_role;

create function public.email_ingest_imap(
  p_account_id uuid,
  p_uid_validity text,
  p_uid bigint,
  p_provider_thread_id text,
  p_provider_message_id text,
  p_from_address text,
  p_to_addresses text[],
  p_cc_addresses text[],
  p_subject text,
  p_body_text text,
  p_received_at timestamptz,
  p_unread boolean
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_thread_id uuid;
  v_message_id uuid;
  v_key text;
  v_subject text;
  v_body text;
  v_received_at timestamptz;
begin
  if p_uid < 1 or length(coalesce(p_uid_validity,'')) not between 1 and 40
     or length(coalesce(p_provider_message_id,'')) not between 1 and 512
     or p_from_address is null or p_received_at is null then
    raise exception 'Invalid IMAP message identity';
  end if;
  if not exists (select 1 from public.email_accounts where id = p_account_id and provider = 'fasthosts') then
    raise exception 'Fasthosts account not registered';
  end if;

  v_key := left(coalesce(nullif(p_provider_thread_id,''), p_provider_message_id),512);
  v_subject := left(coalesce(p_subject,''),1000);
  v_body := left(coalesce(p_body_text,''),1048576);
  v_received_at := p_received_at;

  insert into public.email_threads(account_id, provider_thread_id, subject, preview, last_message_at)
  values(p_account_id, v_key, v_subject, left(replace(replace(v_body,E'\n',' '),E'\r',' '),500), v_received_at)
  on conflict (account_id, provider_thread_id) do nothing;

  select id into v_thread_id from public.email_threads
  where account_id = p_account_id and provider_thread_id = v_key;

  insert into public.email_messages(
    thread_id, account_id, provider_message_id, direction, from_address,
    to_addresses, cc_addresses, subject, body_text, received_at
  ) values (
    v_thread_id, p_account_id, p_provider_message_id, 'inbound', p_from_address,
    coalesce(p_to_addresses,'{}'), coalesce(p_cc_addresses,'{}'),
    v_subject, v_body, v_received_at
  ) on conflict (account_id, provider_message_id) do nothing returning id into v_message_id;

  if v_message_id is not null then
    update public.email_threads set
      last_message_at = greatest(last_message_at, v_received_at),
      subject = case when v_received_at >= last_message_at then v_subject else subject end,
      preview = case when v_received_at >= last_message_at then left(replace(replace(v_body,E'\n',' '),E'\r',' '),500) else preview end,
      unread_count = unread_count + case when coalesce(p_unread,false) then 1 else 0 end,
      needs_reply = true,
      status = 'open',
      updated_at = now()
    where id = v_thread_id;
  end if;

  insert into public.email_sync_state(account_id, folder, uid_validity, last_uid, last_success_at)
  values(p_account_id, 'INBOX', p_uid_validity, p_uid, now())
  on conflict (account_id, folder) do update set
    uid_validity = excluded.uid_validity,
    last_uid = case when email_sync_state.uid_validity = excluded.uid_validity
      then greatest(email_sync_state.last_uid, excluded.last_uid) else excluded.last_uid end,
    last_success_at = now();

  return v_message_id is not null;
end;
$$;
revoke all on function public.email_ingest_imap(uuid,text,bigint,text,text,text,text[],text[],text,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.email_ingest_imap(uuid,text,bigint,text,text,text,text[],text[],text,text,timestamptz,boolean) to service_role;

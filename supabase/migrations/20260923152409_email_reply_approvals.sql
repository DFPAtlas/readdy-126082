-- Human reply preparation and review. Approved drafts are never sent by a
-- database trigger; a future sender must explicitly consume them.
create table public.email_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  account_id uuid not null,
  recipient_address text not null check (length(recipient_address) between 3 and 320),
  subject text not null default '' check (length(subject) <= 1000),
  body_text text not null check (length(trim(body_text)) between 1 and 1048576),
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (thread_id, account_id) references public.email_threads(id, account_id) on delete restrict
);
create index email_reply_drafts_queue_idx on public.email_reply_drafts(status, updated_at desc);
create index email_reply_drafts_thread_idx on public.email_reply_drafts(thread_id, created_at desc);
alter table public.email_reply_drafts enable row level security;
revoke all on public.email_reply_drafts from public, anon, authenticated;
grant select, insert, update on public.email_reply_drafts to authenticated;
grant select on public.email_reply_drafts to service_role;

create policy email_reply_drafts_staff_read on public.email_reply_drafts
  for select to authenticated using ((select public.internal_role()) in ('owner','admin'));
create policy email_reply_drafts_staff_insert on public.email_reply_drafts
  for insert to authenticated with check (
    (select public.internal_role()) in ('owner','admin')
    and created_by = (select auth.uid()) and status = 'draft'
    and reviewed_by is null and reviewed_at is null
    and exists (select 1 from public.email_messages m where m.thread_id = email_reply_drafts.thread_id
      and m.account_id = email_reply_drafts.account_id and m.direction = 'inbound'
      and lower(m.from_address) = lower(email_reply_drafts.recipient_address))
  );
create policy email_reply_drafts_staff_update on public.email_reply_drafts
  for update to authenticated
  using ((select public.internal_role()) in ('owner','admin') and status in ('draft','pending'))
  with check ((select public.internal_role()) in ('owner','admin'));

-- Enforce the state machine even when a client calls the table API directly.
create function public.email_reply_draft_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.created_by is distinct from auth.uid()
      or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Invalid initial reply draft';
    end if;
    return new;
  end if;

  if (new.id,new.thread_id,new.account_id,new.recipient_address,new.subject,new.created_by,new.created_at)
     is distinct from
     (old.id,old.thread_id,old.account_id,old.recipient_address,old.subject,old.created_by,old.created_at)
     or old.status not in ('draft','pending') then
    raise exception 'Reply identity or final state cannot be changed';
  end if;

  if old.status = 'draft' then
    if old.created_by is distinct from auth.uid() or new.status not in ('draft','pending')
      or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Only the author may edit or submit a draft';
    end if;
  else
    if new.status not in ('approved','rejected') or new.body_text is distinct from old.body_text
      or new.reviewed_by is distinct from auth.uid() then
      raise exception 'Pending drafts may only be reviewed';
    end if;
    new.reviewed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger email_reply_draft_guard_trigger before insert or update on public.email_reply_drafts
for each row execute function public.email_reply_draft_guard();
revoke all on function public.email_reply_draft_guard() from public, anon, authenticated;

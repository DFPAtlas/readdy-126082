create table if not exists public.internal_unverified_email_intake (
 id uuid primary key default gen_random_uuid(),
 site_slug text not null,
 provider_message_id text not null,
 sender_email text not null,
 recipient_email text not null,
 subject text not null default '',
 body_text text not null default '',
 received_at timestamptz not null,
 verification_status text not null default 'unverified',
 created_at timestamptz not null default now(),
 unique (site_slug, provider_message_id)
);
alter table public.internal_unverified_email_intake enable row level security;
revoke all on public.internal_unverified_email_intake from anon, authenticated;

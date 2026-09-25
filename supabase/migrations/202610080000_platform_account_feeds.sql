-- ============================================================================
-- Platform account feeds — per-brand registered-account totals for the DFP
-- Operations Wall grand total ("TOTAL USERS").
--
-- WHY THIS EXISTS
--   Each DFP platform owns its own account store in ITS OWN backend. This
--   Command Centre database does NOT hold those stores (the migrated brand
--   tables here are empty and must never be summed as a proxy). So the wall
--   never guesses an account total and never adds unrelated tables together.
--   Each brand reports its OWN authoritative registered-account count from its
--   OWN backend through an authenticated server-to-server receiver. A platform
--   that has not reported is shown as AWAITING FEED — never as zero.
--
-- Adds:
--   1. public.platform_account_feeds — latest reported total per platform
--      (one row per site + environment). service_role write only.
--   2. public.wallboard_platform_accounts() — aggregate-only SECURITY DEFINER
--      reader for the wall. Returns per-platform totals + feed state.
--
-- Privacy / security:
--   * Only an aggregate integer count is accepted or stored — never names,
--     emails, user ids, sessions, passwords or tokens.
--   * reported_at is set SERVER-SIDE (now()) so a reporter can never back-date
--     or forward-date its own feed.
--   * The table is not readable or writable from a browser; the wall reads the
--     aggregate only through the SECURITY DEFINER function below, which enforces
--     the same Command Centre role check AuthGuard already applies to the wall.
-- ============================================================================

-- 1. Per-platform reported account totals ------------------------------------
create table if not exists public.platform_account_feeds (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.ai_sites(id) on delete cascade,
  environment   text not null default 'production',
  account_count bigint not null check (account_count >= 0),
  source_label  text not null default 'platform-backend',
  reported_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint platform_account_feeds_site_env_uniq unique (site_id, environment)
);

alter table public.platform_account_feeds enable row level security;

-- No browser access at all: the wall reads the aggregate through the SECURITY
-- DEFINER function; only the receiver (service_role) writes.
revoke all on public.platform_account_feeds from public;
revoke all on public.platform_account_feeds from anon;
revoke all on public.platform_account_feeds from authenticated;
grant select, insert, update, delete on public.platform_account_feeds to service_role;

create index if not exists platform_account_feeds_site_idx
  on public.platform_account_feeds (site_id, environment);

-- 2. Aggregate-only reader for the wall --------------------------------------
-- Returns one row per ACTIVE PRODUCTION platform, LEFT JOINed to its feed so a
-- platform that has never reported is returned with a null count and
-- feed_state = 'awaiting' (honest gap, never a fabricated zero).
create or replace function public.wallboard_platform_accounts()
 returns table(
   site_key text,
   platform_name text,
   account_count bigint,
   reported_at timestamptz,
   feed_state text,
   feed_age_minutes integer
 )
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  -- Explicit caller authorisation: reuse the Command Centre wall/staff mechanism
  -- (internal_user_roles) that AuthGuard already enforces. auth.uid() is NULL for
  -- an unauthenticated (anon) caller, which fails this check.
  if not exists (
    select 1
    from public.internal_user_roles r
    where r.user_id = auth.uid()
      and r.role is not null
      and coalesce(r.status, 'active') <> 'disabled'
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
    select
      s.site_key,
      s.name,
      f.account_count,
      f.reported_at,
      case when f.account_count is null then 'awaiting' else 'reported' end,
      case
        when f.reported_at is null then null
        else greatest(0, (extract(epoch from (now() - f.reported_at)) / 60)::integer)
      end
    from public.ai_sites s
    left join public.platform_account_feeds f
      on f.site_id = s.id
     and f.environment = 'production'
    where s.is_active is true
      and coalesce(s.environment, 'production') = 'production'
    order by s.name;
end;
$function$;

-- Remove the default PUBLIC/anon execution path; the wall is read by a signed-in
-- Command Centre staff member (authenticated). The in-function auth.uid() check
-- remains the authoritative control even if a caller retains EXECUTE.
revoke execute on function public.wallboard_platform_accounts() from public;
revoke execute on function public.wallboard_platform_accounts() from anon;
grant execute on function public.wallboard_platform_accounts() to authenticated;
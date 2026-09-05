-- ============================================================================
-- Wallboard presence reader access — aggregate-only SECURITY DEFINER reader.
--
-- The Operations Wall "Users Online" widget reads aggregate visitor counts via
-- wallboard_online_presence(). Previously SECURITY INVOKER, its internal SELECT
-- on public_analytics_events ran as the caller (authenticated) and was denied:
-- authenticated has no table grant, and the table's RLS policy referenced the
-- legacy admin_profiles table rather than the Command Centre role store.
--
-- This migration:
--   1. Rewrites wallboard_online_presence() as SECURITY DEFINER with an explicit
--      caller check against internal_user_roles (the same mechanism AuthGuard
--      enforces for the wall: a non-null role, status != 'disabled').
--   2. Fixes the search_path and schema-qualifies every reference.
--   3. Revokes default PUBLIC/anon EXECUTE and grants only authenticated.
--
-- The function returns ONLY (site_domain, online_count) — never raw events,
-- session hashes or personal data. It preserves the production-only filter, the
-- 5-minute presence window and distinct-session counting. No broad SELECT grant
-- is given to anon/authenticated on public_analytics_events (direct access stays
-- denied; the aggregate is readable only through this function).
-- ============================================================================

create or replace function public.wallboard_online_presence()
 returns table(site_domain text, online_count bigint)
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  -- Explicit caller authorisation: reuse the Command Centre wall/staff mechanism
  -- (internal_user_roles) that AuthGuard already enforces. A caller must hold an
  -- active, non-disabled Command Centre role. auth.uid() is the signed-in user id
  -- from the JWT; it is NULL for unauthenticated (anon) callers, which fails this
  -- check. We never fall back to a fabricated empty/zero result.
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
    with recent as (
      select
        coalesce(
          nullif(lower(trim(source_metadata->>'domain')), ''),
          nullif(lower(trim(safe_metadata->>'domain')), '')
        ) as site_domain,
        anonymous_session_hash
      from public.public_analytics_events
      where occurred_at > now() - interval '5 minutes'
        and environment = 'production'
        and anonymous_session_hash is not null
    )
    select r.site_domain, count(distinct r.anonymous_session_hash)::bigint as online_count
    from recent r
    where r.site_domain is not null
    group by r.site_domain
    order by online_count desc;
end;
$function$;

-- Remove the default PUBLIC/anon execution path; the wall is read by a signed-in
-- Command Centre staff member (authenticated). The in-function auth.uid() check
-- remains the authoritative control even if a caller retains EXECUTE.
revoke execute on function public.wallboard_online_presence() from public;
revoke execute on function public.wallboard_online_presence() from anon;
grant execute on function public.wallboard_online_presence() to authenticated;
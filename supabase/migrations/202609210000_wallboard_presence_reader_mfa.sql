-- ============================================================================
-- Wallboard presence reader — server-side MFA enforcement + EXECUTE hardening.
--
-- Follow-up to 202609200000_wallboard_presence_reader_access.sql, which made
-- wallboard_online_presence() SECURITY DEFINER with a staff-role check. Two
-- gaps remained:
--
--   1. The RPC did not enforce MFA server-side. The frontend AuthGuard checks
--      aal2 via supabase.auth.mfa, but a directly callable RPC is not protected
--      by frontend logic — an authenticated (non-MFA) caller could still invoke
--      it. This migration reuses the established internal_role_aal2() helper,
--      which returns the caller's role only when auth.jwt()->>'aal' = 'aal2'.
--
--   2. The PUBLIC/anon EXECUTE revocations were recorded but not applied live
--      (the live-revoke path is blocked for reserved roles; see notes below).
--
-- The function returns ONLY (site_domain, online_count) — never raw events,
-- session hashes or personal data. The production-only filter, 5-minute window
-- and distinct-session counting are preserved. No broad SELECT grant is added
-- to public_analytics_events; the aggregate stays readable only through this
-- authorised wrapper.
-- ============================================================================

create or replace function public.wallboard_online_presence()
 returns table(site_domain text, online_count bigint)
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  -- MFA gate: reuse the established server-side mechanism. internal_role_aal2()
  -- returns the caller's role only when their JWT carries aal2 (MFA satisfied);
  -- otherwise NULL. Unauthenticated (anon) callers have no JWT, so auth.jwt()
  -- is null and this returns NULL -> denied.
  if public.internal_role_aal2() is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  -- Preserve the staff-role + status check: a disabled account is denied even
  -- if it still holds an aal2 session. (internal_role_aal2 does not itself
  -- check status, so this stays explicit.)
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

-- Harden execution: remove the default PUBLIC/anon path. The wall is read by a
-- signed-in Command Centre staff member (authenticated). The in-function
-- internal_role_aal2() + status check remains the authoritative control even
-- if a caller retains EXECUTE.
revoke execute on function public.wallboard_online_presence() from public;
revoke execute on function public.wallboard_online_presence() from anon;
grant execute on function public.wallboard_online_presence() to authenticated;
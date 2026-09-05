-- ============================================================================
-- GarageFlow visitor presence receiver — supporting database logic.
--
-- Adds:
--   1. presence_receiver_rate_limit — persistent per-bucket fixed-window
--      rate-limiting state for the garageflow-presence-receiver edge function.
--   2. presence_receiver_cleanup()    — 30-day retention for records written
--      by this receiver, scoped by the source_metadata.receiver marker so
--      unrelated analytics rows are never touched.
--   3. A daily pg_cron job to run retention (reuses the existing cron infra
--      already used by website-monitoring / runtime-health-monitor).
--
-- This migration does NOT grant browsers (anon/authenticated) any access to
-- public_analytics_events — the receiver writes via service_role only.
-- ============================================================================

-- 1. Rate-limit / coalescing support -----------------------------------------
create table if not exists public.presence_receiver_rate_limit (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table public.presence_receiver_rate_limit enable row level security;

-- Only the edge function (service_role) may read/write this table.
grant select, insert, update, delete on public.presence_receiver_rate_limit to service_role;

-- 2. Retention cleanup -------------------------------------------------------
-- SECURITY INVOKER: runs as the caller. pg_cron executes it as the superuser
-- (table owner), so the DELETE succeeds; anon/authenticated lack any DELETE
-- grant on public_analytics_events, so a browser cannot use it to alter data.
create or replace function public.presence_receiver_cleanup()
returns integer
language plpgsql
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public_analytics_events
  where source_metadata ->> 'receiver' = 'garageflow-presence'
    and occurred_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 3. Daily retention job -----------------------------------------------------
select cron.schedule(
  'garageflow-presence-retention',
  '0 3 * * *',
  'select public.presence_receiver_cleanup();'
);
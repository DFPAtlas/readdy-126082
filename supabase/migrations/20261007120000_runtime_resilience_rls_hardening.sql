-- Harden the v381 runtime-resilience tables.
--
-- Runtime resilience is machine telemetry. Browser-authenticated users must not
-- be able to forge watchdog state or recovery history, even when they hold an
-- owner/admin role. The outbound bridge/watchdog uses the service role, which
-- bypasses RLS. Human reads require an active internal role and AAL2/MFA through
-- internal_role_aal2().

begin;

alter table public.runtime_resilience_nodes enable row level security;
alter table public.runtime_recovery_events enable row level security;

drop policy if exists runtime_resilience_nodes_select on public.runtime_resilience_nodes;
drop policy if exists runtime_resilience_nodes_insert on public.runtime_resilience_nodes;
drop policy if exists runtime_resilience_nodes_update on public.runtime_resilience_nodes;
drop policy if exists runtime_recovery_events_select on public.runtime_recovery_events;
drop policy if exists runtime_recovery_events_insert on public.runtime_recovery_events;

create policy runtime_resilience_nodes_select
  on public.runtime_resilience_nodes
  for select
  to authenticated
  using (public.internal_role_aal2() is not null);

create policy runtime_recovery_events_select
  on public.runtime_recovery_events
  for select
  to authenticated
  using (public.internal_role_aal2() is not null);

-- No INSERT, UPDATE, or DELETE policy is created for authenticated users.
-- service_role remains the sole writer through its normal RLS bypass.

revoke insert, update, delete on public.runtime_resilience_nodes from authenticated;
revoke insert, update, delete on public.runtime_recovery_events from authenticated;
grant select on public.runtime_resilience_nodes to authenticated;
grant select on public.runtime_recovery_events to authenticated;

commit;

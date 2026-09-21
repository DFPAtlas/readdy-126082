begin;

revoke all privileges on table
  public.runtime_resilience_nodes,
  public.runtime_recovery_events
from anon;

revoke all privileges on table
  public.runtime_resilience_nodes,
  public.runtime_recovery_events
from authenticated;

grant select on table
  public.runtime_resilience_nodes,
  public.runtime_recovery_events
to authenticated;

commit;

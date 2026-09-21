-- Canary activation. Run only after v54 deployment, per-node secret
-- installation, and negative authentication tests.
-- Activate HAL first. After three fresh heartbeats and audit verification,
-- repeat this transaction for TRON using the matching identity/node/secret names.

begin;

do $$
declare
  target_identity_id uuid;
begin
  select id into target_identity_id
  from public.ai_runtime_service_identities
  where identity_key = 'dfp-runtime-hal'
    and identity_type = 'internal_runtime'
    and credential_reference = 'DFP_RUNTIME_BRIDGE_HAL_SIGNING_KEY'
    and status = 'blocked'
    and is_active = false;

  if target_identity_id is null then
    raise exception 'HAL v54 identity is missing or not in the staged state';
  end if;

  update public.ai_runtime_bridge_nodes
  set
    service_identity_id = target_identity_id,
    execution_enabled = false,
    updated_at = now()
  where node_key = 'atlas-hal-runtime-01';

  if not found then
    raise exception 'HAL runtime node was not found';
  end if;

  update public.ai_runtime_service_identities
  set status = 'active', is_active = true, updated_at = now()
  where id = target_identity_id;
end
$$;

commit;

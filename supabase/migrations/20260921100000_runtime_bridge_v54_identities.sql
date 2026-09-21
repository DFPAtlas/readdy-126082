-- Stage the v54 identities without granting access.
-- This migration is deliberately non-activating: credentials must be installed
-- on both sides and the v54 function must pass negative tests before activation.

begin;

insert into public.ai_runtime_service_identities (
  identity_key, name, identity_type, environment, allowed_request_types,
  allowed_site_keys, allowed_agent_keys, risk_ceiling, status,
  credential_reference, is_active, notes
)
values
  (
    'dfp-runtime-hal', 'HAL Runtime Bridge', 'internal_runtime', 'production',
    '["handshake","heartbeat","report_health","report_capabilities","report_ollama_catalogue","fetch_control_messages","report_transport_probe_ack","report_ollama_inference_probe","report_n8n_sandbox_probe","report_runtime_chain_probe","report_agent_dry_run_probe","report_readonly_tool_probe","report_diagnostic_run_tool_probe","report_approval_gated_diagnostic_probe"]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, 'green', 'blocked',
    'DFP_RUNTIME_BRIDGE_HAL_SIGNING_KEY', false,
    'v54 staged identity. Activate only after secret installation and negative authentication tests.'
  ),
  (
    'dfp-runtime-tron', 'TRON Runtime Bridge', 'internal_runtime', 'production',
    '["handshake","heartbeat","report_health","report_capabilities","report_ollama_catalogue","fetch_control_messages","report_transport_probe_ack","report_ollama_inference_probe","report_n8n_sandbox_probe","report_runtime_chain_probe","report_agent_dry_run_probe","report_readonly_tool_probe","report_diagnostic_run_tool_probe","report_approval_gated_diagnostic_probe"]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, 'green', 'blocked',
    'DFP_RUNTIME_BRIDGE_TRON_SIGNING_KEY', false,
    'v54 staged identity. Activate only after secret installation and negative authentication tests.'
  )
on conflict (identity_key) do update
set
  name = excluded.name,
  identity_type = excluded.identity_type,
  environment = excluded.environment,
  allowed_request_types = excluded.allowed_request_types,
  allowed_site_keys = excluded.allowed_site_keys,
  allowed_agent_keys = excluded.allowed_agent_keys,
  risk_ceiling = excluded.risk_ceiling,
  status = 'blocked',
  credential_reference = excluded.credential_reference,
  is_active = false,
  expires_at = null,
  notes = excluded.notes,
  updated_at = now();

update public.ai_runtime_service_identities
set
  status = 'blocked',
  is_active = false,
  notes = 'Retired by runtime bridge v54 hardening; shared identities are not permitted.',
  updated_at = now()
where identity_key = 'dfp-local-runtime-bridge';

update public.ai_runtime_bridge_nodes
set execution_enabled = false, updated_at = now()
where node_key in ('atlas-hal-runtime-01', 'atlas-tron-runtime-01');

commit;

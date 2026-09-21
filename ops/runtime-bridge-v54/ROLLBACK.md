# Runtime Bridge v54 rollback

Rollback is intentionally fail-closed. It restores a telemetry-offline state; it does not reactivate the retired shared credential.

1. Stop the HAL and TRON bridge services.
2. Block both v54 identities and keep execution disabled with the following transaction:

       begin;
       update public.ai_runtime_service_identities
       set status = 'blocked', is_active = false, updated_at = now()
       where identity_key in ('dfp-runtime-hal', 'dfp-runtime-tron');

       update public.ai_runtime_bridge_nodes
       set execution_enabled = false, updated_at = now()
       where node_key in ('atlas-hal-runtime-01', 'atlas-tron-runtime-01');
       commit;

3. Restore the previously exported Edge Function bundle and its prior gateway setting.
4. Confirm both identities reject signed requests and no fresh bridge messages are written.
5. Keep the wallboard at CRITICAL/OFFLINE; retained values remain LAST KNOWN.
6. Investigate before another activation attempt. Never set the old shared identity active as a shortcut.

No rollback step changes approval gates, callback authentication, MFA/read permissions, audit retention, or execution authority.

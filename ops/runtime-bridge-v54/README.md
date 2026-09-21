# Runtime Bridge v54 hardening

Status: **candidate only — not deployed**.

## Why the outage keeps returning

The bridge has three separately managed sources of truth:

1. Readdy/GitHub application code.
2. The deployed Supabase Edge Function and gateway flags.
3. HAL/TRON service files and watchdogs that previously existed only on the hosts.

The v53 deployment enabled Supabase JWT verification while HAL/TRON continued to send HMAC-only service requests. The gateway therefore returned 401 before the handler ran. The handler also trusted one hard-coded shared identity and did not enforce the database identity status, per-operation permissions, expiry, or node ownership. Switching JWT verification off by itself would have exposed that latent authorization defect.

v54 makes the repository canonical for the gateway setting and function source. Every request must pass all of these gates:

- Valid v1 HMAC and five-minute timestamp window.
- Nonce replay protection.
- Identity exists, is active, has status active, and is not expired.
- Secret is resolved through that identity's credential reference.
- Operation is permitted globally and by that identity.
- Node exists and is bound to that exact identity.
- Execution remains disabled.
- Rejected known identities, signatures, operations, and node mismatches are audited.

HAL and TRON receive separate credentials. The old shared identity stays blocked.

## Controlled rollout

1. Export the live v53 bundle and function metadata; record its hash and current database row counts.
2. Run node scripts/validate-runtime-bridge-v54.mjs.
3. Generate independent high-entropy HAL and TRON secrets. Never place secret values in Git, SQL, logs, screenshots, or chat.
4. Install DFP_RUNTIME_BRIDGE_HAL_SIGNING_KEY and DFP_RUNTIME_BRIDGE_TRON_SIGNING_KEY in Supabase.
5. Stage identities with supabase/migrations/20260921100000_runtime_bridge_v54_identities.sql. They remain blocked and inactive.
6. Configure each local bridge with its own identity and matching secret, but keep both services stopped.
7. Deploy the versioned function and supabase/config.toml together. Do not deploy the gateway flag alone.
8. Before activation, prove that invalid signature, disabled identity, disallowed operation, unknown node, wrong-node identity, replayed nonce, stale timestamp, and missing secret all fail.
9. Activate HAL only using ops/runtime-bridge-v54/activate.sql; start HAL; require three fresh heartbeats, current CPU/memory, audit entries, and execution_enabled=false.
10. Repeat the canary transaction for TRON; require three fresh heartbeats and current Ollama/model telemetry.
11. Keep the shared identity blocked. Delete its secret only after the observation window and rollback decision.
12. Install the versioned systemd service + watchdog timer on the HAL canary;
    verify stale-marker restart and journal evidence without enabling execution.
13. Repeat the supervised install on TRON only after HAL remains fresh.
14. Merge only after the hosted branch checks and live canary evidence pass.

## Watchdog contract

The watchdog must measure a monotonic liveness marker written by the bridge at least once per second. It must not compare nanoseconds with milliseconds. Use a stale threshold comfortably above the marker interval, restart no more than once per threshold window, and write a journal reason for every restart. A bridge process that cannot update its marker must fail closed; it must never enable execution or replay queued work.

The v381 push supplied the local bridge source. This candidate now adds the
source-controlled systemd service and watchdog templates, a five-second liveness
marker, bounded network calls, and serialized periodic lanes. Production rollout
must install these exact versioned files on HAL and TRON; host-only edits are not
release artifacts.

## Acceptance criteria

- Gateway configuration and handler are deployed from the same commit.
- HAL and TRON use distinct identities and secrets.
- A valid identity cannot report for the other node.
- Blocked, inactive, or expired identities fail.
- Operations outside the identity allowlist fail.
- Replay and stale timestamp checks fail.
- HAL and TRON each produce three consecutive fresh heartbeats.
- Wallboard state derives from freshness; retained telemetry is labelled last known.
- Execution, approvals, callback authentication, MFA/read permissions, and audit retention are unchanged.
- Rollback rehearsal returns to a safe telemetry-offline state.

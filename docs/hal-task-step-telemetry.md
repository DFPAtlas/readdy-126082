# HAL task and step telemetry — opt-in foundation

Execution metadata cannot tell us what a specialist is doing. This addition accepts explicit, structured producer events, reads them locally on HAL and relays a bounded sample in the existing signed heartbeat. It performs no business action, opens no listener and fetches no execution inputs or outputs. No database migration or edge function deployment is required.

## Contract

The operator-configured `HAL_TASK_TELEMETRY_FILE` holds a UTF-8 JSON snapshot:

```json
{"version":1,"events":[{"eventId":"opaque-event-uuid","instance":"hall-n8n","workflowId":"hd2rIh2umh83tydj","executionId":"actual-n8n-execution-id","taskId":"opaque-task-uuid","phase":"checking","occurredAt":"2026-11-01T17:00:00Z"}]}
```

Use actual execution IDs, random task IDs and stable event IDs on retries. Never use email addresses, customer IDs, ticket contents, prompts, tokens or personal data in identifiers. Extra fields are discarded. Phases are limited to checking, discovering, ranking, drafting, notifying, repairing, waiting, completed, failed, handoff_requested and handoff_received. These are producer reports, not independently verified business outcomes.

A sender emits `handoff_requested` with `targetInstance` and `targetWorkflowId` identifying the intended receiver. Only the receiver may emit `handoff_received`, under its own instance/workflow/execution ID with the same taskId and peer fields identifying the sender. A request never establishes receipt. The first version displays the reported peer and phase; it does not claim delivery, pair requests with receipts, or implement a dispatch mechanism.

## Producer helper

`runtime-bridge/tools/record-task-event.py` provides a Linux-only producer adapter for existing local workers. It writes atomically, serialises concurrent writers with flock, rejects conflicting retries, keeps at most 100 events from the last day and uses mode 0640. Run it under a dedicated producer account in an operator-owned directory shared read-only with the bridge account. Its fixed file path must come from operator configuration, never customer input. Do not pass arbitrary shell strings assembled from workflow data.

Example for a worker with the actual IDs substituted:

```bash
python3 /opt/dfp/runtime-bridge/tools/record-task-event.py --file /var/lib/dfp-task-telemetry/events.json --instance hall-n8n --workflow-id hd2rIh2umh83tydj --execution-id ACTUAL_EXECUTION_ID --task-id OPAQUE_TASK_UUID --event-id STABLE_EVENT_UUID --phase checking
```

The helper is not an n8n node and is not installed into either n8n container by this PR. Workflow instrumentation is still required. Do not enable shell execution in n8n merely to use this helper. A later adapter should write this contract from the existing trusted local integration boundary. Synthetic examples do not count as live validation.

## HAL rollout requirements

1. Deploy the updated bridge source, including `src/taskTelemetry.ts`. The existing systemd installer does not deploy this addition yet: do not rerun the old installer expecting step telemetry.
2. Provision the snapshot directory and file with a producer writer account and bridge read access, including directory traversal and shared group inheritance for atomic replacements. Keep other accounts from writing it.
3. Set `HAL_TASK_TELEMETRY_FILE=/var/lib/dfp-task-telemetry/events.json` in HAL's private environment file. Add only `--allow-read=/var/lib/dfp-task-telemetry/events.json` to Deno's existing ExecStart arguments, preserving all existing permissions, source paths, signing settings and watchdog configuration. Check systemd filesystem restrictions too. Do not grant unrestricted read/write permissions. The bridge never writes the file.
4. Instrument an actual workflow/worker at step boundaries. Restart the existing systemd bridge only after configuration is ready, then verify a fresh heartbeat with `local_services.task_activity.state=available` and a real run event.
5. Publish the frontend and verify the named run, reported phase, task/peer tooltip and stale state on the operational wall. Neither HAL rollout nor browser verification has been completed by this PR.

Docker remains unchanged and therefore has no file-read permission or snapshot mount; that deployment requires equivalent explicit configuration if used later. HAL currently uses systemd, not the retired Docker bridge.

## Display and limits

Events join only on exact instance, workflow ID and execution ID, and must fall within that execution's time window. Freshness requires current execution collection, a current heartbeat and task snapshot, and an event younger than two minutes. Terminal phases, handover requests, completed executions and simulation never establish current work. Older observations are labelled last reported. Long steps need producer refresh events with new event IDs if they should remain current.

Names still come from the dated workflow catalogue or existing exact registry mapping. No specialist identity is inferred. Future events beyond 30 seconds and observations older than a day are rejected. Unknown/malformed events are omitted; unavailable or denied file reads become unavailable telemetry without leaking local errors.

This is a sampled view, not an audit log: at most 100 events, 64 KiB and the latest 50 executions per instance are visible. A busy producer may evict events between heartbeats. The UI shows only the latest matching event per run; task timelines, reliable delivery/acknowledgement and historical retention remain separate work.

Validation: `node --experimental-strip-types --test tests/hal-agent-runs.test.mjs tests/hal-task-telemetry.test.mjs` and `python3 tests/test_hal_task_writer.py`.

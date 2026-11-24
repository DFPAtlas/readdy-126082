# HAL agent run visibility

The active Operations Wall right-hand Autonomous Operations rail now includes **HAL Run Activity** for `hall-n8n` and `leadgen_n8n`. It displays execution IDs, workflow IDs, status, start/end times and completed duration or live elapsed time. Two run cards rotate through the bounded sample, prioritising fresh running executions. Both instance collection states and sample times remain visible. Master-agent mission rows now paginate three at a time to reserve space for activity. The wall remains read-only.

## Data path

HAL bridge → local n8n public API (GET only, `includeData=false`) → existing signed heartbeat `local_services.n8n_executions` → existing protected heartbeat storage → shared runtime-health store → Operations Wall. No direct browser connection to HAL and no new database migration or Edge Function deployment is required. Existing heartbeat authentication and staff read permissions apply.

The bridge reads the newest 50 executions and a separate page of up to 50 running executions for each instance, deduplicating by execution ID within that instance. Each heartbeat carries at most 50 rows per instance, prioritising running rows. Pagination/overflow is explicitly labelled partial. IDs are namespaced by instance in the presentation. Only IDs, status and timestamps leave HAL; execution inputs, outputs, errors, credentials and workflow definitions are omitted. API errors are generic. Redirects are refused to prevent forwarding keys to another host.

## Rollout

1. Merge and publish the frontend through the usual Readdy process.
2. On HAL, update the runtime-bridge source and Dockerfile from this commit. Preserve the existing local `.env` and signing secret.
3. Configure `N8N_LOCAL_URL` for `hall-n8n` and `N8N_SECONDARY_URL` for `leadgen_n8n`, using addresses reachable **inside the bridge container**. `127.0.0.1` only works with host networking or when n8n shares the network namespace.
4. Add `N8N_LOCAL_API_KEY` and `N8N_SECONDARY_API_KEY` to the bridge's local `.env`, using a separate key for each instance. Prefer execution-list-only permissions where the installed n8n edition supports scopes. Do not put keys in frontend variables, source control, tickets or chat.
5. From `runtime-bridge`, rebuild/recreate only the bridge:

   ```bash
   docker compose up -d --build dfp-runtime-bridge
   ```

6. Wait for the next heartbeat and wallboard refresh. Confirm both instance samples show current telemetry. Run an existing harmless test workflow in n8n and compare its execution ID, outcome and times with Command. Short runs may appear only after completion. Stop the bridge temporarily and confirm current activity becomes unknown after two minutes, then restore it. Test invalid API keys only in a safe validation environment; collection must say unavailable rather than idle.

Collection is opt-in. Missing keys show not configured, HTTP/auth/network failures show unavailable. Samples and heartbeat receive times both expire after two minutes; historical terminal outcomes remain visible, while active states become unknown. No automatic run/retry/stop/activation authority is added.

## Limits

This is a bounded sample of saved executions, not a complete audit log or lifetime execution count. n8n save/prune settings determine available history; busy instances may omit runs. Individual specialist nodes inside one workflow are not separate execution records and require workflow instrumentation for per-specialist visibility. Names resolve only through explicit per-instance maps to saved DFP workflow keys, with exact workflow ID/environment checks and matching active agent/site records. Unmapped or conflicting rows keep workflow IDs. The panel never invents a current task from a workflow name. Simulated heartbeat data is explicitly labelled and excluded from live running counts. Existing callback-derived wallboard KPIs retain their existing source and are distinct from this panel.

## Validation

`node --experimental-strip-types --test tests/hal-agent-runs.test.mjs` covers private-data stripping, read-only requests, failure/configuration states, deduplication, limits, running priority and timestamp expiry. Production build and ESLint on changed UI files pass. Full TypeScript validation reports 290 errors on both this branch and unchanged main, with identical diagnostics and no added errors. The collector module also passes an isolated TypeScript check. Live HAL collection still requires the rollout and an observed execution; unit tests do not establish a live connection.

### Active wall validation follow-up

Seven focused tests pass, including instance ID collisions, live elapsed time, stale counts and simulated data. Changed TypeScript/UI files pass ESLint, and the production bundle includes the new active-rail component. Project TypeScript diagnostics remain identical to unchanged main (290 existing errors). Browser layout inspection remains outstanding: Chromium is absent in this environment and its download returned a truncated archive. Verify the complete wall at 1920×1080, 1920×900 and 1536×864 before deployment.

## Instance-aware name mapping

The bridge accepts two independent JSON objects: `N8N_LOCAL_WORKFLOW_MAP` for hall-n8n and `N8N_SECONDARY_WORKFLOW_MAP` for leadgen_n8n. Keys are exact n8n workflow IDs, values are existing `ai_n8n_workflow_registry.workflow_key` values. These settings identify runs; they never grant dispatch or alter workflows. Default maps are empty.

Example format (replace with confirmed IDs/keys):

```dotenv
N8N_LOCAL_WORKFLOW_MAP='{"confirmed-workflow-id":"saved-dfp-workflow-key"}'
N8N_SECONDARY_WORKFLOW_MAP={}
```

Read-only registry inspection on 1 November 2026 found one saved candidate: workflow ID `SzPl8DDm3aBAAOjI`, registry key `quickguard-autonomous-manager-01`, agent QuickGuard Autonomous Manager 01 - State Supervisor, website QuickGuard, environment production. Its registry status is **not_verified**. The instance binding has not been checked against HAL's live n8n inventory, so no instance map is prefilled automatically. Verify that exact workflow ID inside hall-n8n before adding the following to its local map:

```dotenv
N8N_LOCAL_WORKFLOW_MAP='{"SzPl8DDm3aBAAOjI":"quickguard-autonomous-manager-01"}'
```

Do not copy that association to leadgen_n8n without verifying that instance independently. To map additional workflows, use the existing approved workflow registry plus its agent_id/site_id assignments, then configure the confirmed n8n ID in the correct local instance map. Save agent/site identities in DFP rather than embedding display names in HAL configuration.

After a bridge rebuild/restart, mapped heartbeat rows carry only `registryWorkflowKey`; the wall joins that to the current saved registry. Exact ID, environment, active status and relationship checks must agree. Missing or ambiguous rows, conflicting agent/workflow/site relationships, and unavailable lookups fall back to workflow IDs with an explanation. Registry verification state is shown separately and never changed by the telemetry collector.

Invalid JSON, non-string values, invalid identifiers or more than 128 mappings disable mapping for that instance and show MAP INVALID. Run collection continues. Upstream n8n responses cannot supply registry identity: any such field is discarded and replaced from the instance's local map. Removing a mapping, or removing/deactivating the saved registry association, restores the ID fallback on the next refresh.

This requires no database migration. It requires the updated frontend and bridge plus confirmed instance-specific configuration on HAL. No live mappings, agents, websites or verification statuses were changed during implementation. Current task/step and specialist handover reporting remain a later phase.

Mapping validation: all 11 focused tests pass, including exact registry joins, inactive/ambiguous/environment conflicts, independent instance IDs, invalid map configuration and rejection of upstream identity fields. Production build, changed-file lint and an isolated TypeScript check pass. Full project diagnostics remain identical to main's existing 290 errors. Live mapping configuration and browser layout verification are still outstanding.

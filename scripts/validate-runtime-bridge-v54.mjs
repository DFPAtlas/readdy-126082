import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const source = read("supabase/functions/runtime-bridge/index.ts");
const client = read("runtime-bridge/src/main.ts");
const envExample = read("runtime-bridge/.env.example");
const service = read("runtime-bridge/deploy/systemd/dfp-runtime-bridge@.service");
const watchdog = read("runtime-bridge/deploy/systemd/watchdog.sh");
const watchdogService = read("runtime-bridge/deploy/systemd/dfp-runtime-bridge-watchdog@.service");
const config = read("supabase/config.toml");
const migration = read("supabase/migrations/20260921100000_runtime_bridge_v54_identities.sql");
const activation = read("ops/runtime-bridge-v54/activate.sql");

const requiredSource = [
  'idRow.status === "active"',
  "idRow.is_active === true",
  "idRow.allowed_request_types",
  "idRow.expires_at",
  "Deno.env.get(signingSecretName)",
  "nodeRow.service_identity_id !== idRow.id",
  '"runtime_bridge_identity_blocked"',
  '"runtime_bridge_signature_rejected"',
  '"runtime_bridge_operation_blocked"',
  '"runtime_bridge_node_identity_mismatch"',
  "last_authenticated_at",
  "execution_enabled: false",
];

for (const token of requiredSource) {
  assert.ok(source.includes(token), "runtime-bridge is missing required gate: " + token);
}

for (const forbidden of [
  'const IDENTITY_KEY = "dfp-local-runtime-bridge"',
  'const SIGNING_SECRET_NAME = "DFP_RUNTIME_BRIDGE_SIGNING_KEY"',
  ".insert(upsert)",
]) {
  assert.ok(!source.includes(forbidden), "runtime-bridge contains forbidden legacy behavior: " + forbidden);
}

const requiredClient = [
  'if (!config.identity) missing.push("DFP_BRIDGE_IDENTITY")',
  '"atlas-hal-runtime-01": "dfp-runtime-hal"',
  '"atlas-tron-runtime-01": "dfp-runtime-tron"',
  "fetchWithTimeout(config.endpoint",
  "DFP_BRIDGE_REQUEST_TIMEOUT_MS",
  "DFP_BRIDGE_LIVENESS_FILE",
  "writeLivenessMarker",
  'void runPeriodic("heartbeat"',
  "Deno.exitCode = 78",
  "Deno.exit(1)",
];

for (const token of requiredClient) {
  assert.ok(client.includes(token), "local bridge is missing reliability gate: " + token);
}

for (const forbidden of [
  '?? "dfp-local-runtime-bridge"',
  'setInterval(() => {\n    void heartbeat()',
]) {
  assert.ok(!client.includes(forbidden), "local bridge contains forbidden legacy behavior: " + forbidden);
}

// Every remaining direct fetch must carry an AbortSignal in its request block.
// Bounded helper calls do not match this expression.
const clientLines = client.split(/\r?\n/);
for (let index = 0; index < clientLines.length; index += 1) {
  if (!clientLines[index].includes("await fetch(")) continue;
  const requestBlock = clientLines.slice(index, index + 14).join("\n");
  assert.match(requestBlock, /signal:\s*(controller|init\.signal)/, "unbounded fetch near line " + (index + 1));
}

assert.match(envExample, /^DFP_BRIDGE_IDENTITY=$/m);
assert.doesNotMatch(envExample, /DFP_BRIDGE_SIGNING_SECRET=\S+/);
assert.match(service, /Restart=on-failure/);
assert.match(service, /--allow-write=\/run\/dfp-runtime-bridge\/%i\.alive/);
assert.match(watchdog, /date \+%s/);
assert.match(watchdog, /stat -c %Y/);
assert.match(watchdog, /systemctl try-restart/);
assert.doesNotMatch(watchdog, /nanosecond|%N/i);
assert.match(watchdogService, /DFP_BRIDGE_WATCHDOG_MAX_AGE_SECONDS=30/);

assert.match(config, /\[functions\.runtime-bridge\][\s\S]*verify_jwt\s*=\s*false/);
assert.match(migration, /'dfp-runtime-hal'[\s\S]*'blocked'[\s\S]*false/);
assert.match(migration, /'dfp-runtime-tron'[\s\S]*'blocked'[\s\S]*false/);
assert.match(migration, /where identity_key = 'dfp-local-runtime-bridge'/);
assert.match(migration, /execution_enabled = false/);
assert.match(activation, /service_identity_id = target_identity_id/);
assert.match(activation, /execution_enabled = false/);
assert.match(activation, /status = 'active'/);

for (const forbiddenSql of [
  /execution_enabled\s*=\s*true/i,
  /risk_ceiling\s*=\s*'(amber|red|unrestricted)'/i,
]) {
  assert.ok(!forbiddenSql.test(migration + activation), "SQL weakens execution controls: " + forbiddenSql);
}

console.log("runtime-bridge v54 security and reliability gates: PASS");

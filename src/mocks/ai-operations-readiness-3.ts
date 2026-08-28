// ============================================================================
// AI Operations — Phase 2 closeout readiness data.
//
// ⚠️ Planning/status data only — no live connection, no table creation, no
// agent execution is implied. Reflects the Phase 2 control-plane completion
// and the still-open runtime work that keeps the platform at NO-GO.
// ============================================================================

export type Phase2ItemState = 'complete' | 'not_started' | 'blocked';

export interface Phase2CloseoutItem {
  name: string;
  state: Phase2ItemState;
}

export const phase2ControlPlane: Phase2CloseoutItem[] = [
  { name: 'Database Persistence', state: 'complete' },
  { name: 'Core Registries', state: 'complete' },
  { name: 'Governance Persistence', state: 'complete' },
  { name: 'Group Live Data', state: 'complete' },
  { name: 'Dynamic Search', state: 'complete' },
  { name: 'Cross-Module Registry Wiring', state: 'complete' },
];

export const phase2Runtime: Phase2CloseoutItem[] = [
  { name: 'Runtime Monitoring', state: 'not_started' },
  { name: 'Agent Runtime', state: 'not_started' },
  { name: 'n8n Runtime', state: 'not_started' },
  { name: 'Tool Connectivity', state: 'not_started' },
  { name: 'Model Connectivity', state: 'not_started' },
  { name: 'Knowledge Retrieval', state: 'not_started' },
  { name: 'Notification Delivery', state: 'not_started' },
  { name: 'Scheduler Runtime', state: 'not_started' },
  { name: 'Automated Remediation', state: 'not_started' },
];

export const phase3EntryGates: string[] = [
  'Runtime monitoring',
  'Service identity',
  'Richer operational roles',
  'Transactional governance writes',
  'Kill switch',
  'n8n connectivity',
  'Model provider connectivity',
  'Tool connection testing',
  'Runtime audit capture',
  'Rollback / recovery testing',
];

export const noGoReasons: string[] = [
  'No runtime agent engine',
  'No n8n execution connection',
  'No live tool execution',
  'No live model provider connectivity',
  'No live knowledge retrieval',
  'No automatic policy enforcement',
  'No production kill switch',
  'Richer approver / security roles still incomplete',
];

export const phase2ProductionEnabled = 0;
export const phase2Overall = 'NO-GO';

// --- Phase 3 — Runtime Connectivity & Health ---------------------------------

export type RuntimeHealthReadinessState = 'ready' | 'not_started' | 'not_configured' | 'partial';

export interface RuntimeHealthReadinessItem {
  name: string;
  state: RuntimeHealthReadinessState;
  note: string;
}

export const runtimeHealthReadiness: RuntimeHealthReadinessItem[] = [
  { name: 'Runtime Health Framework', state: 'ready', note: 'Server-side `runtime-health` Edge Function + Runtime Health page built.' },
  { name: 'Runtime Monitoring Framework', state: 'ready', note: 'Persisted health history (checks/sweeps) + failure/recovery thresholds + alert dedupe.' },
  { name: 'Scheduled Monitoring', state: 'ready', note: 'Server-side pg_cron scheduler drives recurring allowlisted checks (15-minute interval).' },
  { name: 'Supabase Connectivity', state: 'ready', note: 'Safe read-only database verification (no writes).' },
  { name: 'n8n Connectivity', state: 'not_configured', note: 'No n8n instance URL / API key configured.' },
  { name: 'Local Model Connectivity (Ollama)', state: 'not_configured', note: 'No Ollama host URL configured.' },
  { name: 'Cloud Model Connectivity (OpenAI / Anthropic)', state: 'not_configured', note: 'No provider API keys configured.' },
  { name: 'Tool Connectivity (GitHub / Stripe / Resend)', state: 'partial', note: 'Monitoring + history live; actual tool credentials still not configured.' },
  { name: 'Notification Connector Connectivity', state: 'not_configured', note: 'No notification runtime provider connected.' },
  { name: 'Site API Connectivity', state: 'not_configured', note: 'No safe per-site API health endpoint configured.' },
];

// --- Phase 3 Prompt 03 — Runtime Configuration Readiness ----------------------

export const runtimeConfigurationReadiness: RuntimeHealthReadinessItem[] = [
  { name: 'Scheduler Handshake', state: 'partial', note: 'Cron job + scheduled function registered; no persisted scheduled sweep yet — handshake unverified.' },
  { name: 'n8n Configuration', state: 'not_configured', note: 'N8N_URL / N8N_API_KEY not present in Edge Function Secrets.' },
  { name: 'Ollama Configuration', state: 'not_configured', note: 'OLLAMA_URL not present; local network not reachable from cloud Edge runtime.' },
  { name: 'OpenAI Configuration', state: 'not_configured', note: 'OPENAI_API_KEY not present.' },
  { name: 'Anthropic Configuration', state: 'not_configured', note: 'ANTHROPIC_API_KEY not present.' },
  { name: 'Resend Configuration', state: 'not_configured', note: 'RESEND_API_KEY not present (no email sent).' },
  { name: 'Stripe Configuration', state: 'not_configured', note: 'STRIPE_SECRET_KEY not present (no financial object).' },
  { name: 'GitHub Configuration', state: 'not_configured', note: 'GITHUB_TOKEN not present (no write).' },
  { name: 'Site API Configuration', state: 'not_configured', note: 'No approved per-site health endpoint configured.' },
];

export type Phase3GateItemState = 'verified' | 'pending' | 'blocked';

export interface Phase3GateItem {
  name: string;
  state: Phase3GateItemState;
}

export const runtimeConnectionConfigurationGate: {
  name: string;
  state: 'blocked' | 'open';
  summary: string;
  items: Phase3GateItem[];
} = {
  name: 'Runtime Connection Configuration',
  state: 'blocked',
  summary:
    'The connections required for the first pilot agent must be genuinely verified (configuration present + safe runtime check passed) before pilot runtime activation.',
  items: [
    { name: 'Supabase connectivity', state: 'pending' },
    { name: 'Scheduler handshake', state: 'blocked' },
    { name: 'n8n configuration', state: 'blocked' },
    { name: 'Model provider configuration', state: 'blocked' },
    { name: 'Tool connection configuration', state: 'blocked' },
    { name: 'Knowledge retrieval', state: 'blocked' },
  ],
};

// --- Phase 3 Prompt 04 — Runtime Safety Controls ------------------------------

export const runtimeSafetyControls: RuntimeHealthReadinessItem[] = [
  { name: 'Master Kill Switch', state: 'ready', note: 'Authoritative group-wide kill switch provisioned ON — all execution blocked.' },
  { name: 'Runtime Gate Engine', state: 'ready', note: 'Deterministic 14-gate fail-closed evaluator (ai_runtime_controls).' },
  { name: 'Site Gates', state: 'ready', note: 'Per-site execution gates — default deny, no site allowed.' },
  { name: 'Agent Gates', state: 'ready', note: 'Per-agent execution gates — default deny, no agent allowed.' },
  { name: 'Risk Gate', state: 'ready', note: 'Risk ceiling gate — production ceiling GREEN (still blocked by the master switch).' },
  { name: 'Approval Gate', state: 'ready', note: 'Approval respected; approval alone never enables execution.' },
  { name: 'Policy Gate', state: 'ready', note: 'Live security-policy effects (deny/restrict/require-approval) block.' },
  { name: 'Runtime Configuration Gate', state: 'ready', note: 'Missing required runtime dependencies block execution.' },
  { name: 'Runtime Health Gate', state: 'ready', note: 'Unavailable/unverified runtime dependencies block execution.' },
];

// --- Phase 3 Prompt 05 — Trusted Runtime Boundary -----------------------------

export const runtimeBoundaryControls: RuntimeHealthReadinessItem[] = [
  { name: 'Runtime Gateway', state: 'ready', note: 'Central deny-only `ai-runtime-gateway` Edge Function — the single intended execution entry point.' },
  { name: 'Service Identity Registry', state: 'ready', note: 'Allowlisted service identities (blocked/registry-only); no credentials stored in rows.' },
  { name: 'Request Authentication', state: 'ready', note: 'Human JWT + machine HMAC signature (fail-closed); anonymous requests always rejected.' },
  { name: 'Idempotency', state: 'ready', note: 'Idempotency key required; replays return the stored result — no duplicate attempts.' },
  { name: 'Replay Protection', state: 'ready', note: 'Server-side timestamp window + expiry + idempotency checks.' },
  { name: 'Server-side Gate Evaluation', state: 'ready', note: 'Authoritative 14-gate evaluation reloads site/agent/approval/policy/health server-side.' },
  { name: 'Execution Dispatch', state: 'not_started', note: 'The gateway only evaluates — it never dispatches an agent, run, workflow or model.' },
];

// --- Phase 3 Prompt 06 — n8n Runtime Connector --------------------------------

export const runtimeN8nConnector: RuntimeHealthReadinessItem[] = [
  { name: 'Connector Framework', state: 'ready', note: 'Server-side `n8n-runtime-connector` Edge Function built — read-only, allowlisted operations only.' },
  { name: 'Server-side Authentication', state: 'ready', note: 'verify_jwt + internal_role() gate; N8N_URL / N8N_API_KEY stay server-side, never reach the browser.' },
  { name: 'Workflow Discovery', state: 'not_configured', note: 'Discovery adapter built but blocked — N8N_URL / N8N_API_KEY not configured in Edge Function Secrets.' },
  { name: 'Workflow Allowlist', state: 'ready', note: 'ai_n8n_workflow_registry table + RLS (owner/admin write, internal read, no delete).' },
  { name: 'Mapping Verification', state: 'partial', note: 'Read-only verify built (rename/node/trigger checks); cannot run until n8n is reachable.' },
  { name: 'Drift Detection', state: 'ready', note: 'Rename / node-count / trigger-type drift → mapping marked Review Required.' },
  { name: 'Dispatch Preview', state: 'ready', note: 'Dry-run preview returns BLOCKED under current controls; never calls n8n execution/webhook.' },
  { name: 'Execution Dispatch', state: 'not_started', note: 'The connector only previews — execution dispatch intentionally not started.' },
];

// --- Phase 3 Prompt 07 — Runtime Message Boundary -----------------------------

export const runtimeMessageBoundary: RuntimeHealthReadinessItem[] = [
  { name: 'Message Envelope', state: 'ready', note: 'Versioned v1 canonical runtime-message contract (64 KB limit, strict field validation).' },
  { name: 'Signed Callback Verification', state: 'ready', note: 'HMAC-SHA256 deterministic canonical signature (identity + timestamp + nonce + method + path + payload hash).' },
  { name: 'Service Identity Verification', state: 'ready', note: '`dfp-n8n-runtime` revalidated server-side (type n8n, env match, allowlisted credential reference).' },
  { name: 'Timestamp Validation', state: 'ready', note: '±5-minute window; occurred_at / received_at persisted separately.' },
  { name: 'Replay Protection', state: 'ready', note: 'Nonce reuse + duplicate message_id rejected (idempotent), timestamp + signature-version checks.' },
  { name: 'Callback Ledger', state: 'ready', note: 'Append-only `ai_runtime_callbacks` (no UPDATE/DELETE policies; browser cannot insert).' },
  { name: 'n8n Callback Handshake', state: 'not_configured', note: 'Not verified until a genuine signed handshake arrives — signing secret + n8n not yet configured.' },
  { name: 'Runtime Result Processing', state: 'not_started', note: 'Not Started — no authorised dispatch exists; workflow callbacks are record/reject-only.' },
  { name: 'Run State Mutation', state: 'not_started', note: 'Disabled — callbacks never mutate ai_runs or orchestration execution state.' },
];

// --- Phase 3 Prompt 08 — Private Runtime Bridge -------------------------------

export const runtimeBridgeReadiness: RuntimeHealthReadinessItem[] = [
  { name: 'Bridge Framework', state: 'ready', note: 'Server-side `runtime-bridge` Edge Function + local `dfp-runtime-bridge` service (outbound-first).' },
  { name: 'Machine Authentication', state: 'ready', note: 'HMAC-SHA256 signed headers + `dfp-local-runtime-bridge` service identity (fail-closed).' },
  { name: 'Replay Protection', state: 'ready', note: 'Nonce reuse + duplicate message_id rejected; ±5-minute timestamp window.' },
  { name: 'Outbound Connectivity', state: 'ready', note: 'Local runtime dials OUT over HTTPS — no inbound port exposure to n8n/Ollama/Docker.' },
  { name: 'Heartbeat', state: 'ready', note: 'Controlled outbound heartbeat (60s default) + append-only heartbeat ledger.' },
  { name: 'Capability Registration', state: 'ready', note: 'Allowlisted capabilities only (n8n/ollama health; no shell/arbitrary-http/filesystem/docker).' },
  { name: 'Local n8n Health', state: 'not_configured', note: 'Bridge may check local /healthz; not verified until a genuine bridge handshake reports it.' },
  { name: 'Local Ollama Health', state: 'not_configured', note: 'Bridge may check local /api/tags (no inference); not verified until a genuine handshake.' },
  { name: 'Execution Transport', state: 'not_started', note: 'Not Started / Disabled — the bridge is transport only and never owns execution authority.' },
];

// --- Phase 3 Prompt 10 — Private runtime dry-run transport probe --------------

export const runtimeTransportReadiness: RuntimeHealthReadinessItem[] = [
  { name: 'Outbound Bridge', state: 'ready', note: 'Reuses the verified HAL private runtime bridge — no new transport or queue is created.' },
  { name: 'Signed Authentication', state: 'ready', note: 'Existing HMAC-SHA256 signed bridge identity + `dfp-local-runtime-bridge` service identity (fail-closed).' },
  { name: 'Control Message Delivery', state: 'partial', note: 'Ready once a queued `runtime_transport_probe` is delivered to HAL and signed back — verified on a real probe.' },
  { name: 'Signed Acknowledgement', state: 'partial', note: '`report_transport_probe_ack` allowlisted; verified once a genuine signed ack is received and validated.' },
  { name: 'Replay / Idempotency', state: 'ready', note: 'Duplicate probe ACK returns the existing acknowledgement — no duplicate transport evidence.' },
  { name: 'Round-Trip Verification', state: 'partial', note: 'Measures queued → signed-acknowledgement latency; Ready only when a real probe succeeds.' },
  { name: 'Execution Transport', state: 'partial', note: 'Dry-Run Only — the probe proves transport, never execution; no n8n/Ollama/agent action.' },
  { name: 'Execution Dispatch', state: 'not_started', note: 'Not Started — transport verification never satisfies the master kill switch, production, site/agent/approval/policy gates.' },
];

// --- Phase 3 Prompt 09C — Local Ollama catalogue relay + registry comparison ---

export interface OllamaCatalogueReadinessItem {
  name: string;
  state: RuntimeHealthReadinessState;
  note: string;
}

export const ollamaCatalogueReadiness: OllamaCatalogueReadinessItem[] = [
  { name: 'Bridge Connectivity', state: 'ready', note: 'HAL runtime bridge deployed with a verified outbound handshake + fresh heartbeat.' },
  { name: 'Catalogue Relay', state: 'partial', note: 'Sanitised `/api/tags` relay (name/family/parameters/quantisation/classification) via `report_ollama_catalogue`. Verified once a genuine catalogue is relayed.' },
  { name: 'Registry Comparison', state: 'ready', note: 'Deterministic exact-match comparison against `ai_operations_models` — no fuzzy/AI matching, no auto-registration.' },
  { name: 'Model Availability', state: 'partial', note: 'Partial until the relayed catalogue is compared — present/missing/unregistered is derived from the actual mapping.' },
  { name: 'Inference Runtime', state: 'not_started', note: 'Not Started — no prompt, embedding, pull or delete is ever issued. Catalogue observation only.' },
];

export const pilotExecutionGate: {
  name: string;
  state: 'blocked' | 'open';
  summary: string;
  requirements: { label: string; met: boolean }[];
} = {
  name: 'Pilot Execution Authorisation',
  state: 'blocked',
  summary:
    'A future gate that remains BLOCKED until a selected pilot site and agent are explicitly allowed and every required dependency is genuinely verified. The control existing does not authorise execution.',
  requirements: [
    { label: 'Master kill switch controlled', met: false },
    { label: 'Selected site explicitly allowed', met: false },
    { label: 'Selected agent explicitly allowed', met: false },
    { label: 'Required runtime dependencies verified', met: false },
    { label: 'Health green', met: false },
    { label: 'Policy pass', met: false },
    { label: 'Approval pass where required', met: false },
    { label: 'Runtime audit ready', met: false },
    { label: 'Rollback procedure defined', met: false },
    { label: 'Trusted caller identity', met: false },
    { label: 'Fresh runtime health', met: false },
    { label: 'Valid gate evaluation', met: false },
    { label: 'Idempotent request', met: false },
    { label: 'n8n reachable from execution runtime (if pilot uses n8n)', met: false },
    { label: 'Approved n8n workflow mapping', met: false },
    { label: 'n8n workflow verification current', met: false },
    { label: 'No unresolved n8n mapping drift', met: false },
    { label: 'Signed runtime callback channel configured', met: false },
    { label: 'n8n callback handshake verified (if pilot uses n8n)', met: false },
    { label: 'Replay protection verified', met: false },
    { label: 'Correlation validation ready', met: false },
    { label: 'Result-processing policy defined', met: false },
    { label: 'Private runtime bridge deployed', met: false },
    { label: 'Bridge handshake verified', met: false },
    { label: 'Local n8n reachable through bridge (if required)', met: false },
    { label: 'Local Ollama reachable through bridge (if required)', met: false },
    { label: 'Bridge execution transport explicitly enabled (future)', met: false },
    { label: 'Current health fresh', met: false },
  ],
};
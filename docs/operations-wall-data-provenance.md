# DFP Operations Wall — Data Provenance

Truthfulness and data-provenance record for every value rendered on the DFP
Operations Wall (`/ai-operations/wallboard`). This document classifies each
displayed value as exactly one of **LIVE**, **DERIVED LIVE**, **CONFIGURATION**,
**SIMULATED**, or **UNAVAILABLE**, and records its source, freshness rule,
missing-data behaviour and simulation behaviour.

No credentials, URLs, tokens, user emails or sensitive payloads are recorded
here.

## Provenance classification

| Class | Meaning |
| --- | --- |
| **LIVE** | Directly received from a current authoritative source. |
| **DERIVED LIVE** | Calculated only from current authoritative live records. |
| **CONFIGURATION** | Registry, planned estate, or manually configured metadata. |
| **SIMULATED** | Operator-injected test data (clearly labelled). |
| **UNAVAILABLE** | No authoritative source currently exists. |

---

## Core Systems rail (left)

| Display label | Selector | Underlying source | Class | Freshness | Missing-data | Simulation |
| --- | --- | --- | --- | --- | --- | --- |
| HAL (orchestration node) | `getCoreSystems()` → `halStatus()` | `getHalHost()` → `HAL_RUNTIME_NODE_KEY` (`atlas-hal-runtime-01`) bridge node + heartbeat | DERIVED LIVE | 2 / 5 min reachable / stale thresholds | `UNKNOWN` (never falls back to first host) | n/a |
| TRON (AI overwatch) | `getCoreSystems()` → `tronStatus()` | `getOversight()` → `getTronHost()` → `TRON_RUNTIME_NODE_KEY` (`atlas-tron-runtime-01`) | DERIVED LIVE | 2 / 5 min thresholds | `UNKNOWN` / `NOT CONNECTED` (never falls back to HAL) | n/a |
| N8N-01 | `getCoreSystems()` → `n8nStatusByKey('n8n-primary')` | `getN8nInstances()` resolved by stable key `n8n-primary` | DERIVED LIVE | connector reachability snapshot | `UNKNOWN` if key absent | n/a |
| N8N-02 | `getCoreSystems()` → `n8nStatusByKey(null)` | no second instance registered | UNAVAILABLE | n/a | `UNKNOWN` (no stable identity) | n/a |
| SUPABASE | `getCoreSystems()` → `supabaseStatus()` | `getDatabaseSummary()` | DERIVED LIVE | db summary snapshot | `UNKNOWN` | n/a |
| NETWORK | `getCoreSystems()` → `networkStatus()` | `getInfrastructureNetwork()` (HAL bridge) | DERIVED LIVE | bridge freshness | `UNKNOWN` | n/a |
| STORAGE | `getCoreSystems()` → `storageStatus()` | `getInfrastructureStorage()` (`dfp_service_health`) | DERIVED LIVE | service-health snapshot | `UNKNOWN` when empty | n/a |

---

## Compute Core (HAL / TRON / DFP Relay)

| Display label | Selector | Underlying source | Class | Freshness | Missing-data | Simulation |
| --- | --- | --- | --- | --- | --- | --- |
| HAL state | `getComputeCore().hal.state` | `getHalHost()` (HAL node only) | DERIVED LIVE | 2 / 5 min thresholds | `OFFLINE` | badge shown |
| HAL · AGENT RUNS | `getComputeCore().hal.metrics` | `getStatusBarMetrics().activeRuns` | DERIVED LIVE | live registry | real count | n/a |
| HAL · BRIDGE | `getComputeCore().hal.metrics` | `getHalHost().state` → `bridgeLabel()` | DERIVED LIVE | 2 / 5 min thresholds | `UNKNOWN` | n/a |
| HAL · CPU / MEMORY | `getComputeCore().hal.gauges` | HAL heartbeat `local_services.host` | DERIVED LIVE | heartbeat age | `—` + `NOT MONITORED` (never 0) | shown but badge marked |
| TRON state | `getComputeCore().tron.state` | `getTronHost()` (TRON node only) | DERIVED LIVE | 2 / 5 min thresholds | `NOT CONNECTED` | badge shown |
| TRON · MODELS | `getComputeCore().tron.dials.models` | TRON `ollamaModelCount` | DERIVED LIVE | heartbeat age | `—` | badge shown |
| TRON · OLLAMA | `getComputeCore().tron.dials.ollama` | TRON `ollamaStatus` | DERIVED LIVE | heartbeat age | `UNKNOWN` | badge shown |
| DFP Relay | `getComputeCore().link` | HAL + TRON states (independent) | DERIVED LIVE | 2 / 5 min thresholds | `OFFLINE` / `PARTIAL` | n/a |

**Note:** `UPTIME → LINKED` was removed — it was not an uptime measurement. The
row is now `BRIDGE` and shows the authoritative bridge state (`LIVE` / `STALE` /
`OFFLINE` / `UNKNOWN`).

---

## Runtime Resilience (HAL / TRON)

A dedicated, isolated resilience band. Data is composed from the EXISTING
authoritative bridge sources plus two new dedicated tables — no field has a
competing source of truth.

- **Node identity / bridge state / cloud heartbeat** → `ai_runtime_bridge_nodes`
  (authoritative, `atlas-hal-runtime-01` / `atlas-tron-runtime-01`).
- **n8n / Ollama / CPU / memory** → newest per-node `ai_runtime_bridge_heartbeats`
  (`n8n_status`, `ollama_status`, `local_services.ollama.model_count`,
  `local_services.host.cpu_percent` / `memory_percent`).
- **Watchdog / LOCAL liveness / fault+recovery / restart / container-uptime /
  temperature** → `runtime_resilience_nodes` (new snapshot; one row per node,
  `node_id` FK to the bridge node).
- **Recovery history** → `runtime_recovery_events` (new append-only table,
  newest-first bounded read).

| Display field | Source | Class | Missing-data behaviour |
| --- | --- | --- | --- |
| Node state (HEALTHY / DEGRADED / RECOVERING / OFFLINE / WATCHDOG FAULT) | central `evaluateNodeState()` over composed node | DERIVED LIVE | `AWAITING TELEMETRY` until a resilience snapshot exists (never HEALTHY) |
| Bridge status | `deriveBridgeNodeState()` (2 / 5 min windows) | DERIVED LIVE | `NOT REGISTERED` |
| Watchdog | `runtime_resilience_nodes.watchdog_status` | DERIVED LIVE | `UNAVAILABLE` (not a fault) |
| Last heartbeat | bridge node `last_heartbeat_at` / `last_seen_at` | DERIVED LIVE | `—` |
| Local liveness age | `runtime_resilience_nodes.last_liveness_at` / `liveness_age_ms` (own 60s window, NOT the cloud heartbeat) | DERIVED LIVE | `UNAVAILABLE` (never derived from heartbeat) |
| Last fault / reason | `runtime_resilience_nodes.last_fault_at` / `last_fault_reason` | DERIVED LIVE | `NO RECORDED FAULT` |
| Last recovery (duration) | `runtime_resilience_nodes.last_recovery_ms` | DERIVED LIVE | `—` and result `—` (never auto-PASS) |
| Recovery target / met | target = 5000ms; `met = last_recovery_ms <= target` | DERIVED LIVE | result `—` when no recovery data |
| Restarts 24h / container uptime | `runtime_resilience_nodes` counters | DERIVED LIVE | `UNAVAILABLE` (never 0) |
| Ollama models | heartbeat `local_services.ollama.model_count` | DERIVED LIVE | `UNAVAILABLE` (never 0) |
| CPU / RAM | heartbeat `local_services.host.cpu_percent` / `memory_percent` | DERIVED LIVE | `UNAVAILABLE` (never 0) |
| Temperature | `runtime_resilience_nodes.temperature_c` | DERIVED LIVE | `UNAVAILABLE` (never 0) |
| Recovery events | `runtime_recovery_events` (node, method, fault/recovered times, reason, target result) | DERIVED LIVE | `NO RECOVERY EVENTS RECORDED` |

**Key rules:**
- Local liveness and cloud heartbeat remain separate — liveness is never
  computed from heartbeat timestamps, and the cloud heartbeat interval is never
  used as the recovery timer.
- `target_met = recovery_ms <= target_ms`; the node result derives from real
  `last_recovery_ms` only. Missing recovery data never renders PASS.
- WATCHDOG FAULT (watchdog stopped/failed while bridge may run) is distinct from
  OFFLINE (bridge stopped reporting beyond the authoritative 5-minute timeout).
- Incomplete optional telemetry alone never marks a node OFFLINE.
- The runtime bridge remains outbound-only and fail-closed; this band adds no
  inbound control path to HAL or TRON.

---

## AI Systems card (Compute Core right)

| Display label | Selector | Underlying source | Class | Freshness | Missing-data | Simulation |
| --- | --- | --- | --- | --- | --- | --- |
| MODEL STATUS | `getAiSystemsStatus()` → `model_status` | **TRON's own paired Ollama heartbeat** (`getTronHost().ollamaStatus`) | DERIVED LIVE | heartbeat age | `UNKNOWN` | badge shown |
| VECTOR DB | `getAiSystemsStatus()` → `vector_db` | `getVectorHealth().embedded` (knowledge registry) | DERIVED LIVE | registry snapshot | `UNKNOWN` | n/a |
| TOOLS | `getAiSystemsStatus()` → `tools` | `getSecurityConnections()` (tool registry) | DERIVED LIVE | registry snapshot | `UNKNOWN` | n/a |
| SAFETY | `getAiSystemsStatus()` → `safety` | `getSecuritySummary()` | DERIVED LIVE | registry snapshot | `UNKNOWN` | n/a |

**Vector DB semantics:** `INDEXED` (embeddings > 0), `EMPTY` (available, zero),
`UNKNOWN` (unavailable). An embedding count is **never** presented as a live
connection — there is no vector-store health check.

**Model status semantics:** single explicit source (TRON Ollama heartbeat) —
no blended HAL/TRON/registry state.

---

## Site modules (Group Operations)

| Display label | Selector | Underlying source | Class | Freshness | Missing-data |
| --- | --- | --- | --- | --- | --- |
| Site state (ACTIVE / DEGRADED / OFFLINE / NOT CONFIGURED) | `getSiteModules()` → `siteState()` | `ai_sites.operational_status` (registry) | CONFIGURATION | registry snapshot | `NOT CONFIGURED` |
| Site heartbeat (LIVE / STALE / OFFLINE / NOT MONITORED) | `getSiteModules()` → `resolveHeartbeat()` | `internal_monitored_websites` | DERIVED LIVE | 10 min stale threshold | `NOT MONITORED` |
| USERS | `getSiteModules().users` | `getUsersOnline()` presence | DERIVED LIVE | 5 min presence window | `—` |
| AGENTS | `getSiteModules().agents` | `getSiteHealth().activeAgents` | DERIVED LIVE | registry snapshot | real count |
| ALERTS | `getSiteModules().alerts` | `getSiteHealth().alerts` | DERIVED LIVE | registry snapshot | real count |

**Key rule:** registry `active` → **ACTIVE**, never `ONLINE`. `ONLINE` requires
a fresh successful monitor result (heartbeat `LIVE`).

---

## Group metrics (top bar)

| Display label | Selector | Source | Class | Missing-data |
| --- | --- | --- | --- | --- |
| SITES ONLINE | `getGroupMetrics().sitesOnline` | fresh `LIVE` monitor results only | DERIVED LIVE | `—/configured` + `NOT MONITORED` |
| ESTATE ring | `getGroupMetrics().estatePercent` | online / monitored-configured | DERIVED LIVE | `—` + `NOT MONITORED` / `NOT CONFIGURED` |
| USERS ACTIVE | `getGroupMetrics().usersActive` | presence total | DERIVED LIVE | `—` |
| AGENTS RUNNING | `getGroupMetrics().agentsRunning` | `getStatusBarMetrics().agentsWorking` | DERIVED LIVE | real count |
| ALERTS | `getGroupMetrics().alerts` | `criticalAlerts` | DERIVED LIVE | real count |

**Estate ring numerator/denominator:** numerator = sites with a fresh successful
monitor (heartbeat `LIVE`); denominator = configured sites with any monitor
reading (fresh success, fresh failure, or stale). A percentage is never
derived from configuration state alone.

---

## Autonomous Operations rail (right)

| Display label | Selector | Underlying source | Class | Missing-data |
| --- | --- | --- | --- | --- |
| Master agent state | `getMasterAgentRows().state` | `getSiteMasterCards()` / `getGroupOrchestrator()` | DERIVED LIVE | `NOT ASSIGNED` |
| Task | `getMasterAgentRows().task` | `current_task` | DERIVED LIVE | `No active task` |
| Reference key | `getMasterAgentRows().refKey` | real `agent_key` (persisted) | LIVE | `—` (never a synthetic `T-xxxx`) |
| Progress | `getMasterAgentRows().progress` | **none exists** | UNAVAILABLE | `null` → inactive segments |

**Removed:** `taskIdFor()` (deterministic synthetic `T-xxxx` ids) and
`progressFor()` (invented progress from agent state). `RUNNING` no longer
implies six-of-eight segments. Real agent state is preserved separately via
`state`.

---

## Live Events ticker (bottom)

| Display label | Selector | Underlying source | Class | Missing-data |
| --- | --- | --- | --- | --- |
| Event entries | `getLiveEvents()` | `getWallboardActivity(40)` → `data.auditEvents` | DERIVED LIVE | `NO RECENT OPERATIONAL EVENTS` |
| LIVE / SIMULATED badge | `getLiveEvents().provenance` | `event === 'simulate_runtime_heartbeat'` | LIVE / SIMULATED | n/a |

Deduplication key: `site + sourceType + normalised(event) + status + provenance`
(display-only, newest-first, up to 12 unique). Sensitive fields (actor email,
UUIDs, notes, payloads, prompts, credentials) are never selected.

---

## Simulated heartbeat handling

A runtime heartbeat is **SIMULATED** when its `heartbeat_key` starts with `SIM-`
(injected by the authenticated `simulate-runtime-heartbeat` Edge Function; real
heartbeats use an `HB` prefix). When the latest HAL or TRON heartbeat is
simulated:

- Test values stay visible.
- An amber `SIMULATED` badge appears on the affected runtime card.
- The heartbeat is **not** labelled ordinary `LIVE`.
- `execution_enabled` is unchanged; simulation is **not** treated as evidence of
  real execution.
- A following real (`HB`) heartbeat automatically clears the badge.

---

## Approved static configuration (not demo data)

| Item | Class |
| --- | --- |
| Site names, short codes, brand colours, subtitles | CONFIGURATION |
| Planned estate layout (`SITE_BRANDS`) | CONFIGURATION |
| HAL / TRON stable node keys (`atlas-hal-runtime-01`, `atlas-tron-runtime-01`) | CONFIGURATION |
| Interface labels | CONFIGURATION |
| Refresh intervals, health/staleness thresholds | CONFIGURATION |
| Visual styling constants | CONFIGURATION |

---

## Remaining integration gaps (UNAVAILABLE)

| Area | Note |
| --- | --- |
| Vector-store health check | No pgvector / vector-service runtime exists; `embedding_state` is a registry marker only. |
| Host CPU / GPU / disk / temperature | No authoritative telemetry beyond HAL's relayed CPU/memory. |
| Per-agent progress | No numeric progress field exists on master agents. |
| Second n8n instance | Only a single instance (`n8n-primary`) is registered. |
| Website monitor coverage | `internal_monitored_websites` domains differ from `ai_sites` registry domains — unmatched sites surface as `NOT MONITORED`. |
| Presence / analytics | Treated as DERIVED LIVE when available; otherwise `—`. |
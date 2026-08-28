# dfp-runtime-bridge

Private local runtime bridge for **DFP AI Operations** — the secure outbound-first
link between DFP Command / Supabase and trusted local infrastructure (n8n, Ollama,
future local runtime services).

> **This is connectivity + heartbeat + safe local health relay + three single fixed
> sandbox diagnostics only.** It never executes an agent or a business workflow,
> never performs arbitrary Ollama inference, never runs a shell command, and never
> proxies arbitrary URLs. The only "execution" permitted is: (1) the fixed
> `dfp_ollama_ping_v1` Ollama sandbox ping (Prompt 11A), and (2) the fixed
> `DFP Runtime Sandbox Ping` n8n diagnostic workflow (Prompt 12) — both hard-coded
> and fail-closed. It never owns execution authority — it is transport + diagnostics
> only.

## Architecture

```
LOCAL RUNTIME (n8n / Ollama)
        ▲  local read-only checks
        │  (N8N_LOCAL_URL /healthz, OLLAMA_LOCAL_URL /api/tags)
        │
dfp-runtime-bridge (this service)  ──OUTBOUND HTTPS──▶  DFP `runtime-bridge` Edge Function
        │  (signed HMAC handshake/heartbeat/health relay)
        │
        └── NEVER opens local ports / no inbound TCP / no public tunnel
```

The cloud never requires direct inbound TCP access to n8n, Ollama, Docker, the
private LAN, or Tailscale-only hosts. Local check targets are configured **here**,
never supplied by the cloud.

## Requirements

* Deno 2.x (or Docker).
* A trusted runtime machine that can make outbound HTTPS to the DFP endpoint.

## Configure

```bash
cp .env.example .env   # then fill in real values (names only in .env.example)
```

Required variables:

| Variable | Purpose |
|---|---|
| `DFP_BRIDGE_ENDPOINT` | Full HTTPS URL of the `runtime-bridge` Edge Function |
| `DFP_BRIDGE_IDENTITY` | Bridge service identity (default `dfp-local-runtime-bridge`) |
| `DFP_BRIDGE_SIGNING_SECRET` | HMAC signing secret (must equal `DFP_RUNTIME_BRIDGE_SIGNING_KEY` in Supabase Secrets) |
| `DFP_BRIDGE_NODE_KEY` | Stable key for this node |
| `N8N_LOCAL_URL` | Local n8n URL (optional) |
| `N8N_SANDBOX_WEBHOOK_PATH` | Fixed local n8n webhook path for the dedicated `DFP Runtime Sandbox Ping` diagnostic (e.g. `/webhook/dfp-runtime-sandbox-ping`); probe fails closed when unset/invalid |
| `OLLAMA_LOCAL_URL` | Local Ollama URL (optional) |

## Run

```bash
# Deno (dev)
deno run --allow-env --allow-net src/main.ts

# Docker
docker compose up -d
```

## Safety properties

* **Outbound-first** — no inbound ports, no router port-forwarding, no public tunnel.
* **Fail-closed offline** — if the cloud is unreachable it retries with backoff and
  never switches into autonomous execution. There is no offline execution mode.
* **Signed machine auth** — HMAC-SHA256 over identity + timestamp + nonce + method +
  path + payload hash, with a ±5-minute window and nonce replay protection.
* **Allowlisted capabilities only** — `n8n_health`, `n8n_metadata`, `ollama_health`,
  `ollama_models`, `signed_callbacks`, `outbound_https`. No shell/arbitrary-http/
  filesystem/docker capability exists.
* **No secrets leave the host** — the cloud learns only `configured true/false` and
  sanitised status, never values/lengths/prefixes.

## Current state

The bridge software is **ready for local deployment** but is **not yet running or
verified**. Until a genuine authenticated outbound handshake produces a valid node +
heartbeat, the DFP control plane reports the bridge as **Not Verified**, and runtime
execution remains **BLOCKED** (Master Kill Switch ON · Production Enabled 0 · Execution
Dispatch Not Started).
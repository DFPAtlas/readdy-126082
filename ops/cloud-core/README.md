# Cloud Core heartbeat (stage 1)

This stage registers only the health of the planned `cloud-core-01` node. It does not install n8n, enable agent routes, or turn on execution. The Wall's dispatch state remains **DISABLED**.

## Prerequisites

- A trusted Cloud Core VPS with Node.js 22+ and an n8n process answering `http://127.0.0.1:5678/healthz`.
- The DFP Supabase service-role key, stored only in `/etc/dfp/cloud-core.env` on the VPS. This key has broad database privileges; never place it in Git, Readdy, a browser, or n8n workflow output.
- Outbound HTTPS to the DFP Supabase project. No inbound management port is needed for this heartbeat.

## Install after n8n is healthy

1. Create a dedicated `dfp-core` system user and `/opt/dfp-cloud-core`.
2. Copy `heartbeat.mjs` into that directory. Copy `cloud-core.env.example` to `/etc/dfp/cloud-core.env`, add the key, and set owner root with mode 0600. The systemd manager reads the root-owned environment file before starting the service; do not make it world-readable.
3. Copy `dfp-cloud-core-heartbeat.service` to `/etc/systemd/system/` and adjust `ExecStart` if Node is elsewhere. Run `systemctl daemon-reload && systemctl enable --now dfp-cloud-core-heartbeat.service`.
4. Check `journalctl -u dfp-cloud-core-heartbeat.service -n 30 --no-pager`. It should report `heartbeat_recorded`.
5. In DFP Supabase, read `dfp_runtime_node_status` for `cloud-core-01`. It should show `observed_status=online` and `dispatch_ready=false`. The Wall's /platform page should show the same.

The worker checks local n8n health every 30 seconds and updates only `heartbeat_at` for the fixed Cloud Core node. If n8n or Supabase is unavailable it stops updating; the database view marks the heartbeat offline after 90 seconds. It cannot enable task execution or claim jobs.

## Rollback

`systemctl disable --now dfp-cloud-core-heartbeat.service`. Wait 90 seconds for the Wall to show offline. No database row or existing HAL/TRON bridge is removed.

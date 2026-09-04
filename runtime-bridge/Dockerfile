# ============================================================================
# dfp-runtime-bridge — lightweight Deno runtime for the private local bridge.
# Outbound-first: the container dials OUT to DFP; no inbound ports are exposed.
# ============================================================================

FROM denoland/deno:2.1.4

WORKDIR /app

# Copy the bridge source (only the service code — no secrets).
COPY src/main.ts ./src/main.ts

# Runs with --allow-env (config), --allow-net (outbound HTTPS + local health
# checks) and --allow-sys=cpus,systemMemoryInfo (CPU/memory telemetry only).
# NO shell/filesystem/arbitrary-execution permissions.
CMD ["run", "--allow-env", "--allow-net", "--allow-sys=cpus,systemMemoryInfo", "src/main.ts"]
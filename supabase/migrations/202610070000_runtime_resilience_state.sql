-- ============================================================================
-- Runtime Resilience state — dedicated snapshot + append-only recovery events.
--
-- Reconciled against the EXISTING authoritative runtime sources so we never
-- create a competing source of truth:
--
--   * Node identity / bridge state / cloud heartbeat stay in
--     ai_runtime_bridge_nodes  (authoritative, untouched here).
--   * n8n / Ollama / CPU / memory telemetry stay in
--     ai_runtime_bridge_heartbeats.local_services (authoritative, untouched).
--
-- This migration adds ONLY the resilience-specific data that has no existing
-- authoritative home: watchdog state, LOCAL liveness (distinct from the cloud
-- heartbeat), fault / recovery state, restart + container-uptime counters and
-- temperature. It is additive and forward-only: nothing is dropped, renamed or
-- rewritten.
--
-- RLS mirrors the established DFP Command convention:
--   * SELECT  -> any authenticated caller with an internal role (internal_role()).
--   * INSERT  -> owner / admin only.
--   * UPDATE  -> owner / admin only (snapshot table only; events are append-only).
--   * DELETE  -> not permitted (no policy).
-- The future outbound-only runtime bridge / watchdog writes via the service
-- role, which bypasses RLS exactly as the existing bridge node/heartbeat
-- ingestion does. No inbound control path is introduced.
--
-- Values are free-form text (matching the AI Operations convention in
-- src/lib/ai-operations/types.ts) rather than restrictive database enums, so
-- the supported fault-reason / recovery-method sets can be extended forward
-- without destructive changes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Runtime resilience node snapshot (one row per runtime node).
--    node_id is the unique identity — a UUID FK to the authoritative bridge
--    node registry, never a display name.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.runtime_resilience_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL UNIQUE
    REFERENCES public.ai_runtime_bridge_nodes (id) ON DELETE CASCADE,
  watchdog_status text,
  last_liveness_at timestamptz,
  liveness_age_ms integer,
  last_fault_at timestamptz,
  last_fault_reason text,
  last_recovered_at timestamptz,
  last_recovery_ms integer,
  restart_count_24h integer,
  container_uptime_seconds bigint,
  temperature_c numeric,
  recovery_target_ms integer NOT NULL DEFAULT 5000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Runtime recovery events (append-only history). Sorted newest-first by the
--    consumer. recovery_target_met on the node snapshot and target_met here
--    are DERIVED (last_recovery_ms <= target), not stored authoritatively.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.runtime_recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL
    REFERENCES public.ai_runtime_bridge_nodes (id) ON DELETE CASCADE,
  fault_detected_at timestamptz,
  fault_reason text,
  recovery_started_at timestamptz,
  recovered_at timestamptz,
  recovery_ms integer,
  recovery_method text,
  target_ms integer,
  target_met boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes for the wallboard's bounded newest-first reads.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_runtime_recovery_events_node_id
  ON public.runtime_recovery_events (node_id);
CREATE INDEX IF NOT EXISTS idx_runtime_recovery_events_recovered_at
  ON public.runtime_recovery_events (recovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_recovery_events_created_at
  ON public.runtime_recovery_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Row-level security (least privilege, mirrors bridge node convention).
-- ---------------------------------------------------------------------------
ALTER TABLE public.runtime_resilience_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_recovery_events ENABLE ROW LEVEL SECURITY;

-- Snapshot table: read for any internal role; write for owner/admin.
DROP POLICY IF EXISTS runtime_resilience_nodes_select ON public.runtime_resilience_nodes;
DROP POLICY IF EXISTS runtime_resilience_nodes_insert ON public.runtime_resilience_nodes;
DROP POLICY IF EXISTS runtime_resilience_nodes_update ON public.runtime_resilience_nodes;

CREATE POLICY runtime_resilience_nodes_select
  ON public.runtime_resilience_nodes
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY runtime_resilience_nodes_insert
  ON public.runtime_resilience_nodes
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

CREATE POLICY runtime_resilience_nodes_update
  ON public.runtime_resilience_nodes
  FOR UPDATE TO authenticated
  USING (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]))
  WITH CHECK (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

-- Events table: read for any internal role; append for owner/admin. No UPDATE/DELETE.
DROP POLICY IF EXISTS runtime_recovery_events_select ON public.runtime_recovery_events;
DROP POLICY IF EXISTS runtime_recovery_events_insert ON public.runtime_recovery_events;

CREATE POLICY runtime_recovery_events_select
  ON public.runtime_recovery_events
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY runtime_recovery_events_insert
  ON public.runtime_recovery_events
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() = ANY (ARRAY['owner'::text, 'admin'::text]));
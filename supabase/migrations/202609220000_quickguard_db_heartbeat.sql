-- ============================================================================
-- QuickGuard database heartbeat — data-path repair.
--
-- Scope: QuickGuard only. No other site's monitoring record is touched.
--
-- 1. Adds a stable `site_key` pairing on `internal_supabase_monitors` so the
--    wallboard joins a monitor to its site by the canonical `quickguard` key
--    (never by the project display-name spelling "QuickGaurd"/"QuickGuard").
-- 2. Adds the per-monitor heartbeat telemetry columns the wall needs:
--      database_latency_ms          — last query latency in milliseconds
--      database_last_heartbeat_at   — last successful heartbeat timestamp
--      database_error_code          — short safe error code (when applicable)
--      database_error_reason        — short safe error reason (when applicable)
-- 3. Replaces the obsolete placeholder QuickGuard Supabase URL with the
--    canonical project. No secrets are stored in this table — the connection
--    credential lives in the trusted Edge Function environment only.
--
-- The 5-minute scheduled heartbeat runner is registered out-of-band via
-- pg_cron (matching the existing dfp-health-probe / internal-monitoring
-- runners) and is NOT duplicated here, to avoid re-running cron.schedule on
-- every deploy.
-- ============================================================================

ALTER TABLE public.internal_supabase_monitors
  ADD COLUMN IF NOT EXISTS site_key text;

ALTER TABLE public.internal_supabase_monitors
  ADD COLUMN IF NOT EXISTS database_latency_ms integer;

ALTER TABLE public.internal_supabase_monitors
  ADD COLUMN IF NOT EXISTS database_last_heartbeat_at timestamptz;

ALTER TABLE public.internal_supabase_monitors
  ADD COLUMN IF NOT EXISTS database_error_code text;

ALTER TABLE public.internal_supabase_monitors
  ADD COLUMN IF NOT EXISTS database_error_reason text;

CREATE INDEX IF NOT EXISTS idx_internal_supabase_monitors_site_key
  ON public.internal_supabase_monitors (site_key);

-- Canonical QuickGuard identity (source of truth).
--   site key:            quickguard
--   project name:        QuickGaurd
--   project ref:         vnywjfpkepjgclkbcmsj
--   Supabase URL:        https://vnywjfpkepjgclkbcmsj.supabase.co
UPDATE public.internal_supabase_monitors
SET supabase_project_name = 'QuickGaurd',
    supabase_url          = 'https://vnywjfpkepjgclkbcmsj.supabase.co',
    site_key              = 'quickguard',
    updated_at            = now()
WHERE id = 2;
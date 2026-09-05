-- ============================================================================
-- Repair 15A — Group Operations live site monitoring.
--
-- Adds a stable `site_key` pairing between the authoritative `ai_sites` registry
-- and `internal_monitored_websites`, so the wallboard can join monitors to sites
-- by a stable key (never by array order or display name). Legacy monitor rows
-- are preserved; backfill uses normalised-domain matching only.
--
-- The 5-minute scheduled website-monitoring runner is registered out-of-band
-- via pg_cron (matching the existing dfp-health-probe / runtime-health jobs)
-- and is NOT duplicated here, to avoid re-running cron.schedule on every deploy.
-- ============================================================================

ALTER TABLE public.internal_monitored_websites
  ADD COLUMN IF NOT EXISTS site_key text;

CREATE INDEX IF NOT EXISTS idx_internal_monitored_websites_site_key
  ON public.internal_monitored_websites (site_key);
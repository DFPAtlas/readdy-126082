-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 06 — WEBSITE INTEGRATION ADMINISTRATION (DB)
-- ============================================================================
-- Adds the database-side pieces for the integration administration area:
--   * internal_support_sites.integration_mode / allowed_origins / archived_at
--   * internal_support_site_settings — site-level ticket settings
--   * internal_support_site_rate_limits — per-site rate-limit configuration
--   * internal_support_site_stats() — aggregated per-site stats (no N+1)
--
-- Strictly ADDITIVE. No existing table, page, route, Edge Function, auth flow,
-- role model, or RLS policy is modified. Builds on Prompts 01-05.
--
-- ROLE MODEL: reuses public.internal_role() (owner/admin manage, viewer
-- read-only). Credential issuance/rotation/revocation happen in a protected
-- Edge Function (manage-support-integrations) — never from the browser.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. SITE INTEGRATION COLUMNS
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_support_sites
  ADD COLUMN IF NOT EXISTS integration_mode text NOT NULL DEFAULT 'public_form'
    CHECK (integration_mode IN ('public_form','server_to_server'));

ALTER TABLE public.internal_support_sites
  ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.internal_support_sites
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. SITE TICKET SETTINGS
--    Extends the Prompt 05 notification toggles with the full ticket-setting
--    surface. All columns carry safe defaults so existing rows are unaffected.
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_support_site_settings
  ADD COLUMN IF NOT EXISTS enabled_categories text[] NOT NULL DEFAULT ARRAY['general','technical','account','billing','access','bug','complaint','feature_request','security','other'],
  ADD COLUMN IF NOT EXISTS default_category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS max_public_priority text NOT NULL DEFAULT 'high'
    CHECK (max_public_priority IN ('low','normal','high','urgent','critical')),
  ADD COLUMN IF NOT EXISTS default_priority text NOT NULL DEFAULT 'normal'
    CHECK (default_priority IN ('low','normal','high','urgent','critical')),
  ADD COLUMN IF NOT EXISTS auto_assign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS notify_customer_confirmation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_alert boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS captcha_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_attachment_size_mb integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS spam_protection_mode text NOT NULL DEFAULT 'standard'
    CHECK (spam_protection_mode IN ('standard','strict','off')),
  ADD COLUMN IF NOT EXISTS acknowledgement_text text
    CHECK (acknowledgement_text IS NULL OR char_length(acknowledgement_text) <= 2000);

-- ---------------------------------------------------------------------------
-- 3. PER-SITE RATE LIMIT CONFIGURATION
--    The admin-configured limits. The ingestion Edge Function reads these with
--    a fallback to the existing safe defaults when no row is present.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_site_rate_limits (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid NOT NULL UNIQUE REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  network_per_15m        integer NOT NULL DEFAULT 5,
  email_per_hour         integer NOT NULL DEFAULT 3,
  failed_auth_threshold  integer NOT NULL DEFAULT 10,
  block_minutes          integer NOT NULL DEFAULT 15,
  max_body_bytes         integer NOT NULL DEFAULT 64000,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_site_rate_limits_updated_at
  BEFORE UPDATE ON public.internal_support_site_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.internal_support_site_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_site_rate_limits_select
  ON public.internal_support_site_rate_limits
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);

CREATE POLICY internal_site_rate_limits_insert
  ON public.internal_support_site_rate_limits
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY internal_site_rate_limits_update
  ON public.internal_support_site_rate_limits
  FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY internal_site_rate_limits_delete
  ON public.internal_support_site_rate_limits
  FOR DELETE TO authenticated USING (public.internal_role() IN ('owner','admin'));

-- ---------------------------------------------------------------------------
-- 4. AGGREGATED SITE STATS
--    One query returns per-site ticket / request / credential counts so the
--    list never performs an N+1 fan-out. SECURITY DEFINER reads across the
--    ticket tables without tripping their per-row RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_support_site_stats()
RETURNS TABLE (
  site_id                 uuid,
  ticket_count            bigint,
  last_ticket_at          timestamptz,
  request_count_24h       bigint,
  last_request_at         timestamptz,
  active_credential_count bigint,
  total_credential_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id,
    (SELECT count(*) FROM public.internal_support_tickets t WHERE t.site_id = s.id),
    (SELECT max(t.created_at) FROM public.internal_support_tickets t WHERE t.site_id = s.id),
    (SELECT count(*) FROM public.internal_ticket_request_log r
      WHERE r.site_id = s.id AND r.created_at > now() - interval '24 hours'),
    (SELECT max(r.request_timestamp) FROM public.internal_ticket_request_log r
      WHERE r.site_id = s.id),
    (SELECT count(*) FROM public.internal_ticket_api_clients c
      WHERE c.site_id = s.id AND c.is_active = true AND c.revoked_at IS NULL),
    (SELECT count(*) FROM public.internal_ticket_api_clients c WHERE c.site_id = s.id)
  FROM public.internal_support_sites s;
$$;

REVOKE ALL ON FUNCTION public.internal_support_site_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_site_stats() TO authenticated;
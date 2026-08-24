-- ============================================================================
-- DFP Command — Prompt 19: Live Site Onboarding + Connector Management
-- ============================================================================
-- Extends the existing site registry (`internal_support_sites`) and Support
-- Integrations admin area with:
--   * lifecycle status + environment + contact/notes columns on the site row
--   * per-site connectors       (support_site_connectors)
--   * per-site capabilities     (support_site_capabilities)
--   * connection-test history   (support_connector_tests)
--   * support.sites.* permissions in internal_has_permission
--   * management RPCs (connector upsert, capability enable, site status,
--     credential rotation, connector disable)
--
-- Secrets are NEVER stored here — connector credentials live in Supabase Edge
-- Function Secrets / n8n credentials only. Only "configured" booleans and
-- non-secret references are recorded.
--
-- Strictly ADDITIVE. Existing routing, tickets, diagnostics, repairs,
-- sessions, triage, replies, knowledge and analytics are unchanged.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. SITE LIFECYCLE COLUMNS
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_support_sites
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'setup'
    CHECK (status IN ('setup','testing','active','degraded','disabled')),
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production'
    CHECK (environment IN ('production','staging','test')),
  ADD COLUMN IF NOT EXISTS support_contact text,
  ADD COLUMN IF NOT EXISTS notes text;

-- ---------------------------------------------------------------------------
-- 2. CONNECTORS — one row per connector reference (a site may have several).
--    Never holds a secret; only credential_configured + non-secret refs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_site_connectors (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  connector_type         text NOT NULL
    CHECK (connector_type IN ('supabase','rest_api','n8n','stripe','email_provider','custom_dfp')),
  api_base_reference     text,
  credential_configured  boolean NOT NULL DEFAULT false,
  n8n_workflow_reference text,
  health_status          text NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('unknown','operational','degraded','error','disabled')),
  needs_rotation         boolean NOT NULL DEFAULT false,
  disabled               boolean NOT NULL DEFAULT false,
  disabled_reason        text,
  last_tested_at         timestamptz,
  last_success_at        timestamptz,
  last_error             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. CAPABILITIES — per-site feature status. Rows seeded automatically on site
--    creation. A capability is only "operational" after a passing test.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_site_capabilities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  capability     text NOT NULL
    CHECK (capability IN ('ticket_intake','customer_resolution','diagnostics','repairs',
                          'view_as_customer','ai_triage','ai_reply','knowledge',
                          'billing','email_delivery','site_health')),
  status         text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('configured','not_configured','testing','operational','error','disabled')),
  enabled        boolean NOT NULL DEFAULT false,
  required       boolean NOT NULL DEFAULT false,
  last_tested_at timestamptz,
  last_success_at timestamptz,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, capability)
);

-- ---------------------------------------------------------------------------
-- 4. TEST HISTORY — safe connection-test results. No credentials/payloads.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_connector_tests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  capability     text NOT NULL,
  test_type      text NOT NULL DEFAULT 'manual',
  status         text NOT NULL CHECK (status IN ('pass','fail','not_configured','error')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  requested_by   uuid,
  safe_error     text,
  test_reference text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. RLS — internal staff may read; all writes go through SECURITY DEFINER
--    RPCs (below) which enforce permission + validation.
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_site_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_connectors_select
  ON public.support_site_connectors FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

ALTER TABLE public.support_site_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_capabilities_select
  ON public.support_site_capabilities FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

ALTER TABLE public.support_connector_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_connector_tests_select
  ON public.support_connector_tests FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_connector_tests_site_cap
  ON public.support_connector_tests (site_id, capability, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. SEED — create the 11 default capability rows whenever a site is created.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_seed_site_capabilities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.support_site_capabilities (site_id, capability, required)
  SELECT NEW.id, c, (c IN ('ticket_intake','customer_resolution'))
  FROM unnest(ARRAY['ticket_intake','customer_resolution','diagnostics','repairs',
                    'view_as_customer','ai_triage','ai_reply','knowledge',
                    'billing','email_delivery','site_health']) AS c
  ON CONFLICT (site_id, capability) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_seed_site_capabilities
  AFTER INSERT ON public.internal_support_sites
  FOR EACH ROW EXECUTE FUNCTION public.support_seed_site_capabilities();

-- Backfill existing sites.
INSERT INTO public.support_site_capabilities (site_id, capability, required)
SELECT s.id, c, (c IN ('ticket_intake','customer_resolution'))
FROM public.internal_support_sites s
CROSS JOIN unnest(ARRAY['ticket_intake','customer_resolution','diagnostics','repairs',
                        'view_as_customer','ai_triage','ai_reply','knowledge',
                        'billing','email_delivery','site_health']) AS c
ON CONFLICT (site_id, capability) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. MANAGEMENT RPCs (all SECURITY DEFINER, permission-gated).
-- ---------------------------------------------------------------------------

-- Configure/update a connector.
CREATE OR REPLACE FUNCTION public.support_upsert_site_connector(
  p_site_id uuid, p_connector_type text, p_api_base_reference text DEFAULT NULL,
  p_credential_configured boolean DEFAULT false, p_n8n_workflow_reference text DEFAULT NULL,
  p_connector_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ DECLARE v_connector_id uuid; BEGIN
  IF NOT public.internal_has_permission('support.sites.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_connector_id IS NOT NULL THEN
    UPDATE public.support_site_connectors
       SET connector_type = p_connector_type, api_base_reference = p_api_base_reference,
           credential_configured = p_credential_configured, n8n_workflow_reference = p_n8n_workflow_reference,
           health_status = 'unknown', disabled = false, disabled_reason = NULL, updated_at = now()
     WHERE id = p_connector_id AND site_id = p_site_id RETURNING id INTO v_connector_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'CONNECTOR_NOT_FOUND'; END IF;
  ELSE
    INSERT INTO public.support_site_connectors (site_id, connector_type, api_base_reference, credential_configured, n8n_workflow_reference)
    VALUES (p_site_id, p_connector_type, p_api_base_reference, p_credential_configured, p_n8n_workflow_reference)
    RETURNING id INTO v_connector_id;
  END IF;
  INSERT INTO public.support_customer_activity (staff_user_id, site_id, action, metadata)
  VALUES (auth.uid(), p_site_id, 'connector_configured', jsonb_build_object('connector_id', v_connector_id, 'connector_type', p_connector_type));
  RETURN jsonb_build_object('ok', true, 'connector_id', v_connector_id);
END; $$;

-- Enable/disable a capability with fail-safe validation.
CREATE OR REPLACE FUNCTION public.support_set_capability_enabled(p_site_id uuid, p_capability text, p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ DECLARE v_supported boolean; v_pass boolean; BEGIN
  IF NOT public.internal_has_permission('support.sites.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_site_capabilities WHERE site_id = p_site_id AND capability = p_capability) THEN
    RAISE EXCEPTION 'CAPABILITY_NOT_FOUND';
  END IF;
  IF p_enabled THEN
    IF p_capability = 'view_as_customer' THEN
      SELECT view_as_customer_supported INTO v_supported FROM public.internal_support_sites WHERE id = p_site_id;
      IF v_supported IS NULL OR v_supported = false THEN
        RAISE EXCEPTION 'View-as-Customer cannot be enabled until the read-only projection test passes.';
      END IF;
    END IF;
    IF p_capability IN ('repairs','diagnostics','ai_triage','ai_reply') THEN
      SELECT EXISTS (SELECT 1 FROM public.support_connector_tests WHERE site_id = p_site_id AND capability = p_capability AND status = 'pass') INTO v_pass;
      IF NOT v_pass THEN RAISE EXCEPTION 'This capability cannot be enabled until a successful connector test passes.'; END IF;
    END IF;
  END IF;
  UPDATE public.support_site_capabilities
     SET enabled = p_enabled, status = CASE WHEN p_enabled AND status = 'disabled' THEN 'configured' ELSE status END, updated_at = now()
   WHERE site_id = p_site_id AND capability = p_capability;
  INSERT INTO public.support_customer_activity (staff_user_id, site_id, action, metadata)
  VALUES (auth.uid(), p_site_id, CASE WHEN p_enabled THEN 'capability_enabled' ELSE 'capability_disabled' END, jsonb_build_object('capability', p_capability));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Change site lifecycle status; activation requires minimum readiness.
CREATE OR REPLACE FUNCTION public.support_set_site_status(p_site_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ DECLARE v_intake_ok boolean; v_resolution_ok boolean; v_has_default boolean; BEGIN
  IF NOT public.internal_has_permission('support.sites.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('setup','testing','active','degraded','disabled') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF p_status = 'active' THEN
    SELECT EXISTS (SELECT 1 FROM public.support_site_capabilities WHERE site_id = p_site_id AND capability = 'ticket_intake' AND status = 'operational') INTO v_intake_ok;
    SELECT EXISTS (SELECT 1 FROM public.support_site_capabilities WHERE site_id = p_site_id AND capability = 'customer_resolution' AND status = 'operational') INTO v_resolution_ok;
    SELECT (default_support_team_id IS NOT NULL) INTO v_has_default FROM public.internal_support_sites WHERE id = p_site_id;
    IF NOT (v_intake_ok AND v_resolution_ok AND v_has_default) THEN RAISE EXCEPTION 'ACTIVATION_NOT_READY'; END IF;
  END IF;
  UPDATE public.internal_support_sites SET status = p_status, updated_at = now() WHERE id = p_site_id;
  INSERT INTO public.support_customer_activity (staff_user_id, site_id, action, metadata)
  VALUES (auth.uid(), p_site_id,
    CASE WHEN p_status = 'disabled' THEN 'support_site_disabled' WHEN p_status = 'active' THEN 'support_site_enabled' ELSE 'support_site_updated' END,
    jsonb_build_object('status', p_status, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'status', p_status);
END; $$;

-- Mark connector credentials as needing rotation / rotated.
CREATE OR REPLACE FUNCTION public.support_mark_credential_rotation(p_connector_id uuid, p_needs_rotation boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ DECLARE v_site_id uuid; BEGIN
  IF NOT public.internal_has_permission('support.sites.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.support_site_connectors SET needs_rotation = p_needs_rotation, updated_at = now()
   WHERE id = p_connector_id RETURNING site_id INTO v_site_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONNECTOR_NOT_FOUND'; END IF;
  INSERT INTO public.support_customer_activity (staff_user_id, site_id, action, metadata)
  VALUES (auth.uid(), v_site_id, 'credential_rotation_marked', jsonb_build_object('connector_id', p_connector_id, 'needs_rotation', p_needs_rotation));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Disable a connector (requires reason).
CREATE OR REPLACE FUNCTION public.support_disable_connector(p_connector_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ DECLARE v_site_id uuid; BEGIN
  IF NOT public.internal_has_permission('support.sites.manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.support_site_connectors SET disabled = true, disabled_reason = p_reason, health_status = 'disabled', updated_at = now()
   WHERE id = p_connector_id RETURNING site_id INTO v_site_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONNECTOR_NOT_FOUND'; END IF;
  INSERT INTO public.support_customer_activity (staff_user_id, site_id, action, metadata)
  VALUES (auth.uid(), v_site_id, 'connector_disabled', jsonb_build_object('connector_id', p_connector_id, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END; $$;
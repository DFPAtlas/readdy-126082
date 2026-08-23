-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 02 — SECURE TICKET INGESTION API (DB)
-- ============================================================================
-- Adds the database-side pieces for the secure ticket-ingestion Edge Function:
--   * internal_ticket_api_clients  — per-site integration credentials
--   * internal_ticket_rate_limits  — persistent, privacy-conscious rate limits
--   * internal_ticket_request_log  — nonce / idempotency replay protection
--   * internal_create_support_ticket() — atomic ticket + message + event
--     creation (transactional, race-safe)
--
-- Scope is strictly ADDITIVE. No existing table, page, route, function, Edge
-- Function, auth flow, or RLS policy is modified. Builds on the Prompt 01
-- foundation (internal_support_sites / internal_support_tickets /
-- internal_ticket_messages / internal_ticket_events / internal_ticket_sla_rules).
--
-- ROLE MODEL: reuses public.internal_role() (owner/admin/viewer). The secret
-- columns below are additionally revoked from authenticated roles so no raw
-- credential is ever readable through a browser SELECT query.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. API CLIENTS
--    One credential per integration mode per site. Stores ONLY a hash and an
--    encrypted blob of the secret — never the raw secret. The raw secret is
--    returned exactly once at issuance time by the Edge Function.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_api_clients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                 uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  client_name             text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 200),
  integration_mode        text NOT NULL DEFAULT 'public_form'
                            CHECK (integration_mode IN ('public_form','server_to_server')),
  key_prefix              text NOT NULL UNIQUE CHECK (char_length(key_prefix) BETWEEN 4 AND 100),
  secret_hash             text NOT NULL CHECK (char_length(secret_hash) >= 16),
  secret_ciphertext       text,  -- AES-GCM(secret) — decryptable only in Edge Function
  allowed_origins         text[] NOT NULL DEFAULT ARRAY[]::text[],
  turnstile_required      boolean NOT NULL DEFAULT false,
  elevated_priority_allowed boolean NOT NULL DEFAULT false,
  is_active               boolean NOT NULL DEFAULT true,
  last_used_at            timestamptz,
  expires_at              timestamptz,
  revoked_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_ticket_api_clients_site_id_idx
  ON public.internal_ticket_api_clients (site_id);
CREATE INDEX IF NOT EXISTS internal_ticket_api_clients_active_idx
  ON public.internal_ticket_api_clients (is_active);

-- ---------------------------------------------------------------------------
-- 2. RATE LIMITS
--    Persistent counters keyed by (site, bucket, subject hash, window). Only a
--    privacy-conscious hash is stored — never a raw IP or email.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_rate_limits (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id       uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  bucket        text NOT NULL CHECK (char_length(bucket) BETWEEN 1 AND 50),
  subject_hash  text NOT NULL CHECK (char_length(subject_hash) >= 16),
  window_start  timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS internal_ticket_rate_limits_key
  ON public.internal_ticket_rate_limits (site_id, bucket, subject_hash, window_start);

CREATE INDEX IF NOT EXISTS internal_ticket_rate_limits_site_idx
  ON public.internal_ticket_rate_limits (site_id, bucket, window_start);

-- ---------------------------------------------------------------------------
-- 3. REQUEST LOG (nonce / idempotency)
--    Prevents replay and duplicate creation. Unique partial indexes make the
--    idempotency path race-safe (relies on the DB constraint, not a
--    read-then-insert check in application code).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ticket_request_log (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id            uuid NOT NULL REFERENCES public.internal_support_sites(id) ON DELETE CASCADE,
  nonce_hash         text,
  idempotency_hash   text,
  request_timestamp  timestamptz NOT NULL DEFAULT now(),
  ticket_id          uuid REFERENCES public.internal_support_tickets(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS internal_ticket_request_log_nonce_key
  ON public.internal_ticket_request_log (site_id, nonce_hash)
  WHERE nonce_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS internal_ticket_request_log_idempotency_key
  ON public.internal_ticket_request_log (site_id, idempotency_hash)
  WHERE idempotency_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS internal_ticket_request_log_created_idx
  ON public.internal_ticket_request_log (created_at);

-- ---------------------------------------------------------------------------
-- 4. ATOMIC TICKET CREATION
--    One transaction creates: the ticket (trigger assigns the concurrency-safe
--    ticket number + SLA due date), the first customer message, a
--    ticket_created event, a safe activity-log entry, and the request-log
--    record. If anything fails, everything rolls back.
--
--    Only the service role may execute this (revoked from PUBLIC/authenticated).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_create_support_ticket(
  p_site_id             uuid,
  p_project_id          bigint,
  p_external_reference  text,
  p_customer_user_id    uuid,
  p_customer_name       text,
  p_customer_email      text,
  p_customer_phone      text,
  p_subject             text,
  p_description         text,
  p_category            text,
  p_priority            text,
  p_source              text,
  p_metadata            jsonb,
  p_nonce_hash          text,
  p_idempotency_hash    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_site          public.internal_support_sites%ROWTYPE;
  v_ticket_id     uuid;
  v_ticket_number text;
  v_existing      uuid;
  v_log_id        bigint;
BEGIN
  -- 1. Site must exist and be active.
  SELECT * INTO v_site
    FROM public.internal_support_sites
   WHERE id = p_site_id AND is_active = true;
  IF v_site.id IS NULL THEN
    RAISE EXCEPTION 'SITE_INACTIVE';
  END IF;

  -- 2. External-reference de-duplication (per site).
  IF p_external_reference IS NOT NULL AND p_external_reference <> '' THEN
    SELECT id INTO v_existing
      FROM public.internal_support_tickets
     WHERE site_id = p_site_id AND external_reference = p_external_reference
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      SELECT ticket_number INTO v_ticket_number
        FROM public.internal_support_tickets WHERE id = v_existing;
      RETURN jsonb_build_object(
        'status', 'duplicate_external_reference',
        'ticket_id', v_existing,
        'ticket_number', v_ticket_number
      );
    END IF;
  END IF;

  -- 3. Reserve the request atomically (idempotency first, else nonce).
  --    The unique partial indexes make this race-safe.
  IF p_idempotency_hash IS NOT NULL AND p_idempotency_hash <> '' THEN
    INSERT INTO public.internal_ticket_request_log
      (site_id, idempotency_hash, nonce_hash, request_timestamp, expires_at)
    VALUES
      (p_site_id, p_idempotency_hash, NULLIF(p_nonce_hash, ''), now(), now() + interval '7 days')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_log_id;

    IF v_log_id IS NULL THEN
      -- Already seen this idempotency key.
      SELECT ticket_id INTO v_existing
        FROM public.internal_ticket_request_log
       WHERE site_id = p_site_id AND idempotency_hash = p_idempotency_hash
       LIMIT 1;
      IF v_existing IS NOT NULL THEN
        SELECT ticket_number INTO v_ticket_number
          FROM public.internal_support_tickets WHERE id = v_existing;
        RETURN jsonb_build_object(
          'status', 'duplicate_idempotency',
          'ticket_id', v_existing,
          'ticket_number', v_ticket_number
        );
      ELSE
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS';
      END IF;
    END IF;

  ELSIF p_nonce_hash IS NOT NULL AND p_nonce_hash <> '' THEN
    INSERT INTO public.internal_ticket_request_log
      (site_id, nonce_hash, request_timestamp, expires_at)
    VALUES
      (p_site_id, p_nonce_hash, now(), now() + interval '7 days')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_log_id;

    IF v_log_id IS NULL THEN
      RAISE EXCEPTION 'NONCE_REPLAY';
    END IF;
  END IF;

  -- 4. Create the ticket (BEFORE INSERT triggers assign ticket_number + due_at).
  INSERT INTO public.internal_support_tickets (
    site_id, project_id, external_reference, customer_user_id,
    customer_name, customer_email, customer_phone, subject, description,
    category, priority, status, source, metadata
  ) VALUES (
    p_site_id, p_project_id, NULLIF(p_external_reference, ''),
    p_customer_user_id, p_customer_name, p_customer_email, p_customer_phone,
    p_subject, p_description, p_category, p_priority, 'new', p_source,
    COALESCE(p_metadata, jsonb_build_object())
  )
  RETURNING id, ticket_number INTO v_ticket_id, v_ticket_number;

  -- 5. First customer message (also the conversation thread's first entry).
  INSERT INTO public.internal_ticket_messages (
    ticket_id, sender_type, sender_name, sender_email, message_body,
    message_format, is_internal_note, is_read
  ) VALUES (
    v_ticket_id, 'customer', p_customer_name, p_customer_email, p_description,
    'plain_text', false, false
  );

  -- 6. ticket_created event.
  INSERT INTO public.internal_ticket_events (
    ticket_id, actor_type, event_type, description, new_value
  ) VALUES (
    v_ticket_id, 'customer', 'ticket_created',
    'Ticket created via ' || p_source,
    jsonb_build_object('priority', p_priority, 'category', p_category, 'source', p_source)
  );

  -- 7. Safe activity-log entry (no full message body, no extra personal data).
  INSERT INTO public.internal_activity_log (
    project_id, description, entity_type, action, metadata
  ) VALUES (
    p_project_id,
    'Support ticket ' || v_ticket_number || ' created from ' || v_site.site_name,
    'support_ticket',
    'created',
    jsonb_build_object(
      'ticket_id', v_ticket_id,
      'ticket_number', v_ticket_number,
      'site_id', p_site_id,
      'site_name', v_site.site_name
    )
  );

  -- 8. Bind the resulting ticket to the reserved request-log row.
  IF v_log_id IS NOT NULL THEN
    UPDATE public.internal_ticket_request_log
       SET ticket_id = v_ticket_id
     WHERE id = v_log_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'created',
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.internal_create_support_ticket(
  uuid, bigint, text, uuid, text, text, text, text, text, text, text, text, jsonb, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_create_support_ticket(
  uuid, bigint, text, uuid, text, text, text, text, text, text, text, text, jsonb, text, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. RATE-LIMIT INCREMENT
--    Atomic upsert that increments the counter for a (site, bucket, subject,
--    window) and returns the new count. Service role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_ticket_rate_limit_hit(
  p_site_id      uuid,
  p_bucket       text,
  p_subject_hash text,
  p_window_start timestamptz,
  p_max          integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.internal_ticket_rate_limits
    (site_id, bucket, subject_hash, window_start, request_count)
  VALUES (p_site_id, p_bucket, p_subject_hash, p_window_start, 1)
  ON CONFLICT (site_id, bucket, subject_hash, window_start)
  DO UPDATE SET request_count = public.internal_ticket_rate_limits.request_count + 1,
                updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN jsonb_build_object('count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_rate_limit_hit(uuid, text, text, timestamptz, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_ticket_rate_limit_hit(uuid, text, text, timestamptz, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. updated_at maintenance for the new tables that carry the column.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_api_clients_updated_at
  BEFORE UPDATE ON public.internal_ticket_api_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rate_limits_updated_at
  BEFORE UPDATE ON public.internal_ticket_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY
--    Anonymous gets nothing. Authenticated internal users get read (viewer) or
--    manage (owner/admin) — consistent with the Prompt 01 foundation. The
--    secret columns are additionally revoked so no browser query reads them.
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_ticket_api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_request_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'internal_ticket_api_clients',
    'internal_ticket_rate_limits',
    'internal_ticket_request_log'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL)',
      t || '_api', t
    );
    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN (''owner'',''admin''))',
      t || '_api', t
    );
    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.internal_role() IN (''owner'',''admin'')) WITH CHECK (public.internal_role() IN (''owner'',''admin''))',
      t || '_api', t
    );
    EXECUTE format(
      'CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.internal_role() IN (''owner'',''admin''))',
      t || '_api', t
    );
  END LOOP;
END $$;

-- Never expose the raw credential material through a browser SELECT query.
REVOKE SELECT (secret_hash, secret_ciphertext) ON public.internal_ticket_api_clients
  FROM authenticated;
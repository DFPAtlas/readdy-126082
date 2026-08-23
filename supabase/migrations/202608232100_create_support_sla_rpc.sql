-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 09D — SLA PERFORMANCE TABLE
-- ============================================================================
-- Adds two server-side aggregation functions for the SLA performance section
-- on the Support Reports page. No browser downloads raw tickets or messages.
--
--   1. internal_support_sla_summary(p_start, p_end, p_site_id)
--        Returns the SLA summary metrics in one jsonb payload.
--
--   2. internal_support_sla_breaches(p_start, p_end, p_site_id, p_limit, p_offset)
--        Returns one row per active SLA-breach ticket (paginated).
--
-- SLA definitions (same as Prompt 08; no second definition introduced):
--   * A ticket "has an SLA target" when due_at, resolution_due_at or
--     sla_rule_id is set.
--   * First-response breach = first_response_breached_at is set, OR the ticket
--     has no public staff reply yet and due_at < now().
--   * Resolution breach = resolution_breached_at is set, OR the ticket is not
--     resolved yet and resolution_due_at < now().
--   * Active excludes 'resolved', 'closed', 'spam'.
--   * Overdue = active AND due_at < now() (identical to 09A).
--   * Compliance % = completed-within / (within + after), computed only over
--     tickets that had a resolution SLA target; missing SLA data is excluded
--     and never silently counted as compliant.
--
-- Exclusions: spam status and test tickets (external_reference 'TEST-%' or
-- metadata.context.isTest) are excluded from every metric.
--
-- Access: authenticated internal users only (owner/admin/viewer). Anonymous
-- rejected. No permissive policies, no service-role exposure, no new indexes,
-- no materialised views, no new dependency. Server-side time via now().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. SLA SUMMARY
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_support_sla_summary(
  p_start   timestamptz,
  p_end     timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role          text := public.internal_role();
  v_with_target   bigint;
  v_within        bigint;
  v_after         bigint;
  v_overdue       bigint;
  v_fr_breaches   bigint;
  v_res_breaches  bigint;
  v_compliance    numeric;
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  -- Tickets with an SLA target (created in range).
  SELECT count(*) INTO v_with_target
    FROM public.internal_support_tickets t
   WHERE t.created_at >= p_start
     AND t.created_at < p_end
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (t.due_at IS NOT NULL OR t.resolution_due_at IS NOT NULL OR t.sla_rule_id IS NOT NULL)
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- Completed within SLA (resolved in range, had a resolution target, on time).
  SELECT count(*) INTO v_within
    FROM public.internal_support_tickets t
   WHERE t.resolved_at >= p_start
     AND t.resolved_at < p_end
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND t.resolution_due_at IS NOT NULL
     AND t.resolved_at <= t.resolution_due_at
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- Completed after SLA (resolved in range, past the resolution target).
  SELECT count(*) INTO v_after
    FROM public.internal_support_tickets t
   WHERE t.resolved_at >= p_start
     AND t.resolved_at < p_end
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND t.resolution_due_at IS NOT NULL
     AND t.resolved_at > t.resolution_due_at
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- Active tickets currently overdue (snapshot; same as 09A overdue definition).
  SELECT count(*) INTO v_overdue
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND t.due_at < now()
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- First-response breaches in range.
  SELECT count(*) INTO v_fr_breaches
    FROM public.internal_support_tickets t
   WHERE t.first_response_breached_at >= p_start
     AND t.first_response_breached_at < p_end
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- Resolution breaches in range.
  SELECT count(*) INTO v_res_breaches
    FROM public.internal_support_tickets t
   WHERE t.resolution_breached_at >= p_start
     AND t.resolution_breached_at < p_end
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- Compliance percentage over tickets that actually had a resolution target.
  IF (v_within + v_after) > 0 THEN
    v_compliance := round((v_within::numeric / (v_within + v_after)::numeric) * 100, 1);
  ELSE
    v_compliance := NULL;
  END IF;

  RETURN jsonb_build_object(
    'tickets_with_sla_target', v_with_target,
    'completed_within_sla',     v_within,
    'completed_after_sla',      v_after,
    'active_overdue',           v_overdue,
    'first_response_breaches',  v_fr_breaches,
    'resolution_breaches',      v_res_breaches,
    'total_breaches',           v_fr_breaches + v_res_breaches,
    'compliance_percent',       v_compliance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_sla_summary(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_sla_summary(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. ACTIVE SLA-BREACH TICKETS (paginated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_support_sla_breaches(
  p_start   timestamptz,
  p_end     timestamptz,
  p_site_id uuid DEFAULT NULL,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  ticket_id         uuid,
  ticket_number     text,
  site_name         text,
  subject           text,
  priority          text,
  status            text,
  assigned_name     text,
  breach_type       text,
  due_time          timestamptz,
  breached_seconds  bigint,
  last_activity_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.internal_role();
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  RETURN QUERY
  WITH breached AS (
    SELECT
      t.id,
      t.ticket_number,
      s.site_name,
      t.subject,
      t.priority,
      t.status,
      t.assigned_to,
      t.due_at,
      t.resolution_due_at,
      t.last_activity_at,
      -- A resolution breach is the more severe state; if both apply, show it.
      CASE
        WHEN (t.resolution_breached_at IS NOT NULL
              OR (t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND t.resolution_due_at < now()))
          THEN 'resolution'
        ELSE 'first_response'
      END AS breach_kind,
      CASE
        WHEN (t.resolution_breached_at IS NOT NULL
              OR (t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND t.resolution_due_at < now()))
          THEN t.resolution_due_at
        ELSE t.due_at
      END AS breach_due
      FROM public.internal_support_tickets t
      JOIN public.internal_support_sites s ON s.id = t.site_id
     WHERE t.status NOT IN ('resolved','closed','spam')
       AND t.created_at >= p_start
       AND t.created_at < p_end
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
       AND (
            t.first_response_breached_at IS NOT NULL
         OR (t.first_response_at IS NULL AND t.due_at IS NOT NULL AND t.due_at < now())
         OR t.resolution_breached_at IS NOT NULL
         OR (t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND t.resolution_due_at < now())
       )
  )
  SELECT
    b.id,
    b.ticket_number,
    b.site_name,
    b.subject,
    b.priority,
    b.status,
    COALESCE((u.raw_user_meta_data->>'full_name')::text,
             (u.raw_user_meta_data->>'name')::text,
             u.email)                                   AS assigned_name,
    b.breach_kind                                       AS breach_type,
    b.breach_due                                        AS due_time,
    CASE WHEN b.breach_due IS NOT NULL
         THEN (extract(epoch FROM (now() - b.breach_due)))::bigint
         ELSE NULL END                                   AS breached_seconds,
    b.last_activity_at
  FROM breached b
  LEFT JOIN auth.users u ON u.id = b.assigned_to
  ORDER BY
    CASE b.priority WHEN 'critical' THEN 5 WHEN 'urgent' THEN 4 WHEN 'high' THEN 3
         WHEN 'normal' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
    CASE WHEN b.breach_due IS NOT NULL
         THEN (extract(epoch FROM (now() - b.breach_due)))::bigint
         ELSE 0 END DESC,
    b.breach_due ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_sla_breaches(timestamptz, timestamptz, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_sla_breaches(timestamptz, timestamptz, uuid, integer, integer) TO authenticated;
-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 09B — TICKET VOLUME CHART
-- ============================================================================
-- Adds a single server-side aggregation function for the ticket-volume chart
-- on the Support Reports page.
--
--   internal_support_volume(p_start, p_end)
--     Returns one row per grouping bucket, each with the four series:
--       tickets_received, tickets_resolved, customer_replies, staff_replies.
--
-- Grouping (matches Prompt 09B):
--   * day   — ranges of 31 days or fewer.
--   * week  — ranges longer than 31 days, up to 180 days.
--   * month — ranges longer than 180 days.
--
-- Definitions:
--   * Customer replies = messages with sender_type = 'customer'.
--   * Public staff replies = sender_type = 'staff' AND is_internal_note = false
--     (internal notes are never counted).
--   * Spam and test tickets (external_reference 'TEST-%' or
--     metadata.context.isTest) are excluded from every series.
--
-- Access: any authenticated internal user (owner/admin/viewer — matching the
-- read-only reporting policy). Anonymous access is rejected. Buckets with no
-- activity are still returned with zero values so zero-value periods render
-- correctly. No new indexes, no permissive policies, no service-role exposure.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.internal_support_volume(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  period           timestamptz,
  label            text,
  tickets_received bigint,
  tickets_resolved bigint,
  customer_replies bigint,
  staff_replies    bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role         text := public.internal_role();
  v_days         numeric;
  v_granularity  text;
  v_bucket_start timestamptz;
  v_step         interval;
BEGIN
  -- Only authenticated internal users may read the volume series.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Guard against empty / inverted ranges.
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  v_days := extract(epoch from (p_end - p_start)) / 86400.0;

  IF v_days <= 31 THEN
    v_granularity := 'day';
    v_bucket_start := date_trunc('day', p_start);
    v_step := interval '1 day';
  ELSIF v_days <= 180 THEN
    v_granularity := 'week';
    v_bucket_start := date_trunc('week', p_start);
    v_step := interval '1 week';
  ELSE
    v_granularity := 'month';
    v_bucket_start := date_trunc('month', p_start);
    v_step := interval '1 month';
  END IF;

  RETURN QUERY
  WITH series AS (
    SELECT gs AS bucket
      FROM generate_series(v_bucket_start, p_end, v_step) AS gs
  ),
  received AS (
    SELECT
      CASE
        WHEN v_granularity = 'day'  THEN date_trunc('day',   t.created_at)
        WHEN v_granularity = 'week' THEN date_trunc('week',  t.created_at)
        ELSE                             date_trunc('month', t.created_at)
      END AS bucket,
      count(*) AS cnt
      FROM public.internal_support_tickets t
     WHERE t.created_at >= p_start
       AND t.created_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY 1
  ),
  resolved AS (
    SELECT
      CASE
        WHEN v_granularity = 'day'  THEN date_trunc('day',   t.resolved_at)
        WHEN v_granularity = 'week' THEN date_trunc('week',  t.resolved_at)
        ELSE                             date_trunc('month', t.resolved_at)
      END AS bucket,
      count(*) AS cnt
      FROM public.internal_support_tickets t
     WHERE t.resolved_at >= p_start
       AND t.resolved_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY 1
  ),
  cust_replies AS (
    SELECT
      CASE
        WHEN v_granularity = 'day'  THEN date_trunc('day',   m.created_at)
        WHEN v_granularity = 'week' THEN date_trunc('week',  m.created_at)
        ELSE                             date_trunc('month', m.created_at)
      END AS bucket,
      count(*) AS cnt
      FROM public.internal_ticket_messages m
      JOIN public.internal_support_tickets t ON t.id = m.ticket_id
     WHERE m.sender_type = 'customer'
       AND m.created_at >= p_start
       AND m.created_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY 1
  ),
  staff_replies AS (
    SELECT
      CASE
        WHEN v_granularity = 'day'  THEN date_trunc('day',   m.created_at)
        WHEN v_granularity = 'week' THEN date_trunc('week',  m.created_at)
        ELSE                             date_trunc('month', m.created_at)
      END AS bucket,
      count(*) AS cnt
      FROM public.internal_ticket_messages m
      JOIN public.internal_support_tickets t ON t.id = m.ticket_id
     WHERE m.sender_type = 'staff'
       AND m.is_internal_note = false
       AND m.created_at >= p_start
       AND m.created_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY 1
  )
  SELECT
    s.bucket AS period,
    CASE
      WHEN v_granularity = 'month' THEN to_char(s.bucket, 'Mon YYYY')
      ELSE to_char(s.bucket, 'Mon DD')
    END AS label,
    COALESCE(r.cnt,  0) AS tickets_received,
    COALESCE(rs.cnt, 0) AS tickets_resolved,
    COALESCE(cr.cnt, 0) AS customer_replies,
    COALESCE(sr.cnt, 0) AS staff_replies
  FROM series s
  LEFT JOIN received r      ON r.bucket  = s.bucket
  LEFT JOIN resolved rs     ON rs.bucket = s.bucket
  LEFT JOIN cust_replies cr ON cr.bucket = s.bucket
  LEFT JOIN staff_replies sr ON sr.bucket = s.bucket
  ORDER BY s.bucket;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_volume(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_volume(timestamptz, timestamptz) TO authenticated;
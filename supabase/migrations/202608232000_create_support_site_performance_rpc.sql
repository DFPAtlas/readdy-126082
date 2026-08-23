-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 09C — WEBSITE PERFORMANCE TABLE
-- ============================================================================
-- Adds a single server-side aggregation function for the website-performance
-- table on the Support Reports page.
--
--   internal_support_site_performance(p_start, p_end)
--     Returns one row per registered (non-archived) support website, each with
--     the metrics needed by the table. Aggregation happens entirely in the
--     database so the browser never downloads raw tickets/messages.
--
-- Metrics (see Prompt 09C):
--   * Tickets received = tickets created in range.
--   * Active = tickets whose status is NOT resolved/closed/spam (snapshot).
--   * Resolved = tickets resolved in range.
--   * Overdue = active AND due_at < now().
--   * Unassigned = active AND assigned_to IS NULL.
--   * Last ticket received = max(created_at) in range.
--   * Average first-response = mean of (first public staff reply − created_at)
--     for tickets received in range (internal notes never count as a reply).
--   * Average resolution = mean of (resolved_at − created_at) for tickets
--     resolved in range.
--
-- Test tickets (external_reference 'TEST-%' or metadata.context.isTest) are
-- excluded from every metric.
--
-- Access: any authenticated internal user (owner/admin/viewer — matching the
-- read-only reporting policy). Anonymous access is rejected. No materialised
-- views, no new indexes, no permissive policies, no service-role exposure.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.internal_support_site_performance(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  site_id                      uuid,
  site_name                    text,
  site_slug                    text,
  domain                       text,
  tickets_received             bigint,
  active_tickets               bigint,
  resolved_tickets             bigint,
  overdue_active               bigint,
  unassigned_active            bigint,
  last_ticket_received         timestamptz,
  avg_first_response_seconds   numeric,
  avg_resolution_seconds       numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.internal_role();
BEGIN
  -- Only authenticated internal users may read the website performance table.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Guard against empty / inverted ranges.
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  RETURN QUERY
  WITH sites AS (
    SELECT s.id, s.site_name, s.site_slug, s.domain
      FROM public.internal_support_sites s
     WHERE s.archived_at IS NULL
  ),
  received AS (
    SELECT t.site_id,
           count(*)             AS cnt,
           max(t.created_at)    AS last_received
      FROM public.internal_support_tickets t
     WHERE t.created_at >= p_start
       AND t.created_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.site_id
  ),
  resolved AS (
    SELECT t.site_id, count(*) AS cnt
      FROM public.internal_support_tickets t
     WHERE t.resolved_at >= p_start
       AND t.resolved_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.site_id
  ),
  active AS (
    SELECT t.site_id,
           count(*) FILTER (WHERE t.due_at < now())          AS overdue,
           count(*) FILTER (WHERE t.assigned_to IS NULL)     AS unassigned,
           count(*)                                          AS active_total
      FROM public.internal_support_tickets t
     WHERE t.status NOT IN ('resolved','closed','spam')
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.site_id
  ),
  first_response AS (
    SELECT t.site_id,
           avg(extract(epoch FROM (fr.first_at - t.created_at))) AS avg_seconds
      FROM public.internal_support_tickets t
      JOIN LATERAL (
        SELECT min(m.created_at) AS first_at
          FROM public.internal_ticket_messages m
         WHERE m.ticket_id = t.id
           AND m.sender_type = 'staff'
           AND m.is_internal_note = false
      ) fr ON true
     WHERE t.created_at >= p_start
       AND t.created_at < p_end
       AND fr.first_at IS NOT NULL
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.site_id
  ),
  resolution_time AS (
    SELECT t.site_id,
           avg(extract(epoch FROM (t.resolved_at - t.created_at))) AS avg_seconds
      FROM public.internal_support_tickets t
     WHERE t.resolved_at >= p_start
       AND t.resolved_at < p_end
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.site_id
  )
  SELECT
    s.id                                   AS site_id,
    s.site_name                            AS site_name,
    s.site_slug                            AS site_slug,
    s.domain                               AS domain,
    COALESCE(r.cnt, 0)                     AS tickets_received,
    COALESCE(a.active_total, 0)            AS active_tickets,
    COALESCE(rs.cnt, 0)                    AS resolved_tickets,
    COALESCE(a.overdue, 0)                 AS overdue_active,
    COALESCE(a.unassigned, 0)              AS unassigned_active,
    r.last_received                        AS last_ticket_received,
    fr.avg_seconds                         AS avg_first_response_seconds,
    rt.avg_seconds                         AS avg_resolution_seconds
  FROM sites s
  LEFT JOIN received r       ON r.site_id  = s.id
  LEFT JOIN resolved rs      ON rs.site_id = s.id
  LEFT JOIN active a         ON a.site_id  = s.id
  LEFT JOIN first_response fr ON fr.site_id = s.id
  LEFT JOIN resolution_time rt ON rt.site_id = s.id
  ORDER BY COALESCE(r.cnt, 0) DESC, s.site_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_site_performance(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_site_performance(timestamptz, timestamptz) TO authenticated;
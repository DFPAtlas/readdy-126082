-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 09E — STAFF WORKLOAD & UNASSIGNED
-- ============================================================================
-- Adds two server-side aggregation functions for the staff-workload section on
-- the Support Reports page. No browser downloads raw tickets or messages.
--
--   1. internal_support_unassigned_summary(p_start, p_end, p_site_id)
--        Returns a snapshot of active unassigned tickets in one jsonb payload.
--
--   2. internal_support_staff_workload(p_start, p_end, p_site_id)
--        Returns one row per eligible support staff member (owner/admin) with
--        open / overdue / critical-urgent / received / resolved / response and
--        resolution averages / last activity.
--
-- Staff source: internal_user_roles (owner/admin) joined to auth.users, the
-- same source used by internal_list_staff(). Staff email is included because
-- it is already exposed to authenticated internal users by that function.
--
-- Definitions (consistent with Prompts 08 / 09A–09D):
--   * Open        = status NOT IN ('resolved','closed','spam') (snapshot).
--   * Overdue     = open AND due_at < now().
--   * Critical/urgent = open AND priority IN ('critical','urgent').
--   * Received    = tickets created in the selected range assigned to the
--                   staff member.
--   * Resolved    = tickets resolved in the selected range assigned to the
--                   staff member.
--   * First response = first public staff reply (internal notes excluded).
--   * Test tickets (external_reference 'TEST-%' or metadata.context.isTest)
--     are excluded from every metric.
--
-- Access: owner/admin only. Viewers and anonymous access are rejected, and no
-- staff information is exposed beyond operational support management needs.
-- Server-side time via now(). No permissive policies, no service-role
-- exposure, no new indexes, no materialised views, no new dependency.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. UNASSIGNED SUMMARY (snapshot)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_support_unassigned_summary(
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
  v_role        text := public.internal_role();
  v_active      bigint;
  v_overdue     bigint;
  v_urgent      bigint;
  v_critical    bigint;
  v_oldest_id   uuid;
  v_oldest_num  text;
  v_oldest_at   timestamptz;
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE t.due_at < now()),
         count(*) FILTER (WHERE t.priority = 'urgent'),
         count(*) FILTER (WHERE t.priority = 'critical')
    INTO v_active, v_overdue, v_urgent, v_critical
    FROM public.internal_support_tickets t
   WHERE t.assigned_to IS NULL
     AND t.status NOT IN ('resolved','closed','spam')
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT t.id, t.ticket_number, t.created_at
    INTO v_oldest_id, v_oldest_num, v_oldest_at
    FROM public.internal_support_tickets t
   WHERE t.assigned_to IS NULL
     AND t.status NOT IN ('resolved','closed','spam')
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true')
   ORDER BY t.created_at ASC
   LIMIT 1;

  RETURN jsonb_build_object(
    'active_unassigned',   v_active,
    'overdue_unassigned',  v_overdue,
    'urgent_unassigned',   v_urgent,
    'critical_unassigned', v_critical,
    'oldest_ticket_id',    v_oldest_id,
    'oldest_ticket_number', v_oldest_num,
    'oldest_created_at',   v_oldest_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_unassigned_summary(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_unassigned_summary(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. STAFF WORKLOAD
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_support_staff_workload(
  p_start   timestamptz,
  p_end     timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id                    uuid,
  staff_name                 text,
  staff_email                text,
  open_assigned              bigint,
  overdue_assigned           bigint,
  critical_urgent_assigned   bigint,
  received                   bigint,
  resolved                   bigint,
  avg_first_response_seconds numeric,
  avg_resolution_seconds     numeric,
  last_activity_at           timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.internal_role();
BEGIN
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  RETURN QUERY
  WITH staff AS (
    SELECT r.user_id,
           u.email,
           COALESCE((u.raw_user_meta_data->>'full_name')::text,
                    (u.raw_user_meta_data->>'name')::text,
                    u.email) AS full_name
      FROM public.internal_user_roles r
      JOIN auth.users u ON u.id = r.user_id
     WHERE r.role IN ('owner','admin')
  ),
  open_tickets AS (
    SELECT t.assigned_to,
           count(*) AS open_cnt,
           count(*) FILTER (WHERE t.due_at < now()) AS overdue_cnt,
           count(*) FILTER (WHERE t.priority IN ('critical','urgent')) AS crit_urgent_cnt
      FROM public.internal_support_tickets t
     WHERE t.assigned_to IS NOT NULL
       AND t.status NOT IN ('resolved','closed','spam')
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.assigned_to
  ),
  received AS (
    SELECT t.assigned_to, count(*) AS cnt
      FROM public.internal_support_tickets t
     WHERE t.assigned_to IS NOT NULL
       AND t.created_at >= p_start
       AND t.created_at < p_end
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.assigned_to
  ),
  resolved AS (
    SELECT t.assigned_to, count(*) AS cnt
      FROM public.internal_support_tickets t
     WHERE t.assigned_to IS NOT NULL
       AND t.resolved_at >= p_start
       AND t.resolved_at < p_end
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.assigned_to
  ),
  first_response AS (
    SELECT t.assigned_to,
           avg(extract(epoch FROM (fr.first_at - t.created_at))) AS avg_seconds
      FROM public.internal_support_tickets t
      JOIN LATERAL (
        SELECT min(m.created_at) AS first_at
          FROM public.internal_ticket_messages m
         WHERE m.ticket_id = t.id
           AND m.sender_type = 'staff'
           AND m.is_internal_note = false
      ) fr ON true
     WHERE t.assigned_to IS NOT NULL
       AND t.created_at >= p_start
       AND t.created_at < p_end
       AND fr.first_at IS NOT NULL
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.assigned_to
  ),
  resolution_time AS (
    SELECT t.assigned_to,
           avg(extract(epoch FROM (t.resolved_at - t.created_at))) AS avg_seconds
      FROM public.internal_support_tickets t
     WHERE t.assigned_to IS NOT NULL
       AND t.resolved_at >= p_start
       AND t.resolved_at < p_end
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.assigned_to
  ),
  last_activity AS (
    SELECT t.assigned_to, max(t.last_activity_at) AS last_at
      FROM public.internal_support_tickets t
     WHERE t.assigned_to IS NOT NULL
       AND (p_site_id IS NULL OR t.site_id = p_site_id)
       AND NOT (t.external_reference ILIKE 'TEST-%'
                OR (t.metadata->'context'->>'isTest') = 'true')
     GROUP BY t.assigned_to
  )
  SELECT
    s.user_id                                    AS user_id,
    s.full_name                                  AS staff_name,
    s.email                                      AS staff_email,
    COALESCE(o.open_cnt, 0)                      AS open_assigned,
    COALESCE(o.overdue_cnt, 0)                   AS overdue_assigned,
    COALESCE(o.crit_urgent_cnt, 0)               AS critical_urgent_assigned,
    COALESCE(r.cnt, 0)                           AS received,
    COALESCE(rs.cnt, 0)                          AS resolved,
    fr.avg_seconds                               AS avg_first_response_seconds,
    rt.avg_seconds                               AS avg_resolution_seconds,
    la.last_at                                   AS last_activity_at
  FROM staff s
  LEFT JOIN open_tickets o      ON o.assigned_to = s.user_id
  LEFT JOIN received r          ON r.assigned_to = s.user_id
  LEFT JOIN resolved rs         ON rs.assigned_to = s.user_id
  LEFT JOIN first_response fr   ON fr.assigned_to = s.user_id
  LEFT JOIN resolution_time rt  ON rt.assigned_to = s.user_id
  LEFT JOIN last_activity la    ON la.assigned_to = s.user_id
  ORDER BY
    COALESCE(o.overdue_cnt, 0)   DESC,
    COALESCE(o.open_cnt, 0)      DESC,
    COALESCE(o.crit_urgent_cnt, 0) DESC,
    s.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_staff_workload(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_staff_workload(timestamptz, timestamptz, uuid) TO authenticated;
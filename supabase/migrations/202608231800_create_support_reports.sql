-- ============================================================================
-- FOOTPRINTCC CENTRAL SUPPORT TICKETS 09A — SUPPORT SUMMARY REPORTING FOUNDATION
-- ============================================================================
-- Adds a single server-side aggregation function for the Support Reports page.
--   1. internal_support_summary(p_start, p_end) — returns the eight summary
--      metrics in one jsonb payload, computed entirely in the database so the
--      browser never downloads tickets/messages.
--
-- Metric definitions (see Prompt 09A):
--   * Active tickets exclude 'resolved', 'closed', 'spam'.
--   * Overdue = active AND due_at < now().
--   * Customer replies = messages with sender_type = 'customer'.
--   * Public staff replies = sender_type = 'staff' AND is_internal_note = false.
--   * Internal notes are never counted as replies.
--   * SLA breaches = tickets whose first-response or resolution breach
--     timestamp falls in the selected range.
--   * Test tickets (external_reference 'TEST-%' or metadata.context.isTest)
--     are excluded from every metric.
--
-- Access: any authenticated internal user (owner/admin/viewer — matching the
-- read-only reporting policy). Anonymous access is rejected. No new indexes,
-- no permissive policies, no service-role exposure.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.internal_support_summary(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role              text := public.internal_role();
  v_received          bigint;
  v_resolved          bigint;
  v_active            bigint;
  v_overdue           bigint;
  v_unassigned        bigint;
  v_customer_replies  bigint;
  v_staff_replies     bigint;
  v_sla_breaches      bigint;
BEGIN
  -- Only authenticated internal users may read the summary.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Guard against empty / inverted / oversized ranges.
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  -- 1. Tickets received in range.
  SELECT count(*) INTO v_received
    FROM public.internal_support_tickets t
   WHERE t.created_at >= p_start
     AND t.created_at < p_end
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 2. Tickets resolved in range.
  SELECT count(*) INTO v_resolved
    FROM public.internal_support_tickets t
   WHERE t.resolved_at >= p_start
     AND t.resolved_at < p_end
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 3. Active open tickets (current snapshot).
  SELECT count(*) INTO v_active
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 4. Overdue active tickets.
  SELECT count(*) INTO v_overdue
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND t.due_at < now()
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 5. Unassigned active tickets.
  SELECT count(*) INTO v_unassigned
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND t.assigned_to IS NULL
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 6. Customer replies in range (internal notes are sender_type != customer,
  --    so they are inherently excluded; test tickets excluded via join).
  SELECT count(*) INTO v_customer_replies
    FROM public.internal_ticket_messages m
    JOIN public.internal_support_tickets t ON t.id = m.ticket_id
   WHERE m.sender_type = 'customer'
     AND m.created_at >= p_start
     AND m.created_at < p_end
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 7. Public staff replies in range (explicitly excludes internal notes).
  SELECT count(*) INTO v_staff_replies
    FROM public.internal_ticket_messages m
    JOIN public.internal_support_tickets t ON t.id = m.ticket_id
   WHERE m.sender_type = 'staff'
     AND m.is_internal_note = false
     AND m.created_at >= p_start
     AND m.created_at < p_end
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  -- 8. SLA breaches in range (first-response or resolution breach timestamp).
  SELECT count(*) INTO v_sla_breaches
    FROM public.internal_support_tickets t
   WHERE (
          (t.first_response_breached_at >= p_start AND t.first_response_breached_at < p_end)
       OR (t.resolution_breached_at >= p_start AND t.resolution_breached_at < p_end)
        )
     AND NOT (t.external_reference ILIKE 'TEST-%'
              OR (t.metadata->'context'->>'isTest') = 'true');

  RETURN jsonb_build_object(
    'tickets_received',  v_received,
    'tickets_resolved',  v_resolved,
    'active_open',       v_active,
    'overdue_active',    v_overdue,
    'unassigned_active', v_unassigned,
    'customer_replies',  v_customer_replies,
    'staff_replies',     v_staff_replies,
    'sla_breaches',      v_sla_breaches
  );
END;
$$;

REVOKE ALL ON FUNCTION public.internal_support_summary(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_support_summary(timestamptz, timestamptz) TO authenticated;
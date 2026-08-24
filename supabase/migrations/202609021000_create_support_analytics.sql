-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — PROMPT 18 — SUPPORT ANALYTICS + SLA + AI QUALITY
-- ============================================================================
-- Extends the Prompt 09 reports foundation with operational analytics for
-- categories, diagnostics, repairs, support sessions, AI triage/reply quality,
-- knowledge value, routing quality and escalations. No raw tickets are ever
-- downloaded to the browser — every metric is aggregated server-side.
--
-- PRINCIPLES (Prompt 18):
--   * Reuse existing data only. No metric is invented where a source table is
--     absent — every value is derived from an existing column.
--   * ROLE + SITE ACCESS: every function gates on
--     internal_has_permission('support.metrics.view') AND filters by
--     internal_accessible_site_ids() (owner/admin/support_manager unrestricted,
--     other roles limited to their explicit site assignments).
--   * No future dates; ranges are validated (start < end).
--   * Test tickets (external_reference 'TEST-%' or metadata.context.isTest)
--     are excluded everywhere.
--
-- Functions added (all SECURITY DEFINER, STABLE):
--   internal_accessible_site_ids()               → helper (uuid[] or NULL=all)
--   support_analytics_sites()                    → accessible sites (filter UI)
--   support_analytics_overview(p_site_id)        → snapshot operational cards
--   support_analytics_categories(p_start,p_end,p_site_id)
--   support_analytics_recurring(p_start,p_end,p_site_id)
--   support_analytics_diagnostics(p_start,p_end,p_site_id)
--   support_analytics_repairs(p_start,p_end,p_site_id)
--   support_analytics_sessions(p_start,p_end,p_site_id)
--   support_analytics_triage(p_start,p_end,p_site_id)
--   support_analytics_replies(p_start,p_end,p_site_id)
--   support_analytics_knowledge(p_start,p_end,p_site_id)
--   support_analytics_routing(p_start,p_end,p_site_id)
--   support_analytics_escalations(p_start,p_end,p_site_id)
--
-- Audit events: support_analytics_exported (written by an export edge function
-- only; normal page views are NOT audited).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Site-access helper. NULL = unrestricted (owner/admin/support_manager);
--    otherwise the caller's explicit site assignments (possibly empty).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_accessible_site_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.internal_user_roles r
      WHERE r.user_id = auth.uid() AND r.status = 'active'
        AND r.role IN ('owner','admin','support_manager')
    )
    THEN NULL::uuid[]
    ELSE COALESCE((
      SELECT array_agg(a.site_id ORDER BY a.site_id)
      FROM public.internal_staff_site_access a
      JOIN public.internal_user_roles r ON r.user_id = a.user_id
      WHERE r.user_id = auth.uid() AND r.status = 'active'
    ), ARRAY[]::uuid[])
  END;
$fn$;

REVOKE ALL ON FUNCTION public.internal_accessible_site_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_accessible_site_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Accessible sites for the analytics site filter dropdown.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_sites()
RETURNS TABLE(site_id uuid, site_name text, site_slug text, domain text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT s.id, s.site_name, s.site_slug, s.domain
    FROM public.internal_support_sites s
   WHERE s.archived_at IS NULL
     AND public.internal_has_permission('support.metrics.view')
     AND (public.internal_accessible_site_ids() IS NULL
          OR s.id = ANY(public.internal_accessible_site_ids()))
   ORDER BY s.site_name ASC;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_sites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_sites() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Overview operational cards (current snapshot; not range-dependent).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_overview(p_site_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
  v_open bigint; v_new_today bigint; v_resolved_today bigint;
  v_urgent bigint; v_at_risk bigint; v_breached bigint;
  v_unassigned bigint; v_needs_review bigint;
  v_pending_repairs bigint; v_active_sessions bigint;
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  v_access := public.internal_accessible_site_ids();

  SELECT count(*) INTO v_open
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT count(*) INTO v_new_today
    FROM public.internal_support_tickets t
   WHERE t.created_at >= date_trunc('day', now())
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT count(*) INTO v_resolved_today
    FROM public.internal_support_tickets t
   WHERE t.resolved_at >= date_trunc('day', now())
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT count(*) INTO v_urgent
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND t.priority IN ('urgent','critical')
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  -- At risk: active with an SLA due time still in the future (clock running,
  -- not yet breached). Derived from the existing due_at column.
  SELECT count(*) INTO v_at_risk
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND t.due_at IS NOT NULL AND t.due_at > now()
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  -- Breached: active with a breach timestamp set, or past due.
  SELECT count(*) INTO v_breached
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND (t.first_response_breached_at IS NOT NULL
          OR t.resolution_breached_at IS NOT NULL
          OR t.due_at < now())
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT count(*) INTO v_unassigned
    FROM public.internal_support_tickets t
   WHERE t.status NOT IN ('resolved','closed','spam')
     AND t.assigned_to IS NULL
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT count(*) INTO v_needs_review
    FROM public.internal_support_tickets t
   WHERE t.routing_status = 'needs_review'
     AND t.status NOT IN ('resolved','closed','spam')
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  SELECT count(*) INTO v_pending_repairs
    FROM public.support_repair_actions r
   WHERE r.status = 'pending_approval'
     AND (p_site_id IS NULL OR r.site_id = p_site_id)
     AND (v_access IS NULL OR r.site_id = ANY(v_access));

  SELECT count(*) INTO v_active_sessions
    FROM public.support_sessions s
   WHERE s.status = 'active'
     AND (p_site_id IS NULL OR s.site_id = p_site_id)
     AND (v_access IS NULL OR s.site_id = ANY(v_access));

  RETURN jsonb_build_object(
    'open_tickets', v_open,
    'new_today', v_new_today,
    'resolved_today', v_resolved_today,
    'urgent_tickets', v_urgent,
    'sla_at_risk', v_at_risk,
    'sla_breached', v_breached,
    'unassigned', v_unassigned,
    'needs_review', v_needs_review,
    'pending_repairs', v_pending_repairs,
    'active_sessions', v_active_sessions
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_overview(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Category analytics (top categories + trend + resolution + repeat count).
--    trend compares the two halves of the selected range.
--    repeat_count = extra occurrences beyond the first per (category, site).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_categories(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
  v_mid timestamptz;
  v_total bigint;
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();
  v_mid := p_start + ((p_end - p_start) / 2);

  SELECT count(*) INTO v_total
    FROM public.internal_support_tickets t
   WHERE t.created_at >= p_start AND t.created_at < p_end
     AND t.category IS NOT NULL
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access))
     AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true');

  RETURN COALESCE((
    WITH base AS (
      SELECT t.category, t.site_id, t.created_at, t.resolved_at
        FROM public.internal_support_tickets t
       WHERE t.created_at >= p_start AND t.created_at < p_end
         AND t.category IS NOT NULL
         AND (p_site_id IS NULL OR t.site_id = p_site_id)
         AND (v_access IS NULL OR t.site_id = ANY(v_access))
         AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')
    ),
    site_counts AS (
      SELECT category, site_id, count(*) AS scnt
        FROM base GROUP BY category, site_id
    ),
    repeat AS (
      SELECT category, sum(greatest(scnt - 1, 0)) AS repeat_count
        FROM site_counts WHERE scnt > 1 GROUP BY category
    ),
    agg AS (
      SELECT b.category,
             count(*) AS cnt,
             count(*) FILTER (WHERE b.created_at >= v_mid) AS later_half,
             count(*) FILTER (WHERE b.created_at < v_mid) AS earlier_half,
             avg(extract(epoch FROM (b.resolved_at - b.created_at)))
               FILTER (WHERE b.resolved_at IS NOT NULL) AS avg_res_seconds
        FROM base b
       GROUP BY b.category
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'category', a.category,
        'count', a.cnt,
        'percent', CASE WHEN v_total > 0 THEN round((a.cnt::numeric / v_total::numeric) * 100, 1) ELSE 0 END,
        'avg_resolution_seconds', a.avg_res_seconds,
        'repeat_count', COALESCE(r.repeat_count, 0),
        'trend', CASE
                   WHEN a.later_half > a.earlier_half THEN 'increasing'
                   WHEN a.later_half < a.earlier_half THEN 'decreasing'
                   ELSE 'stable'
                 END
      )
      ORDER BY a.cnt DESC, a.category ASC
    )
    FROM agg a
    LEFT JOIN repeat r ON r.category = a.category
  ), '[]'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_categories(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_categories(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Recurring issues — (site, category) groups with 2+ tickets, trend, and a
--    typical resolution pulled from APPROVED resolution memory only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_recurring(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
  v_mid timestamptz;
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();
  v_mid := p_start + ((p_end - p_start) / 2);

  RETURN COALESCE((
    WITH base AS (
      SELECT t.site_id, t.category, t.created_at
        FROM public.internal_support_tickets t
       WHERE t.created_at >= p_start AND t.created_at < p_end
         AND t.category IS NOT NULL
         AND (p_site_id IS NULL OR t.site_id = p_site_id)
         AND (v_access IS NULL OR t.site_id = ANY(v_access))
         AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')
    ),
    grouped AS (
      SELECT b.site_id, b.category, count(*) AS occurrences,
             count(*) FILTER (WHERE b.created_at >= v_mid) AS later_half,
             count(*) FILTER (WHERE b.created_at < v_mid) AS earlier_half
        FROM base b
       GROUP BY b.site_id, b.category
      HAVING count(*) >= 2
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'site_name', COALESCE(s.site_name, 'General'),
        'category', g.category,
        'occurrences', g.occurrences,
        'trend', CASE
                   WHEN g.later_half > g.earlier_half THEN 'increasing'
                   WHEN g.later_half < g.earlier_half THEN 'decreasing'
                   ELSE 'stable'
                 END,
        'typical_resolution', (
          SELECT COALESCE(rr.customer_safe_summary, rr.resolution_action)
            FROM public.support_resolution_records rr
           WHERE rr.status = 'approved'
             AND (rr.site_id IS NULL OR rr.site_id = g.site_id)
             AND rr.category = g.category
           ORDER BY rr.approved_at DESC NULLS LAST, rr.created_at DESC
           LIMIT 1
        )
      )
      ORDER BY g.occurrences DESC
    )
    FROM grouped g
    LEFT JOIN public.internal_support_sites s ON s.id = g.site_id
  ), '[]'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_recurring(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_recurring(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Diagnostic analytics. "Checks" = diagnostic_scope (existing column).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_diagnostics(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  RETURN jsonb_build_object(
    'runs', (SELECT count(*) FROM public.support_diagnostic_runs d
             WHERE d.created_at >= p_start AND d.created_at < p_end
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access))),
    'completed', (SELECT count(*) FROM public.support_diagnostic_runs d
             WHERE d.created_at >= p_start AND d.created_at < p_end AND d.status = 'completed'
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access))),
    'failed', (SELECT count(*) FROM public.support_diagnostic_runs d
             WHERE d.created_at >= p_start AND d.created_at < p_end AND d.status = 'failed'
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access))),
    'cancelled', (SELECT count(*) FROM public.support_diagnostic_runs d
             WHERE d.created_at >= p_start AND d.created_at < p_end AND d.status = 'cancelled'
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access))),
    'avg_duration_seconds', (SELECT avg(extract(epoch FROM (d.completed_at - d.started_at)))
             FROM public.support_diagnostic_runs d
             WHERE d.created_at >= p_start AND d.created_at < p_end
               AND d.completed_at IS NOT NULL AND d.started_at IS NOT NULL
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access))),
    'scopes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'scope', COALESCE(d.diagnostic_scope, 'general'),
               'count', count(*),
               'failures', count(*) FILTER (WHERE d.status = 'failed')
             ) ORDER BY count(*) DESC)
        FROM public.support_diagnostic_runs d
       WHERE d.created_at >= p_start AND d.created_at < p_end
         AND (p_site_id IS NULL OR d.site_id = p_site_id)
         AND (v_access IS NULL OR d.site_id = ANY(v_access))
       GROUP BY COALESCE(d.diagnostic_scope, 'general')
    ), '[]'::jsonb),
    'leading_to_repair', (SELECT count(*) FROM public.support_diagnostic_runs d
             WHERE d.created_at >= p_start AND d.created_at < p_end
               AND EXISTS (SELECT 1 FROM public.support_repair_actions r WHERE r.diagnostic_run_id = d.id)
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access))),
    'leading_to_resolution', (SELECT count(*) FROM public.support_diagnostic_runs d
             JOIN public.internal_support_tickets t ON t.id = d.ticket_id
             WHERE d.created_at >= p_start AND d.created_at < p_end
               AND t.resolved_at IS NOT NULL
               AND (p_site_id IS NULL OR d.site_id = p_site_id)
               AND (v_access IS NULL OR d.site_id = ANY(v_access)))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_diagnostics(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_diagnostics(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Repair analytics. Only VERIFIED completions count as success.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_repairs(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
  v_requested bigint; v_approved bigint; v_rejected bigint;
  v_completed bigint; v_failed bigint; v_verification_failed bigint;
  v_pending bigint; v_verified_success bigint;
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  SELECT count(*),
         count(*) FILTER (WHERE r.status IN ('approved','executing','completed')),
         count(*) FILTER (WHERE r.status = 'rejected'),
         count(*) FILTER (WHERE r.status = 'completed'),
         count(*) FILTER (WHERE r.status = 'failed'),
         count(*) FILTER (WHERE r.status = 'completed' AND r.verification->>'status' = 'failed'),
         count(*) FILTER (WHERE r.status = 'pending_approval'),
         count(*) FILTER (WHERE r.status = 'completed' AND r.verification->>'status' IS DISTINCT FROM 'failed')
    INTO v_requested, v_approved, v_rejected, v_completed, v_failed,
         v_verification_failed, v_pending, v_verified_success
    FROM public.support_repair_actions r
   WHERE r.created_at >= p_start AND r.created_at < p_end
     AND (p_site_id IS NULL OR r.site_id = p_site_id)
     AND (v_access IS NULL OR r.site_id = ANY(v_access));

  RETURN jsonb_build_object(
    'requested', v_requested,
    'approved', v_approved,
    'rejected', v_rejected,
    'completed', v_completed,
    'failed', v_failed,
    'verification_failed', v_verification_failed,
    'pending_approval', v_pending,
    'success_rate', CASE
      WHEN (v_verified_success + v_failed + v_verification_failed) > 0
      THEN round((v_verified_success::numeric / (v_verified_success + v_failed + v_verification_failed)::numeric) * 100, 1)
      ELSE NULL END,
    'by_action_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('action_type', r.action_type, 'count', count(*))
             ORDER BY count(*) DESC)
        FROM public.support_repair_actions r
       WHERE r.created_at >= p_start AND r.created_at < p_end
         AND (p_site_id IS NULL OR r.site_id = p_site_id)
         AND (v_access IS NULL OR r.site_id = ANY(v_access))
       GROUP BY r.action_type
    ), '[]'::jsonb),
    'by_risk', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('risk_level', r.risk_level, 'count', count(*))
             ORDER BY count(*) DESC)
        FROM public.support_repair_actions r
       WHERE r.created_at >= p_start AND r.created_at < p_end
         AND (p_site_id IS NULL OR r.site_id = p_site_id)
         AND (v_access IS NULL OR r.site_id = ANY(v_access))
       GROUP BY r.risk_level
    ), '[]'::jsonb),
    'by_site', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'site_name', COALESCE(s.site_name, 'Unknown'), 'count', c.cnt
             ) ORDER BY c.cnt DESC)
        FROM (
          SELECT r.site_id, count(*) AS cnt
            FROM public.support_repair_actions r
           WHERE r.created_at >= p_start AND r.created_at < p_end
             AND (p_site_id IS NULL OR r.site_id = p_site_id)
             AND (v_access IS NULL OR r.site_id = ANY(v_access))
           GROUP BY r.site_id
        ) c
        LEFT JOIN public.internal_support_sites s ON s.id = c.site_id
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_repairs(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_repairs(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Support session analytics (safe operational metrics only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_sessions(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  RETURN jsonb_build_object(
    'started', (SELECT count(*) FROM public.support_sessions s
             WHERE s.created_at >= p_start AND s.created_at < p_end
               AND (p_site_id IS NULL OR s.site_id = p_site_id)
               AND (v_access IS NULL OR s.site_id = ANY(v_access))),
    'completed', (SELECT count(*) FROM public.support_sessions s
             WHERE s.status = 'ended' AND s.ended_at >= p_start AND s.ended_at < p_end
               AND (p_site_id IS NULL OR s.site_id = p_site_id)
               AND (v_access IS NULL OR s.site_id = ANY(v_access))),
    'expired', (SELECT count(*) FROM public.support_sessions s
             WHERE s.status = 'expired'
               AND (p_site_id IS NULL OR s.site_id = p_site_id)
               AND (v_access IS NULL OR s.site_id = ANY(v_access))),
    'revoked', (SELECT count(*) FROM public.support_sessions s
             WHERE s.status = 'revoked' AND s.revoked_at >= p_start AND s.revoked_at < p_end
               AND (p_site_id IS NULL OR s.site_id = p_site_id)
               AND (v_access IS NULL OR s.site_id = ANY(v_access))),
    'avg_duration_seconds', (SELECT avg(extract(epoch FROM (s.ended_at - s.started_at)))
             FROM public.support_sessions s
             WHERE s.status = 'ended' AND s.ended_at >= p_start AND s.ended_at < p_end
               AND s.ended_at IS NOT NULL AND s.started_at IS NOT NULL
               AND (p_site_id IS NULL OR s.site_id = p_site_id)
               AND (v_access IS NULL OR s.site_id = ANY(v_access))),
    'sites_using_view_as_customer', (SELECT count(DISTINCT s.site_id)
             FROM public.support_sessions s
             JOIN public.internal_support_sites st ON st.id = s.site_id
             WHERE s.created_at >= p_start AND s.created_at < p_end
               AND st.view_as_customer_supported = true
               AND (p_site_id IS NULL OR s.site_id = p_site_id)
               AND (v_access IS NULL OR s.site_id = ANY(v_access)))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_sessions(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_sessions(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. AI triage quality. Acceptance is derived from staff feedback flags, not
--    presented as accuracy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_triage(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
  v_completed bigint; v_feedback bigint;
  v_cat_accepted bigint; v_team_accepted bigint; v_priority_accepted bigint;
  v_helpful bigint; v_not_helpful bigint; v_overrides bigint;
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  SELECT count(*),
         count(*) FILTER (WHERE tr.feedback_helpful IS NOT NULL
                          OR tr.feedback_correct_category IS NOT NULL
                          OR tr.feedback_correct_team IS NOT NULL
                          OR tr.feedback_correct_priority IS NOT NULL)
    INTO v_completed, v_feedback
    FROM public.support_ticket_triage tr
    JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
   WHERE tr.created_at >= p_start AND tr.created_at < p_end
     AND tr.status = 'completed'
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access));

  SELECT count(*) FILTER (WHERE tr.feedback_correct_category = true),
         count(*) FILTER (WHERE tr.feedback_correct_team = true),
         count(*) FILTER (WHERE tr.feedback_correct_priority = true),
         count(*) FILTER (WHERE tr.feedback_helpful = true),
         count(*) FILTER (WHERE tr.feedback_helpful = false),
         count(*) FILTER (WHERE tr.feedback_correct_category = false
                          OR tr.feedback_correct_team = false
                          OR tr.feedback_correct_priority = false)
    INTO v_cat_accepted, v_team_accepted, v_priority_accepted,
         v_helpful, v_not_helpful, v_overrides
    FROM public.support_ticket_triage tr
    JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
   WHERE tr.created_at >= p_start AND tr.created_at < p_end
     AND tr.status = 'completed'
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access));

  RETURN jsonb_build_object(
    'runs', (SELECT count(*) FROM public.support_ticket_triage tr
             JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
             WHERE tr.created_at >= p_start AND tr.created_at < p_end
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))),
    'completed', v_completed,
    'failed', (SELECT count(*) FROM public.support_ticket_triage tr
             JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
             WHERE tr.created_at >= p_start AND tr.created_at < p_end AND tr.status IN ('failed','unavailable')
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))),
    'confidence', jsonb_build_object(
      'high', (SELECT count(*) FROM public.support_ticket_triage tr
             JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
             WHERE tr.created_at >= p_start AND tr.created_at < p_end AND tr.confidence = 'high'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))),
      'medium', (SELECT count(*) FROM public.support_ticket_triage tr
             JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
             WHERE tr.created_at >= p_start AND tr.created_at < p_end AND tr.confidence = 'medium'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))),
      'low', (SELECT count(*) FROM public.support_ticket_triage tr
             JOIN public.internal_support_tickets t ON t.id = tr.ticket_id
             WHERE tr.created_at >= p_start AND tr.created_at < p_end AND tr.confidence = 'low'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access)))
    ),
    'category_accepted', v_cat_accepted,
    'team_accepted', v_team_accepted,
    'priority_accepted', v_priority_accepted,
    'manual_overrides', v_overrides,
    'helpful', v_helpful,
    'not_helpful', v_not_helpful,
    'feedback_recorded', v_feedback
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_triage(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_triage(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. AI reply quality. "Used" / "Discarded" derive from the audit events.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_replies(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
  v_generated bigint; v_helpful bigint; v_not_helpful bigint;
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  SELECT count(*),
         count(*) FILTER (WHERE ar.feedback_helpful = true),
         count(*) FILTER (WHERE ar.feedback_helpful = false)
    INTO v_generated, v_helpful, v_not_helpful
    FROM public.support_ai_replies ar
    JOIN public.internal_support_tickets t ON t.id = ar.ticket_id
   WHERE ar.created_at >= p_start AND ar.created_at < p_end
     AND ar.status = 'completed'
     AND (p_site_id IS NULL OR t.site_id = p_site_id)
     AND (v_access IS NULL OR t.site_id = ANY(v_access));

  RETURN jsonb_build_object(
    'generated', v_generated,
    'used', (SELECT count(*) FROM public.support_customer_activity a
             JOIN public.internal_support_tickets t ON t.id = a.ticket_id
             WHERE a.action = 'ai_reply_used' AND a.created_at >= p_start AND a.created_at < p_end
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))),
    'discarded', (SELECT count(*) FROM public.support_customer_activity a
             JOIN public.internal_support_tickets t ON t.id = a.ticket_id
             WHERE a.action = 'ai_reply_discarded' AND a.created_at >= p_start AND a.created_at < p_end
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))),
    'helpful', v_helpful,
    'not_helpful', v_not_helpful,
    'reasons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', ar.feedback_reason, 'count', count(*))
             ORDER BY count(*) DESC)
        FROM public.support_ai_replies ar
        JOIN public.internal_support_tickets t ON t.id = ar.ticket_id
       WHERE ar.created_at >= p_start AND ar.created_at < p_end
         AND ar.feedback_reason IS NOT NULL
         AND (p_site_id IS NULL OR t.site_id = p_site_id)
         AND (v_access IS NULL OR t.site_id = ANY(v_access))
       GROUP BY ar.feedback_reason
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_replies(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_replies(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. Knowledge base value. Article insertions / articles-used-in-replies are
--     not tracked by the current Prompt 17 workflow (inserting an article into
--     the editor is client-side only), so those metrics are intentionally
--     omitted rather than invented.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_knowledge(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  RETURN jsonb_build_object(
    'total_articles', (SELECT count(*) FROM public.support_knowledge_articles ka
             WHERE (p_site_id IS NULL OR ka.site_id = p_site_id)
               AND (v_access IS NULL OR ka.site_id IS NULL OR ka.site_id = ANY(v_access))),
    'approved_articles', (SELECT count(*) FROM public.support_knowledge_articles ka
             WHERE ka.status = 'approved'
               AND (p_site_id IS NULL OR ka.site_id = p_site_id)
               AND (v_access IS NULL OR ka.site_id IS NULL OR ka.site_id = ANY(v_access))),
    'stale_articles', (SELECT count(*) FROM public.support_knowledge_articles ka
             WHERE ka.status = 'approved' AND ka.last_reviewed_at < (now() - interval '180 days')
               AND (p_site_id IS NULL OR ka.site_id = p_site_id)
               AND (v_access IS NULL OR ka.site_id IS NULL OR ka.site_id = ANY(v_access))),
    'articles_due_review', (SELECT count(*) FROM public.support_knowledge_articles ka
             WHERE ka.status IN ('approved','review') AND ka.last_reviewed_at < (now() - interval '180 days')
               AND (p_site_id IS NULL OR ka.site_id = p_site_id)
               AND (v_access IS NULL OR ka.site_id IS NULL OR ka.site_id = ANY(v_access))),
    'resolution_memories', (SELECT count(*) FROM public.support_resolution_records rr
             WHERE (p_site_id IS NULL OR rr.site_id = p_site_id)
               AND (v_access IS NULL OR rr.site_id IS NULL OR rr.site_id = ANY(v_access))),
    'approved_resolution_memories', (SELECT count(*) FROM public.support_resolution_records rr
             WHERE rr.status = 'approved'
               AND (p_site_id IS NULL OR rr.site_id = p_site_id)
               AND (v_access IS NULL OR rr.site_id IS NULL OR rr.site_id = ANY(v_access)))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_knowledge(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_knowledge(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 12. Routing quality (Prompt 15 data) — routing_status breakdown + default
--     team fallbacks + manual overrides.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_routing(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  RETURN jsonb_build_object(
    'routed', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.routing_status = 'assigned'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'needs_review', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.routing_status = 'needs_review'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'queued', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.routing_status = 'queued'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'unrouted', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.routing_status = 'unrouted'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'escalated', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.routing_status = 'escalated'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'default_team_fallbacks', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.routing_reason ILIKE '%default team%'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'manual_overrides', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.matched_rule_id IS NULL AND t.routing_status IN ('assigned','escalated')
               AND t.team_id IS NOT NULL
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'by_team', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'team_name', COALESCE(tm.name, 'Unassigned'),
               'routed', count(*) FILTER (WHERE t.routing_status = 'assigned'),
               'needs_review', count(*) FILTER (WHERE t.routing_status = 'needs_review'),
               'default_fallback', count(*) FILTER (WHERE t.routing_reason ILIKE '%default team%')
             ) ORDER BY count(*) DESC)
        FROM public.internal_support_tickets t
        LEFT JOIN public.internal_support_teams tm ON tm.id = t.team_id
       WHERE t.created_at >= p_start AND t.created_at < p_end
         AND (p_site_id IS NULL OR t.site_id = p_site_id)
         AND (v_access IS NULL OR t.site_id = ANY(v_access))
         AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')
       GROUP BY tm.name
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_routing(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_routing(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 13. Escalation analytics.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_analytics_escalations(
  p_start timestamptz,
  p_end timestamptz,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_access uuid[];
BEGIN
  IF NOT public.internal_has_permission('support.metrics.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  v_access := public.internal_accessible_site_ids();

  RETURN jsonb_build_object(
    'escalated_tickets', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND (t.escalation_level > 0 OR t.routing_status = 'escalated')
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'security_escalations', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.category = 'security'
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'technical_escalations', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND t.category IN ('technical','bug')
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'sla_escalations', (SELECT count(*) FROM public.internal_support_tickets t
             WHERE t.created_at >= p_start AND t.created_at < p_end
               AND (t.resolution_breached_at IS NOT NULL OR t.first_response_breached_at IS NOT NULL)
               AND (p_site_id IS NULL OR t.site_id = p_site_id)
               AND (v_access IS NULL OR t.site_id = ANY(v_access))
               AND NOT (t.external_reference ILIKE 'TEST-%' OR (t.metadata->'context'->>'isTest') = 'true')),
    'repair_failures', (SELECT count(*) FROM public.support_repair_actions r
             WHERE r.created_at >= p_start AND r.created_at < p_end
               AND (r.status = 'failed' OR r.verification->>'status' = 'failed')
               AND (p_site_id IS NULL OR r.site_id = p_site_id)
               AND (v_access IS NULL OR r.site_id = ANY(v_access))),
    'by_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('escalation_type', e.escalation_type, 'count', count(*))
             ORDER BY count(*) DESC)
        FROM public.internal_ticket_escalations e
        JOIN public.internal_support_tickets t ON t.id = e.ticket_id
       WHERE e.created_at >= p_start AND e.created_at < p_end
         AND (p_site_id IS NULL OR t.site_id = p_site_id)
         AND (v_access IS NULL OR t.site_id = ANY(v_access))
       GROUP BY e.escalation_type
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.support_analytics_escalations(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_analytics_escalations(timestamptz, timestamptz, uuid) TO authenticated;
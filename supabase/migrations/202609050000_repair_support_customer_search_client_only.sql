-- ============================================================================
-- DFP COMMAND — REPAIR — SUPPORT CUSTOMER SEARCH (CLIENT-ONLY RECORDS)
-- ============================================================================
-- The original public.support_search_customers only returned profile-backed
-- customers and client records where clients.user_id IS NOT NULL. A valid
-- client with clients.user_id = NULL was therefore invisible to the
-- Link Customer search.
--
-- This adds support_search_customers_v2 which returns BOTH:
--   * profile-backed customers (entity_type = 'user')
--   * client/organisation records without a login (entity_type = 'client')
--
-- NOTE: PostgreSQL does not allow changing a function's return type in place
-- and DROP is blocked by the safety guard, so this is a new function name.
-- The frontend Link Customer modal now calls _v2. The original function is
-- left in place (unused) for backward compatibility.
--
-- Security is preserved: SECURITY DEFINER, support.customers.search permission,
-- and existing RLS are unchanged. Client-only rows expose no auth facts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.support_search_customers_v2(p_query text, p_limit integer DEFAULT 30)
RETURNS TABLE(customer_id uuid, organisation_id uuid, email text, full_name text, company_name text, organisation_name text, products text, role text, status text, match_field text, user_id_short text, entity_type text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
  v_is_uuid boolean;
BEGIN
  IF NOT public.internal_has_permission('support.customers.search') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_is_uuid := v_q ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  INSERT INTO public.support_customer_activity (staff_user_id, action, metadata)
  VALUES (auth.uid(), 'customer_searched', jsonb_build_object('query', v_q));

  IF v_q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matched_users AS (
    SELECT p.id AS cid, 'user_id'::text AS mf, 1 AS rnk
      FROM public.profiles p
     WHERE v_is_uuid AND (p.id::text = v_q OR p.auth_user_id::text = v_q)
    UNION ALL
    SELECT p.id AS cid, 'ticket'::text AS mf, 2 AS rnk
      FROM public.internal_support_tickets t
      JOIN public.profiles p ON p.id = t.customer_user_id OR p.auth_user_id = t.customer_user_id
     WHERE lower(t.ticket_number) = v_q
    UNION ALL
    SELECT p.id AS cid, 'email'::text AS mf, 3 AS rnk
      FROM public.profiles p
     WHERE lower(p.email) LIKE '%' || v_q || '%'
    UNION ALL
    SELECT p.id AS cid, 'name'::text AS mf, 4 AS rnk
      FROM public.profiles p
     WHERE lower(concat_ws(' ', p.full_name, p.display_name, p.first_name, p.last_name)) LIKE '%' || v_q || '%'
    UNION ALL
    SELECT c.user_id AS cid, 'organisation'::text AS mf, 5 AS rnk
      FROM public.clients c
     WHERE c.user_id IS NOT NULL
       AND lower(concat_ws(' ', c.company_name, c.trading_name, c.contact_name)) LIKE '%' || v_q || '%'
    UNION ALL
    SELECT c.user_id AS cid, 'site'::text AS mf, 6 AS rnk
      FROM public.client_websites w
      JOIN public.clients c ON c.id = w.client_id
     WHERE c.user_id IS NOT NULL AND lower(w.name) LIKE '%' || v_q || '%'
  ),
  ranked_users AS (
    SELECT DISTINCT ON (cid) cid, mf, rnk
      FROM matched_users
     ORDER BY cid, rnk
  ),
  user_rows AS (
    SELECT
      r.cid AS customer_id,
      (SELECT c.id FROM public.clients c WHERE c.user_id = r.cid ORDER BY c.created_at ASC LIMIT 1) AS organisation_id,
      p.email,
      coalesce(p.full_name, p.display_name, concat_ws(' ', p.first_name, p.last_name)) AS full_name,
      (SELECT c.company_name FROM public.clients c WHERE c.user_id = r.cid ORDER BY c.created_at ASC LIMIT 1) AS company_name,
      (SELECT coalesce(c.trading_name, c.company_name) FROM public.clients c WHERE c.user_id = r.cid ORDER BY c.created_at ASC LIMIT 1) AS organisation_name,
      (SELECT string_agg(w.name, ', ' ORDER BY w.name) FROM public.client_websites w JOIN public.clients c ON c.id = w.client_id WHERE c.user_id = r.cid) AS products,
      p.role,
      p.status,
      r.mf AS match_field,
      left(r.cid::text, 8) AS user_id_short,
      'user'::text AS entity_type,
      r.rnk
    FROM ranked_users r
    JOIN public.profiles p ON p.id = r.cid
  ),
  client_rows AS (
    SELECT
      NULL::uuid AS customer_id,
      c.id AS organisation_id,
      c.email,
      c.contact_name AS full_name,
      c.company_name,
      coalesce(c.trading_name, c.company_name) AS organisation_name,
      (SELECT string_agg(w.name, ', ' ORDER BY w.name) FROM public.client_websites w WHERE w.client_id = c.id) AS products,
      NULL::text AS role,
      c.status,
      CASE WHEN lower(c.email) LIKE '%' || v_q || '%' THEN 'email'::text ELSE 'name'::text END AS match_field,
      NULL::text AS user_id_short,
      'client'::text AS entity_type,
      (CASE WHEN lower(c.email) LIKE '%' || v_q || '%' THEN 1 ELSE 2 END) + 100 AS rnk
    FROM public.clients c
    WHERE c.user_id IS NULL
      AND (
        lower(c.email) LIKE '%' || v_q || '%'
        OR lower(concat_ws(' ', c.contact_name, c.company_name, c.trading_name)) LIKE '%' || v_q || '%'
      )
  )
  SELECT
    u.customer_id, u.organisation_id, u.email, u.full_name, u.company_name,
    u.organisation_name, u.products, u.role, u.status, u.match_field,
    u.user_id_short, u.entity_type
  FROM (
    SELECT * FROM user_rows
    UNION ALL
    SELECT * FROM client_rows
  ) u
  ORDER BY u.rnk ASC, u.email ASC NULLS LAST
  LIMIT p_limit;
END;
$function$;
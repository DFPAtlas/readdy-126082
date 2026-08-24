-- ============================================================================
-- DFP Command — Support Teams, Site Assignment & Intelligent Ticket Routing
-- Prompt 15
--
-- IMPORTANT: This file documents schema + functions that were applied live to
-- the database. Every statement is idempotent (IF NOT EXISTS / guarded seeds),
-- so running this on an already-migrated database is a safe no-op.
--
-- Flow:  NEW TICKET → IDENTIFY SITE → CLASSIFY → SELECT TEAM → PRIORITY/SLA
--        → ASSIGN OR QUEUE → NOTIFY STAFF → AUDIT
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Support team registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_teams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  description      text,
  status           text NOT NULL DEFAULT 'active',           -- active | archived
  manager_id       uuid,                                     -- staff user_id
  routing_strategy text NOT NULL DEFAULT 'manual',           -- manual | round_robin | least_open_tickets
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_teams_status ON public.internal_support_teams (status);

-- ---------------------------------------------------------------------------
-- 2. Team membership (works alongside Prompt 14 staff roles + site access)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_team_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL,
  staff_id        uuid NOT NULL,                             -- internal_user_roles.user_id
  membership_role text NOT NULL DEFAULT 'member',            -- manager | member
  status          text NOT NULL DEFAULT 'active',            -- active | removed
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_support_team_member UNIQUE (team_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_support_team_members_team ON public.internal_support_team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_support_team_members_staff ON public.internal_support_team_members (staff_id);

-- ---------------------------------------------------------------------------
-- 3. Team ↔ site assignment (teams only receive authorised sites)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_team_sites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL,
  site_id    uuid NOT NULL,                                  -- internal_support_sites.id
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_support_team_site UNIQUE (team_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_support_team_sites_team ON public.internal_support_team_sites (team_id);
CREATE INDEX IF NOT EXISTS idx_support_team_sites_site ON public.internal_support_team_sites (site_id);

-- ---------------------------------------------------------------------------
-- 4. Deterministic routing rules (no arbitrary executable code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_support_routing_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  rule_order          integer NOT NULL DEFAULT 100,          -- lower = evaluated first
  is_active           boolean NOT NULL DEFAULT true,
  site_id             uuid,                                  -- optional site filter
  category            text,                                  -- optional category filter
  priority            text,                                  -- optional priority filter
  keywords            text,                                  -- comma-separated match terms
  match_security      boolean NOT NULL DEFAULT false,
  match_billing       boolean NOT NULL DEFAULT false,
  team_id             uuid NOT NULL,                         -- routing result
  suggested_priority  text,                                  -- low|normal|high|urgent|critical
  requires_escalation boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_routing_rules_order ON public.internal_support_routing_rules (rule_order, created_at);

-- ---------------------------------------------------------------------------
-- 5. Default teams (extensible — not hard-coded to a fixed list)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.internal_support_teams WHERE name = 'General Support') THEN
    INSERT INTO public.internal_support_teams (name, description, routing_strategy) VALUES
      ('General Support', 'Everyday account, access and product questions.', 'least_open_tickets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.internal_support_teams WHERE name = 'Technical Support') THEN
    INSERT INTO public.internal_support_teams (name, description, routing_strategy) VALUES
      ('Technical Support', 'Technical issues, bugs and integration failures.', 'round_robin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.internal_support_teams WHERE name = 'Billing Support') THEN
    INSERT INTO public.internal_support_teams (name, description, routing_strategy) VALUES
      ('Billing Support', 'Subscriptions, invoices and payment-related enquiries.', 'manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.internal_support_teams WHERE name = 'Security Support') THEN
    INSERT INTO public.internal_support_teams (name, description, routing_strategy) VALUES
      ('Security Support', 'Security, fraud and account-takeover triage.', 'manual');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Auto-routing trigger — every new (non-spam) ticket is routed on insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.route_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.routing_status = 'unrouted' AND NEW.status <> 'spam' THEN
    PERFORM public.internal_resolve_ticket_route(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_route_new_ticket ON public.internal_support_tickets;
CREATE TRIGGER trg_route_new_ticket
  AFTER INSERT ON public.internal_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.route_new_ticket();

-- ---------------------------------------------------------------------------
-- 7. RPC inventory (applied live — signatures for reference)
--
-- Teams / membership / sites
--   internal_list_support_teams()                  → team list w/ member_count, site_ids, site_names, open_tickets
--   internal_upsert_support_team(p_team_id, p_name, p_description, p_manager_id, p_routing_strategy)
--   internal_archive_support_team(p_team_id)
--   internal_set_team_members(p_team_id, p_staff_ids uuid[])
--   internal_set_team_sites(p_team_id, p_site_ids uuid[])
--   internal_set_site_default_team(p_site_id, p_team_id)
--   internal_team_workload()                       → per-team workload metrics
--
-- Routing rules
--   internal_list_routing_rules()
--   internal_upsert_routing_rule(p_rule_id, p_name, p_rule_order, p_is_active, p_site_id, p_category, p_priority, p_keywords, p_match_security, p_match_billing, p_team_id, p_suggested_priority, p_requires_escalation)
--   internal_delete_routing_rule(p_rule_id)
--
-- Routing / assignment
--   internal_route_ticket(p_ticket_id)             → permission-gated resolve
--   internal_resolve_ticket_route(p_ticket_id)     → full routing resolution (security/billing/rule/default/needs_review + auto-assign + priority clamp + audit events)
--   internal_list_assignable_staff(p_ticket_id)    → staff eligible for a ticket (site + team + role + active)
--   internal_pick_team_member(p_team_id, p_site_id, p_strategy) → round_robin / least_open_tickets pick
--   internal_assign_ticket(p_ticket_id, p_staff_id)
--   internal_self_assign_ticket(p_ticket_id)
--   internal_unassign_ticket(p_ticket_id)
--   internal_set_ticket_team(p_ticket_id, p_team_id)
--
-- Notifications / reports
--   internal_enqueue_notification(...)
--   internal_enqueue_escalation_notification(...)
--   internal_support_unassigned_summary(...)
-- ---------------------------------------------------------------------------
-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 12: NOTIFICATIONS + ESCALATIONS LIVE
-- PERSISTENCE
--
-- Creates the live Notifications & Escalations foundation:
--   * ai_notification_rules   — notification routing + escalation rule registry.
--   * ai_escalation_policies  — escalation chain definitions.
--   * ai_escalation_levels    — ordered escalation steps.
--   * ai_notification_events  — append-oriented event history.
--   * ai_quiet_hours_policies — quiet-hours configuration.
--
-- Safety:
--   * RLS enabled on all five tables, reusing public.internal_role().
--   * SELECT for authenticated staff; INSERT/UPDATE for owner/admin.
--     ai_notification_events UPDATE is acknowledgement-metadata-only in the
--     application layer (no broad history rewrite); escalation levels use
--     ON DELETE RESTRICT. No DELETE policies anywhere.
--   * No real delivery occurs — channels/recipients are configuration metadata
--     only. No email/SMS/push/Slack/Teams/webhook/phone is contacted, no n8n,
--     no agent/model execution, no scheduler jobs.
--   * No secrets or private contact details — recipient_scope/reference are
--     safe role labels only (e.g. "Security Team", "Management").
--
-- This file is idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT).
-- No unrelated messaging/email/notification tables are touched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_notification_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  event_type text,
  scope text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  severity_minimum text,
  priority_minimum text,
  environment text NOT NULL DEFAULT 'production',
  status text,
  channels jsonb,
  recipient_scope text,
  recipient_reference text,
  acknowledgement_required boolean NOT NULL DEFAULT false,
  acknowledgement_timeout_minutes integer,
  escalation_enabled boolean NOT NULL DEFAULT false,
  escalation_policy_key text,
  quiet_hours_policy_key text,
  dedupe_window_minutes integer,
  suppression_enabled boolean NOT NULL DEFAULT true,
  approval_required boolean NOT NULL DEFAULT false,
  audit_required boolean NOT NULL DEFAULT false,
  owner_team text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_notif_rules_severity_check CHECK (severity_minimum IN ('info','low','medium','high','critical')),
  CONSTRAINT ai_notif_rules_priority_check CHECK (priority_minimum IN ('informational','normal','high','urgent','critical')),
  CONSTRAINT ai_notif_rules_status_check CHECK (status IN ('active','draft','review_required','disabled','expired')),
  CONSTRAINT ai_notif_rules_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_notif_rules_event_type ON public.ai_notification_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_notif_rules_site ON public.ai_notification_rules(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_rules_env ON public.ai_notification_rules(environment);
CREATE INDEX IF NOT EXISTS idx_ai_notif_rules_status ON public.ai_notification_rules(status);
CREATE INDEX IF NOT EXISTS idx_ai_notif_rules_active ON public.ai_notification_rules(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_notification_rules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_notification_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_notification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_notif_rules_select ON public.ai_notification_rules;
CREATE POLICY ai_notif_rules_select ON public.ai_notification_rules
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_notif_rules_insert ON public.ai_notification_rules;
CREATE POLICY ai_notif_rules_insert ON public.ai_notification_rules
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_notif_rules_update ON public.ai_notification_rules;
CREATE POLICY ai_notif_rules_update ON public.ai_notification_rules
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_escalation_policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  scope text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'active',
  max_level integer NOT NULL DEFAULT 0,
  acknowledgement_required boolean NOT NULL DEFAULT false,
  reset_on_acknowledge boolean NOT NULL DEFAULT false,
  owner_team text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_esc_policies_status_check CHECK (status IN ('active','draft','review_required','disabled','expired')),
  CONSTRAINT ai_esc_policies_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_esc_policies_site ON public.ai_escalation_policies(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_esc_policies_env ON public.ai_escalation_policies(environment);
CREATE INDEX IF NOT EXISTS idx_ai_esc_policies_status ON public.ai_escalation_policies(status);
CREATE INDEX IF NOT EXISTS idx_ai_esc_policies_active ON public.ai_escalation_policies(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_escalation_policies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_escalation_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_escalation_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_esc_policies_select ON public.ai_escalation_policies;
CREATE POLICY ai_esc_policies_select ON public.ai_escalation_policies
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_esc_policies_insert ON public.ai_escalation_policies;
CREATE POLICY ai_esc_policies_insert ON public.ai_escalation_policies
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_esc_policies_update ON public.ai_escalation_policies;
CREATE POLICY ai_esc_policies_update ON public.ai_escalation_policies
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_escalation_levels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_escalation_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_policy_id uuid NOT NULL REFERENCES public.ai_escalation_policies(id) ON DELETE RESTRICT,
  level_number integer NOT NULL,
  name text,
  delay_minutes integer NOT NULL DEFAULT 0,
  recipient_scope text,
  recipient_reference text,
  channels jsonb,
  severity_override text,
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_esc_levels_unique UNIQUE (escalation_policy_id, level_number)
);

CREATE INDEX IF NOT EXISTS idx_ai_esc_levels_policy ON public.ai_escalation_levels(escalation_policy_id);
CREATE INDEX IF NOT EXISTS idx_ai_esc_levels_level ON public.ai_escalation_levels(level_number);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_escalation_levels;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_escalation_levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_escalation_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_esc_levels_select ON public.ai_escalation_levels;
CREATE POLICY ai_esc_levels_select ON public.ai_escalation_levels
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_esc_levels_insert ON public.ai_escalation_levels;
CREATE POLICY ai_esc_levels_insert ON public.ai_escalation_levels
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_esc_levels_update ON public.ai_escalation_levels;
CREATE POLICY ai_esc_levels_update ON public.ai_escalation_levels
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_notification_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  rule_id uuid REFERENCES public.ai_notification_rules(id) ON DELETE SET NULL,
  escalation_policy_id uuid REFERENCES public.ai_escalation_policies(id) ON DELETE SET NULL,
  alert_id uuid REFERENCES public.ai_alerts(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES public.ai_incidents(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.ai_approvals(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  event_type text,
  severity text,
  priority text,
  environment text NOT NULL DEFAULT 'production',
  channel text,
  recipient_scope text,
  recipient_reference text,
  status text,
  delivery_state text,
  acknowledgement_state text,
  acknowledged_by text,
  acknowledged_at timestamptz,
  escalation_level integer,
  dedupe_key text,
  suppressed boolean NOT NULL DEFAULT false,
  suppression_reason text,
  correlation_id text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_notif_events_severity_check CHECK (severity IN ('info','low','medium','high','critical')),
  CONSTRAINT ai_notif_events_priority_check CHECK (priority IN ('informational','normal','high','urgent','critical')),
  CONSTRAINT ai_notif_events_status_check CHECK (status IN ('queued','sent','delivered','acknowledged','failed','escalated','suppressed','expired','cancelled')),
  CONSTRAINT ai_notif_events_ack_check CHECK (acknowledgement_state IN ('not_required','awaiting','acknowledged','missed','expired')),
  CONSTRAINT ai_notif_events_channel_check CHECK (channel IN ('dfp_command','email','sms','push','slack','teams','webhook','phone','other')),
  CONSTRAINT ai_notif_events_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_notif_events_rule ON public.ai_notification_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_alert ON public.ai_notification_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_incident ON public.ai_notification_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_approval ON public.ai_notification_events(approval_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_run ON public.ai_notification_events(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_site ON public.ai_notification_events(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_type ON public.ai_notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_severity ON public.ai_notification_events(severity);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_status ON public.ai_notification_events(status);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_ack ON public.ai_notification_events(acknowledgement_state);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_correlation ON public.ai_notification_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_notif_events_created ON public.ai_notification_events(created_at);

ALTER TABLE public.ai_notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_notif_events_select ON public.ai_notification_events;
CREATE POLICY ai_notif_events_select ON public.ai_notification_events
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_notif_events_insert ON public.ai_notification_events;
CREATE POLICY ai_notif_events_insert ON public.ai_notification_events
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
-- Acknowledgement metadata only — the application restricts writes to
-- acknowledgement_state / acknowledged_by / acknowledged_at. No broad history
-- rewrite is exposed through the UI.
DROP POLICY IF EXISTS ai_notif_events_update ON public.ai_notification_events;
CREATE POLICY ai_notif_events_update ON public.ai_notification_events
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_quiet_hours_policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_quiet_hours_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  name text NOT NULL,
  scope text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  start_time text,
  end_time text,
  days jsonb,
  critical_bypass boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_quiet_hours_site ON public.ai_quiet_hours_policies(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_quiet_hours_active ON public.ai_quiet_hours_policies(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_quiet_hours_policies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_quiet_hours_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_quiet_hours_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_quiet_hours_select ON public.ai_quiet_hours_policies;
CREATE POLICY ai_quiet_hours_select ON public.ai_quiet_hours_policies
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_quiet_hours_insert ON public.ai_quiet_hours_policies;
CREATE POLICY ai_quiet_hours_insert ON public.ai_quiet_hours_policies
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_quiet_hours_update ON public.ai_quiet_hours_policies;
CREATE POLICY ai_quiet_hours_update ON public.ai_quiet_hours_policies
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ============================================================================
-- QUIET-HOURS SEED (2 group-wide policies)
-- ============================================================================
INSERT INTO public.ai_quiet_hours_policies (policy_key, name, scope, site_id, timezone, start_time, end_time, days, critical_bypass, is_active)
VALUES
  ('qh-critical-bypass','Critical Bypass','group',NULL,'UTC','00:00','00:00','["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,true,true),
  ('qh-delay-normal','Delay Normal Notifications','group',NULL,'UTC','22:00','07:00','["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,true,true)
ON CONFLICT (policy_key) DO UPDATE SET
  name = EXCLUDED.name, scope = EXCLUDED.scope, timezone = EXCLUDED.timezone,
  start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, days = EXCLUDED.days,
  critical_bypass = EXCLUDED.critical_bypass, is_active = EXCLUDED.is_active;

-- ============================================================================
-- INITIAL RULE MIGRATION (24 demo rules). Idempotent via ON CONFLICT.
-- ============================================================================
INSERT INTO public.ai_notification_rules (
  rule_key, name, description, event_type, scope, site_id, severity_minimum,
  priority_minimum, environment, status, channels, recipient_scope,
  recipient_reference, acknowledgement_required, acknowledgement_timeout_minutes,
  escalation_enabled, escalation_policy_key, quiet_hours_policy_key,
  dedupe_window_minutes, suppression_enabled, approval_required, audit_required,
  owner_team, is_active, notes
)
SELECT
  v.rule_key, v.name, v.description, v.event_type, v.scope, s.id,
  v.severity_minimum, v.priority_minimum, 'production', v.status, v.channels::jsonb,
  'team', v.recipient_reference, v.acknowledgement_required,
  v.acknowledgement_timeout_minutes, v.escalation_enabled, v.escalation_policy_key,
  v.quiet_hours_policy_key, v.dedupe_window_minutes, v.suppression_enabled, false,
  v.audit_required, v.owner_team, v.is_active, v.notes
FROM (VALUES
  ('NOT-1001','Critical Site Outage','Immediately notify the Technical Team when any site reports a critical outage or total service interruption.','site_health','group',NULL,'critical','critical','active','["dfp_command","email","slack","phone"]','Technical Team',true,5,true,'ESC-NOT-1001','qh-critical-bypass',10,true,true,'Group AI Operations',true,'Highest-priority rule. Bypasses quiet hours and deduplication suppression for genuine outages.'),
  ('NOT-1002','Security Violation Alert','Route all security and policy violations to the Security Team for immediate review.','policy_violation','group',NULL,'high','critical','active','["dfp_command","email","slack"]','Security Team',true,10,true,'ESC-NOT-1002','qh-critical-bypass',15,true,true,'Group AI Operations',true,'Security events always generate an audit record.'),
  ('NOT-1003','RED Action Blocked','Notify AI Operations and the approval team whenever a RED-class action is blocked pending approval.','action_blocked','group',NULL,'high','high','active','["dfp_command","email"]','AI Operations + Approval Team',true,15,true,'ESC-NOT-1003','qh-critical-bypass',30,true,true,'Group AI Operations',true,'Blocked RED actions require human approval before any execution.'),
  ('NOT-1004','Approval Nearing Expiry','Remind approvers when a pending approval approaches its expiry window.','approval_expiring','group',NULL,'medium','high','active','["dfp_command","email"]','Approval Team',false,NULL,true,'ESC-NOT-1004','qh-delay-normal',240,true,false,'Group AI Operations',true,'Reminder-only rule; does not require acknowledgement.'),
  ('NOT-1005','Failed Run After Retries','Escalate to technical when a run fails after exhausting its retry policy.','run_failure','group',NULL,'high','high','active','["dfp_command","email"]','Technical Team',true,20,true,'ESC-NOT-1005','qh-delay-normal',60,true,true,'Group AI Operations',true,'Triggers only after configured max attempts are exhausted.'),
  ('NOT-1006','n8n Outage','Route n8n / workflow automation outages to the Platform Team.','tool_connection','group',NULL,'critical','critical','active','["dfp_command","email","slack"]','Platform Team',true,5,true,'ESC-NOT-1006','qh-critical-bypass',10,true,true,'Group AI Operations',true,'n8n is a shared dependency for most sites.'),
  ('NOT-1007','Model Provider Degraded','Notify AI Operations when a model provider is degraded or unavailable.','model_provider','group',NULL,'high','high','active','["dfp_command","email"]','AI Operations',true,15,true,'ESC-NOT-1007','qh-delay-normal',30,true,false,'Group AI Operations',true,'Fallback routing may mitigate; notify to confirm fallback health.'),
  ('NOT-1008','Budget Over 90%','Flag budget spends exceeding 90% of monthly limit for management review.','budget_alert','group',NULL,'high','high','active','["dfp_command","email"]','Management',false,NULL,true,'ESC-NOT-1008','qh-delay-normal',1440,true,true,'Group AI Operations',true,'Governance only — no automatic spend enforcement.'),
  ('NOT-1009','UAT Failure','Notify the project and UAT team when a UAT cycle fails.','uat_failure','group',NULL,'high','high','active','["dfp_command","email","slack"]','Project / UAT Team',true,30,true,'ESC-NOT-1009','qh-delay-normal',120,true,true,'Group AI Operations',true,'Blocks release progression; requires verification before retry.'),
  ('NOT-1010','Agent Offline','Notify AI Operations when a production agent goes offline or errors.','agent_failure','group',NULL,'high','high','active','["dfp_command","email"]','AI Operations',true,15,true,'ESC-NOT-1010','qh-delay-normal',30,true,false,'Group AI Operations',true,'Covers both agent errors and full offline states.'),
  ('NOT-1011','Repeated Incident Escalation','Increase severity and notify wider team when a known issue repeats.','repeating_incident','group',NULL,'medium','high','active','["dfp_command","email"]','AI Operations',true,20,true,'ESC-NOT-1011','qh-delay-normal',NULL,false,true,'Group AI Operations',true,'Deduplication disabled so repeats always surface.'),
  ('NOT-1012','Unresolved Critical Alert','Escalate critical alerts that remain unresolved past their SLA to management.','sla_breach','group',NULL,'critical','critical','active','["dfp_command","email","phone"]','Management',true,10,true,'ESC-NOT-1012','qh-critical-bypass',30,true,true,'Group AI Operations',true,'Triggers on critical alerts breaching resolution SLA.'),
  ('NOT-1013','Digital Footprint Site Health','Route Digital Footprint site health alerts to the Digital Footprint delivery team.','site_health','site','digital-footprint','high','high','active','["dfp_command","email"]','Digital Footprint Delivery',true,15,true,'ESC-NOT-1013','qh-delay-normal',30,true,false,'Digital Footprint Delivery',true,'Site-scoped health routing.'),
  ('NOT-1014','QuickGuard Failed Agent Run','Notify QuickGuard Operations on failed agent runs.','run_failure','site','quickguard','high','high','active','["dfp_command","email"]','QuickGuard Operations',true,20,true,'ESC-NOT-1014','qh-delay-normal',60,true,true,'QuickGuard Operations',true,'Covers guard matching and shift management agents.'),
  ('NOT-1015','GuardianHub Check-Call Degradation','Route GuardianHub check-call / welfare agent issues to the welfare team.','agent_failure','site','guardianhub','critical','critical','active','["dfp_command","email","phone"]','GuardianHub Welfare',true,5,true,'ESC-NOT-1015','qh-critical-bypass',10,true,true,'GuardianHub Welfare',true,'Welfare check-calls are safety-critical; highest priority.'),
  ('NOT-1016','LetHub Compliance Warning','Notify LetHub Operations on compliance review warnings.','policy_violation','site','lethub','high','high','active','["dfp_command","email"]','LetHub Operations',true,30,true,'ESC-NOT-1016','qh-delay-normal',60,true,true,'LetHub Operations',true,'Tenancy compliance is a regulated process.'),
  ('NOT-1017','Vowora Notification Failure','Route Vowora guest/notification failures to the Vowora planning team.','integration','site','wedora','high','high','active','["dfp_command","email"]','Vowora Planning',true,20,true,'ESC-NOT-1017','qh-delay-normal',45,true,false,'Vowora Planning',true,'Guest-facing notification delivery failures.'),
  ('NOT-1018','The Forge UAT Failure','Notify Forge engineering on UAT cycle failures for releases.','uat_failure','site','the-forge','high','high','active','["dfp_command","email","slack"]','The Forge Engineering',true,30,true,'ESC-NOT-1018','qh-delay-normal',120,true,true,'The Forge Engineering',true,'Release-blocking UAT failures.'),
  ('NOT-1019','Digital Footprint Support / Diagnostics','Route Digital Footprint support and diagnostics issues to delivery support.','run_failure','site','digital-footprint','high','high','active','["dfp_command","email"]','Digital Footprint Delivery',true,20,true,'ESC-NOT-1019','qh-delay-normal',45,true,true,'Digital Footprint Delivery',true,'Diagnostics and support triage failures.'),
  ('NOT-1020','QuickGuard Payroll Reconciliation','Notify QuickGuard Operations on payroll reconciliation failures.','orchestration_blocked','site','quickguard','high','urgent','active','["dfp_command","email"]','QuickGuard Operations',true,15,true,'ESC-NOT-1020','qh-critical-bypass',30,true,true,'QuickGuard Operations',true,'Payroll has financial impact; flagged urgent.'),
  ('NOT-1021','GuardianHub Welfare Flag Escalation','Immediately escalate welfare flag incidents to GuardianHub safety teams.','security','site','guardianhub','critical','critical','active','["dfp_command","email","phone"]','GuardianHub Welfare',true,5,true,'ESC-NOT-1021','qh-critical-bypass',10,true,true,'GuardianHub Welfare',true,'Welfare flags are safety-critical.'),
  ('NOT-1022','Group Budget Alert','Group-wide budget alerts route to management for review.','budget_alert','group',NULL,'medium','normal','review_required','["dfp_command","email"]','Management',false,NULL,true,'ESC-NOT-1022','qh-delay-normal',1440,true,true,'Group AI Operations',true,'Flagged for review — threshold tuning pending.'),
  ('NOT-1023','Security Policy Violation Reminder','Draft rule for policy violation reminders to site owners.','policy_violation','group',NULL,'medium','normal','draft','["email"]','Site Owner',false,NULL,true,'ESC-NOT-1023','qh-delay-normal',1440,true,false,'Group AI Operations',false,'Draft — awaiting site-owner mapping confirmation.'),
  ('NOT-1024','Model Failure Fallback','Notify AI Operations when a primary model fails and fallback routing activates.','model_failure','group',NULL,'high','high','active','["dfp_command","email"]','AI Operations',true,15,true,'ESC-NOT-1024','qh-delay-normal',30,true,false,'Group AI Operations',true,'Confirms fallback routing is healthy.')
) AS v(rule_key, name, description, event_type, scope, site_key, severity_minimum, priority_minimum, status, channels, recipient_reference, acknowledgement_required, acknowledgement_timeout_minutes, escalation_enabled, escalation_policy_key, quiet_hours_policy_key, dedupe_window_minutes, suppression_enabled, audit_required, owner_team, is_active, notes)
LEFT JOIN public.ai_sites s ON s.site_key = v.site_key
ON CONFLICT (rule_key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
  scope = EXCLUDED.scope, site_id = EXCLUDED.site_id, severity_minimum = EXCLUDED.severity_minimum,
  priority_minimum = EXCLUDED.priority_minimum, status = EXCLUDED.status, channels = EXCLUDED.channels,
  recipient_reference = EXCLUDED.recipient_reference,
  acknowledgement_required = EXCLUDED.acknowledgement_required,
  acknowledgement_timeout_minutes = EXCLUDED.acknowledgement_timeout_minutes,
  escalation_enabled = EXCLUDED.escalation_enabled,
  escalation_policy_key = EXCLUDED.escalation_policy_key,
  quiet_hours_policy_key = EXCLUDED.quiet_hours_policy_key,
  dedupe_window_minutes = EXCLUDED.dedupe_window_minutes,
  suppression_enabled = EXCLUDED.suppression_enabled, audit_required = EXCLUDED.audit_required,
  owner_team = EXCLUDED.owner_team, is_active = EXCLUDED.is_active, notes = EXCLUDED.notes;

-- ============================================================================
-- INITIAL ESCALATION POLICY MIGRATION (24 policies, one per rule — no two rules
-- share an identical escalation design, so no deduplication is possible).
-- ============================================================================
INSERT INTO public.ai_escalation_policies (
  policy_key, name, description, scope, site_id, environment, status, max_level,
  acknowledgement_required, reset_on_acknowledge, owner_team, is_active, notes
)
SELECT
  v.policy_key, v.name, v.description, v.scope, s.id, 'production', 'active',
  v.max_level, v.acknowledgement_required, false, v.owner_team, v.is_active, v.notes
FROM (VALUES
  ('ESC-NOT-1001','Critical Site Outage Escalation','5-level escalation for critical site outages.',NULL,NULL,4,true,'Group AI Operations',true,''),
  ('ESC-NOT-1002','Security Violation Alert Escalation','5-level escalation for security violations.',NULL,NULL,4,true,'Group AI Operations',true,''),
  ('ESC-NOT-1003','RED Action Blocked Escalation','4-level escalation for blocked RED actions.',NULL,NULL,3,true,'Group AI Operations',true,''),
  ('ESC-NOT-1004','Approval Nearing Expiry Escalation','3-level reminder escalation.',NULL,NULL,2,false,'Group AI Operations',true,''),
  ('ESC-NOT-1005','Failed Run After Retries Escalation','4-level escalation for exhausted runs.',NULL,NULL,3,true,'Group AI Operations',true,''),
  ('ESC-NOT-1006','n8n Outage Escalation','4-level escalation for automation outages.',NULL,NULL,3,true,'Group AI Operations',true,''),
  ('ESC-NOT-1007','Model Provider Degraded Escalation','3-level escalation for provider degradation.',NULL,NULL,2,true,'Group AI Operations',true,''),
  ('ESC-NOT-1008','Budget Over 90% Escalation','3-level budget review escalation.',NULL,NULL,2,false,'Group AI Operations',true,''),
  ('ESC-NOT-1009','UAT Failure Escalation','3-level UAT failure escalation.',NULL,NULL,2,true,'Group AI Operations',true,''),
  ('ESC-NOT-1010','Agent Offline Escalation','4-level agent offline escalation.',NULL,NULL,3,true,'Group AI Operations',true,''),
  ('ESC-NOT-1011','Repeated Incident Escalation','4-level repeating incident escalation.',NULL,NULL,3,true,'Group AI Operations',true,''),
  ('ESC-NOT-1012','Unresolved Critical Alert Escalation','5-level critical SLA escalation.',NULL,NULL,4,true,'Group AI Operations',true,''),
  ('ESC-NOT-1013','Digital Footprint Site Health Escalation','4-level site health escalation.','site','digital-footprint',3,true,'Digital Footprint Delivery',true,''),
  ('ESC-NOT-1014','QuickGuard Failed Agent Run Escalation','4-level run failure escalation.','site','quickguard',3,true,'QuickGuard Operations',true,''),
  ('ESC-NOT-1015','GuardianHub Check-Call Degradation Escalation','5-level welfare-critical escalation.','site','guardianhub',4,true,'GuardianHub Welfare',true,''),
  ('ESC-NOT-1016','LetHub Compliance Warning Escalation','3-level compliance escalation.','site','lethub',2,true,'LetHub Operations',true,''),
  ('ESC-NOT-1017','Vowora Notification Failure Escalation','3-level notification failure escalation.','site','wedora',2,true,'Vowora Planning',true,''),
  ('ESC-NOT-1018','The Forge UAT Failure Escalation','3-level UAT failure escalation.','site','the-forge',2,true,'The Forge Engineering',true,''),
  ('ESC-NOT-1019','Digital Footprint Support Diagnostics Escalation','4-level diagnostics escalation.','site','digital-footprint',3,true,'Digital Footprint Delivery',true,''),
  ('ESC-NOT-1020','QuickGuard Payroll Reconciliation Escalation','4-level payroll escalation.','site','quickguard',3,true,'QuickGuard Operations',true,''),
  ('ESC-NOT-1021','GuardianHub Welfare Flag Escalation','5-level welfare-critical escalation.','site','guardianhub',4,true,'GuardianHub Welfare',true,''),
  ('ESC-NOT-1022','Group Budget Alert Escalation','2-level budget review escalation.',NULL,NULL,1,false,'Group AI Operations',true,''),
  ('ESC-NOT-1023','Security Policy Violation Reminder Escalation','2-level reminder escalation.',NULL,NULL,1,false,'Group AI Operations',false,''),
  ('ESC-NOT-1024','Model Failure Fallback Escalation','3-level fallback escalation.',NULL,NULL,2,true,'Group AI Operations',true,'')
) AS v(policy_key, name, description, scope, site_key, max_level, acknowledgement_required, owner_team, is_active, notes)
LEFT JOIN public.ai_sites s ON s.site_key = v.site_key
ON CONFLICT (policy_key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, scope = EXCLUDED.scope,
  site_id = EXCLUDED.site_id, max_level = EXCLUDED.max_level,
  acknowledgement_required = EXCLUDED.acknowledgement_required,
  owner_team = EXCLUDED.owner_team, is_active = EXCLUDED.is_active, notes = EXCLUDED.notes;

-- ============================================================================
-- INITIAL ESCALATION LEVEL MIGRATION (the known 5-level model: L0 Initial,
-- L1 Team, L2 Technical/Security, L3 Management, L4 Critical Incident).
-- ============================================================================
INSERT INTO public.ai_escalation_levels (
  escalation_policy_id, level_number, name, delay_minutes, recipient_scope,
  recipient_reference, channels, severity_override, requires_acknowledgement
)
SELECT p.id, v.level_number, v.name, v.delay_minutes, 'team', v.team,
       v.channels::jsonb, NULL, v.requires_acknowledgement
FROM (VALUES
  ('ESC-NOT-1001',0,'Initial Notification',0,'Technical Team','["dfp_command"]',true),
  ('ESC-NOT-1001',1,'Team Escalation',10,'Technical Team Lead','["email"]',true),
  ('ESC-NOT-1001',2,'Technical / Security Escalation',20,'Platform Team','["slack"]',true),
  ('ESC-NOT-1001',3,'Management Escalation',40,'Management','["email"]',true),
  ('ESC-NOT-1001',4,'Critical Incident',60,'Incident Command','["phone"]',true),
  ('ESC-NOT-1002',0,'Initial Notification',0,'Security Team','["dfp_command"]',true),
  ('ESC-NOT-1002',1,'Team Escalation',15,'Security Team Lead','["email"]',true),
  ('ESC-NOT-1002',2,'Technical / Security Escalation',30,'Security Escalation','["slack"]',true),
  ('ESC-NOT-1002',3,'Management Escalation',45,'Management','["email"]',true),
  ('ESC-NOT-1002',4,'Critical Incident',60,'Incident Command','["phone"]',true),
  ('ESC-NOT-1003',0,'Initial Notification',0,'AI Operations + Approval Team','["dfp_command"]',true),
  ('ESC-NOT-1003',1,'Team Escalation',30,'Approval Team Lead','["email"]',true),
  ('ESC-NOT-1003',2,'Technical / Security Escalation',60,'Management','["email"]',true),
  ('ESC-NOT-1003',3,'Management Escalation',120,'Management','["phone"]',true),
  ('ESC-NOT-1004',0,'Initial Notification',0,'Approval Team','["dfp_command"]',false),
  ('ESC-NOT-1004',1,'Team Escalation',120,'Approval Team Lead','["email"]',false),
  ('ESC-NOT-1004',2,'Technical / Security Escalation',360,'Management','["email"]',true),
  ('ESC-NOT-1005',0,'Initial Notification',0,'Technical Team','["dfp_command"]',true),
  ('ESC-NOT-1005',1,'Team Escalation',45,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1005',2,'Technical / Security Escalation',90,'Platform Team','["slack"]',true),
  ('ESC-NOT-1005',3,'Management Escalation',180,'Management','["email"]',true),
  ('ESC-NOT-1006',0,'Initial Notification',0,'Platform Team','["dfp_command"]',true),
  ('ESC-NOT-1006',1,'Team Escalation',15,'Platform Team Lead','["email"]',true),
  ('ESC-NOT-1006',2,'Technical / Security Escalation',30,'Technical Escalation','["slack"]',true),
  ('ESC-NOT-1006',3,'Management Escalation',60,'Management','["email"]',true),
  ('ESC-NOT-1007',0,'Initial Notification',0,'AI Operations','["dfp_command"]',true),
  ('ESC-NOT-1007',1,'Team Escalation',30,'Platform Team','["email"]',true),
  ('ESC-NOT-1007',2,'Technical / Security Escalation',60,'Management','["email"]',true),
  ('ESC-NOT-1008',0,'Initial Notification',0,'Management','["dfp_command"]',false),
  ('ESC-NOT-1008',1,'Team Escalation',1440,'Finance Review','["email"]',false),
  ('ESC-NOT-1008',2,'Technical / Security Escalation',2880,'Management','["email"]',true),
  ('ESC-NOT-1009',0,'Initial Notification',0,'Project / UAT Team','["dfp_command"]',true),
  ('ESC-NOT-1009',1,'Team Escalation',120,'Delivery Lead','["email"]',true),
  ('ESC-NOT-1009',2,'Technical / Security Escalation',240,'Management','["email"]',true),
  ('ESC-NOT-1010',0,'Initial Notification',0,'AI Operations','["dfp_command"]',true),
  ('ESC-NOT-1010',1,'Team Escalation',30,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1010',2,'Technical / Security Escalation',60,'Platform Team','["slack"]',true),
  ('ESC-NOT-1010',3,'Management Escalation',120,'Management','["email"]',true),
  ('ESC-NOT-1011',0,'Initial Notification',0,'AI Operations','["dfp_command"]',true),
  ('ESC-NOT-1011',1,'Team Escalation',45,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1011',2,'Technical / Security Escalation',90,'Security / Platform','["slack"]',true),
  ('ESC-NOT-1011',3,'Management Escalation',180,'Management','["email"]',true),
  ('ESC-NOT-1012',0,'Initial Notification',0,'Management','["dfp_command"]',true),
  ('ESC-NOT-1012',1,'Team Escalation',30,'Management','["phone"]',true),
  ('ESC-NOT-1012',2,'Technical / Security Escalation',60,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1012',3,'Management Escalation',120,'Management','["phone"]',true),
  ('ESC-NOT-1012',4,'Critical Incident',180,'Incident Command','["phone"]',true),
  ('ESC-NOT-1013',0,'Initial Notification',0,'Digital Footprint Delivery','["dfp_command"]',true),
  ('ESC-NOT-1013',1,'Team Escalation',30,'Technical Team','["email"]',true),
  ('ESC-NOT-1013',2,'Technical / Security Escalation',60,'Platform Team','["slack"]',true),
  ('ESC-NOT-1013',3,'Management Escalation',120,'Management','["email"]',true),
  ('ESC-NOT-1014',0,'Initial Notification',0,'QuickGuard Operations','["dfp_command"]',true),
  ('ESC-NOT-1014',1,'Team Escalation',45,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1014',2,'Technical / Security Escalation',90,'Platform Team','["slack"]',true),
  ('ESC-NOT-1014',3,'Management Escalation',180,'Management','["email"]',true),
  ('ESC-NOT-1015',0,'Initial Notification',0,'GuardianHub Welfare','["dfp_command"]',true),
  ('ESC-NOT-1015',1,'Team Escalation',10,'Welfare Team Lead','["phone"]',true),
  ('ESC-NOT-1015',2,'Technical / Security Escalation',20,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1015',3,'Management Escalation',40,'Management','["phone"]',true),
  ('ESC-NOT-1015',4,'Critical Incident',60,'Incident Command','["phone"]',true),
  ('ESC-NOT-1016',0,'Initial Notification',0,'LetHub Operations','["dfp_command"]',true),
  ('ESC-NOT-1016',1,'Team Escalation',60,'Security Team','["email"]',true),
  ('ESC-NOT-1016',2,'Technical / Security Escalation',180,'Management','["email"]',true),
  ('ESC-NOT-1017',0,'Initial Notification',0,'Vowora Planning','["dfp_command"]',true),
  ('ESC-NOT-1017',1,'Team Escalation',45,'Platform Team','["email"]',true),
  ('ESC-NOT-1017',2,'Technical / Security Escalation',120,'Management','["email"]',true),
  ('ESC-NOT-1018',0,'Initial Notification',0,'The Forge Engineering','["dfp_command"]',true),
  ('ESC-NOT-1018',1,'Team Escalation',120,'Delivery Lead','["email"]',true),
  ('ESC-NOT-1018',2,'Technical / Security Escalation',240,'Management','["email"]',true),
  ('ESC-NOT-1019',0,'Initial Notification',0,'Digital Footprint Delivery','["dfp_command"]',true),
  ('ESC-NOT-1019',1,'Team Escalation',45,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1019',2,'Technical / Security Escalation',90,'Platform Team','["slack"]',true),
  ('ESC-NOT-1019',3,'Management Escalation',180,'Management','["email"]',true),
  ('ESC-NOT-1020',0,'Initial Notification',0,'QuickGuard Operations','["dfp_command"]',true),
  ('ESC-NOT-1020',1,'Team Escalation',30,'Technical Escalation','["email"]',true),
  ('ESC-NOT-1020',2,'Technical / Security Escalation',60,'Management','["email"]',true),
  ('ESC-NOT-1020',3,'Management Escalation',120,'Management','["phone"]',true),
  ('ESC-NOT-1021',0,'Initial Notification',0,'GuardianHub Welfare','["dfp_command"]',true),
  ('ESC-NOT-1021',1,'Team Escalation',10,'Welfare Team Lead','["phone"]',true),
  ('ESC-NOT-1021',2,'Technical / Security Escalation',20,'Incident / Safety Team','["email"]',true),
  ('ESC-NOT-1021',3,'Management Escalation',40,'Management','["phone"]',true),
  ('ESC-NOT-1021',4,'Critical Incident',60,'Incident Command','["phone"]',true),
  ('ESC-NOT-1022',0,'Initial Notification',0,'Management','["dfp_command"]',false),
  ('ESC-NOT-1022',1,'Team Escalation',1440,'Finance Review','["email"]',false),
  ('ESC-NOT-1023',0,'Initial Notification',0,'Site Owner','["email"]',false),
  ('ESC-NOT-1023',1,'Team Escalation',1440,'Security Team','["email"]',true),
  ('ESC-NOT-1024',0,'Initial Notification',0,'AI Operations','["dfp_command"]',true),
  ('ESC-NOT-1024',1,'Team Escalation',30,'Platform Team','["email"]',true),
  ('ESC-NOT-1024',2,'Technical / Security Escalation',60,'Management','["email"]',true)
) AS v(policy_key, level_number, name, delay_minutes, team, channels, requires_acknowledgement)
JOIN public.ai_escalation_policies p ON p.policy_key = v.policy_key
ON CONFLICT (escalation_policy_id, level_number) DO UPDATE SET
  name = EXCLUDED.name, delay_minutes = EXCLUDED.delay_minutes,
  recipient_reference = EXCLUDED.recipient_reference, channels = EXCLUDED.channels,
  requires_acknowledgement = EXCLUDED.requires_acknowledgement;

-- ============================================================================
-- INITIAL EVENT MIGRATION (30 demo events). Historical/demo baseline only —
-- delivery_state = 'demo_migrated' (no external delivery is claimed). FKs
-- resolve to live alert/approval/run/site/rule rows where the key exists.
-- ============================================================================
INSERT INTO public.ai_notification_events (
  event_key, rule_id, alert_id, approval_id, run_id, site_id, event_type,
  severity, priority, environment, channel, recipient_scope, recipient_reference,
  status, delivery_state, acknowledgement_state, acknowledged_by, acknowledged_at,
  escalation_level, dedupe_key, suppressed, suppression_reason, correlation_id, summary
)
SELECT
  v.event_key, r.id, al.id, ap.id, ru.id, s.id, v.event_type, v.severity,
  v.priority, 'production', v.channel, 'team', v.recipient_reference, v.status,
  'demo_migrated', v.acknowledgement_state, NULLIF(v.acknowledged_by, ''),
  NULLIF(v.acknowledged_at,'')::timestamptz, v.escalation_level, NULL,
  v.suppressed, CASE WHEN v.suppressed THEN 'demo_dedupe' ELSE NULL END,
  v.correlation_id, v.summary
FROM (VALUES
  ('NOT-EVT-0001','NOT-1001','ALR-5001',NULL,NULL,'guardianhub','Alerts & Incidents','critical','critical','dfp_command','Technical Team','acknowledged','acknowledged','Technical Team','2026-08-25 11:01',0,false,NULL,'Critical site outage — check-call service down'),
  ('NOT-EVT-0002','NOT-1002',NULL,NULL,NULL,'digital-footprint','Security & Policy','critical','critical','dfp_command','Security Team','delivered','awaiting','','',0,false,'POL-AUTH-CHANGE','Security violation — restricted action attempted'),
  ('NOT-EVT-0003','NOT-1005',NULL,NULL,'RUN-7A9E3','the-forge','Tasks & Runs','high','high','email','Technical Team','escalated','missed','','',1,false,NULL,'Run failed after retries — code generation'),
  ('NOT-EVT-0004','NOT-1004',NULL,'APR-4471',NULL,NULL,'Approvals','medium','high','dfp_command','Approval Team','sent','not_required','','',0,false,NULL,'Approval APR-4471 nearing expiry'),
  ('NOT-EVT-0005','NOT-1006',NULL,NULL,NULL,NULL,'Tools & Connections','critical','critical','dfp_command','Platform Team','acknowledged','acknowledged','Platform Team','2026-08-25 09:47',0,false,'ORC-7019','n8n connection failure'),
  ('NOT-EVT-0006','NOT-1007',NULL,NULL,NULL,NULL,'Models & Providers','high','high','dfp_command','AI Operations','delivered','acknowledged','AI Operations','2026-08-25 09:40',0,false,'PROV-ANTHROPIC','Model provider degraded — Anthropic'),
  ('NOT-EVT-0007','NOT-1008',NULL,NULL,NULL,'quickguard','Cost & Budgets','high','high','email','Management','delivered','not_required','','',0,false,'BUD-0003','Budget >90% — QuickGuard AI'),
  ('NOT-EVT-0008','NOT-1009','ALR-5050',NULL,NULL,'the-forge','UAT','high','high','dfp_command','Project / UAT Team','acknowledged','acknowledged','Project / UAT Team','2026-08-25 09:20',0,false,NULL,'UAT cycle failed — release validation'),
  ('NOT-EVT-0009','NOT-1015',NULL,NULL,NULL,'guardianhub','Agents','critical','critical','dfp_command','GuardianHub Welfare','acknowledged','acknowledged','GuardianHub Welfare','2026-08-25 08:57',0,false,'gh-checkcall','Agent offline — Check-Call Agent'),
  ('NOT-EVT-0010','NOT-1011','ALR-5007',NULL,NULL,NULL,'Alerts & Incidents','high','high','dfp_command','AI Operations','delivered','awaiting','','',0,false,NULL,'Repeated incident detected — known issue'),
  ('NOT-EVT-0011','NOT-1012','ALR-5002',NULL,NULL,'digital-footprint','Alerts & Incidents','critical','critical','phone','Management','escalated','missed','','',3,false,NULL,'Critical alert breaching SLA'),
  ('NOT-EVT-0012','NOT-1003',NULL,NULL,NULL,NULL,'Security & Policy','high','high','dfp_command','AI Operations + Approval Team','acknowledged','acknowledged','AI Operations + Approval Team','2026-08-25 08:22',0,false,'POL-NO-SELF-APPROVE','RED action blocked — pending approval'),
  ('NOT-EVT-0013','NOT-1014',NULL,NULL,'RUN-3C9B7','quickguard','Tasks & Runs','high','high','email','QuickGuard Operations','delivered','acknowledged','QuickGuard Operations','2026-08-25 08:12',0,false,NULL,'Agent run failed — guard matching'),
  ('NOT-EVT-0014','NOT-1022',NULL,NULL,NULL,NULL,'Cost & Budgets','low','normal','email','Management','delivered','not_required','','',0,false,'BUD-0001','Budget forecast overage — group budget'),
  ('NOT-EVT-0015','NOT-1005',NULL,NULL,'RUN-5C2F4','lethub','Tasks & Runs','high','high','email','Technical Team','acknowledged','acknowledged','Technical Team','2026-08-24 22:25',0,false,NULL,'Run failed after retries — tenancy compliance'),
  ('NOT-EVT-0016','NOT-1017','ALR-5030',NULL,NULL,'wedora','Alerts & Incidents','high','high','dfp_command','Vowora Planning','failed','awaiting','','',0,false,NULL,'Notification delivery failure — guest batch'),
  ('NOT-EVT-0017','NOT-1016',NULL,NULL,NULL,'lethub','Security & Policy','high','high','dfp_command','LetHub Operations','acknowledged','acknowledged','LetHub Operations','2026-08-24 21:35',0,false,'POL-PRIVACY','Compliance warning — tenancy review'),
  ('NOT-EVT-0018','NOT-1024',NULL,NULL,NULL,NULL,'Models & Providers','high','high','dfp_command','AI Operations','delivered','acknowledged','AI Operations','2026-08-24 21:00',0,false,'MOD-CLAUDE-SONNET','Model failure — fallback activated'),
  ('NOT-EVT-0019','NOT-1020',NULL,NULL,NULL,'quickguard','Orchestrator','high','urgent','dfp_command','QuickGuard Operations','escalated','acknowledged','QuickGuard Operations','2026-08-24 20:38',2,false,'ORC-7008','Orchestration blocked — payroll reconciliation'),
  ('NOT-EVT-0020','NOT-1010',NULL,NULL,NULL,'the-forge','Agents','high','high','email','AI Operations','delivered','awaiting','','',0,false,'tf-code','Agent offline — Code Agent'),
  ('NOT-EVT-0021',NULL,NULL,NULL,NULL,'the-forge','UAT','low','normal','dfp_command','Project / UAT Team','delivered','not_required','','',0,false,'ORC-7013','UAT cycle passed — release validation'),
  ('NOT-EVT-0022',NULL,NULL,NULL,NULL,NULL,'Alerts & Incidents','low','informational','dfp_command','Security Team','delivered','not_required','','',0,false,'ORC-7009','Group-wide security anomaly scan complete'),
  ('NOT-EVT-0023',NULL,NULL,'APR-4482',NULL,NULL,'Approvals','low','normal','email','Requesting Team','delivered','not_required','','',0,false,NULL,'Approval APR-4482 decision recorded'),
  ('NOT-EVT-0024','NOT-1021','ALR-5010',NULL,NULL,'guardianhub','Alerts & Incidents','critical','critical','phone','GuardianHub Welfare','acknowledged','acknowledged','GuardianHub Welfare','2026-08-24 18:02',0,false,NULL,'Welfare flag escalation'),
  ('NOT-EVT-0025','NOT-1019','ALR-5020',NULL,NULL,'digital-footprint','Tools & Connections','high','high','email','Digital Footprint Delivery','delivered','acknowledged','Digital Footprint Delivery','2026-08-24 17:55',0,false,NULL,'Tool degraded — support diagnostics'),
  ('NOT-EVT-0026',NULL,'ALR-5090',NULL,NULL,NULL,'Alerts & Incidents','low','informational','dfp_command','AI Operations','delivered','not_required','','',0,false,NULL,'Critical alert resolved — verification complete'),
  ('NOT-EVT-0027','NOT-1008',NULL,NULL,NULL,'the-forge','Cost & Budgets','high','high','email','Management','suppressed','not_required','','',0,true,'BUD-0007','Budget >90% — The Forge AI'),
  ('NOT-EVT-0028','NOT-1011','ALR-5011',NULL,NULL,'quickguard','Alerts & Incidents','high','urgent','dfp_command','AI Operations','escalated','acknowledged','AI Operations','2026-08-24 16:30',1,false,NULL,'Incident escalation — repeated failure'),
  ('NOT-EVT-0029',NULL,NULL,NULL,NULL,NULL,'Security & Policy','low','informational','dfp_command','Security Team','delivered','not_required','','',0,false,'POL-AUDIT','Policy evaluation recorded — audit only'),
  ('NOT-EVT-0030','NOT-1010',NULL,NULL,NULL,'wedora','Agents','high','high','email','Vowora Planning','expired','expired','','',1,false,'wd-rsvp','Agent offline — RSVP Agent')
) AS v(event_key, rule_key, alert_key, approval_key, run_key, site_key, event_type, severity, priority, channel, recipient_reference, status, acknowledgement_state, acknowledged_by, acknowledged_at, escalation_level, suppressed, correlation_id, summary)
LEFT JOIN public.ai_notification_rules r ON r.rule_key = v.rule_key
LEFT JOIN public.ai_alerts al ON al.alert_key = v.alert_key
LEFT JOIN public.ai_approvals ap ON ap.approval_key = v.approval_key
LEFT JOIN public.ai_runs ru ON ru.run_key = v.run_key
LEFT JOIN public.ai_sites s ON s.site_key = v.site_key
ON CONFLICT (event_key) DO UPDATE SET
  rule_id = EXCLUDED.rule_id, alert_id = EXCLUDED.alert_id, approval_id = EXCLUDED.approval_id,
  run_id = EXCLUDED.run_id, site_id = EXCLUDED.site_id, event_type = EXCLUDED.event_type,
  severity = EXCLUDED.severity, priority = EXCLUDED.priority, channel = EXCLUDED.channel,
  recipient_reference = EXCLUDED.recipient_reference, status = EXCLUDED.status,
  delivery_state = EXCLUDED.delivery_state, acknowledgement_state = EXCLUDED.acknowledgement_state,
  acknowledged_by = EXCLUDED.acknowledged_by, acknowledged_at = EXCLUDED.acknowledged_at,
  escalation_level = EXCLUDED.escalation_level, suppressed = EXCLUDED.suppressed,
  suppression_reason = EXCLUDED.suppression_reason, correlation_id = EXCLUDED.correlation_id,
  summary = EXCLUDED.summary;
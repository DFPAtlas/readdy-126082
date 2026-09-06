-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 11: ALERTS + INCIDENT OPERATIONS LIVE
-- PERSISTENCE
--
-- Creates the live Alerts & Incident Operations foundation:
--   * ai_alerts             — operational alert registry (metadata only).
--   * ai_incidents          — incident cases (sanitised summaries only).
--   * ai_incident_alerts    — incident ↔ alert many-to-many mapping.
--   * ai_incident_timeline  — append-oriented incident history.
--
-- Safety:
--   * RLS enabled on all four tables, reusing public.internal_role().
--   * SELECT for authenticated staff; INSERT/UPDATE for owner/admin;
--     ai_incident_alerts / ai_incident_timeline are INSERT-only (no UPDATE /
--     no DELETE — timeline history is never overwritten).
--   * site_id / agent_id / run_id / approval_id / policy_id / connection_id /
--     model_id FKs use ON DELETE SET NULL; incident link/timeline FKs use
--     ON DELETE RESTRICT.
--   * No monitoring input, no automated remediation, no notifications, no
--     agent/n8n/model execution — observation & governance records only.
--   * No secrets, no raw logs.
--
-- This file is idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT).
-- No unrelated support/security/business incident tables are touched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  alert_type text,
  source_type text,
  source_reference text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.ai_approvals(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.ai_security_policies(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.ai_tool_connections(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.ai_operations_models(id) ON DELETE SET NULL,
  severity text,
  priority text,
  status text,
  health_impact text,
  risk_level text,
  environment text NOT NULL DEFAULT 'production',
  correlation_id text,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  resolution_summary text,
  requires_incident boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT false,
  review_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_alerts_alert_type_check CHECK (alert_type IN ('site_health','agent_failure','run_failure','orchestration','tool_connection','model_provider','security','policy_violation','approval','uat','monitoring','data_health','billing','integration','other')),
  CONSTRAINT ai_alerts_severity_check CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT ai_alerts_priority_check CHECK (priority IN ('low','normal','high','urgent','critical')),
  CONSTRAINT ai_alerts_status_check CHECK (status IN ('new','acknowledged','investigating','waiting','awaiting_approval','escalated','monitoring','resolved','closed','suppressed')),
  CONSTRAINT ai_alerts_risk_check CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT ai_alerts_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_type ON public.ai_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_site ON public.ai_alerts(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_agent ON public.ai_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_run ON public.ai_alerts(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_severity ON public.ai_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_priority ON public.ai_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_status ON public.ai_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_env ON public.ai_alerts(environment);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_correlation ON public.ai_alerts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_last_seen ON public.ai_alerts(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_active ON public.ai_alerts(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_alerts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_alerts_select ON public.ai_alerts;
CREATE POLICY ai_alerts_select ON public.ai_alerts
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_alerts_insert ON public.ai_alerts;
CREATE POLICY ai_alerts_insert ON public.ai_alerts
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_alerts_update ON public.ai_alerts;
CREATE POLICY ai_alerts_update ON public.ai_alerts
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_incidents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  severity text,
  priority text,
  status text,
  incident_type text,
  environment text NOT NULL DEFAULT 'production',
  lead_team text,
  owner_reference text,
  correlation_id text,
  impact_summary text,
  diagnostics_summary text,
  suspected_cause text,
  confirmed_cause text,
  response_plan text,
  resolution_summary text,
  prevention_summary text,
  known_issue_memory_key text,
  approval_required boolean NOT NULL DEFAULT false,
  security_review_required boolean NOT NULL DEFAULT false,
  uat_required boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_incidents_severity_check CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT ai_incidents_priority_check CHECK (priority IN ('low','normal','high','urgent','critical')),
  CONSTRAINT ai_incidents_status_check CHECK (status IN ('new','acknowledged','investigating','waiting','awaiting_approval','escalated','monitoring','resolved','closed','suppressed')),
  CONSTRAINT ai_incidents_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_incidents_site ON public.ai_incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_severity ON public.ai_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_priority ON public.ai_incidents(priority);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_status ON public.ai_incidents(status);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_type ON public.ai_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_correlation ON public.ai_incidents(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_created ON public.ai_incidents(created_at);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_incidents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_incidents_select ON public.ai_incidents;
CREATE POLICY ai_incidents_select ON public.ai_incidents
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_incidents_insert ON public.ai_incidents;
CREATE POLICY ai_incidents_insert ON public.ai_incidents
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_incidents_update ON public.ai_incidents;
CREATE POLICY ai_incidents_update ON public.ai_incidents
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_incident_alerts (many-to-many, INSERT-only, RESTRICT FKs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_incident_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.ai_incidents(id) ON DELETE RESTRICT,
  alert_id uuid NOT NULL REFERENCES public.ai_alerts(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_incident_alerts_unique UNIQUE (incident_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_incident_alerts_incident ON public.ai_incident_alerts(incident_id);
CREATE INDEX IF NOT EXISTS idx_ai_incident_alerts_alert ON public.ai_incident_alerts(alert_id);

ALTER TABLE public.ai_incident_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_incident_alerts_select ON public.ai_incident_alerts;
CREATE POLICY ai_incident_alerts_select ON public.ai_incident_alerts
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_incident_alerts_insert ON public.ai_incident_alerts;
CREATE POLICY ai_incident_alerts_insert ON public.ai_incident_alerts
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_incident_timeline (append-only, INSERT-only, RESTRICT FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.ai_incidents(id) ON DELETE RESTRICT,
  event_type text,
  previous_status text,
  new_status text,
  actor_reference text,
  actor_role text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_incident_timeline_incident ON public.ai_incident_timeline(incident_id);
CREATE INDEX IF NOT EXISTS idx_ai_incident_timeline_created ON public.ai_incident_timeline(created_at);

ALTER TABLE public.ai_incident_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_incident_timeline_select ON public.ai_incident_timeline;
CREATE POLICY ai_incident_timeline_select ON public.ai_incident_timeline
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_incident_timeline_insert ON public.ai_incident_timeline;
CREATE POLICY ai_incident_timeline_insert ON public.ai_incident_timeline
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ============================================================================
-- INITIAL ALERT MIGRATION (27 demo alerts). Idempotent via ON CONFLICT.
-- Optional references resolve to live UUIDs where the key exists; unresolved
-- references (e.g. orchestrationId — no live orchestrator table) are left NULL.
-- ============================================================================
INSERT INTO public.ai_alerts (
  alert_key, title, summary, alert_type, source_type, site_id, agent_id, run_id,
  approval_id, policy_id, connection_id, model_id, severity, priority, status,
  risk_level, occurrence_count, first_seen_at, last_seen_at, acknowledged_at,
  acknowledged_by, resolved_at, resolution_summary, requires_incident,
  requires_approval, review_required, is_active, notes
)
SELECT
  v.alert_key, v.title, v.summary, v.alert_type, v.source_type,
  s.id, a.id, r.id, ap.id, p.id, c.id, m.id,
  v.severity, v.priority, v.status, v.risk_level, v.occurrence_count,
  v.detected_at::timestamptz, v.updated_at::timestamptz,
  NULLIF(v.acknowledged_at, '')::timestamptz, NULLIF(v.acknowledged_by, ''),
  NULLIF(v.resolved_at, '')::timestamptz, NULLIF(v.resolution_summary, ''),
  v.requires_incident, v.requires_approval, v.review_required, true, v.notes
FROM (VALUES
  ('ALR-5001','OpenAI provider degraded — elevated latency','The shared cloud model provider is reporting elevated response latency and intermittent 5xx errors on completion calls.','model_provider','Model provider monitoring',NULL,NULL,NULL,NULL,'POL-MODEL-RESTRICTED','CON-MODEL','MOD-GPT4O','high','high','investigating','high',1,'2026-08-25 09:12','2026-08-25 10:05','2026-08-25 09:18','Platform Engineering','','','Fallback to Claude Sonnet available via routing policy.'),
  ('ALR-5002','n8n connection failure — automation queue stalled','The shared n8n automation connection is unreachable, stalling scheduled workflow execution across the group.','integration','Connection health check',NULL,NULL,NULL,NULL,'POL-N8N','CON-N8N',NULL,'critical','critical','escalated','critical',1,'2026-08-25 08:55','2026-08-25 09:50','2026-08-25 09:00','Platform Engineering','','','Connection restored check required before declaring resolved.'),
  ('ALR-5003','Blocked RED action — production data deletion attempt','An agent attempted a production data deletion that was blocked by policy and routed to human approval.','policy_violation','Policy engine',NULL,'core-data-health','RUN-71D2E','APR-4500','POL-DATA-DELETE','CON-SUPABASE',NULL,'high','high','awaiting_approval','high',1,'2026-08-25 09:30','2026-08-25 10:10','2026-08-25 09:35','Security Operations','','','No data was modified.'),
  ('ALR-5004','Approval expiring — RED deployment authorisation','A RED deployment approval is approaching expiry without sign-off, risking workflow stall.','approval','Approval expiry monitor',NULL,'core-deploy',NULL,'APR-4471','POL-DEPLOY',NULL,NULL,'high','high','awaiting_approval','high',1,'2026-08-25 08:40','2026-08-25 10:00','2026-08-25 08:45','Release Management','','','Approval window closes soon.'),
  ('ALR-5005','Group security anomaly scan blocked','The group-wide security anomaly scan was blocked at the execution gate pending risk review.','security','Orchestrator',NULL,'core-security',NULL,'APR-4490','POL-SEPARATION',NULL,NULL,'critical','critical','investigating','critical',1,'2026-08-25 09:05','2026-08-25 10:15','2026-08-25 09:10','Security Operations','','','Scan is non-destructive; review blocking.'),
  ('ALR-5006','Repeated escalation-policy mismatch','A recurring mismatch between escalation routing and policy has been detected again.','monitoring','Monitoring',NULL,'core-monitoring',NULL,NULL,'POL-AUTONOMY',NULL,NULL,'medium','normal','acknowledged','medium',3,'2026-08-25 07:50','2026-08-25 08:30','2026-08-25 08:00','Operations','','','Known pattern — see knowledge record.'),
  ('ALR-5010','Digital Footprint support diagnostics failure','The Digital Footprint diagnostics agent failed a support-diagnosis run, delaying ticket resolution.','agent_failure','Run monitor','digital-footprint','dfp-diag','RUN-7A9E3',NULL,NULL,NULL,NULL,'high','high','investigating','high',1,'2026-08-25 09:58','2026-08-25 10:20','2026-08-25 10:02','Digital Footprint Support','','','Transient timeout suspected.'),
  ('ALR-5011','Digital Footprint data health warning','A data health check flagged a minor inconsistency in project records.','data_health','Scheduled health check','digital-footprint','core-data-health',NULL,NULL,NULL,'CON-SUPABASE',NULL,'medium','normal','monitoring','medium',1,'2026-08-25 08:30','2026-08-25 09:00','2026-08-25 08:35','Data Operations','','','Non-critical.'),
  ('ALR-5020','QuickGuard guard matching run failure','The guard matching agent failed a shift-matching run, leaving a shift unassigned.','run_failure','Run monitor','quickguard','qg-match','RUN-8C1B7',NULL,NULL,NULL,NULL,'high','high','investigating','high',1,'2026-08-25 10:31','2026-08-25 10:45','2026-08-25 10:35','QuickGuard Operations','','','Single shift affected.'),
  ('ALR-5021','QuickGuard compliance licence warning','A licence renewal window is approaching for several guards, flagged by the compliance agent.','monitoring','Compliance check','quickguard','qg-comp',NULL,NULL,NULL,NULL,NULL,'medium','normal','waiting','medium',1,'2026-08-25 08:10','2026-08-25 09:00','2026-08-25 08:20','QuickGuard Compliance','','','Several guards affected.'),
  ('ALR-5022','QuickGuard timesheet sync failure','Timesheet data failed to sync to payroll, flagged for reconciliation.','integration','Integration monitor','quickguard','qg-timesheet','RUN-5C2F4',NULL,NULL,NULL,NULL,'medium','normal','acknowledged','medium',1,'2026-08-25 07:30','2026-08-25 08:10','2026-08-25 07:40','QuickGuard Operations','','','No data loss.'),
  ('ALR-5030','GuardianHub check-call failure (repeating)','The check-call agent failed again on a welfare check-call, matching a previously documented incident.','run_failure','Run monitor','guardianhub','gh-checkcall','RUN-6B5D8',NULL,NULL,NULL,NULL,'critical','critical','escalated','critical',3,'2026-08-25 09:20','2026-08-25 10:10','2026-08-25 09:25','GuardianHub Welfare','','','Known issue — see incident memory.'),
  ('ALR-5031','GuardianHub Supabase degraded','The GuardianHub Supabase connection is degraded, slowing database operations.','site_health','Connection health check','guardianhub',NULL,NULL,NULL,NULL,'CON-SUPABASE',NULL,'high','high','investigating','high',1,'2026-08-25 09:00','2026-08-25 10:00','2026-08-25 09:05','Platform Engineering','','','No outage.'),
  ('ALR-5032','GuardianHub welfare escalation blocked','A welfare escalation was blocked pending human approval.','approval','Approval gate','guardianhub','gh-welfare',NULL,'APR-4511','POL-SEPARATION',NULL,NULL,'critical','critical','awaiting_approval','critical',1,'2026-08-25 09:40','2026-08-25 10:20','2026-08-25 09:45','GuardianHub Welfare','','','High-sensitivity escalation.'),
  ('ALR-5040','LetHub tenancy compliance warning','A tenancy compliance review flagged documents approaching expiry.','monitoring','Compliance review','lethub','lh-comp',NULL,NULL,NULL,NULL,NULL,'medium','normal','monitoring','medium',1,'2026-08-25 08:20','2026-08-25 09:10','2026-08-25 08:30','LetHub Compliance','','','Non-critical.'),
  ('ALR-5041','LetHub maintenance triage failure','The maintenance agent failed to triage an incoming maintenance request.','agent_failure','Run monitor','lethub','lh-maint','RUN-8F21A',NULL,NULL,NULL,NULL,'high','high','investigating','high',1,'2026-08-25 09:50','2026-08-25 10:15','2026-08-25 09:55','LetHub Operations','','','Single request.'),
  ('ALR-5050','Vowora RSVP notification failure','The RSVP agent failed to send guest notifications due to an email connection issue.','tool_connection','Connection health check','wedora','wd-rsvp','RUN-3C9B7',NULL,NULL,'CON-EMAIL',NULL,'high','high','investigating','high',1,'2026-08-25 09:15','2026-08-25 10:05','2026-08-25 09:20','Vowora Operations','','','Email connection degraded.'),
  ('ALR-5051','Vowora supplier quote chase failure','The supplier agent failed to chase an outstanding quote.','run_failure','Run monitor','wedora','wd-supplier','RUN-8B44D',NULL,NULL,NULL,NULL,'medium','normal','acknowledged','medium',1,'2026-08-25 08:05','2026-08-25 08:50','2026-08-25 08:15','Vowora Operations','','','Low impact.'),
  ('ALR-5060','The Forge UAT failure','A release UAT cycle failed validation, blocking the release gate.','uat','UAT runner','the-forge','core-uat',NULL,NULL,'POL-DEPLOY',NULL,NULL,'high','high','investigating','high',1,'2026-08-25 09:35','2026-08-25 10:20','2026-08-25 09:40','The Forge QA','','','Multiple cases failed.'),
  ('ALR-5061','The Forge code agent error','The code agent entered an error state during a generation task.','agent_failure','Agent monitor','the-forge','tf-code','RUN-1A77F',NULL,NULL,NULL,'MOD-CODESTRAL','high','high','escalated','high',1,'2026-08-25 10:00','2026-08-25 10:25','2026-08-25 10:05','The Forge Engineering','','','Error state on code agent.'),
  ('ALR-5062','The Forge n8n degraded','The Forge n8n connection is degraded, slowing build automation.','tool_connection','Connection health check','the-forge',NULL,NULL,NULL,'POL-N8N','CON-N8N',NULL,'medium','normal','monitoring','medium',1,'2026-08-25 08:45','2026-08-25 09:30','2026-08-25 08:50','Platform Engineering','','','No outage.'),
  ('ALR-5007','Group billing threshold warning','Group AI spend approached its daily cost threshold.','billing','Cost monitor',NULL,'core-billing',NULL,NULL,'POL-COST','CON-STRIPE',NULL,'low','low','acknowledged','low',1,'2026-08-25 08:00','2026-08-25 08:40','2026-08-25 08:10','Finance','','','Informational.'),
  ('ALR-5008','Group backup failure','A scheduled backup failed to complete.','data_health','Backup monitor',NULL,'core-backup','RUN-8C1B7',NULL,'POL-RETENTION','CON-STORAGE',NULL,'medium','normal','investigating','medium',1,'2026-08-25 09:10','2026-08-25 10:00','2026-08-25 09:15','Platform Engineering','','','Retry pending.'),
  ('ALR-5090','LetHub property sync resolved','A property sync issue was diagnosed and fixed.','site_health','Health check','lethub','lh-property','RUN-5D88F',NULL,NULL,'CON-SUPABASE',NULL,'medium','normal','resolved','medium',1,'2026-08-24 16:20','2026-08-24 18:00','2026-08-24 16:30','LetHub Operations','2026-08-24 18:00','Property sync restored and verified.','Closed today.'),
  ('ALR-5091','Vowora seating validation resolved','A seating chart validation failure was fixed and re-verified.','uat','UAT runner','wedora','wd-seating',NULL,NULL,NULL,NULL,NULL,'medium','normal','resolved','medium',1,'2026-08-24 15:40','2026-08-24 17:30','2026-08-24 15:50','Vowora QA','2026-08-24 17:30','Seating validation re-run and passed.','Closed today.'),
  ('ALR-5092','QuickGuard payroll reconciliation closed','A payroll reconciliation run failure was resolved and closed.','run_failure','Run monitor','quickguard','qg-payment','RUN-2C91D',NULL,NULL,NULL,NULL,'high','high','closed','high',2,'2026-08-24 14:10','2026-08-24 16:40','2026-08-24 14:20','QuickGuard Finance','2026-08-24 16:40','Payroll reconciliation re-run and verified.','Closed today.'),
  ('ALR-5093','The Forge sandbox isolation resolved','A sandbox isolation breach attempt was contained and resolved.','security','Security monitor','the-forge','tf-security',NULL,NULL,'POL-SANDBOX-ISOLATION',NULL,NULL,'high','high','resolved','high',1,'2026-08-24 13:30','2026-08-24 15:50','2026-08-24 13:40','Security Operations','2026-08-24 15:50','Sandbox isolation enforced and verified.','Closed today.')
) AS v(alert_key, title, summary, alert_type, source_type, site_key, agent_key, run_key, approval_key, policy_key, connection_key, model_key, severity, priority, status, risk_level, occurrence_count, detected_at, updated_at, acknowledged_at, acknowledged_by, resolved_at, resolution_summary, notes)
LEFT JOIN public.ai_sites s ON s.site_key = v.site_key
LEFT JOIN public.ai_operations_agents a ON a.agent_key = v.agent_key
LEFT JOIN public.ai_runs r ON r.run_key = v.run_key
LEFT JOIN public.ai_approvals ap ON ap.approval_key = v.approval_key
LEFT JOIN public.ai_security_policies p ON p.policy_key = v.policy_key
LEFT JOIN public.ai_tool_connections c ON c.connection_key = v.connection_key
LEFT JOIN public.ai_operations_models m ON m.model_key = v.model_key
ON CONFLICT (alert_key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  alert_type = EXCLUDED.alert_type,
  source_type = EXCLUDED.source_type,
  site_id = EXCLUDED.site_id,
  agent_id = EXCLUDED.agent_id,
  run_id = EXCLUDED.run_id,
  approval_id = EXCLUDED.approval_id,
  policy_id = EXCLUDED.policy_id,
  connection_id = EXCLUDED.connection_id,
  model_id = EXCLUDED.model_id,
  severity = EXCLUDED.severity,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  occurrence_count = EXCLUDED.occurrence_count,
  first_seen_at = EXCLUDED.first_seen_at,
  last_seen_at = EXCLUDED.last_seen_at,
  acknowledged_at = EXCLUDED.acknowledged_at,
  acknowledged_by = EXCLUDED.acknowledged_by,
  resolved_at = EXCLUDED.resolved_at,
  resolution_summary = EXCLUDED.resolution_summary,
  requires_incident = EXCLUDED.requires_incident,
  requires_approval = EXCLUDED.requires_approval,
  review_required = EXCLUDED.review_required,
  notes = EXCLUDED.notes;

-- ============================================================================
-- INITIAL INCIDENT MIGRATION (17 incident cases).
--
-- Rule (documented, non-fabricating): an incident is created only where the
-- demo alert clearly indicates a genuine incident case — severity critical/
-- high OR a repeating/known-issue incident. Pure medium/low monitoring,
-- billing, compliance and informational alerts remain alert-only.
-- known_issue_memory_key is set only where a deterministic, already-declared
-- reference exists (CHECK-CALL → INC-GH-0042, PAYROLL → INC-QG-0031).
-- ============================================================================
INSERT INTO public.ai_incidents (
  incident_key, title, summary, site_id, severity, priority, status, incident_type,
  lead_team, owner_reference, impact_summary, diagnostics_summary, suspected_cause,
  response_plan, resolution_summary, confirmed_cause, known_issue_memory_key,
  approval_required, security_review_required, uat_required, started_at,
  acknowledged_at, resolved_at, closed_at, is_active, notes
)
SELECT
  v.incident_key, v.title, v.summary, s.id, v.severity, v.priority, v.status,
  v.incident_type, v.lead_team, v.owner_reference, v.impact_summary,
  v.diagnostics_summary, v.suspected_cause, v.response_plan,
  NULLIF(v.resolution_summary, ''), NULLIF(v.confirmed_cause, ''),
  NULLIF(v.memory_key, ''), v.approval_required, v.security_review_required,
  v.uat_required, v.started_at::timestamptz, NULLIF(v.acknowledged_at,'')::timestamptz,
  NULLIF(v.resolved_at,'')::timestamptz, NULLIF(v.closed_at,'')::timestamptz, true, v.notes
FROM (VALUES
  ('INC-8101','OpenAI provider degraded — elevated latency','The shared cloud model provider is reporting elevated response latency and intermittent 5xx errors on completion calls.',NULL,'high','high','investigating','model_provider','Platform Engineering','AI Infrastructure','Elevated latency on GPT-4o completions across multiple sites.','Provider-side degradation or regional routing issue.','Provider-side degradation or regional routing issue.','Continue monitoring; engage fallback routing if latency breaches threshold.','','','',false,false,false,'2026-08-25 09:12','2026-08-25 09:18','','',''),
  ('INC-8102','n8n connection failure — automation queue stalled','The shared n8n automation connection is unreachable, stalling scheduled workflow execution across the group.',NULL,'critical','critical','escalated','integration','Platform Engineering','Automation Engineering','Scheduled automations paused group-wide.','Connection credential or endpoint failure.','Connection credential or endpoint failure.','Restore connection and validate workflow backlog before resuming.','','','',true,false,false,'2026-08-25 08:55','2026-08-25 09:00','','',''),
  ('INC-8103','Blocked RED action — production data deletion attempt','An agent attempted a production data deletion that was blocked by policy and routed to human approval.',NULL,'high','high','awaiting_approval','policy_violation','Security Operations','Governance','Destructive action blocked; no data affected.','Agent identified stale records as candidates for deletion.','Agent identified stale records as candidates for deletion.','Review deletion intent and require dual approval before any action.','','','',true,true,false,'2026-08-25 09:30','2026-08-25 09:35','','',''),
  ('INC-8104','Approval expiring — RED deployment authorisation','A RED deployment approval is approaching expiry without sign-off, risking workflow stall.',NULL,'high','high','awaiting_approval','approval','Release Management','Governance','Deployment cannot proceed without approval.','Approver unavailability.','Approver unavailability.','Prompt approvers to complete dual sign-off.','','','',true,false,true,'2026-08-25 08:40','2026-08-25 08:45','','',''),
  ('INC-8105','Group security anomaly scan blocked','The group-wide security anomaly scan was blocked at the execution gate pending risk review.',NULL,'critical','critical','investigating','security','Security Operations','Security Leadership','Security scan coverage gap while blocked.','Separation-of-duties gate triggered.','Separation-of-duties gate triggered.','Complete risk review and release the scan.','','','',true,true,false,'2026-08-25 09:05','2026-08-25 09:10','','',''),
  ('INC-8106','Repeated escalation-policy mismatch','A recurring mismatch between escalation routing and policy has been detected again.',NULL,'medium','normal','acknowledged','monitoring','Operations','Operations Leadership','Minor escalation routing drift.','Routing rule drift from policy.','Routing rule drift from policy.','Review escalation rules against policy.','','','',false,false,false,'2026-08-25 07:50','2026-08-25 08:00','','',''),
  ('INC-8110','Digital Footprint support diagnostics failure','The Digital Footprint diagnostics agent failed a support-diagnosis run, delaying ticket resolution.','digital-footprint','high','high','investigating','agent_failure','Digital Footprint Support','Platform Engineering','Delayed support diagnosis for an open ticket.','Transient timeout during probe.','Transient timeout during probe.','Review failed run and retry with corrected input.','','','',false,false,false,'2026-08-25 09:58','2026-08-25 10:02','','',''),
  ('INC-8120','QuickGuard guard matching run failure','The guard matching agent failed a shift-matching run, leaving a shift unassigned.','quickguard','high','high','investigating','run_failure','QuickGuard Operations','Operations Leadership','Shift left unassigned pending rematch.','Insufficient eligible guard pool for shift window.','Insufficient eligible guard pool for shift window.','Review matching run and rematch eligible guards.','','','',false,false,false,'2026-08-25 10:31','2026-08-25 10:35','','',''),
  ('INC-8130','GuardianHub check-call failure (repeating)','The check-call agent failed again on a welfare check-call, matching a previously documented incident.','guardianhub','critical','critical','escalated','run_failure','GuardianHub Welfare','Welfare Leadership','Welfare check-call not completed.','Recurring call-completion timeout.','Recurring call-completion timeout.','Apply documented resolution and re-verify check-call.','','','INC-GH-0042',false,true,false,'2026-08-25 09:20','2026-08-25 09:25','','',''),
  ('INC-8131','GuardianHub Supabase degraded','The GuardianHub Supabase connection is degraded, slowing database operations.','guardianhub','high','high','investigating','site_health','Platform Engineering','Database Engineering','Slower database queries.','Increased database load or slow queries.','Increased database load or slow queries.','Monitor latency and investigate database load.','','','',false,false,false,'2026-08-25 09:00','2026-08-25 09:05','','',''),
  ('INC-8132','GuardianHub welfare escalation blocked','A welfare escalation was blocked pending human approval.','guardianhub','critical','critical','awaiting_approval','approval','GuardianHub Welfare','Welfare Leadership','Welfare escalation delayed pending approval.','Required welfare approval gate.','Required welfare approval gate.','Expedite human approval for welfare flag.','','','',true,true,false,'2026-08-25 09:40','2026-08-25 09:45','','',''),
  ('INC-8141','LetHub maintenance triage failure','The maintenance agent failed to triage an incoming maintenance request.','lethub','high','high','investigating','agent_failure','LetHub Operations','Platform Engineering','Maintenance request not triaged.','Input parsing error on request.','Input parsing error on request.','Review triage run and reassign request.','','','',false,false,false,'2026-08-25 09:50','2026-08-25 09:55','','',''),
  ('INC-8150','Vowora RSVP notification failure','The RSVP agent failed to send guest notifications due to an email connection issue.','wedora','high','high','investigating','tool_connection','Vowora Operations','Platform Engineering','Guest notifications not delivered.','Email connection failure.','Email connection failure.','Verify email connection and resend notifications.','','','',false,false,false,'2026-08-25 09:15','2026-08-25 09:20','','',''),
  ('INC-8160','The Forge UAT failure','A release UAT cycle failed validation, blocking the release gate.','the-forge','high','high','investigating','uat','The Forge QA','Engineering Leadership','Release gate blocked.','Regression in recent build.','Regression in recent build.','Review failing UAT cases and re-run cycle.','','','',true,false,true,'2026-08-25 09:35','2026-08-25 09:40','','',''),
  ('INC-8161','The Forge code agent error','The code agent entered an error state during a generation task.','the-forge','high','high','escalated','agent_failure','The Forge Engineering','Engineering Leadership','Generation task halted.','Model error on generation request.','Model error on generation request.','Restart generation task after reviewing error.','','','',false,false,false,'2026-08-25 10:00','2026-08-25 10:05','','',''),
  ('INC-8192','QuickGuard payroll reconciliation closed','A payroll reconciliation run failure was resolved and closed.','quickguard','high','high','closed','run_failure','QuickGuard Finance','Finance Leadership','Resolved — payroll reconciled.','Reconciliation mismatch.','Reconciliation mismatch.','Monitor.','Payroll reconciliation re-run and verified.','Reconciliation mismatch.','INC-QG-0031',false,false,false,'2026-08-24 14:10','2026-08-24 14:20','2026-08-24 16:40','2026-08-24 16:40',''),
  ('INC-8193','The Forge sandbox isolation resolved','A sandbox isolation breach attempt was contained and resolved.','the-forge','high','high','resolved','security','Security Operations','Security Leadership','Resolved — sandbox isolation preserved.','Sandbox boundary misconfiguration.','Sandbox boundary misconfiguration.','Monitor.','Sandbox isolation enforced and verified.','Sandbox boundary misconfiguration.','',false,true,false,'2026-08-24 13:30','2026-08-24 13:40','2026-08-24 15:50','','')
) AS v(incident_key, title, summary, site_key, severity, priority, status, incident_type, lead_team, owner_reference, impact_summary, diagnostics_summary, suspected_cause, response_plan, resolution_summary, confirmed_cause, memory_key, approval_required, security_review_required, uat_required, started_at, acknowledged_at, resolved_at, closed_at, notes)
LEFT JOIN public.ai_sites s ON s.site_key = v.site_key
ON CONFLICT (incident_key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  site_id = EXCLUDED.site_id,
  severity = EXCLUDED.severity,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  incident_type = EXCLUDED.incident_type,
  lead_team = EXCLUDED.lead_team,
  owner_reference = EXCLUDED.owner_reference,
  impact_summary = EXCLUDED.impact_summary,
  diagnostics_summary = EXCLUDED.diagnostics_summary,
  suspected_cause = EXCLUDED.suspected_cause,
  response_plan = EXCLUDED.response_plan,
  resolution_summary = EXCLUDED.resolution_summary,
  confirmed_cause = EXCLUDED.confirmed_cause,
  known_issue_memory_key = EXCLUDED.known_issue_memory_key,
  approval_required = EXCLUDED.approval_required,
  security_review_required = EXCLUDED.security_review_required,
  uat_required = EXCLUDED.uat_required,
  started_at = EXCLUDED.started_at,
  acknowledged_at = EXCLUDED.acknowledged_at,
  resolved_at = EXCLUDED.resolved_at,
  closed_at = EXCLUDED.closed_at;

-- ---------------------------------------------------------------------------
-- Incident ↔ alert links (originating alert per incident).
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_incident_alerts (incident_id, alert_id, relationship_type)
SELECT inc.id, al.id, 'primary'
FROM (VALUES
  ('INC-8101','ALR-5001'),('INC-8102','ALR-5002'),('INC-8103','ALR-5003'),
  ('INC-8104','ALR-5004'),('INC-8105','ALR-5005'),('INC-8106','ALR-5006'),
  ('INC-8110','ALR-5010'),('INC-8120','ALR-5020'),('INC-8130','ALR-5030'),
  ('INC-8131','ALR-5031'),('INC-8132','ALR-5032'),('INC-8141','ALR-5041'),
  ('INC-8150','ALR-5050'),('INC-8160','ALR-5060'),('INC-8161','ALR-5061'),
  ('INC-8192','ALR-5092'),('INC-8193','ALR-5093')
) AS v(incident_key, alert_key)
JOIN public.ai_incidents inc ON inc.incident_key = v.incident_key
JOIN public.ai_alerts al ON al.alert_key = v.alert_key
ON CONFLICT (incident_id, alert_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Incident timeline baseline — a single conservative migration_baseline event
-- per incident. No historical chronology is fabricated.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_incident_timeline (incident_id, event_type, previous_status, new_status, actor_reference, actor_role, summary)
SELECT inc.id, 'migration_baseline', NULL, inc.status, 'migration', 'system',
       'Incident record migrated from demo registry — no historical chronology fabricated.'
FROM public.ai_incidents inc
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_incident_timeline t WHERE t.incident_id = inc.id
);
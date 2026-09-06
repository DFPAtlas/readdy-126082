-- ============================================================================
-- AI Operations — Scheduling & Automation (Phase 2 Prompt 13).
--
-- Persists scheduling/automation CONFIGURATION only. No cron jobs, no
-- Supabase scheduled jobs, no n8n, no agent execution, no run creation, no
-- notifications, no model/tool calls. `schedule_expression` / retry /
-- configuration JSONB are registry/planning metadata only.
--
-- Reuses the existing ai_quiet_hours_policies table (created in Prompt 12) —
-- a second quiet-hours table is NOT created.
-- ============================================================================

-- --- 2. ai_schedules -----------------------------------------------------------

create table if not exists ai_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_key text unique not null,
  name text not null,
  description text,
  automation_type text,
  trigger_type text,
  site_id uuid references ai_sites(id) on delete set null,
  agent_id uuid references ai_operations_agents(id) on delete set null,
  notification_rule_id uuid references ai_notification_rules(id) on delete set null,
  target_type text,
  target_reference text,
  schedule_expression text,
  recurrence_summary text,
  timezone text,
  start_at timestamptz,
  end_at timestamptz,
  next_run_at timestamptz,
  last_run_at timestamptz,
  environment text not null default 'production',
  status text,
  risk_level text,
  priority text,
  approval_required boolean not null default false,
  audit_required boolean not null default false,
  quiet_hours_policy_key text,
  maintenance_behavior text,
  retry_policy jsonb,
  configuration jsonb,
  owner_team text,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- 3. ai_event_automation_rules --------------------------------------------

create table if not exists ai_event_automation_rules (
  id uuid primary key default gen_random_uuid(),
  event_rule_key text unique not null,
  name text not null,
  description text,
  event_type text,
  source_type text,
  source_reference text,
  site_id uuid references ai_sites(id) on delete set null,
  agent_id uuid references ai_operations_agents(id) on delete set null,
  notification_rule_id uuid references ai_notification_rules(id) on delete set null,
  action_type text,
  action_reference text,
  conditions jsonb,
  dedupe_window_minutes integer,
  cooldown_minutes integer,
  environment text not null default 'production',
  status text,
  risk_level text,
  approval_required boolean not null default false,
  audit_required boolean not null default false,
  owner_team text,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- 5. ai_maintenance_windows -------------------------------------------------

create table if not exists ai_maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  window_key text unique not null,
  name text not null,
  description text,
  scope text,
  site_id uuid references ai_sites(id) on delete set null,
  timezone text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  suppress_schedules boolean not null default false,
  suppress_notifications boolean not null default false,
  affected_references jsonb,
  reason text,
  owner_team text,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- 6. ai_schedule_history (append-oriented) ---------------------------------

create table if not exists ai_schedule_history (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references ai_schedules(id) on delete restrict,
  event_rule_id uuid references ai_event_automation_rules(id) on delete restrict,
  event_type text,
  planned_for timestamptz,
  observed_at timestamptz not null default now(),
  status text,
  actor_reference text,
  summary text,
  correlation_id text,
  created_at timestamptz not null default now()
);

-- --- 7. Indexes ---------------------------------------------------------------

create index if not exists ai_schedules_key_idx on ai_schedules (schedule_key);
create index if not exists ai_schedules_type_idx on ai_schedules (automation_type);
create index if not exists ai_schedules_trigger_idx on ai_schedules (trigger_type);
create index if not exists ai_schedules_site_idx on ai_schedules (site_id);
create index if not exists ai_schedules_agent_idx on ai_schedules (agent_id);
create index if not exists ai_schedules_status_idx on ai_schedules (status);
create index if not exists ai_schedules_env_idx on ai_schedules (environment);
create index if not exists ai_schedules_next_run_idx on ai_schedules (next_run_at);
create index if not exists ai_schedules_active_idx on ai_schedules (is_active);

create index if not exists ai_event_rules_key_idx on ai_event_automation_rules (event_rule_key);
create index if not exists ai_event_rules_type_idx on ai_event_automation_rules (event_type);
create index if not exists ai_event_rules_source_idx on ai_event_automation_rules (source_type);
create index if not exists ai_event_rules_site_idx on ai_event_automation_rules (site_id);
create index if not exists ai_event_rules_agent_idx on ai_event_automation_rules (agent_id);
create index if not exists ai_event_rules_status_idx on ai_event_automation_rules (status);
create index if not exists ai_event_rules_env_idx on ai_event_automation_rules (environment);
create index if not exists ai_event_rules_active_idx on ai_event_automation_rules (is_active);

create index if not exists ai_maint_windows_key_idx on ai_maintenance_windows (window_key);
create index if not exists ai_maint_windows_site_idx on ai_maintenance_windows (site_id);
create index if not exists ai_maint_windows_start_idx on ai_maintenance_windows (starts_at);
create index if not exists ai_maint_windows_end_idx on ai_maintenance_windows (ends_at);
create index if not exists ai_maint_windows_status_idx on ai_maintenance_windows (status);
create index if not exists ai_maint_windows_active_idx on ai_maintenance_windows (is_active);

create index if not exists ai_schedule_history_schedule_idx on ai_schedule_history (schedule_id);
create index if not exists ai_schedule_history_rule_idx on ai_schedule_history (event_rule_id);
create index if not exists ai_schedule_history_type_idx on ai_schedule_history (event_type);
create index if not exists ai_schedule_history_observed_idx on ai_schedule_history (observed_at);
create index if not exists ai_schedule_history_status_idx on ai_schedule_history (status);

-- --- 8. RLS -------------------------------------------------------------------

alter table ai_schedules enable row level security;
alter table ai_event_automation_rules enable row level security;
alter table ai_maintenance_windows enable row level security;
alter table ai_schedule_history enable row level security;

-- Schedules (SELECT staff; INSERT/UPDATE owner/admin; no DELETE)
create policy ai_schedules_select on ai_schedules
  for select to authenticated using (internal_role() is not null);
create policy ai_schedules_insert on ai_schedules
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_schedules_update on ai_schedules
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- Event rules (SELECT staff; INSERT/UPDATE owner/admin; no DELETE)
create policy ai_event_rules_select on ai_event_automation_rules
  for select to authenticated using (internal_role() is not null);
create policy ai_event_rules_insert on ai_event_automation_rules
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_event_rules_update on ai_event_automation_rules
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- Maintenance windows (SELECT staff; INSERT/UPDATE owner/admin; no DELETE)
create policy ai_maint_windows_select on ai_maintenance_windows
  for select to authenticated using (internal_role() is not null);
create policy ai_maint_windows_insert on ai_maintenance_windows
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_maint_windows_update on ai_maintenance_windows
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- History (SELECT staff; INSERT owner/admin; no UPDATE/DELETE)
create policy ai_schedule_history_select on ai_schedule_history
  for select to authenticated using (internal_role() is not null);
create policy ai_schedule_history_insert on ai_schedule_history
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));

-- ============================================================================
-- Seeds (idempotent). Configuration metadata only — no execution is implied.
-- ============================================================================

-- --- 9. Schedules -------------------------------------------------------------

insert into ai_schedules (
  schedule_key, name, description, automation_type, trigger_type,
  site_id, agent_id, notification_rule_id, target_type, schedule_expression,
  recurrence_summary, timezone, start_at, end_at, next_run_at, last_run_at,
  environment, status, risk_level, priority, approval_required, audit_required,
  quiet_hours_policy_key, maintenance_behavior, retry_policy, owner_team,
  is_active, notes
)
select
  s.schedule_key, s.name, s.description, s.automation_type, s.trigger_type,
  st.id, ag.id, nr.id, s.target_type, s.schedule_expression,
  s.recurrence_summary, s.timezone, s.start_at::timestamptz, nullif(s.end_at,'')::timestamptz,
  nullif(s.next_run_at,'')::timestamptz, nullif(s.last_run_at,'')::timestamptz,
  s.environment, s.status, s.risk_level, s.priority, s.approval_required, s.audit_required,
  s.quiet_hours_policy_key, s.maintenance_behavior, s.retry_policy, s.owner_team,
  s.is_active, s.notes
from (values
  ('SCH-1001','AI Operations daily health check','Group-wide sweep of site health, agent status, queue depth and orchestrator throughput to catch degradation before it escalates.','scheduled','time','group','core-monitoring','NOT-1002','monitoring','Daily at 08:00','Daily','Europe/London','2026-01-05','','2026-08-26 08:00','2026-08-25 08:00','production','active','low','high',false,true,'qh-critical-bypass','Pause automation','{"maxRetries":2,"retryDelay":"5m","backoffStrategy":"exponential","failureEscalation":"Alert AI Operations","fallbackAgent":"core-diagnostics","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','AI Operations',true,'First scheduled task of each day; feeds the Live Operations wallboard.'),
  ('SCH-1002','Security policy review','Recurring review of AI security policies to confirm no policy is overdue or stale before the monthly governance checkpoint.','recurring','recurrence','group','core-security','NOT-1005','security','Every Monday','Weekly','Europe/London','2026-01-05','','2026-08-31 09:00','2026-08-24 09:00','production','active','medium','high',true,true,'qh-delay-normal','Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Escalate to Security Team","fallbackAgent":"core-data-health","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Security Team',true,'Policy review output feeds the Security registry review queue.'),
  ('SCH-1003','Budget threshold review','Daily comparison of AI spend against group and site budgets to surface threshold breaches for management review.','scheduled','time','group','core-billing','NOT-1015','billing','Daily at 07:30','Daily','Europe/London','2026-02-01','','2026-08-26 07:30','2026-08-25 07:30','production','active','low','normal',false,true,'qh-critical-bypass','Allow critical automation','{"maxRetries":2,"retryDelay":"15m","backoffStrategy":"exponential","failureEscalation":"Alert Finance / AI Operations","fallbackAgent":"core-reporting","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','AI Operations',true,'Feeds the Cost & Budgets module budget-alert panel.'),
  ('SCH-1004','Backup verification','Weekly verification that group and per-site Supabase backups are present, recent and restorable.','recurring','recurrence','group','core-backup','NOT-1006','backup','Every Sunday 02:00','Weekly','Europe/London','2026-01-04','','2026-08-30 02:00','2026-08-23 02:00','production','active','medium','high',false,true,'qh-critical-bypass','Pause automation','{"maxRetries":2,"retryDelay":"30m","backoffStrategy":"exponential","failureEscalation":"Escalate to Platform Team","fallbackAgent":"core-monitoring","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Platform Team',true,'Backup verification failures create an incident after 2 consecutive failures.'),
  ('SCH-1005','Daily AI Operations report','Compiles the end-of-day AI Operations digest covering runs, approvals, alerts and cost for the leadership stand-up.','scheduled','time','group','core-reporting','NOT-1008','reporting','Daily at 18:00','Daily','Europe/London','2026-01-05','','2026-08-26 18:00','2026-08-25 18:00','production','active','low','normal',false,false,null,'Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Alert AI Operations","fallbackAgent":"core-billing","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','AI Operations',true,'Report is routed to the daily stand-up channel; no delivery occurs in demo.'),
  ('SCH-1006','Knowledge review reminders','Surfaces knowledge sources nearing or past their review date so owners can re-validate content.','recurring','recurrence','group','core-knowledge','NOT-1011','compliance','Every Friday 10:00','Weekly','Europe/London','2026-01-05','','2026-08-28 10:00','2026-08-21 10:00','production','review_required','low','normal',true,false,'qh-delay-normal','Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Alert Knowledge Owner","fallbackAgent":"core-reporting","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Knowledge Team',true,'Schedule is due for its own governance review before next run.'),
  ('SCH-1007','Guard compliance review','QuickGuard-specific verification of guard licences, right-to-work and training records against expiring items.','scheduled','time','quickguard','qg-comp','NOT-1009','compliance','Daily at 06:30','Daily','Europe/London','2026-01-05','','2026-08-26 06:30','2026-08-25 06:30','production','active','high','high',true,true,'qh-critical-bypass','Pause automation','{"maxRetries":3,"retryDelay":"5m","backoffStrategy":"exponential","failureEscalation":"Escalate to Compliance Team","fallbackAgent":"core-security","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Compliance Team',true,'High-risk schedule; requires approval and full audit trail.'),
  ('SCH-1008','Shift coverage check','Recurring rota scan for uncovered shifts within the next 48 hours to pre-empt coverage gaps.','recurring','recurrence','quickguard','qg-shift','NOT-1003','monitoring','Every 2 hours','Every 2 hours','Europe/London','2026-01-05','','2026-08-26 12:00','2026-08-26 10:00','production','active','medium','high',false,false,null,'Pause automation','{"maxRetries":2,"retryDelay":"5m","backoffStrategy":"exponential","failureEscalation":"Alert Operations","fallbackAgent":"qg-rota","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Operations Team',true,'Most frequent schedule; suppressed during quiet hours.'),
  ('SCH-1009','Failed-shift workflow review','Event-driven review that runs whenever a shift assignment workflow fails, triggering root-cause analysis.','event_triggered','event','quickguard','qg-shift','NOT-1007','workflow','On failed run','On event','Europe/London','2026-02-01','','','2026-08-26 08:02','production','active','medium','high',false,true,'qh-critical-bypass','Allow critical automation','{"maxRetries":1,"retryDelay":"5m","backoffStrategy":"linear","failureEscalation":"Alert Operations","fallbackAgent":"core-diagnostics","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Operations Team',true,'Triggered by shift workflow failure; performs automated root-cause analysis.'),
  ('SCH-1010','Check-call monitoring','GuardianHub scheduled check-call monitoring to detect missed or late welfare check-calls.','scheduled','time','guardianhub','gh-checkcall','NOT-1010','monitoring','Every 15 minutes','Every 15 minutes','Europe/London','2026-01-05','','2026-08-26 10:45','2026-08-26 10:30','production','failed','high','urgent',true,true,'qh-critical-bypass','Allow critical automation','{"maxRetries":3,"retryDelay":"2m","backoffStrategy":"exponential","failureEscalation":"Escalate to Welfare Team","fallbackAgent":"gh-welfare","disableAfterRepeatedFailure":true,"createIncidentAfterThreshold":true}','Welfare Team',true,'Currently failing — consecutive check-call probe timeouts. Review required.'),
  ('SCH-1011','Welfare exception review','Recurring review of welfare flags raised by check-call analysis to confirm resolution and escalation.','recurring','recurrence','guardianhub','gh-welfare','NOT-1010','compliance','Daily at 09:00','Daily','Europe/London','2026-01-05','','2026-08-26 09:00','2026-08-25 09:00','production','active','high','high',true,true,'qh-critical-bypass','Pause automation','{"maxRetries":2,"retryDelay":"10m","backoffStrategy":"exponential","failureEscalation":"Escalate to Welfare Team","fallbackAgent":"gh-supervisor","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Welfare Team',true,'Welfare exceptions require human approval before any action.'),
  ('SCH-1012','Rota health check','GuardianHub weekly rota health check for shift distribution, over-allocation and rest-gap violations.','recurring','recurrence','guardianhub','gh-rota','NOT-1003','monitoring','Every Monday 07:00','Weekly','Europe/London','2026-01-05','','2026-08-31 07:00','2026-08-24 07:00','production','active','low','normal',false,false,null,'Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Alert Operations","fallbackAgent":"gh-supervisor","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Operations Team',true,'Outputs a weekly rota health scorecard.'),
  ('SCH-1013','Property compliance review','LetHub property compliance review for certificates, safety checks and regulatory documents nearing expiry.','scheduled','time','lethub','lh-comp','NOT-1004','compliance','Daily at 07:00','Daily','Europe/London','2026-01-05','','2026-08-26 07:00','2026-08-25 07:00','production','active','medium','high',false,true,'qh-critical-bypass','Pause automation','{"maxRetries":2,"retryDelay":"10m","backoffStrategy":"exponential","failureEscalation":"Alert Compliance Team","fallbackAgent":"lh-document","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Compliance Team',true,'Certificates and safety docs are checked against expiry windows.'),
  ('SCH-1014','Maintenance backlog check','LetHub maintenance backlog check to prioritise ageing jobs and flag overdue contractor responses.','recurring','recurrence','lethub','lh-maint','NOT-1003','monitoring','Every 6 hours','Every 6 hours','Europe/London','2026-01-05','','2026-08-26 14:00','2026-08-26 08:00','production','active','low','normal',false,false,'qh-delay-normal','Pause automation','{"maxRetries":1,"retryDelay":"15m","backoffStrategy":"linear","failureEscalation":"Alert Operations","fallbackAgent":"lh-property","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Operations Team',true,'Maintenance backlog priority list refreshed every 6 hours.'),
  ('SCH-1015','RSVP follow-up review','Vowora RSVP follow-up review to identify unanswered invitations and trigger reminder workflows.','scheduled','time','wedora','wd-rsvp','NOT-1008','communications','Daily at 08:30','Daily','Europe/London','2026-01-05','','2026-08-26 08:30','2026-08-25 08:30','production','active','low','normal',false,false,null,'Pause automation','{"maxRetries":2,"retryDelay":"10m","backoffStrategy":"exponential","failureEscalation":"Alert Communications","fallbackAgent":"wd-comms","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Communications Team',true,'Reminder workflows are prepared but no messages are sent in demo.'),
  ('SCH-1016','Supplier deadline check','Vowora supplier deadline check to flag vendors with outstanding deliverables before the wedding date.','recurring','recurrence','wedora','wd-supplier','NOT-1003','monitoring','Every 12 hours','Every 12 hours','Europe/London','2026-01-05','','2026-08-26 20:00','2026-08-26 08:00','production','active','low','normal',false,false,'qh-delay-normal','Pause automation','{"maxRetries":1,"retryDelay":"15m","backoffStrategy":"linear","failureEscalation":"Alert Planning Team","fallbackAgent":"wd-planner","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Planning Team',true,'Vendor deliverables checked twice daily.'),
  ('SCH-1017','Sandbox health check','The Forge sandbox health check to confirm isolated build environments are responsive and isolated.','scheduled','time','the-forge','tf-master','NOT-1006','monitoring','Every 30 minutes','Every 30 minutes','Europe/London','2026-01-05','','2026-08-26 11:00','2026-08-26 10:30','sandbox','active','low','normal',false,false,null,'Pause automation','{"maxRetries":2,"retryDelay":"5m","backoffStrategy":"exponential","failureEscalation":"Alert Platform Team","fallbackAgent":"tf-code","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Platform Team',true,'Sandbox isolation is enforced by POL-SANDBOX-ISOLATION.'),
  ('SCH-1018','UAT validation','The Forge scheduled UAT validation against the current release build before publishing.','scheduled','time','the-forge','tf-test','NOT-1012','uat','On release build','On demand','Europe/London','2026-01-05','','','2026-08-22 14:00','sandbox','paused','medium','high',true,true,'qh-delay-normal','Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Alert UAT Team","fallbackAgent":"core-uat","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','UAT Team',false,'Paused pending the next release candidate.'),
  ('SCH-1019','Publishing readiness review','The Forge publishing readiness review to confirm all gates pass before a production deploy.','scheduled','time','the-forge','tf-publishing','NOT-1014','deployment','Before deploy','On demand','Europe/London','2026-01-05','','','2026-08-23 16:00','production','active','critical','critical',true,true,'qh-critical-bypass','Allow critical automation','{"maxRetries":0,"retryDelay":"0m","backoffStrategy":"none","failureEscalation":"Block deploy","fallbackAgent":"tf-code","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Release Team',true,'Critical gate — no retries; requires full governance and approval.'),
  ('SCH-1020','Group security anomaly scan','Event-driven security scan that runs on critical alert to hunt for related anomalies across the group.','event_triggered','event','group','core-security','NOT-1005','security','On critical alert','On event','Europe/London','2026-02-01','','','2026-08-24 03:12','production','active','critical','critical',false,true,'qh-critical-bypass','Allow critical automation','{"maxRetries":2,"retryDelay":"5m","backoffStrategy":"exponential","failureEscalation":"Escalate to Security Team","fallbackAgent":"core-diagnostics","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Security Team',true,'Triggered by critical security alerts; hunt-only, no automated remediation.'),
  ('SCH-1021','Tenancy compliance watch','Condition-triggered LetHub check that runs when tenancy error count exceeds a threshold.','condition_triggered','condition','lethub','lh-tenancy','NOT-1004','compliance','Error count > 10','On condition','Europe/London','2026-02-01','','','2026-08-25 13:22','production','active','medium','high',false,true,null,'Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Alert Compliance Team","fallbackAgent":"lh-comp","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":true}','Compliance Team',true,'Condition-based; no event listener executes in demo.'),
  ('SCH-1022','Vowora seating chart rebuild','One-time scheduled seating chart rebuild for an upcoming wedding — currently in draft awaiting review.','one_time','time','wedora','wd-seating','NOT-1008','matching','One-time at 10:00','One-time','Europe/London','2026-08-29','2026-08-29','2026-08-29 10:00','','production','draft','low','normal',true,true,'qh-delay-normal','Pause automation','{"maxRetries":1,"retryDelay":"10m","backoffStrategy":"linear","failureEscalation":"Alert Planning Team","fallbackAgent":"wd-planner","disableAfterRepeatedFailure":false,"createIncidentAfterThreshold":false}','Planning Team',false,'Draft — not yet approved for execution.')
) as s(schedule_key, name, description, automation_type, trigger_type, site_key, agent_key, rule_key, target_type, schedule_expression, recurrence_summary, timezone, start_at, end_at, next_run_at, last_run_at, environment, status, risk_level, priority, approval_required, audit_required, quiet_hours_policy_key, maintenance_behavior, retry_policy, owner_team, is_active, notes)
left join ai_sites st on st.site_key = s.site_key
left join ai_operations_agents ag on ag.agent_key = s.agent_key
left join ai_notification_rules nr on nr.rule_key = s.rule_key
on conflict (schedule_key) do nothing;

-- --- 19. Event automation rules -----------------------------------------------

insert into ai_event_automation_rules (
  event_rule_key, name, description, event_type, source_type, source_reference,
  site_id, agent_id, notification_rule_id, action_type, action_reference,
  conditions, environment, status, risk_level, approval_required, audit_required,
  owner_team, is_active
)
select
  e.event_rule_key, e.name, e.description, e.event_type, e.source_type, e.source_reference,
  st.id, ag.id, nr.id, e.action_type, e.action_reference,
  e.conditions, e.environment, e.status, e.risk_level, e.approval_required, e.audit_required,
  e.owner_team, e.is_active
from (values
  ('EVT-2001','Critical alert → Diagnostics Agent','Trigger a diagnostic probe when a critical alert fires.','critical_alert','alert','','group','core-diagnostics',null,'run_diagnostic','affected component','{"condition":"Severity is critical"}','production','active','medium',false,true,'Security Team',true),
  ('EVT-2002','Failed run → Failure analysis','Analyse a run failure after retries are exhausted.','run_failure','run','','group','core-diagnostics',null,'run_failure_analysis','failed run','{"condition":"Run status is failed after retries"}','production','active','medium',false,true,'AI Operations',true),
  ('EVT-2003','Approval expires → Notification workflow','Prepare an approver reminder when an approval nears expiry.','approval_expiring','approval','','group','core-comms',null,'prepare_reminder','approver','{"condition":"Approval nearing expiry"}','production','active','low',false,true,'AI Operations',true),
  ('EVT-2004','Tool degraded → Monitoring workflow','Start a monitoring workflow when a connection is degraded.','tool_degraded','tool','','group','core-monitoring',null,'start_monitoring','affected connection','{"condition":"Connection health is degraded"}','production','active','medium',false,true,'AI Operations',true),
  ('EVT-2005','Budget threshold reached → Review workflow','Trigger a management budget review when spend reaches 90%.','budget_threshold','budget','','group','core-billing',null,'trigger_review','budget','{"condition":"Spend reaches 90% threshold"}','production','active','medium',true,true,'Finance Team',true)
) as e(event_rule_key, name, description, event_type, source_type, source_reference, site_key, agent_key, rule_key, action_type, action_reference, conditions, environment, status, risk_level, approval_required, audit_required, owner_team, is_active)
left join ai_sites st on st.site_key = e.site_key
left join ai_operations_agents ag on ag.agent_key = e.agent_key
left join ai_notification_rules nr on nr.rule_key = e.rule_key
on conflict (event_rule_key) do nothing;

-- --- 21. Maintenance windows ---------------------------------------------------

insert into ai_maintenance_windows (
  window_key, name, description, scope, site_id, timezone, starts_at, ends_at,
  status, suppress_schedules, suppress_notifications, affected_references,
  reason, owner_team, is_active
)
select
  m.window_key, m.name, m.description, m.scope, st.id, m.timezone,
  m.starts_at::timestamptz, m.ends_at::timestamptz,
  m.status, m.suppress_schedules, m.suppress_notifications, m.affected_references,
  m.reason, m.owner_team, m.is_active
from (values
  ('MW-3001','Group Sunday backup maintenance','Weekly backup maintenance window.','group',null,'Europe/London','2026-08-30 01:00','2026-08-30 03:00','active',true,false,'["backup"]','Weekly backup maintenance','Platform Team',true),
  ('MW-3002','QuickGuard payroll freeze','Monthly payroll freeze window.','site','quickguard','Europe/London','2026-08-31 18:00','2026-08-31 22:00','active',true,false,'["payroll"]','Monthly payroll freeze','Finance Team',true),
  ('MW-3003','GuardianHub database upgrade','One-time database upgrade window.','site','guardianhub','Europe/London','2026-09-02 00:00','2026-09-02 04:00','active',true,false,'["database"]','Database upgrade','Platform Team',true),
  ('MW-3004','The Forge release window','Weekly release window.','site','the-forge','Europe/London','2026-08-28 15:00','2026-08-28 17:00','active',true,false,'["release"]','Release window','Release Team',true)
) as m(window_key, name, description, scope, site_key, timezone, starts_at, ends_at, status, suppress_schedules, suppress_notifications, affected_references, reason, owner_team, is_active)
left join ai_sites st on st.site_key = m.site_key
on conflict (window_key) do nothing;

-- --- 10. Schedule history baseline (migration_baseline only) ------------------

insert into ai_schedule_history (schedule_id, event_type, status, actor_reference, summary, correlation_id)
select id, 'migration_baseline', 'migration_baseline', 'system', 'Imported from demo Scheduling registry.', schedule_key
from ai_schedules
on conflict do nothing;

-- ============================================================================
-- End.
-- ============================================================================
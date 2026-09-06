-- ============================================================================
-- AI Operations — Master Orchestrator (Phase 2 Prompt 14).
--
-- Persists orchestration requests, routing plans, candidate scoring, plan
-- steps and governance decisions. This phase persists CONFIGURATION / PLANNING
-- metadata only — it does NOT execute anything. No agents, no n8n, no tools,
-- no models, no automatic runs, no production site changes.
--
-- `execution_allowed` is FALSE for every migrated record and is a planning
-- flag only — it is NOT an Execute switch.
-- ============================================================================

-- --- 2. ai_orchestrations -----------------------------------------------------

create table if not exists ai_orchestrations (
  id uuid primary key default gen_random_uuid(),
  orchestration_key text unique not null,
  title text not null,
  description text,
  request_type text,
  request_source text,
  requested_action text,
  site_id uuid references ai_sites(id) on delete set null,
  environment text not null default 'production',
  priority text,
  risk_level text,
  status text,
  classification text,
  classification_confidence text,
  selected_agent_id uuid references ai_operations_agents(id) on delete set null,
  approval_id uuid references ai_approvals(id) on delete set null,
  run_id uuid references ai_runs(id) on delete set null,
  policy_result text,
  permission_result text,
  approval_required boolean not null default false,
  verification_required boolean not null default false,
  uat_required boolean not null default false,
  audit_required boolean not null default false,
  execution_allowed boolean not null default false,
  blocked_reason text,
  correlation_id text,
  failure_strategy text,
  fallback_strategy text,
  result_summary text,
  requested_by text,
  requested_at timestamptz,
  completed_at timestamptz,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- 3. ai_orchestration_steps ------------------------------------------------

create table if not exists ai_orchestration_steps (
  id uuid primary key default gen_random_uuid(),
  orchestration_id uuid references ai_orchestrations(id) on delete restrict,
  step_number integer not null,
  name text,
  step_type text,
  agent_id uuid references ai_operations_agents(id) on delete set null,
  status text,
  risk_level text,
  approval_required boolean not null default false,
  tool_references jsonb,
  knowledge_references jsonb,
  model_reference text,
  input_summary text,
  expected_output text,
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (orchestration_id, step_number)
);

-- --- 4. ai_orchestration_candidates -------------------------------------------

create table if not exists ai_orchestration_candidates (
  id uuid primary key default gen_random_uuid(),
  orchestration_id uuid references ai_orchestrations(id) on delete restrict,
  agent_id uuid references ai_operations_agents(id) on delete restrict,
  rank integer not null default 0,
  score numeric,
  capability_score numeric,
  availability_score numeric,
  policy_score numeric,
  tool_score numeric,
  knowledge_score numeric,
  model_score numeric,
  risk_score numeric,
  eligible boolean not null default false,
  rejection_reason text,
  selection_reason text,
  created_at timestamptz not null default now(),
  unique (orchestration_id, agent_id)
);

-- --- 5. ai_orchestration_decisions (append-oriented) --------------------------

create table if not exists ai_orchestration_decisions (
  id uuid primary key default gen_random_uuid(),
  orchestration_id uuid references ai_orchestrations(id) on delete restrict,
  decision_type text,
  decision text,
  reason text,
  actor_type text,
  actor_reference text,
  policy_reference text,
  agent_reference text,
  previous_state text,
  new_state text,
  created_at timestamptz not null default now()
);

-- --- 6. Indexes ---------------------------------------------------------------

create index if not exists ai_orchestrations_key_idx on ai_orchestrations (orchestration_key);
create index if not exists ai_orchestrations_site_idx on ai_orchestrations (site_id);
create index if not exists ai_orchestrations_agent_idx on ai_orchestrations (selected_agent_id);
create index if not exists ai_orchestrations_status_idx on ai_orchestrations (status);
create index if not exists ai_orchestrations_priority_idx on ai_orchestrations (priority);
create index if not exists ai_orchestrations_risk_idx on ai_orchestrations (risk_level);
create index if not exists ai_orchestrations_env_idx on ai_orchestrations (environment);
create index if not exists ai_orchestrations_corr_idx on ai_orchestrations (correlation_id);
create index if not exists ai_orchestrations_requested_idx on ai_orchestrations (requested_at);
create index if not exists ai_orchestrations_active_idx on ai_orchestrations (is_active);

create index if not exists ai_orch_steps_orch_idx on ai_orchestration_steps (orchestration_id);
create index if not exists ai_orch_steps_number_idx on ai_orchestration_steps (step_number);
create index if not exists ai_orch_steps_agent_idx on ai_orchestration_steps (agent_id);
create index if not exists ai_orch_steps_status_idx on ai_orchestration_steps (status);

create index if not exists ai_orch_candidates_orch_idx on ai_orchestration_candidates (orchestration_id);
create index if not exists ai_orch_candidates_agent_idx on ai_orchestration_candidates (agent_id);
create index if not exists ai_orch_candidates_rank_idx on ai_orchestration_candidates (rank);
create index if not exists ai_orch_candidates_eligible_idx on ai_orchestration_candidates (eligible);

create index if not exists ai_orch_decisions_orch_idx on ai_orchestration_decisions (orchestration_id);
create index if not exists ai_orch_decisions_type_idx on ai_orchestration_decisions (decision_type);
create index if not exists ai_orch_decisions_created_idx on ai_orchestration_decisions (created_at);

-- --- 7. RLS -------------------------------------------------------------------

alter table ai_orchestrations enable row level security;
alter table ai_orchestration_steps enable row level security;
alter table ai_orchestration_candidates enable row level security;
alter table ai_orchestration_decisions enable row level security;

-- Orchestrations (SELECT staff; INSERT/UPDATE owner/admin; no DELETE)
create policy ai_orchestrations_select on ai_orchestrations
  for select to authenticated using (internal_role() is not null);
create policy ai_orchestrations_insert on ai_orchestrations
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_orchestrations_update on ai_orchestrations
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- Steps (SELECT staff; INSERT/UPDATE owner/admin; no DELETE)
create policy ai_orch_steps_select on ai_orchestration_steps
  for select to authenticated using (internal_role() is not null);
create policy ai_orch_steps_insert on ai_orchestration_steps
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_orch_steps_update on ai_orchestration_steps
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- Candidates (SELECT staff; INSERT/UPDATE owner/admin; no DELETE)
create policy ai_orch_candidates_select on ai_orchestration_candidates
  for select to authenticated using (internal_role() is not null);
create policy ai_orch_candidates_insert on ai_orchestration_candidates
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_orch_candidates_update on ai_orchestration_candidates
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- Decisions (SELECT staff; INSERT owner/admin; no UPDATE/DELETE)
create policy ai_orch_decisions_select on ai_orchestration_decisions
  for select to authenticated using (internal_role() is not null);
create policy ai_orch_decisions_insert on ai_orchestration_decisions
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));

-- ============================================================================
-- Seeds (idempotent). Planning/governance metadata only — no execution is
-- implied. `execution_allowed` is FALSE for all migrated records.
-- ============================================================================

-- --- 8. Orchestrations --------------------------------------------------------

insert into ai_orchestrations (
  orchestration_key, title, description, request_type, request_source,
  requested_action, site_id, environment, priority, risk_level, status,
  classification, classification_confidence, selected_agent_id, approval_id,
  run_id, policy_result, permission_result, approval_required,
  verification_required, uat_required, audit_required, execution_allowed,
  blocked_reason, correlation_id, failure_strategy, fallback_strategy,
  result_summary, requested_by, is_active
)
select
  o.orchestration_key, o.title, o.description, o.request_type, o.request_source,
  o.requested_action, st.id, o.environment, o.priority, o.risk_level, o.status,
  o.classification, o.classification_confidence, ag.id, ap.id, rn.id,
  o.policy_result, o.permission_result, o.approval_required,
  o.verification_required, o.uat_required, o.audit_required, false,
  nullif(o.blocked_reason,''), o.correlation_id, o.failure_strategy, o.fallback_strategy,
  o.result_summary, o.requested_by, o.is_active
from (values
  ('ORC-7001','GuardianHub welfare check-call incident repair','Diagnose elevated check-call latency, propose a repair, obtain human approval, execute, verify, run UAT and audit.','repair_recommendation','monitoring_alert','Repair recommendation','guardianhub','production','high','high','completed','Repair recommendation','96%','core-diagnostics','APR-4409','RUN-A1000','pass','pass',true,true,true,true,'','COR-1070','retry same agent','Repair Recommendation Agent','Welfare check-call latency resolved; latency back within target.','Monitoring Agent',false),
  ('ORC-7002','QuickGuard shift matching request','Match eligible guards to an open shift based on availability, qualifications and location.','matching','user','Guard matching','quickguard','production','high','medium','executing','Guard matching','99%','qg-match',null,'RUN-8F21A','pass','pass',false,true,false,false,'','COR-1010','use fallback agent','Shift Management Agent','Match recommendations being produced.','QuickGuard Ops',true),
  ('ORC-7003','GuardianHub diagnostics investigation','Investigate reported support incident on GuardianHub.','diagnostics','support_ticket','Diagnostics','guardianhub','production','high','medium','executing','Diagnostics','92%','core-diagnostics',null,'RUN-3C9B7','pass','pass',false,false,false,false,'','COR-1011','retry same agent','Check-Call Agent','Investigation underway.','GuardianHub Support',true),
  ('ORC-7004','The Forge release validation','Run release validation on the latest Forge build.','uat','scheduled','Release validation','the-forge','production','critical','high','failed','Release validation','98%','tf-test','APR-4500','RUN-4F77B','pass','pass',true,true,true,true,'Latest build failed release validation; deploy agent awaiting approval.','COR-1085','route specialist','Code Agent','Release validation failed on 7 of 41 checks.','Forge Master Agent',false),
  ('ORC-7005','Digital Footprint inbound lead processing','Score and qualify a new inbound business enquiry.','lead_processing','event','Lead scoring','digital-footprint','production','normal','low','completed','Lead scoring','97%','dfp-lead',null,'RUN-71D2E','pass','pass',false,false,false,false,'','COR-1013','retry same agent','Lead / CRM Agent','Lead scored and routed to sales queue.','Lead / CRM Agent',false),
  ('ORC-7006','LetHub tenancy compliance review','Review tenancy compliance and surface findings for human review.','compliance','scheduled','Compliance review','lethub','production','high','high','awaiting_approval','Compliance review','95%','lh-comp','APR-4460','RUN-8A22C','approval_required','approval_required',true,true,false,true,'','COR-1050','require new approval','Tenancy Agent','Compliance findings drafted; awaiting approval.','LetHub Ops',true),
  ('ORC-7007','Vowora seating chart validation','Validate a wedding seating chart for conflicts.','workflow','user','Seating validation','wedora','production','normal','medium','completed','Seating validation','94%','wd-seating',null,'RUN-4C77E','pass','pass',false,true,false,false,'','COR-1060','retry same agent','Wedding Planner Agent','Seating chart validated with 1 flagged duplicate invitation.','Vowora Ops',false),
  ('ORC-7008','QuickGuard payroll reconciliation','Reconcile the latest guard payroll batch.','billing','scheduled','Payroll reconciliation','quickguard','production','high','high','failed','Payroll reconciliation','96%','qg-payment','APR-4515','RUN-8D22F','blocked','blocked',true,true,false,true,'Payment Agent offline; Core Billing Agent paused for policy review.','COR-1091','escalate to human','Billing Agent','Routing failed — no eligible agent available.','QuickGuard Finance',false),
  ('ORC-7009','Group security anomaly scan','Scan for security anomalies across the group.','security','scheduled','Security monitoring','group','production','high','high','routed','Security monitoring','98%','core-security',null,'RUN-1A77F','pass','pass',false,false,false,true,'','COR-1012','use fallback agent','The Forge Security Agent','Routed to Security Agent; fallback prepared.','Security Agent',true),
  ('ORC-7010','Digital Footprint onboarding prep','Prepare onboarding checklist for a new client.','workflow','user','Client onboarding','digital-footprint','production','normal','low','blocked','Client onboarding','95%','dfp-onboard',null,'RUN-2E77B','pass','pass',false,false,false,false,'Client Onboarding Agent at capacity; no fallback in scope.','COR-1013','pause workflow','—','Blocked — agent at capacity.','DFP Delivery',true),
  ('ORC-7011','Group database migration request','Apply a proposed database migration.','deployment','manual','Database migration','group','production','critical','critical','blocked','Database migration','90%','core-deploy',null,'RUN-9E55D','blocked','blocked',true,true,true,true,'Deployment Agent disabled; red-class migration denied pending release policy.','COR-1013','require new approval','—','Blocked — permission gate failed.','Group Admin',true),
  ('ORC-7012','QuickGuard launch rewards calculation','Calculate launch reward eligibility.','billing','event','Reward calculation','quickguard','production','normal','medium','verifying','Reward calculation','93%','qg-launch','APR-4471','RUN-7D22F','pass','pass',true,true,false,false,'','COR-1030','retry same agent','—','Rewards calculated; verifying result.','QuickGuard Ops',true),
  ('ORC-7013','The Forge release UAT cycle','Run user-acceptance tests on a release candidate.','uat','scheduled','UAT cycle','the-forge','staging','high','medium','uat','UAT cycle','97%','core-uat',null,'RUN-6D22E','pass','pass',false,true,true,true,'','COR-1085','retry same agent','UAT Coordinator Agent','UAT cycle in progress.','Forge Team',true),
  ('ORC-7014','GuardianHub welfare flag escalation','Escalate a concerning welfare flag for human review.','monitoring','monitoring_alert','Welfare escalation','guardianhub','production','urgent','high','escalated','Welfare escalation','99%','gh-welfare','APR-4490','RUN-7F11B','approval_required','approval_required',true,false,false,true,'','COR-1042','escalate to human','—','Escalated to human review.','Welfare Agent',true),
  ('ORC-7015','LetHub maintenance request (withdrawn)','Maintenance triage request later withdrawn by staff.','repair_recommendation','manual','Maintenance triage','lethub','production','normal','medium','cancelled','Maintenance triage','91%','lh-maint',null,'RUN-2D55F','pass','pass',false,false,false,false,'','COR-1080','cancel workflow','—','Cancelled by requester before execution.','LetHub Support',false),
  ('ORC-7016','Group daily operational report','Compile the daily operational report.','reporting','scheduled','Report generation','group','production','normal','low','completed','Report generation','99%','core-reporting',null,'RUN-3F66C','pass','pass',false,false,false,false,'','COR-1096','retry same agent','—','Daily report compiled and delivered.','Reporting Agent',false),
  ('ORC-7017','Group data integrity check','Run data integrity checks across group databases.','data_health','scheduled','Data health check','group','production','normal','medium','completed','Data health check','98%','core-data-health',null,'RUN-8B44D','pass','pass',false,false,false,false,'','COR-1023','retry same agent','—','Integrity checks passed; findings reported.','Data Health Agent',false),
  ('ORC-7018','Vowora wedding planning timeline','Coordinate multi-agent wedding planning from timeline through RSVP and supplier coordination.','workflow','user','Wedding planning','wedora','production','normal','low','completed','Wedding planning','96%','wd-planner',null,'RUN-3B66D','pass','pass',false,false,false,false,'','COR-1081','retry same agent','—','Wedding timeline, RSVP and supplier coordination completed.','Vowora Ops',false),
  ('ORC-7019','Group site registry sync','Sync site metadata into the group-wide registry.','system','scheduled','Site metadata sync','group','production','low','low','completed','Site metadata sync','99%','core-site-registry',null,'RUN-2C91D','pass','pass',false,false,false,false,'','COR-1022','retry same agent','—','Site metadata synced.','Site Registry Agent',false),
  ('ORC-7020','The Forge production deployment','Deploy an approved release to production.','deployment','approval','Production deployment','the-forge','production','critical','critical','awaiting_approval','Production deployment','98%','tf-publishing','APR-4500','RUN-8F22B','approval_required','approval_required',true,true,true,true,'','COR-1097','require new approval','—','Deployment awaiting release approval.','Publishing Agent',true),
  ('ORC-7021','Group support ticket triage','Triage an incoming group support ticket.','support','support_ticket','Support triage','group','production','normal','low','routed','Support triage','94%','core-support',null,'RUN-5E11B','pass','pass',false,false,false,false,'','COR-1021','retry same agent','Diagnostics Agent','Routed to Support Agent.','Support Agent',true),
  ('ORC-7022','QuickGuard incident escalation','Capture and escalate a security incident for human handling.','security','event','Incident escalation','quickguard','production','urgent','high','escalated','Incident escalation','97%','qg-incident','APR-4482','RUN-6C11E','approval_required','approval_required',true,false,false,true,'','COR-1051','escalate to human','—','Escalated to human incident team.','Incident Agent',true)
) as o(orchestration_key, title, description, request_type, request_source, requested_action, site_key, environment, priority, risk_level, status, classification, classification_confidence, agent_key, approval_key, run_key, policy_result, permission_result, approval_required, verification_required, uat_required, audit_required, blocked_reason, correlation_id, failure_strategy, fallback_strategy, result_summary, requested_by, is_active)
left join ai_sites st on st.site_key = o.site_key
left join ai_operations_agents ag on ag.agent_key = o.agent_key
left join ai_approvals ap on ap.approval_key = o.approval_key
left join ai_runs rn on rn.run_key = o.run_key
on conflict (orchestration_key) do nothing;

-- --- 9. Orchestration steps ---------------------------------------------------

insert into ai_orchestration_steps (
  orchestration_id, step_number, name, step_type, agent_id, status,
  risk_level, approval_required, tool_references
)
select
  o.id, s.step_number, s.name, s.step_type, ag.id, s.status,
  s.risk_level, s.approval_required, s.tool_references::jsonb
from (values
  ('ORC-7001',1,'Ticket received and triaged','agent_step','core-support','completed','low',false,'["Site API"]'),
  ('ORC-7001',2,'Support classification','agent_step','core-support','completed','low',false,'["Knowledge Base"]'),
  ('ORC-7001',3,'Run diagnostics','agent_step','core-diagnostics','completed','medium',false,'["Supabase"]'),
  ('ORC-7001',4,'Data health checks','agent_step','core-data-health','completed','medium',false,'["Supabase"]'),
  ('ORC-7001',5,'Produce repair recommendation','agent_step','core-repair','completed','high',true,'["n8n"]'),
  ('ORC-7001',6,'Approve repair action','human_approval',null,'completed','high',true,'["—"]'),
  ('ORC-7001',7,'Execute approved repair','agent_step','core-repair','completed','high',false,'["n8n"]'),
  ('ORC-7001',8,'Verify + UAT','agent_step','core-uat','completed','low',false,'["Monitoring"]'),
  ('ORC-7002',1,'Load eligible guards','agent_step','qg-match','completed','low',false,'["Supabase"]'),
  ('ORC-7002',2,'Produce match recommendations','agent_step','qg-match','working','medium',false,'["Site API"]'),
  ('ORC-7002',3,'Verify recommendation','agent_step','qg-match','pending','low',false,'["Monitoring"]'),
  ('ORC-7003',1,'Probe incident','agent_step','core-diagnostics','working','medium',false,'["Supabase"]'),
  ('ORC-7003',2,'Summarise findings','agent_step','core-diagnostics','pending','low',false,'["Monitoring"]'),
  ('ORC-7004',1,'Run release validation','agent_step','tf-test','failed','high',true,'["n8n"]'),
  ('ORC-7004',2,'Fix failing checks','agent_step','tf-code','pending','high',true,'["Site API"]'),
  ('ORC-7005',1,'Score inbound enquiry','agent_step','dfp-lead','completed','low',false,'["Supabase"]'),
  ('ORC-7005',2,'Route to sales queue','agent_step','dfp-lead','completed','low',false,'["Site API"]'),
  ('ORC-7006',1,'Review tenancy compliance','agent_step','lh-comp','awaiting_approval','high',true,'["Supabase"]'),
  ('ORC-7006',2,'Approve findings','human_approval',null,'pending','high',true,'["—"]'),
  ('ORC-7006',3,'Apply approved changes','agent_step','lh-comp','pending','high',false,'["Site API"]'),
  ('ORC-7007',1,'Validate seating chart','agent_step','wd-seating','completed','medium',false,'["Supabase"]'),
  ('ORC-7007',2,'Flag conflicts','agent_step','wd-seating','completed','low',false,'["Site API"]'),
  ('ORC-7009',1,'Scan for anomalies','agent_step','core-security','pending','high',false,'["Monitoring"]'),
  ('ORC-7011',1,'Apply migration','agent_step','core-deploy','pending','critical',true,'["n8n"]'),
  ('ORC-7012',1,'Calculate eligibility','agent_step','qg-launch','completed','medium',true,'["Supabase"]'),
  ('ORC-7012',2,'Verify calculations','agent_step','qg-launch','working','low',false,'["Monitoring"]'),
  ('ORC-7013',1,'Run UAT test suite','agent_step','core-uat','working','medium',false,'["n8n"]'),
  ('ORC-7014',1,'Escalate welfare flag','agent_step','gh-welfare','awaiting_approval','high',true,'["Site API"]'),
  ('ORC-7016',1,'Compile daily report','agent_step','core-reporting','completed','low',false,'["Supabase"]'),
  ('ORC-7017',1,'Run integrity checks','agent_step','core-data-health','completed','medium',false,'["Supabase"]'),
  ('ORC-7018',1,'Build planning timeline','agent_step','wd-planner','completed','low',false,'["Supabase"]'),
  ('ORC-7018',2,'Process RSVP batch','agent_step','wd-rsvp','completed','low',false,'["Site API"]'),
  ('ORC-7018',3,'Chase supplier quotes','agent_step','wd-supplier','completed','low',false,'["Site API"]'),
  ('ORC-7019',1,'Sync site metadata','agent_step','core-site-registry','completed','low',false,'["Supabase"]'),
  ('ORC-7020',1,'Approve production deploy','human_approval',null,'awaiting_approval','critical',true,'["—"]'),
  ('ORC-7020',2,'Deploy to production','agent_step','tf-publishing','pending','critical',false,'["n8n"]'),
  ('ORC-7021',1,'Triage support ticket','agent_step','core-support','pending','low',false,'["Knowledge Base"]'),
  ('ORC-7022',1,'Escalate incident','agent_step','qg-incident','awaiting_approval','high',true,'["Site API"]')
) as s(orchestration_key, step_number, name, step_type, agent_key, status, risk_level, approval_required, tool_references)
left join ai_orchestrations o on o.orchestration_key = s.orchestration_key
left join ai_operations_agents ag on ag.agent_key = s.agent_key
on conflict (orchestration_id, step_number) do nothing;

-- --- 10. Candidate scoring ----------------------------------------------------

insert into ai_orchestration_candidates (
  orchestration_id, agent_id, rank, score, capability_score, eligible,
  rejection_reason, selection_reason
)
select
  o.id, ag.id, c.rank, c.score, c.capability_score, c.eligible,
  nullif(c.rejection_reason,''), c.selection_reason
from (values
  ('ORC-7001','core-diagnostics',1,94,96,true,'','best match'),
  ('ORC-7001','core-support',2,78,71,true,'','lower capability match'),
  ('ORC-7001','core-repair',3,88,92,true,'','reserved for recommendation stage'),
  ('ORC-7002','qg-match',1,97,99,true,'','best match'),
  ('ORC-7002','qg-shift',2,82,88,true,'','secondary scope'),
  ('ORC-7003','core-diagnostics',1,91,94,true,'','best match'),
  ('ORC-7003','gh-checkcall',2,70,90,false,'degraded','degraded'),
  ('ORC-7004','tf-test',1,95,97,true,'','best match'),
  ('ORC-7004','tf-code',2,74,82,false,'degraded','degraded'),
  ('ORC-7005','dfp-lead',1,96,98,true,'','best match'),
  ('ORC-7005','core-lead',2,84,85,true,'','core fallback'),
  ('ORC-7006','lh-comp',1,95,97,true,'','best match'),
  ('ORC-7006','lh-tenancy',2,72,74,true,'','wrong scope'),
  ('ORC-7007','wd-seating',1,93,96,true,'','best match'),
  ('ORC-7007','wd-planner',2,80,82,true,'','secondary scope'),
  ('ORC-7008','qg-payment',1,0,95,false,'agent unavailable','agent unavailable'),
  ('ORC-7008','core-billing',2,0,90,false,'agent unavailable','agent unavailable'),
  ('ORC-7009','core-security',1,96,98,true,'','best match'),
  ('ORC-7009','tf-security',2,88,94,true,'','fallback'),
  ('ORC-7010','dfp-onboard',1,88,94,true,'','at capacity'),
  ('ORC-7011','core-deploy',1,0,92,false,'insufficient permission','insufficient permission'),
  ('ORC-7012','qg-launch',1,89,91,true,'','best match'),
  ('ORC-7013','core-uat',1,92,96,true,'','best match'),
  ('ORC-7013','dfp-uat',2,84,90,true,'','site scope'),
  ('ORC-7014','gh-welfare',1,95,98,true,'','best match'),
  ('ORC-7015','lh-maint',1,90,92,true,'','best match'),
  ('ORC-7016','core-reporting',1,94,98,true,'','best match'),
  ('ORC-7017','core-data-health',1,93,97,true,'','best match'),
  ('ORC-7018','wd-planner',1,94,96,true,'','best match'),
  ('ORC-7018','wd-rsvp',2,86,90,true,'','supporting role'),
  ('ORC-7018','wd-supplier',3,82,84,true,'','supporting role'),
  ('ORC-7019','core-site-registry',1,96,99,true,'','best match'),
  ('ORC-7020','tf-publishing',1,93,95,true,'','best match'),
  ('ORC-7021','core-support',1,91,95,true,'','best match'),
  ('ORC-7021','core-diagnostics',2,80,85,true,'','reserved for diagnosis'),
  ('ORC-7022','qg-incident',1,94,96,true,'','best match')
) as c(orchestration_key, agent_key, rank, score, capability_score, eligible, rejection_reason, selection_reason)
left join ai_orchestrations o on o.orchestration_key = c.orchestration_key
left join ai_operations_agents ag on ag.agent_key = c.agent_key
on conflict (orchestration_id, agent_id) do nothing;

-- --- 11. Routing decisions (append-oriented) ----------------------------------

insert into ai_orchestration_decisions (
  orchestration_id, decision_type, decision, reason, actor_type,
  actor_reference, agent_reference, created_at
)
select
  o.id, d.decision_type, d.decision, d.reason, 'orchestrator', 'Orchestrator',
  d.agent_reference, now()
from (values
  ('ORC-7001','request_classified','Repair recommendation','Monitoring alert: check-call latency exceeded threshold.','core-diagnostics'),
  ('ORC-7001','site_resolved','GuardianHub','Diagnostics + repair + welfare capabilities present.',null),
  ('ORC-7001','agent_selected','Diagnostics Agent','Best diagnostic match for welfare check-call incident.','core-diagnostics'),
  ('ORC-7001','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7002','request_classified','Guard matching','Open shift requires eligible guard coverage.','qg-match'),
  ('ORC-7002','site_resolved','QuickGuard','Matching capability present.',null),
  ('ORC-7002','agent_selected','Guard Matching Agent','Specialist matching agent for QuickGuard.','qg-match'),
  ('ORC-7002','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7003','request_classified','Diagnostics','Support ticket: check-call status not updating.','core-diagnostics'),
  ('ORC-7003','site_resolved','GuardianHub','Diagnostics capability present.',null),
  ('ORC-7003','agent_selected','Diagnostics Agent','Core diagnostics agent with broad access.','core-diagnostics'),
  ('ORC-7003','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7004','request_classified','Release validation','Scheduled release validation for latest Forge build.','tf-test'),
  ('ORC-7004','site_resolved','The Forge','Testing + release validation present.',null),
  ('ORC-7004','agent_selected','Testing Agent','Release validation specialist.','tf-test'),
  ('ORC-7004','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7005','request_classified','Lead scoring','New inbound enquiry received via website form.','dfp-lead'),
  ('ORC-7005','site_resolved','Digital Footprint','Lead automation present.',null),
  ('ORC-7005','agent_selected','Lead Qualification Agent','Site-specific lead qualification specialist.','dfp-lead'),
  ('ORC-7005','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7006','request_classified','Compliance review','Nightly tenancy compliance reference check.','lh-comp'),
  ('ORC-7006','site_resolved','LetHub','Compliance capability present.',null),
  ('ORC-7006','agent_selected','Compliance Agent','LetHub compliance specialist.','lh-comp'),
  ('ORC-7006','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7007','request_classified','Seating validation','Validate seating chart for a wedding.','wd-seating'),
  ('ORC-7007','site_resolved','Vowora','Planning capability present.',null),
  ('ORC-7007','agent_selected','Seating Agent','Seating specialist for Vowora.','wd-seating'),
  ('ORC-7007','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7008','request_classified','Payroll reconciliation','Scheduled payroll reconciliation batch.','qg-payment'),
  ('ORC-7008','site_resolved','QuickGuard','Billing capability present.',null),
  ('ORC-7008','routing_blocked','blocked','No eligible agent available.','qg-payment'),
  ('ORC-7008','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7009','request_classified','Security monitoring','Scheduled group-wide security anomaly scan.','core-security'),
  ('ORC-7009','site_resolved','Group-wide','Security capability present.',null),
  ('ORC-7009','agent_selected','Security Agent','Core security specialist.','core-security'),
  ('ORC-7009','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7010','request_classified','Client onboarding','New client requires onboarding checklist.','dfp-onboard'),
  ('ORC-7010','site_resolved','Digital Footprint','Onboarding capability present.',null),
  ('ORC-7010','routing_blocked','blocked','Agent at capacity; no fallback in scope.','dfp-onboard'),
  ('ORC-7010','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7011','request_classified','Database migration','Proposed production database migration.','core-deploy'),
  ('ORC-7011','site_resolved','Group-wide','Deployment capability present.',null),
  ('ORC-7011','routing_blocked','blocked','Permission gate failed — agent disabled.','core-deploy'),
  ('ORC-7011','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7012','request_classified','Reward calculation','Launch reward eligibility calculation.','qg-launch'),
  ('ORC-7012','site_resolved','QuickGuard','Billing capability present.',null),
  ('ORC-7012','agent_selected','Launch Rewards Agent','Launch rewards specialist.','qg-launch'),
  ('ORC-7012','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7013','request_classified','UAT cycle','UAT cycle for a Forge release candidate.','core-uat'),
  ('ORC-7013','site_resolved','The Forge','UAT capability present.',null),
  ('ORC-7013','agent_selected','UAT Agent','Core UAT specialist.','core-uat'),
  ('ORC-7013','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7014','request_classified','Welfare escalation','Welfare monitoring flagged a concerning pattern.','gh-welfare'),
  ('ORC-7014','site_resolved','GuardianHub','Welfare monitoring present.',null),
  ('ORC-7014','agent_selected','Welfare Agent','Welfare monitoring specialist.','gh-welfare'),
  ('ORC-7014','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7015','request_classified','Maintenance triage','Maintenance triage request.','lh-maint'),
  ('ORC-7015','site_resolved','LetHub','Repair capability present.',null),
  ('ORC-7015','agent_selected','Maintenance Agent','Maintenance specialist.','lh-maint'),
  ('ORC-7015','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7016','request_classified','Report generation','Scheduled daily operational report.','core-reporting'),
  ('ORC-7016','site_resolved','Group-wide','Reporting capability present.',null),
  ('ORC-7016','agent_selected','Reporting Agent','Reporting specialist.','core-reporting'),
  ('ORC-7016','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7017','request_classified','Data health check','Scheduled group data integrity check.','core-data-health'),
  ('ORC-7017','site_resolved','Group-wide','Data health capability present.',null),
  ('ORC-7017','agent_selected','Data Health Agent','Data integrity specialist.','core-data-health'),
  ('ORC-7017','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7018','request_classified','Wedding planning','Build a wedding planning timeline.','wd-planner'),
  ('ORC-7018','site_resolved','Vowora','Planning capability present.',null),
  ('ORC-7018','agent_selected','Wedding Planner Agent','Wedding planning specialist.','wd-planner'),
  ('ORC-7018','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7019','request_classified','Site metadata sync','Scheduled site registry metadata sync.','core-site-registry'),
  ('ORC-7019','site_resolved','Group-wide','Registry capability present.',null),
  ('ORC-7019','agent_selected','Site Registry Agent','Registry specialist.','core-site-registry'),
  ('ORC-7019','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7020','request_classified','Production deployment','Deploy approved release to production.','tf-publishing'),
  ('ORC-7020','site_resolved','The Forge','Deployment capability present.',null),
  ('ORC-7020','agent_selected','Publishing Agent','Deployment specialist.','tf-publishing'),
  ('ORC-7020','approval_required','approval_required','Human approval required for this risk level.',null),
  ('ORC-7021','request_classified','Support triage','Incoming group support ticket.','core-support'),
  ('ORC-7021','site_resolved','Group-wide','Support capability present.',null),
  ('ORC-7021','agent_selected','Support Agent','Core support specialist.','core-support'),
  ('ORC-7021','permission_checked','pass','Permission gate passed.',null),
  ('ORC-7022','request_classified','Incident escalation','Security incident detected and triaged.','qg-incident'),
  ('ORC-7022','site_resolved','QuickGuard','Incident capability present.',null),
  ('ORC-7022','agent_selected','Incident Agent','Incident triage specialist.','qg-incident'),
  ('ORC-7022','approval_required','approval_required','Human approval required for this risk level.',null)
) as d(orchestration_key, decision_type, decision, reason, agent_reference)
left join ai_orchestrations o on o.orchestration_key = d.orchestration_key
on conflict do nothing;

-- ============================================================================
-- End.
-- ============================================================================
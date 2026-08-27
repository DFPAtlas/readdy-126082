-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 04 — TASKS & RUNS LIVE SEED
--
-- Idempotent migration of the existing Tasks & Runs demo dataset into the live
-- ai_tasks / ai_runs / ai_run_steps tables (created in Prompt 01).
--
--  * task_key / run_key = stable application identifiers (routes + relationships)
--  * site_id / agent_id / task_id resolved from live ai_sites / ai_operations_agents / ai_tasks
--  * parent/root run relationships resolved AFTER run insertion (step order safe)
--  * run steps imported with sanitised summaries only (no secrets / raw payloads)
--  * approval_id intentionally NOT populated (approvals migrate separately)
--  * TEST / SANDBOX records remain untouched (filtered by environment = 'sandbox')
--
-- Import counts: 43 tasks, 49 runs, 268 steps, 6 parent-linked child runs.
-- ============================================================================

-- 1) TASKS ----------------------------------------------------------------------

INSERT INTO ai_tasks (task_key, name, description, task_type, site_id, requested_by, trigger_source, priority, risk_level, environment, status, approval_required, verification_required, uat_required, audit_required, notes)
SELECT v.task_key, v.name, v.description, v.task_type, s.id, v.requested_by, v.trigger_source, v.priority, v.risk_level, v.environment, v.status, v.approval_required, v.verification_required, v.uat_required, v.audit_required, v.notes
FROM (VALUES
('TASK-1070','Resolve GuardianHub support incident','End-to-end support incident: diagnose, recommend, approve, repair and verify.','support','guardianhub','Orchestrator','support_ticket','high','medium','production','completed',true,false,true,true,'Migrated demo multi-agent chain task.'),
('TASK-9D4F2','Scheduled task execution','Recurring scheduled maintenance run.','system',NULL,'Orchestrator','scheduled','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-8C1B7','Scheduled task execution','Recurring scheduled maintenance run.','system',NULL,'Orchestrator','scheduled','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-7A9E3','Batch processing','Nightly batch data processing.','system',NULL,'Orchestrator','scheduled','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-6B5D8','Ad-hoc request','One-off operational request.','user_requested',NULL,'Orchestrator','user','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-5C2F4','Nightly run','Scheduled overnight maintenance.','system',NULL,'Orchestrator','scheduled','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-8F21A','Match guards to open shift','Match eligible guards to an uncovered shift in London.','matching','quickguard','Orchestrator','event','high','medium','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-3C9B7','Investigate support incident','Diagnose the GuardianHub check-call latency incident.','diagnostics','guardianhub','Orchestrator','monitoring_alert','urgent','high','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-1A77F','Security anomaly scan','Scan for anomalous auth patterns across the group.','security',NULL,'Orchestrator','scheduled','high','high','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-71D2E','Process new business enquiry','Score and enrich a new inbound Digital Footprint enquiry.','lead_processing','digital-footprint','Orchestrator','support_ticket','normal','low','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-4A11D','Compile weekly compliance report','Generate the weekly guard compliance summary.','reporting','quickguard','Orchestrator','scheduled','normal','low','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-5E11B','Queue support notification batch','Send approved support notifications.','communications',NULL,'Orchestrator','agent','normal','low','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-2C91D','Sync site metadata','Refresh group-wide site registry metadata.','data_health',NULL,'Orchestrator','scheduled','low','low','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-8B44D','Run data integrity check','Check data consistency across Wedora tables.','data_health','wedora','Orchestrator','scheduled','normal','medium','production','requested',false,false,false,true,'Migrated demo task.'),
('TASK-7D22F','Modify supervisor database access','Update supervisor database access policy on GuardianHub.','security','guardianhub','Orchestrator','user','high','high','production','requested',true,false,false,true,'Migrated demo task.'),
('TASK-9E33A','Draft database migration','Draft schema migration for LetHub tenancy changes.','deployment','lethub','Orchestrator','user','high','critical','production','requested',true,false,false,true,'Migrated demo task.'),
('TASK-1F44B','Process payroll batch','Reconcile and prepare the QuickGuard payroll batch.','billing','quickguard','Orchestrator','scheduled','critical','high','production','requested',true,false,false,true,'Migrated demo task.'),
('TASK-5D88F','Run check-call batch','Execute the scheduled welfare check-call batch.','monitoring','guardianhub','Orchestrator','scheduled','high','high','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-8D22F','Generate feature page','Generate a new feature page for a Forge build.','deployment','the-forge','Orchestrator','user','high','high','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-7F11B','Run release validation','Validate the latest Forge release build.','uat','the-forge','Orchestrator','uat','high','medium','production','completed',false,false,true,true,'Migrated demo task.'),
('TASK-3E66A','Moderate photo upload','Moderate a batch of shared wedding photos.','data_health','wedora','Orchestrator','event','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-8A22C','Apply repair to site config','Apply an approved repair to GuardianHub site config.','repair_recommendation','guardianhub','Orchestrator','approval','high','high','production','completed',true,false,false,true,'Migrated demo task.'),
('TASK-6E99A','Escalate welfare flag','Escalate a welfare flag to the human review queue.','security','guardianhub','Orchestrator','monitoring_alert','critical','critical','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-4C77E','Process RSVP batch','Process the latest RSVP response batch.','workflow','wedora','Orchestrator','event','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-5B99D','Validate timesheet batch','Validate the latest guard timesheet submission.','workflow','quickguard','Orchestrator','event','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-2D55F','Assist landlord enquiry','Answer a landlord enquiry about listing performance.','support','lethub','Orchestrator','support_ticket','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-3B66D','Build planning timeline','Generate a wedding planning timeline.','workflow','wedora','Orchestrator','user','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-2E66A','Verify licence renewals','Verify upcoming guard licence renewals.','compliance','quickguard','Orchestrator','scheduled','normal','high','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-5A88C','Process tenancy renewal','Process a tenancy renewal for LetHub.','workflow','lethub','Orchestrator','user','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-6B99D','Triaged maintenance request','Triage a maintenance request for LetHub.','support','lethub','Orchestrator','support_ticket','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-4F77B','Update property listing','Update a property listing with new details.','data_health','lethub','Orchestrator','user','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-7C11E','Review tenancy compliance','Run nightly tenancy compliance checks.','compliance','lethub','Orchestrator','scheduled','normal','high','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-9B33D','Validate seating chart','Validate a wedding seating chart for conflicts.','workflow','wedora','Orchestrator','user','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-1C44E','Build day-of timeline','Generate the day-of wedding timeline.','workflow','wedora','Orchestrator','user','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-2A55C','Send tenancy notices','Send approved tenancy notices.','communications','lethub','Orchestrator','scheduled','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-8A22D','Coordinate build pipeline','Orchestrate a Forge build pipeline.','workflow','the-forge','Orchestrator','user','high','high','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-6B22E','Compile daily report','Compile the group daily operations report.','reporting',NULL,'Orchestrator','scheduled','normal','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-4C11F','Verify latest backup','Verify the latest group backup is recoverable.','backup',NULL,'Orchestrator','scheduled','normal','medium','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-3D77A','Process payroll reconciliation','Reconcile the latest payroll batch.','billing','quickguard','Orchestrator','scheduled','high','high','production','completed',true,false,false,true,'Migrated demo task.'),
('TASK-9E55D','Reconcile billing records','Reconcile group billing records.','billing',NULL,'Orchestrator','scheduled','normal','high','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-0B88A','Index new articles','Index new knowledge-base articles.','data_health',NULL,'Orchestrator','event','low','low','production','completed',false,false,false,true,'Migrated demo task.'),
('TASK-3F66C','Compile draft report','Draft a custom operations report.','reporting','digital-footprint','Orchestrator','user','low','low','production','draft',false,false,false,true,'Migrated demo task (draft).'),
('TASK-8F22B','Prepare publish','Prepare a Forge site for publishing.','deployment','the-forge','Orchestrator','approval','critical','critical','production','requested',true,false,true,true,'Migrated demo task.')
) AS v(task_key,name,description,task_type,site_key,requested_by,trigger_source,priority,risk_level,environment,status,approval_required,verification_required,uat_required,audit_required,notes)
LEFT JOIN ai_sites s ON s.site_key = v.site_key
ON CONFLICT (task_key) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now();

-- 2) RUNS (without parent/root links) ------------------------------------------

INSERT INTO ai_runs (run_key, task_id, correlation_id, site_id, agent_id, status, priority, risk_level, environment, queue_position, current_step, total_steps, attempts, max_attempts, retry_count, estimated_cost, actual_cost, started_at, completed_at, error_summary, result_summary, approval_required, approval_id, verification_required, uat_required, audit_required)
SELECT v.run_key, t.id, v.correlation_id, s.id, a.id, v.status, v.priority, v.risk_level, 'production', v.queue_position, v.current_step, v.total_steps, v.attempts, v.max_attempts, v.retry_count, v.estimated_cost, v.actual_cost, NULL, NULL, v.error_summary, v.result_summary, v.approval_required, NULL, v.verification_required, v.uat_required, v.audit_required
FROM (VALUES
('RUN-9D4F2','TASK-9D4F2','COR-9001',NULL,'core-orchestrator','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Completed with no errors.',false,false,false,true),
('RUN-8C1B7','TASK-8C1B7','COR-9002',NULL,'core-orchestrator','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Completed.',false,false,false,true),
('RUN-7A9E3','TASK-7A9E3','COR-9003',NULL,'core-data-health','failed','normal','medium',NULL,6,6,2,3,1,0.04,0.04,'Transient timeout — queued for retry.','Failed — transient timeout, queued for retry.',false,false,false,true),
('RUN-6B5D8','TASK-6B5D8','COR-9004',NULL,'core-orchestrator','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Request handled.',false,false,false,true),
('RUN-5C2F4','TASK-5C2F4','COR-9005',NULL,'core-orchestrator','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Nightly run complete.',false,false,false,true),
('RUN-8F21A','TASK-8F21A','COR-1010','quickguard','qg-match','working','high','medium',NULL,3,7,1,3,0,0.04,NULL,NULL,NULL,false,false,false,true),
('RUN-3C9B7','TASK-3C9B7','COR-1011','guardianhub','core-diagnostics','working','urgent','high',NULL,3,5,1,3,0,0.04,NULL,NULL,NULL,false,false,false,true),
('RUN-1A77F','TASK-1A77F','COR-1012',NULL,'core-security','working','high','high',NULL,3,5,1,3,0,0.04,NULL,NULL,NULL,false,false,false,true),
('RUN-71D2E','TASK-71D2E','COR-1013','digital-footprint','dfp-lead','working','normal','low',NULL,3,5,1,3,0,0.04,NULL,NULL,NULL,false,false,false,true),
('RUN-4A11D','TASK-4A11D','COR-1020','quickguard','qg-comp','queued','normal','low',1,0,6,0,3,0,NULL,NULL,NULL,NULL,false,false,false,true),
('RUN-5E11B','TASK-5E11B','COR-1021',NULL,'core-comms','queued','normal','low',2,0,4,0,3,0,NULL,NULL,NULL,NULL,false,false,false,true),
('RUN-2C91D','TASK-2C91D','COR-1022',NULL,'core-site-registry','waiting','low','low',3,0,3,0,3,0,NULL,NULL,NULL,NULL,false,false,false,true),
('RUN-8B44D','TASK-8B44D','COR-1023','wedora','core-data-health','queued','normal','medium',4,0,5,0,3,0,NULL,NULL,NULL,NULL,false,false,false,true),
('RUN-7D22F','TASK-7D22F','COR-1030','guardianhub','gh-incident','awaiting_approval','high','high',NULL,4,6,1,3,0,0.04,NULL,NULL,NULL,true,false,false,true),
('RUN-9E33A','TASK-9E33A','COR-1031','lethub','tf-database','awaiting_approval','high','critical',NULL,3,5,1,3,0,0.04,NULL,NULL,NULL,true,false,false,true),
('RUN-1F44B','TASK-1F44B','COR-1032','quickguard','qg-payment','awaiting_approval','critical','high',NULL,3,5,1,3,0,0.04,NULL,NULL,NULL,true,false,false,true),
('RUN-5D88F','TASK-5D88F','COR-1040','guardianhub','gh-checkcall','failed','high','high',NULL,6,6,2,3,1,0.04,0.04,'Notification service returned 503 during batch send.','2 of 41 check-calls failed to send.',false,false,false,true),
('RUN-8D22F','TASK-8D22F','COR-1041','the-forge','tf-code','failed','high','high',NULL,6,6,2,3,1,0.04,0.04,'Model output failed schema validation.','Generation failed validation on latest attempt.',false,false,false,true),
('RUN-7F11B','TASK-7F11B','COR-1042','the-forge','tf-test','failed','high','medium',NULL,6,6,1,3,0,0.04,0.04,'3 test cases failing on latest build.','Release validation failed — 3 cases failing.',false,false,true,true),
('RUN-3E66A','TASK-3E66A','COR-1043','wedora','wd-photo','failed','normal','medium',NULL,6,6,3,3,3,0.04,0.04,'Max attempts exceeded after repeated timeouts.','Moderation failed after 3 attempts.',false,false,false,true),
('RUN-8A22C','TASK-8A22C','COR-1050','guardianhub','gh-welfare','blocked','high','high',NULL,4,6,1,3,0,0.04,NULL,'Blocked — awaiting dependent approval APR-4460.',NULL,true,false,false,true),
('RUN-6E99A','TASK-6E99A','COR-1051','guardianhub','gh-welfare','blocked','critical','critical',NULL,2,4,1,3,0,0.04,NULL,'Blocked — awaiting human escalation assignment.',NULL,false,false,false,true),
('RUN-4C77E','TASK-4C77E','COR-1060','wedora','wd-rsvp','retry_scheduled','normal','low',NULL,6,6,1,3,1,0.04,0.04,'Transient DB lock — retry scheduled.',NULL,false,false,false,true),
('RUN-5B99D','TASK-5B99D','COR-1061','quickguard','qg-shift','retry_scheduled','normal','medium',NULL,6,6,1,3,1,0.04,0.04,'Transient timeout — retry scheduled.',NULL,false,false,false,true),
('RUN-A1000','TASK-1070','COR-1070','guardianhub','core-support','completed','high','medium',NULL,10,10,1,3,0,0.04,0.04,NULL,'Incident resolved end-to-end.',true,false,true,true),
('RUN-A1001','TASK-1070','COR-1070','guardianhub','core-support','completed','normal','low',NULL,0,0,1,3,0,0.04,0.04,NULL,'Ticket triaged.',false,false,false,true),
('RUN-A1002','TASK-1070','COR-1070','guardianhub','core-diagnostics','completed','normal','medium',NULL,0,0,1,3,0,0.04,0.04,NULL,'Root cause identified.',false,false,false,true),
('RUN-A1003','TASK-1070','COR-1070','guardianhub','core-data-health','completed','normal','medium',NULL,0,0,1,3,0,0.04,0.04,NULL,'Integrity confirmed.',false,false,false,true),
('RUN-A1004','TASK-1070','COR-1070','guardianhub','core-repair','completed','normal','medium',NULL,0,0,1,3,0,0.04,0.04,NULL,'Fix recommended.',false,false,false,true),
('RUN-A1005','TASK-1070','COR-1070','guardianhub','core-uat','completed','normal','low',NULL,0,0,1,3,0,0.04,0.04,NULL,'Regression clear.',false,false,true,true),
('RUN-A1006','TASK-1070','COR-1070','guardianhub','core-reporting','completed','normal','low',NULL,0,0,1,3,0,0.04,0.04,NULL,'Report generated.',false,false,false,true),
('RUN-2D55F','TASK-2D55F','COR-1080','lethub','lh-landlord','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Enquiry answered.',false,false,false,true),
('RUN-3B66D','TASK-3B66D','COR-1081','wedora','wd-planner','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Timeline generated.',false,false,false,true),
('RUN-2E66A','TASK-2E66A','COR-1082','quickguard','qg-comp','completed','normal','high',NULL,6,6,1,3,0,0.04,0.04,NULL,'Renewals verified; 2 flagged.',false,false,false,true),
('RUN-5A88C','TASK-5A88C','COR-1083','lethub','lh-tenancy','completed','normal','medium',NULL,6,6,1,3,0,0.04,0.04,NULL,'Renewal processed.',false,false,false,true),
('RUN-6B99D','TASK-6B99D','COR-1084','lethub','lh-maint','completed','normal','medium',NULL,6,6,1,3,0,0.04,0.04,NULL,'Request triaged.',false,false,false,true),
('RUN-4F77B','TASK-4F77B','COR-1085','lethub','lh-property','completed','normal','medium',NULL,6,6,1,3,0,0.04,0.04,NULL,'Listing updated.',false,false,false,true),
('RUN-7C11E','TASK-7C11E','COR-1086','lethub','lh-comp','completed','normal','high',NULL,6,6,1,3,0,0.04,0.04,NULL,'Compliance checks passed.',false,false,false,true),
('RUN-9B33D','TASK-9B33D','COR-1087','wedora','wd-seating','completed','normal','medium',NULL,6,6,1,3,0,0.04,0.04,NULL,'Seating chart validated.',false,false,false,true),
('RUN-1C44E','TASK-1C44E','COR-1088','wedora','wd-timeline','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Timeline generated.',false,false,false,true),
('RUN-2A55C','TASK-2A55C','COR-1089','lethub','lh-comms','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Notices sent.',false,false,false,true),
('RUN-8A22D','TASK-8A22D','COR-1090','the-forge','tf-master','completed','high','high',NULL,6,6,1,3,0,0.04,0.04,NULL,'Build pipeline complete.',false,false,false,true),
('RUN-6B22E','TASK-6B22E','COR-1091',NULL,'core-reporting','completed','normal','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Daily report compiled.',false,false,false,true),
('RUN-4C11F','TASK-4C11F','COR-1092',NULL,'core-backup','completed','normal','medium',NULL,6,6,1,3,0,0.04,0.04,NULL,'Backup verified recoverable.',false,false,false,true),
('RUN-3D77A','TASK-3D77A','COR-1093','quickguard','qg-payment','completed','high','high',NULL,6,6,1,3,0,0.04,0.04,NULL,'Payroll reconciled.',true,false,false,true),
('RUN-9E55D','TASK-9E55D','COR-1094',NULL,'core-billing','paused','normal','high',NULL,2,5,1,3,0,0.04,NULL,NULL,'Paused — awaiting policy review.',false,false,false,true),
('RUN-0B88A','TASK-0B88A','COR-1095',NULL,'core-knowledge','cancelled','low','low',NULL,6,6,1,3,0,0.04,0.04,NULL,'Cancelled — duplicate request.',false,false,false,true),
('RUN-3F66C','TASK-3F66C','COR-1096','digital-footprint','core-reporting','draft','low','low',NULL,0,4,0,3,0,NULL,NULL,NULL,'Draft task saved.',false,false,false,true),
('RUN-8F22B','TASK-8F22B','COR-1097','the-forge','tf-publishing','awaiting_approval','critical','critical',NULL,4,8,1,3,0,0.04,NULL,NULL,NULL,true,false,true,true)
) AS v(run_key,task_key,correlation_id,site_key,agent_key,status,priority,risk_level,queue_position,current_step,total_steps,attempts,max_attempts,retry_count,estimated_cost,actual_cost,error_summary,result_summary,approval_required,verification_required,uat_required,audit_required)
LEFT JOIN ai_tasks t ON t.task_key = v.task_key
LEFT JOIN ai_sites s ON s.site_key = v.site_key
LEFT JOIN ai_operations_agents a ON a.agent_key = v.agent_key
ON CONFLICT (run_key) DO UPDATE SET status = EXCLUDED.status, updated_at = now();

-- 3) PARENT / ROOT RUN LINKS ---------------------------------------------------

UPDATE ai_runs r
SET parent_run_id = p.id, root_run_id = p.id
FROM (VALUES
('RUN-A1001','RUN-A1000'),
('RUN-A1002','RUN-A1000'),
('RUN-A1003','RUN-A1000'),
('RUN-A1004','RUN-A1000'),
('RUN-A1005','RUN-A1000'),
('RUN-A1006','RUN-A1000')
) AS v(child_key, parent_key)
JOIN ai_runs p ON p.run_key = v.parent_key
WHERE r.run_key = v.child_key;

-- 4) RUN STEPS (custom timelines) ---------------------------------------------

INSERT INTO ai_run_steps (run_id, step_number, name, status, risk_level, approval_required, input_summary, output_summary)
SELECT r.id, v.n, v.name, v.status, v.risk, v.approval_required, v.input_summary, v.output_summary
FROM (VALUES
('RUN-8F21A',1,'Shift Received','completed','low',false,'New shift requirement','Shift parsed'),
('RUN-8F21A',2,'Eligibility Filter','completed','low',false,'Shift + guard pool','Eligible guards'),
('RUN-8F21A',3,'Score Candidates','working','medium',false,'Eligible guards','Ranking in progress'),
('RUN-8F21A',4,'Recommend Matches','pending','medium',false,'Ranked matches','Top-3 recommendation'),
('RUN-8F21A',5,'Staff Confirmation','pending','medium',true,'Recommendation','Match confirmed'),
('RUN-8F21A',6,'Assign Shift','pending','low',false,'Confirmed match','Shift assigned'),
('RUN-8F21A',7,'Completed','pending','low',false,'Assignment','Run closed'),
('RUN-3C9B7',1,'Task Received','completed','low',false,'Inbound task','Task accepted'),
('RUN-3C9B7',2,'Context Loaded','completed','low',false,'Task metadata','Context ready'),
('RUN-3C9B7',3,'Execution','working','medium',false,'Task payload','Executing'),
('RUN-3C9B7',4,'Verification','pending','low',false,'Result','Verify'),
('RUN-3C9B7',5,'Completed','pending','low',false,'Verified result','Run closed'),
('RUN-1A77F',1,'Task Received','completed','low',false,'Inbound task','Task accepted'),
('RUN-1A77F',2,'Context Loaded','completed','low',false,'Task metadata','Context ready'),
('RUN-1A77F',3,'Execution','working','medium',false,'Task payload','Executing'),
('RUN-1A77F',4,'Verification','pending','low',false,'Result','Verify'),
('RUN-1A77F',5,'Completed','pending','low',false,'Verified result','Run closed'),
('RUN-71D2E',1,'Task Received','completed','low',false,'Inbound task','Task accepted'),
('RUN-71D2E',2,'Context Loaded','completed','low',false,'Task metadata','Context ready'),
('RUN-71D2E',3,'Execution','working','medium',false,'Task payload','Executing'),
('RUN-71D2E',4,'Verification','pending','low',false,'Result','Verify'),
('RUN-71D2E',5,'Completed','pending','low',false,'Verified result','Run closed'),
('RUN-A1000',1,'Ticket Received','completed','low',false,'Inbound support ticket','Ticket acknowledged'),
('RUN-A1000',2,'Support Classification','completed','low',false,'Ticket content','Category: account access'),
('RUN-A1000',3,'Diagnostics','completed','medium',false,'Classified ticket','Root cause candidate'),
('RUN-A1000',4,'Recommendation','completed','medium',false,'Findings','Recommended fix'),
('RUN-A1000',5,'Human Approval','completed','medium',true,'Recommendation','Approved'),
('RUN-A1000',6,'Execution','completed','medium',false,'Approved action','Fix applied'),
('RUN-A1000',7,'Verification','completed','low',false,'Applied fix','Verified'),
('RUN-A1000',8,'UAT','completed','low',false,'Verified fix','Regression clear'),
('RUN-A1000',9,'Audit','completed','low',false,'Run record','Audit trail written'),
('RUN-A1000',10,'Completed','completed','low',false,'Audited run','Run closed'),
('RUN-8F22B',1,'Build Generated','completed','high',false,'Build request','Artifact ready'),
('RUN-8F22B',2,'Security Scan','completed','high',false,'Build artifact','No critical findings'),
('RUN-8F22B',3,'Release Validation','completed','medium',false,'Build artifact','Validated'),
('RUN-8F22B',4,'Human Approval','awaiting_approval','high',true,'Validation report','Awaiting sign-off'),
('RUN-8F22B',5,'Publish','pending','high',false,'Approved build','Publish'),
('RUN-8F22B',6,'UAT','pending','medium',false,'Published build','UAT cycle'),
('RUN-8F22B',7,'Audit','pending','low',false,'Run record','Audit trail'),
('RUN-8F22B',8,'Completed','pending','low',false,'Audited run','Run closed')
) AS v(run_key,n,name,status,risk,approval_required,input_summary,output_summary)
JOIN ai_runs r ON r.run_key = v.run_key
ON CONFLICT DO NOTHING;

-- 5) RUN STEPS (generic timeline for remaining executed runs) -----------------

INSERT INTO ai_run_steps (run_id, step_number, name, status, risk_level, approval_required, input_summary, output_summary)
SELECT r.id, g.n, g.name, g.status, g.risk, g.approval_required, g.input_summary, g.output_summary
FROM ai_runs r
CROSS JOIN (VALUES
(1,'Task Received','completed','low',false,'Inbound task','Task accepted'),
(2,'Context Loaded','completed','low',false,'Task metadata','Context ready'),
(3,'Agent Dispatched','completed','low',false,'Routing rules','Agent assigned'),
(4,'Execution','completed','low',false,'Task payload','Result produced'),
(5,'Verification','completed','low',false,'Result','Verified'),
(6,'Completed','completed','low',false,'Verified result','Run closed')
) AS g(n,name,status,risk,approval_required,input_summary,output_summary)
WHERE r.run_key IN ('RUN-9D4F2','RUN-8C1B7','RUN-7A9E3','RUN-6B5D8','RUN-5C2F4','RUN-7D22F','RUN-9E33A','RUN-1F44B','RUN-5D88F','RUN-8D22F','RUN-7F11B','RUN-3E66A','RUN-8A22C','RUN-6E99A','RUN-4C77E','RUN-5B99D','RUN-A1001','RUN-A1002','RUN-A1003','RUN-A1004','RUN-A1005','RUN-A1006','RUN-2D55F','RUN-3B66D','RUN-2E66A','RUN-5A88C','RUN-6B99D','RUN-4F77B','RUN-7C11E','RUN-9B33D','RUN-1C44E','RUN-2A55C','RUN-8A22D','RUN-6B22E','RUN-4C11F','RUN-3D77A','RUN-9E55D','RUN-0B88A')
ON CONFLICT DO NOTHING;
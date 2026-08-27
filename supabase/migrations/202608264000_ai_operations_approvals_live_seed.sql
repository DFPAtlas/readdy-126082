-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 05 — HUMAN APPROVALS LIVE SEED.
--
-- Migrates the 26 demo approval records into `ai_approvals` idempotently, then
-- completes the previously-deferred Run ↔ Approval linkage and adds the
-- non-destructive FK on `ai_runs.approval_id`.
--
-- Safety:
--   * `approval_key` is the stable application identifier (UNIQUE); database
--     `id` (UUID) is the internal primary key, never exposed.
--   * site/agent/run UUIDs are resolved from the live registries by key; group
--     records keep `site_id = NULL`.
--   * Only sanitised operational summaries are imported — no credentials, no
--     chain-of-thought, no raw sensitive evidence.
--   * ON CONFLICT (approval_key) DO UPDATE keeps the seed idempotent.
-- ============================================================================

INSERT INTO ai_approvals (
  approval_key, title, description, site_id, agent_id, run_id,
  requested_action, request_type, risk_class, severity, environment, status,
  requested_by, required_team, minimum_approvers, current_approval_count,
  business_justification, reasoning_summary, expected_result, potential_impact,
  rollback_available, rollback_summary,
  verification_required, uat_required, audit_required,
  decision, decision_reason, decision_actor, conditions, notes
)
SELECT
  v.approval_key, v.title, v.description,
  s.id, a.id, r.id,
  v.requested_action, v.request_type, v.risk_class, v.severity, v.environment, v.status,
  v.requested_by, v.required_team, v.minimum_approvers, v.current_approval_count,
  v.business_justification, v.reasoning_summary, v.expected_result, v.potential_impact,
  v.rollback_available, v.rollback_summary,
  v.verification_required, v.uat_required, v.audit_required,
  v.decision, v.decision_reason, v.decision_actor,
  CASE WHEN v.condition_text IS NULL THEN NULL ELSE jsonb_build_array(v.condition_text) END,
  v.notes
FROM (VALUES
  ('APR-4471','Modify supervisor database access','Update supervisor database access policy on GuardianHub.','guardianhub','gh-incident','RUN-7D22F','Modify supervisor database access policy','security','red','high','production','pending','AI Agent','Group AI Operations',1,0,'Supervisors need read access to shift data to resolve a live incident.','Diagnostics show the incident is blocked on supervisor read access; the change is scoped and reversible.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4482','Draft database migration','Schema migration for LetHub tenancy changes.','lethub','tf-database','RUN-9E33A','Run database migration','deployment','red','critical','production','pending','AI Agent','Group AI Operations',2,0,'New tenancy fields require a schema migration before the release can proceed.','Migration script drafted and validated; critical risk due to production schema change.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4460','Apply repair to site config','Apply an approved repair to GuardianHub site configuration.','guardianhub','gh-welfare','RUN-8A22C','Apply repair to site config','repair','red','high','production','pending','AI Agent','Group AI Operations',1,0,'Repair recommended after welfare check-call latency investigation.','Root cause identified; applying the config repair is gated behind approval.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4500','Prepare production publish','Publish the latest Forge release build to production.','the-forge','tf-publishing','RUN-8F22B','Publish release build to production','deployment','red','critical','production','pending','AI Agent','Group AI Operations',2,0,'Release build passed security scan and awaits final sign-off before publish.','Release validated; UAT still in progress, so publish requires dual sign-off.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4501','Modify RLS policy','Adjust row-level security policy on the Digital Footprint database.','digital-footprint','core-security',NULL,'Modify RLS policy','security','red','critical','production','pending','AI Agent','Group AI Operations',2,1,'A new role requires adjusted row-level access; the change is narrowly scoped.','RLS change requested; critical risk, requiring two approvers. One approval already recorded.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4511','Deploy production code','Deploy a validated build to the group production environment.',NULL,'core-deploy',NULL,'Deploy production code','deployment','red','critical','production','pending','AI Agent','Group AI Operations',2,1,'Validated release awaiting deployment sign-off.','Deployment is gated behind a full release approval workflow; one of two approvers has signed off.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4513','Modify billing configuration','Adjust group billing configuration for a pricing update.',NULL,'core-billing',NULL,'Modify billing configuration','billing','red','high','production','pending','AI Agent','Group AI Operations',1,0,'Pricing update requires a billing configuration change.','Finance-critical change; human approval required.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4509','Resolve seating conflict','Resolve a seating chart conflict flagged by the Seating Agent.','wedora','wd-seating',NULL,'Resolve seating conflict','manual','green','low','production','pending','AI Agent','Group AI Operations',1,0,'Couple requested a manual seating adjustment.','Low-risk manual change; approval is a formality.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4517','Send supplier reminder','Send a reminder to a wedding supplier about an outstanding quote.','wedora','wd-supplier',NULL,'Send supplier reminder','manual','green','low','production','pending','AI Agent','Group AI Operations',1,0,'Couple asked to chase an outstanding supplier quote.','Low-risk outbound communication; uses an approved template.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4490','Process payroll batch','Reconcile and prepare the QuickGuard payroll batch for payment.','quickguard','qg-payment','RUN-1F44B','Process payroll batch','billing','red','high','production','under_review','AI Agent','Group AI Operations',2,1,'Payroll batch is ready and requires finance sign-off before payment.','Reconciled payroll batch; dual approval required for finance-critical payment.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4508','Probe support incident','Run non-destructive diagnostics on a Digital Footprint support incident.','digital-footprint','dfp-diag',NULL,'Run diagnostics probe','diagnostics','green','low','production','under_review','AI Agent','Group AI Operations',1,0,'Routine diagnostics requested to investigate a reported slow-down.','Non-destructive read-only probe; approval requested for visibility.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4516','Change authentication flow','Update the authentication flow for the Digital Footprint platform.','digital-footprint','core-security',NULL,'Change authentication flow','security','red','critical','production','under_review','AI Agent','Group AI Operations',2,1,'New sign-in method requested; requires security review.','Identity-critical change; dual approval and security review required.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4505','Care compliance override','Apply a one-off compliance override for a GuardianHub care case.','guardianhub','gh-comp',NULL,'Apply compliance override','compliance','amber','high','production','more_info_required','AI Agent','Group AI Operations',1,0,'Exceptional case requires a compliance override.','Request returned to requester for additional supporting evidence.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4506','Licence renewal flag','Verify a flagged guard licence renewal for QuickGuard.','quickguard','qg-comp',NULL,'Verify licence renewal flag','compliance','amber','high','production','verification_required','AI Agent','Group AI Operations',1,1,'Approved action requires post-execution verification.','Action approved; verification step now required before closure.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4507','Release validation sign-off','Sign off on the latest Forge release validation results.','the-forge','tf-test',NULL,'Sign off release validation','uat','amber','medium','production','uat_required','AI Agent','Group AI Operations',1,1,'Approved release now requires UAT completion.','Release approved; UAT cycle required before production.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4409','Resolve GuardianHub support incident','End-to-end support incident: diagnose, recommend, approve, repair and verify.','guardianhub','core-support','RUN-A1000','Resolve support incident','support','amber','medium','production','completed','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'approve','Repair plan reviewed and accepted.','Group AI Operations',NULL,''),
  ('APR-4491','Payroll reconciliation','Reconcile the latest QuickGuard payroll batch.','quickguard','qg-payment','RUN-3D77A','Reconcile payroll batch','billing','amber','high','production','completed','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'approve','Payroll figures verified.','QuickGuard Finance',NULL,''),
  ('APR-4510','Rent arrears recovery','Initiate rent arrears recovery for a LetHub tenancy.','lethub','lh-rent',NULL,'Initiate rent arrears recovery','billing','amber','medium','production','approved','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'approve','Arrears recovery approved.','LetHub Finance',NULL,''),
  ('APR-4514','Retry failed workflow','Retry a known-safe workflow that failed on a transient error.',NULL,'core-repair',NULL,'Retry failed workflow','repair','amber','medium','production','executing','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'approve','Safe retry approved.','Group AI Operations',NULL,''),
  ('APR-4502','Issue partial refund','Issue a partial refund for a Wedora booking adjustment.','wedora','wd-budget',NULL,'Issue partial refund','billing','red','high','production','approved_with_conditions','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'approve_with_conditions','Approved pending final invoice verification.','Wedora Finance','Verify final invoice total before processing.',''),
  ('APR-4503','Drop unused database index','Drop an unused index to reclaim storage on The Forge database.','the-forge','tf-database',NULL,'Drop database index','deployment','red','medium','production','rejected','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'reject','Index still in use by a reporting query; rejection to avoid regressions.','Group AI Operations',NULL,''),
  ('APR-4512','Refund guard overpayment','Refund a guard overpayment on QuickGuard payroll.','quickguard','qg-payment',NULL,'Refund guard overpayment','billing','red','high','production','rejected','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'reject','Amount mismatch; require corrected figures before re-submission.','QuickGuard Finance',NULL,''),
  ('APR-4518','Launch rewards payout','Process a launch rewards payout for QuickGuard.','quickguard','qg-launch',NULL,'Process launch rewards payout','billing','amber','medium','production','cancelled','AI Agent','Group AI Operations',1,0,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'cancel','Campaign ended before payout approval.','QuickGuard Ops',NULL,''),
  ('APR-4504','Bulk tenancy reference checks','Bulk-update tenancy reference checks for LetHub.','lethub','lh-comp',NULL,'Bulk-update tenancy reference checks','compliance','amber','medium','production','expired','AI Agent','Group AI Operations',1,0,'Nightly reference check batch required sign-off.','Request expired before a decision was recorded.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,''),
  ('APR-4515','Deploy feature page','Deploy a generated feature page for a Forge build.','the-forge','tf-code','RUN-8D22F','Deploy feature page','deployment','red','high','production','failed','AI Agent','Group AI Operations',1,1,'Required to resolve an active operational issue.','Evidence supports the action; human sign-off is required before execution.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,'approve','Deploy approved.','Group AI Operations',NULL,''),
  ('APR-4519','Generate tenancy agreement','Generate a tenancy agreement for a LetHub renewal.','lethub','lh-document',NULL,'Generate tenancy agreement','manual','green','low','production','draft','AI Agent','Group AI Operations',1,0,'Draft request saved locally; not yet submitted.','Draft approval — persistence and execution will be connected in a later phase.','Requested change applied and verified.','Contained, reversible impact.',true,'Restore from pre-change snapshot.',true,false,true,NULL,NULL,NULL,NULL,'Draft approval request saved locally.')
) AS v(approval_key, title, description, site_key, agent_key, run_key, requested_action, request_type, risk_class, severity, environment, status, requested_by, required_team, minimum_approvers, current_approval_count, business_justification, reasoning_summary, expected_result, potential_impact, rollback_available, rollback_summary, verification_required, uat_required, audit_required, decision, decision_reason, decision_actor, condition_text, notes)
LEFT JOIN ai_sites s ON s.site_key = v.site_key
LEFT JOIN ai_operations_agents a ON a.agent_key = v.agent_key
LEFT JOIN ai_runs r ON r.run_key = v.run_key
ON CONFLICT (approval_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  site_id = EXCLUDED.site_id,
  agent_id = EXCLUDED.agent_id,
  run_id = EXCLUDED.run_id,
  requested_action = EXCLUDED.requested_action,
  request_type = EXCLUDED.request_type,
  risk_class = EXCLUDED.risk_class,
  severity = EXCLUDED.severity,
  environment = EXCLUDED.environment,
  status = EXCLUDED.status,
  requested_by = EXCLUDED.requested_by,
  required_team = EXCLUDED.required_team,
  minimum_approvers = EXCLUDED.minimum_approvers,
  current_approval_count = EXCLUDED.current_approval_count,
  business_justification = EXCLUDED.business_justification,
  reasoning_summary = EXCLUDED.reasoning_summary,
  expected_result = EXCLUDED.expected_result,
  potential_impact = EXCLUDED.potential_impact,
  rollback_available = EXCLUDED.rollback_available,
  rollback_summary = EXCLUDED.rollback_summary,
  verification_required = EXCLUDED.verification_required,
  uat_required = EXCLUDED.uat_required,
  audit_required = EXCLUDED.audit_required,
  decision = EXCLUDED.decision,
  decision_reason = EXCLUDED.decision_reason,
  decision_actor = EXCLUDED.decision_actor,
  conditions = EXCLUDED.conditions,
  notes = EXCLUDED.notes,
  updated_at = now();

-- --- Run ↔ Approval linkage (deferred from Prompt 04) -------------------------
-- Populate ai_runs.approval_id from the matching approval (non-destructive).
UPDATE ai_runs r
SET approval_id = a.id
FROM ai_approvals a
WHERE a.run_id = r.id
  AND r.approval_id IS NULL;

-- --- Deferred FK (added only after approvals exist and linkage is verified) ---
-- ON DELETE SET NULL is deliberately non-destructive: deleting an approval must
-- never cascade-delete a run (operational history is preserved).
ALTER TABLE ai_runs
ADD CONSTRAINT ai_runs_approval_id_fkey
FOREIGN KEY (approval_id) REFERENCES ai_approvals(id) ON DELETE SET NULL;
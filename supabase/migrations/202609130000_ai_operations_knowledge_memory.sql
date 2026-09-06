-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 10: KNOWLEDGE + MEMORY LIVE PERSISTENCE
--
-- Creates the live Knowledge & Memory foundation:
--   * ai_knowledge_sources    — approved knowledge source catalogue (metadata
--                               only — no document bodies, no credentials).
--   * ai_knowledge_permissions — agent → knowledge access mapping (append-
--                               oriented, revoked via is_active=false).
--   * ai_incident_memory      — approved incident / known-issue memory
--                               (sanitised summaries only — no raw logs).
--
-- Safety:
--   * RLS enabled on all three tables, reusing public.internal_role().
--   * SELECT for authenticated staff; INSERT/UPDATE for owner/admin;
--     no DELETE policy (no destructive delete UI exists).
--   * site_id → ai_sites ON DELETE SET NULL.
--   * knowledge_source_id/agent_id FKs ON DELETE RESTRICT.
--   * source_reference / location_reference are safe labels only — never
--     values. No secrets, no embeddings, no raw private incident logs.
--   * No ingestion / indexing / embedding / retrieval / agent execution is
--     performed — registry + planning metadata only.
--
-- This file is idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT).
-- The unrelated `ai_models` table is NOT touched, and no unrelated
-- document/search/knowledge tables are overwritten.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_knowledge_sources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  source_type text,
  knowledge_type text,
  scope text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  environment text,
  status text,
  health text,
  classification text,
  sensitivity text,
  source_reference text,
  location_reference text,
  owner_team text,
  authority_level text,
  trust_level text,
  ingestion_state text,
  indexing_state text,
  embedding_state text,
  embedding_model_reference text,
  last_ingested_at date,
  last_verified_at date,
  review_required boolean NOT NULL DEFAULT false,
  retention_policy text,
  audit_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_sources_scope_check CHECK (scope IN ('group','site','agent','team')),
  CONSTRAINT ai_knowledge_sources_env_check CHECK (environment IN ('production','staging','sandbox','development')),
  CONSTRAINT ai_knowledge_sources_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_type ON public.ai_knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_ktype ON public.ai_knowledge_sources(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_site ON public.ai_knowledge_sources(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_env ON public.ai_knowledge_sources(environment);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_status ON public.ai_knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_classification ON public.ai_knowledge_sources(classification);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_sensitivity ON public.ai_knowledge_sources(sensitivity);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_ingestion ON public.ai_knowledge_sources(ingestion_state);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_active ON public.ai_knowledge_sources(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_knowledge_sources;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_knowledge_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_knowledge_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_sources_select ON public.ai_knowledge_sources;
CREATE POLICY ai_knowledge_sources_select ON public.ai_knowledge_sources
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_knowledge_sources_insert ON public.ai_knowledge_sources;
CREATE POLICY ai_knowledge_sources_insert ON public.ai_knowledge_sources
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_knowledge_sources_update ON public.ai_knowledge_sources;
CREATE POLICY ai_knowledge_sources_update ON public.ai_knowledge_sources
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_knowledge_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_knowledge_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_source_id uuid NOT NULL REFERENCES public.ai_knowledge_sources(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.ai_operations_agents(id) ON DELETE RESTRICT,
  access_level text,
  purpose text,
  environment text,
  can_read boolean NOT NULL DEFAULT true,
  can_retrieve boolean NOT NULL DEFAULT true,
  can_reference boolean NOT NULL DEFAULT false,
  can_update_metadata boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT false,
  risk_limit text,
  granted_by text,
  granted_at timestamptz,
  reviewed_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_permissions_unique UNIQUE (knowledge_source_id, agent_id),
  CONSTRAINT ai_knowledge_permissions_env_check CHECK (environment IN ('production','staging','sandbox','development')),
  CONSTRAINT ai_knowledge_permissions_risk_check CHECK (risk_limit IN ('low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_permissions_source ON public.ai_knowledge_permissions(knowledge_source_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_permissions_agent ON public.ai_knowledge_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_permissions_level ON public.ai_knowledge_permissions(access_level);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_permissions_env ON public.ai_knowledge_permissions(environment);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_permissions_active ON public.ai_knowledge_permissions(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_knowledge_permissions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_knowledge_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_knowledge_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_permissions_select ON public.ai_knowledge_permissions;
CREATE POLICY ai_knowledge_permissions_select ON public.ai_knowledge_permissions
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_knowledge_permissions_insert ON public.ai_knowledge_permissions;
CREATE POLICY ai_knowledge_permissions_insert ON public.ai_knowledge_permissions
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_knowledge_permissions_update ON public.ai_knowledge_permissions;
CREATE POLICY ai_knowledge_permissions_update ON public.ai_knowledge_permissions
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_incident_memory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_incident_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_key text NOT NULL UNIQUE,
  title text,
  summary text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  related_knowledge_source_id uuid REFERENCES public.ai_knowledge_sources(id) ON DELETE SET NULL,
  incident_type text,
  symptoms jsonb,
  known_cause text,
  resolution_summary text,
  prevention_summary text,
  severity text,
  environment text,
  confidence text,
  verification_state text,
  status text,
  first_seen_at date,
  last_seen_at date,
  recurrence_count integer NOT NULL DEFAULT 0,
  approved_for_reuse boolean NOT NULL DEFAULT false,
  owner_team text,
  review_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_incident_memory_env_check CHECK (environment IN ('production','staging','sandbox','development')),
  CONSTRAINT ai_incident_memory_severity_check CHECK (severity IN ('low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS idx_ai_incident_memory_site ON public.ai_incident_memory(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_incident_memory_type ON public.ai_incident_memory(incident_type);
CREATE INDEX IF NOT EXISTS idx_ai_incident_memory_severity ON public.ai_incident_memory(severity);
CREATE INDEX IF NOT EXISTS idx_ai_incident_memory_status ON public.ai_incident_memory(status);
CREATE INDEX IF NOT EXISTS idx_ai_incident_memory_reuse ON public.ai_incident_memory(approved_for_reuse);
CREATE INDEX IF NOT EXISTS idx_ai_incident_memory_active ON public.ai_incident_memory(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_incident_memory;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_incident_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_incident_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_incident_memory_select ON public.ai_incident_memory;
CREATE POLICY ai_incident_memory_select ON public.ai_incident_memory
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_incident_memory_insert ON public.ai_incident_memory;
CREATE POLICY ai_incident_memory_insert ON public.ai_incident_memory
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_incident_memory_update ON public.ai_incident_memory;
CREATE POLICY ai_incident_memory_update ON public.ai_incident_memory
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- Initial knowledge source migration (31 demo sources). Idempotent. No secrets.
-- source_type is the frontend KnowledgeSourceType; knowledge_type is the
-- broader §3 category. site_id resolved from site_key. No document bodies.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_knowledge_sources (
  knowledge_key, name, description, source_type, scope, site_id, environment, status,
  classification, sensitivity, source_reference, owner_team, review_required, is_active,
  notes, knowledge_type, health, authority_level, trust_level,
  ingestion_state, indexing_state, embedding_state, embedding_model_reference,
  last_ingested_at, last_verified_at, audit_required, retention_policy
)
SELECT
  v.knowledge_key, v.name, v.description, v.source_type, v.scope, s.id AS site_id,
  'production', v.status, v.classification, v.sensitivity, v.source_reference, v.owner_team,
  v.review_required, v.is_active, v.notes,
  CASE v.source_type
    WHEN 'documentation' THEN 'Documentation'
    WHEN 'sop' THEN 'Procedure'
    WHEN 'policy' THEN 'Policy'
    WHEN 'faq' THEN 'Support'
    WHEN 'support_knowledge' THEN 'Support'
    WHEN 'uat' THEN 'Compliance'
    WHEN 'technical' THEN 'Technical'
    WHEN 'product' THEN 'Product'
    WHEN 'incident_history' THEN 'Incident'
    WHEN 'troubleshooting' THEN 'Technical'
    WHEN 'business_rules' THEN 'Policy'
    WHEN 'training' THEN 'Documentation'
    WHEN 'website_content' THEN 'Product'
    WHEN 'database_reference' THEN 'Technical'
    WHEN 'api_documentation' THEN 'Technical'
    WHEN 'agent_instructions' THEN 'Agent'
    ELSE 'Other'
  END AS knowledge_type,
  CASE v.status WHEN 'active' THEN 'healthy' WHEN 'restricted' THEN 'warning' WHEN 'review_required' THEN 'warning' WHEN 'stale' THEN 'warning' ELSE 'unknown' END AS health,
  CASE WHEN v.trusted THEN 'trusted' ELSE 'standard' END AS authority_level,
  CASE WHEN v.trusted THEN 'high' ELSE 'standard' END AS trust_level,
  CASE WHEN v.indexed THEN 'ingested' ELSE 'not_ingested' END AS ingestion_state,
  CASE WHEN v.indexed THEN 'indexed' WHEN v.restricted_index THEN 'restricted' ELSE 'not_indexed' END AS indexing_state,
  CASE WHEN v.indexed THEN 'embedded' ELSE 'not_embedded' END AS embedding_state,
  CASE WHEN v.indexed THEN 'MOD-EMBED' ELSE NULL END AS embedding_model_reference,
  CASE WHEN v.indexed THEN DATE '2026-08-24' ELSE NULL END AS last_ingested_at,
  v.last_reviewed::date AS last_verified_at,
  v.audit_required,
  CASE WHEN v.classification IN ('confidential','restricted') THEN 'extended' ELSE 'standard' END AS retention_policy
FROM (VALUES
  ('KNOW-GOV','DFP AI Operations Governance','Group-wide governance framework defining how AI agents are supervised, scoped and audited across every Digital Footprint platform.','policy','group',NULL,'active','internal','Medium','kb/group/governance','DFP Core Team',true,true,'Single source of truth for group AI governance. Red-class actions always remain human-approved.',true,true,false,'2026-08-20',true),
  ('KNOW-ESCALATION','Incident Escalation Procedure','Standard operating procedure for escalating incidents, alerts and anomalies to the correct human owner across the group.','sop','group',NULL,'active','internal','Medium','kb/group/incident-escalation','Group Incident Team',true,true,NULL,true,true,false,'2026-08-18',true),
  ('KNOW-TRIAGE','Support Triage SOP','Standard procedure for classifying and routing inbound support enquiries to the correct site, queue and agent.','sop','group',NULL,'active','internal','Medium','kb/group/support-triage','DFP Support',true,true,NULL,true,true,false,'2026-08-15',true),
  ('KNOW-APPROVAL','Agent Approval Rules','Defines which agent actions require human approval, the approval team, and the minimum approver count per risk class.','policy','group',NULL,'active','internal','High','kb/group/approval-rules','DFP Core Team',true,true,NULL,true,true,false,'2026-08-12',true),
  ('KNOW-UAT-STD','UAT Standards','Group-wide user-acceptance testing standards covering test plans, sign-off and evidence requirements for releases.','uat','group',NULL,'review_required','internal','Medium','kb/group/uat-standards','DFP Core Team',true,true,'Review due soon - flagged for the UAT team.',true,true,false,'2026-05-10',true),
  ('KNOW-SECURITY-RULES','Security Operating Rules','Group-wide security operating rules governing access control, secrets handling, and least-privilege enforcement.','policy','group',NULL,'restricted','restricted','Critical','kb/group/security-rules','DFP Security',true,true,'Restricted classification. Retrieval requires approval; never cited externally.',true,false,true,'2026-08-22',true),
  ('KNOW-DFP-ONBOARD','Client Onboarding Process','Step-by-step onboarding workflow for new Digital Footprint clients, from kickoff to first platform delivery.','sop','site','digital-footprint','active','confidential','High','kb/dfp/client-onboarding','DFP Delivery',true,true,NULL,true,true,false,'2026-08-14',true),
  ('KNOW-DFP-DIAG','Digital Footprint Diagnostics Guide','Technical guide to running diagnostics on the Digital Footprint platform and interpreting the results.','technical','site','digital-footprint','active','internal','Medium','kb/dfp/diagnostics-guide','DFP Core Team',true,true,NULL,true,true,false,'2026-08-16',true),
  ('KNOW-DFP-SUPPORT','Website Support Knowledge','Curated support knowledge for the Digital Footprint client portal and website support team.','support_knowledge','site','digital-footprint','active','internal','Low','kb/dfp/website-support','DFP Support',true,true,NULL,true,true,false,'2026-08-10',true),
  ('KNOW-QG-MATCH','Guard Matching Rules','Business rules governing how guards are matched to shifts by availability, qualifications and location.','business_rules','site','quickguard','active','internal','Medium','kb/quickguard/matching-rules','QuickGuard Ops',true,true,NULL,true,true,false,'2026-08-19',true),
  ('KNOW-QG-SHIFT','Shift Management Procedure','Procedure for rebalancing rota coverage and managing shift allocation across QuickGuard.','sop','site','quickguard','active','internal','Medium','kb/quickguard/shift-management','QuickGuard Ops',true,true,NULL,true,true,false,'2026-08-17',true),
  ('KNOW-QG-COMP','Guard Compliance Guide','Guide to guard licences, training and compliance requirements including renewal verification.','documentation','site','quickguard','active','confidential','High','kb/quickguard/compliance-guide','QuickGuard Ops',true,true,NULL,true,true,false,'2026-08-11',true),
  ('KNOW-QG-FAQ','Employer Support FAQ','Frequently asked questions for QuickGuard employers covering account, billing and service enquiries.','faq','site','quickguard','active','public','Low','kb/quickguard/employer-faq','QuickGuard Support',true,true,NULL,true,true,false,'2026-08-09',true),
  ('KNOW-QG-TRAINING','Guard Training Manual (Legacy)','Older guard training manual retained for reference while the updated version is finalised.','training','site','quickguard','stale','internal','Medium','kb/quickguard/training-legacy','QuickGuard Ops',true,true,'Superseded by the new training programme. Flagged stale.',true,false,false,'2026-02-20',true),
  ('KNOW-GH-CHECKCALL','Check-Call Procedure','Procedure for coordinating welfare check-calls and recording outcomes for care operations.','sop','site','guardianhub','active','confidential','High','kb/guardianhub/check-call','GuardianHub Ops',true,true,NULL,true,true,false,'2026-08-13',true),
  ('KNOW-GH-WELFARE','Welfare Escalation SOP','Procedure for monitoring welfare signals and escalating concerning patterns to the correct human owner.','sop','site','guardianhub','active','confidential','Critical','kb/guardianhub/welfare-escalation','GuardianHub Ops',true,true,NULL,true,true,false,'2026-08-21',true),
  ('KNOW-GH-ROTA','Rota Rules','Business rules governing weekly rota optimisation and shift coverage for care teams.','business_rules','site','guardianhub','active','internal','Medium','kb/guardianhub/rota-rules','GuardianHub Ops',true,true,NULL,true,true,false,'2026-08-15',true),
  ('KNOW-GH-INCIDENT','Incident Management Guide','Guide to capturing, triaging and escalating care and welfare incidents.','documentation','site','guardianhub','active','confidential','High','kb/guardianhub/incident-management','GuardianHub Ops',true,true,NULL,true,true,false,'2026-08-18',true),
  ('KNOW-LH-TENANCY','Tenancy Workflow','End-to-end tenancy workflow covering renewals, changes and agreement processing.','sop','site','lethub','active','internal','Medium','kb/lethub/tenancy-workflow','LetHub Ops',true,true,NULL,true,true,false,'2026-08-12',true),
  ('KNOW-LH-MAINT','Maintenance Process','Process for triaging and coordinating maintenance and repair requests across managed properties.','sop','site','lethub','active','internal','Medium','kb/lethub/maintenance-process','LetHub Ops',true,true,NULL,true,true,false,'2026-08-10',true),
  ('KNOW-LH-COMP','Property Compliance Guide','Guide to tenancy compliance, referencing and property safety checks.','documentation','site','lethub','active','confidential','High','kb/lethub/property-compliance','LetHub Ops',true,true,NULL,true,true,false,'2026-08-16',true),
  ('KNOW-WD-PLAN','Wedding Planning Workflow','Workflow for building planning timelines and coordinating wedding logistics.','sop','site','wedora','active','internal','Medium','kb/wedora/planning-workflow','Vowora Ops',true,true,NULL,true,true,false,'2026-08-11',true),
  ('KNOW-WD-RSVP','RSVP Rules','Business rules governing RSVP responses, attendance tracking and guest list reconciliation.','business_rules','site','wedora','active','internal','Medium','kb/wedora/rsvp-rules','Vowora Ops',true,true,NULL,true,true,false,'2026-08-14',true),
  ('KNOW-WD-SUPPLIER','Supplier Management Guide','Guide to coordinating wedding suppliers, chasing quotes and managing contracts.','documentation','site','wedora','active','internal','Medium','kb/wedora/supplier-management','Vowora Ops',true,true,NULL,true,true,false,'2026-08-09',true),
  ('KNOW-TF-PROMPT','Prompt Standards','Standards for prompt engineering and version control across The Forge build pipeline.','policy','site','the-forge','active','internal','Medium','kb/forge/prompt-standards','Forge Team',true,true,NULL,true,true,false,'2026-08-20',true),
  ('KNOW-TF-SANDBOX','Sandbox Build Rules','Technical rules for sandboxed build execution, testing and isolation within The Forge.','technical','site','the-forge','active','internal','Medium','kb/forge/sandbox-rules','Forge Team',true,true,NULL,true,true,false,'2026-08-18',true),
  ('KNOW-TF-UAT','UAT Guide (The Forge)','The Forge-specific UAT guide for release validation and sign-off on generated sites.','uat','site','the-forge','active','internal','Medium','kb/forge/uat-guide','Forge Team',true,true,NULL,true,true,false,'2026-08-15',true),
  ('KNOW-TF-PUBLISH','Publishing Procedure','Procedure for coordinating publishing and deployment of generated sites through release gates.','sop','site','the-forge','active','internal','High','kb/forge/publishing-procedure','Forge Team',true,true,NULL,true,true,false,'2026-08-17',true),
  ('KNOW-INC-CHECKCALL','Known Issue: Check-Call Latency','Known issue record documenting elevated check-call latency on GuardianHub and its verified resolution.','incident_history','site','guardianhub','active','confidential','High','kb/guardianhub/known-issues/check-call-latency','GuardianHub Ops',true,true,'Used by Diagnostics and Support agents to identify repeated problems.',true,true,false,'2026-08-21',true),
  ('KNOW-INC-PAYROLL','Previous Incident: Payroll Reconciliation','Previous incident record documenting a QuickGuard payroll reconciliation mismatch and its resolution.','incident_history','site','quickguard','active','confidential','High','kb/quickguard/incidents/payroll-reconciliation','QuickGuard Finance',true,true,'Finance-critical incident. Human approval required for any remediation.',true,true,false,'2026-08-19',true),
  ('KNOW-LEGACY-FAQ','Legacy Support FAQ (Archived)','Retired group-wide support FAQ retained for audit reference only.','faq','group',NULL,'archived','internal','Low','kb/group/legacy-support-faq','DFP Support',false,false,'Superseded by current site-specific support knowledge. Archived.',false,false,false,'2026-01-15',false)
) AS v(knowledge_key, name, description, source_type, scope, site_key, status, classification, sensitivity, source_reference, owner_team, review_required, is_active, notes, trusted, indexed, restricted_index, last_reviewed, audit_required)
LEFT JOIN public.ai_sites s ON s.site_key = v.site_key
ON CONFLICT (knowledge_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  knowledge_type = EXCLUDED.knowledge_type,
  scope = EXCLUDED.scope,
  site_id = EXCLUDED.site_id,
  environment = EXCLUDED.environment,
  status = EXCLUDED.status,
  classification = EXCLUDED.classification,
  sensitivity = EXCLUDED.sensitivity,
  source_reference = EXCLUDED.source_reference,
  owner_team = EXCLUDED.owner_team,
  review_required = EXCLUDED.review_required,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  health = EXCLUDED.health,
  authority_level = EXCLUDED.authority_level,
  trust_level = EXCLUDED.trust_level,
  ingestion_state = EXCLUDED.ingestion_state,
  indexing_state = EXCLUDED.indexing_state,
  embedding_state = EXCLUDED.embedding_state,
  embedding_model_reference = EXCLUDED.embedding_model_reference,
  last_ingested_at = EXCLUDED.last_ingested_at,
  last_verified_at = EXCLUDED.last_verified_at,
  audit_required = EXCLUDED.audit_required,
  retention_policy = EXCLUDED.retention_policy;

-- ---------------------------------------------------------------------------
-- Initial incident memory migration (2 demo records). Idempotent. Sanitised
-- summaries only — no raw private logs or customer content.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_incident_memory (
  memory_key, title, summary, site_id, related_knowledge_source_id, incident_type,
  symptoms, known_cause, resolution_summary, prevention_summary, severity, environment,
  confidence, verification_state, status, first_seen_at, last_seen_at, recurrence_count,
  approved_for_reuse, owner_team, review_required, is_active
) VALUES
  ('INC-GH-0042','Known Issue: Check-Call Latency','Elevated check-call latency affecting welfare check-call completions on GuardianHub.',
   (SELECT id FROM public.ai_sites WHERE site_key='guardianhub'),
   (SELECT id FROM public.ai_knowledge_sources WHERE knowledge_key='KNOW-INC-CHECKCALL'),
   'known_issue',
   '["Elevated check-call latency during peak rota runs"]'::jsonb,
   'Supabase query contention on the check-call table during peak rota runs.',
   'Added a targeted index and rebalanced the diagnostics query window.',
   'Targeted index added to prevent recurrence; diagnostics query window rebalanced.',
   'high','production','high','verified','active',
   DATE '2026-08-20', DATE '2026-08-20', 1, true, 'GuardianHub Ops', true, true),
  ('INC-QG-0031','Previous Incident: Payroll Reconciliation','Payroll reconciliation mismatch between timesheets and payment batch on QuickGuard.',
   (SELECT id FROM public.ai_sites WHERE site_key='quickguard'),
   (SELECT id FROM public.ai_knowledge_sources WHERE knowledge_key='KNOW-INC-PAYROLL'),
   'known_issue',
   '["Payroll reconciliation mismatch between timesheets and payment batch"]'::jsonb,
   'A late timesheet batch was excluded from the reconciliation window.',
   'Re-ran reconciliation including the late batch and added a validation guard.',
   'Validation guard added to include late timesheet batches.',
   'high','production','high','verified','active',
   DATE '2026-08-18', DATE '2026-08-18', 1, true, 'QuickGuard Finance', true, true)
ON CONFLICT (memory_key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  site_id = EXCLUDED.site_id,
  related_knowledge_source_id = EXCLUDED.related_knowledge_source_id,
  incident_type = EXCLUDED.incident_type,
  symptoms = EXCLUDED.symptoms,
  known_cause = EXCLUDED.known_cause,
  resolution_summary = EXCLUDED.resolution_summary,
  prevention_summary = EXCLUDED.prevention_summary,
  severity = EXCLUDED.severity,
  environment = EXCLUDED.environment,
  confidence = EXCLUDED.confidence,
  verification_state = EXCLUDED.verification_state,
  status = EXCLUDED.status,
  first_seen_at = EXCLUDED.first_seen_at,
  last_seen_at = EXCLUDED.last_seen_at,
  recurrence_count = EXCLUDED.recurrence_count,
  approved_for_reuse = EXCLUDED.approved_for_reuse,
  owner_team = EXCLUDED.owner_team,
  review_required = EXCLUDED.review_required,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- Agent → knowledge permission migration.
-- Maps the demo registry's declared agent access (agentAccess) into live
-- ai_knowledge_permissions rows where both agent_key and knowledge_key
-- resolve. Idempotent via ON CONFLICT (knowledge_source_id, agent_id). No
-- invented mappings — only declared demo access is migrated.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_knowledge_permissions (
  knowledge_source_id, agent_id, access_level, purpose, environment,
  can_read, can_retrieve, can_reference, can_update_metadata, approval_required,
  risk_limit, granted_by, granted_at, is_active
)
SELECT
  k.id, a.id,
  CASE v.access_state WHEN 'allowed' THEN 'read' ELSE 'restricted' END AS access_level,
  v.purpose, 'production', true, v.retrieval_allowed, v.retrieval_allowed,
  v.modification_allowed, v.approval_required,
  CASE k.sensitivity WHEN 'Critical' THEN 'high' WHEN 'High' THEN 'medium' ELSE 'low' END,
  'migration', now(), true
FROM (VALUES
  ('KNOW-GOV','core-orchestrator','allowed','Routing and governance reference',true,false,false),
  ('KNOW-GOV','core-support','allowed','Support answers',true,false,false),
  ('KNOW-GOV','core-knowledge','allowed','Curation and indexing',true,true,true),
  ('KNOW-GOV','core-diagnostics','allowed','Diagnostics reference',true,false,false),
  ('KNOW-ESCALATION','core-orchestrator','allowed','Routing and governance reference',true,false,false),
  ('KNOW-ESCALATION','core-support','allowed','Support answers',true,false,false),
  ('KNOW-ESCALATION','core-knowledge','allowed','Curation and indexing',true,true,true),
  ('KNOW-ESCALATION','core-diagnostics','allowed','Diagnostics reference',true,false,false),
  ('KNOW-TRIAGE','core-orchestrator','allowed','Routing and governance reference',true,false,false),
  ('KNOW-TRIAGE','core-support','allowed','Support answers',true,false,false),
  ('KNOW-TRIAGE','core-knowledge','allowed','Curation and indexing',true,true,true),
  ('KNOW-TRIAGE','core-diagnostics','allowed','Diagnostics reference',true,false,false),
  ('KNOW-APPROVAL','core-orchestrator','allowed','Routing and governance reference',true,false,false),
  ('KNOW-APPROVAL','core-support','allowed','Support answers',true,false,false),
  ('KNOW-APPROVAL','core-knowledge','allowed','Curation and indexing',true,true,true),
  ('KNOW-APPROVAL','core-diagnostics','allowed','Diagnostics reference',true,false,false),
  ('KNOW-UAT-STD','core-orchestrator','allowed','Routing and governance reference',true,false,false),
  ('KNOW-UAT-STD','core-support','allowed','Support answers',true,false,false),
  ('KNOW-UAT-STD','core-knowledge','allowed','Curation and indexing',true,true,true),
  ('KNOW-UAT-STD','core-diagnostics','allowed','Diagnostics reference',true,false,false),
  ('KNOW-SECURITY-RULES','core-security','approval_required','Security enforcement',true,false,true),
  ('KNOW-SECURITY-RULES','core-orchestrator','restricted','Governance reference',true,false,true),
  ('KNOW-DFP-ONBOARD','dfp-diag','allowed','Diagnostics guidance',true,false,false),
  ('KNOW-DFP-ONBOARD','dfp-onboard','allowed','Onboarding reference',true,false,false),
  ('KNOW-DFP-ONBOARD','core-support','allowed','Support reference',true,false,false),
  ('KNOW-DFP-DIAG','dfp-diag','allowed','Diagnostics guidance',true,false,false),
  ('KNOW-DFP-DIAG','dfp-onboard','allowed','Onboarding reference',true,false,false),
  ('KNOW-DFP-DIAG','core-support','allowed','Support reference',true,false,false),
  ('KNOW-DFP-SUPPORT','dfp-diag','allowed','Diagnostics guidance',true,false,false),
  ('KNOW-DFP-SUPPORT','dfp-onboard','allowed','Onboarding reference',true,false,false),
  ('KNOW-DFP-SUPPORT','core-support','allowed','Support reference',true,false,false),
  ('KNOW-QG-MATCH','qg-match','allowed','Matching rules',true,false,false),
  ('KNOW-QG-MATCH','qg-shift','allowed','Shift procedure',true,false,false),
  ('KNOW-QG-MATCH','qg-comp','allowed','Compliance checks',true,false,false),
  ('KNOW-QG-MATCH','qg-employer-support','allowed','Employer FAQ',true,false,false),
  ('KNOW-QG-SHIFT','qg-match','allowed','Matching rules',true,false,false),
  ('KNOW-QG-SHIFT','qg-shift','allowed','Shift procedure',true,false,false),
  ('KNOW-QG-SHIFT','qg-comp','allowed','Compliance checks',true,false,false),
  ('KNOW-QG-SHIFT','qg-employer-support','allowed','Employer FAQ',true,false,false),
  ('KNOW-QG-COMP','qg-match','allowed','Matching rules',true,false,false),
  ('KNOW-QG-COMP','qg-shift','allowed','Shift procedure',true,false,false),
  ('KNOW-QG-COMP','qg-comp','allowed','Compliance checks',true,false,false),
  ('KNOW-QG-COMP','qg-employer-support','allowed','Employer FAQ',true,false,false),
  ('KNOW-QG-FAQ','qg-match','allowed','Matching rules',true,false,false),
  ('KNOW-QG-FAQ','qg-shift','allowed','Shift procedure',true,false,false),
  ('KNOW-QG-FAQ','qg-comp','allowed','Compliance checks',true,false,false),
  ('KNOW-QG-FAQ','qg-employer-support','allowed','Employer FAQ',true,false,false),
  ('KNOW-QG-TRAINING','qg-comp','restricted','Legacy reference',true,false,false),
  ('KNOW-GH-CHECKCALL','gh-checkcall','allowed','Check-call procedure',true,false,false),
  ('KNOW-GH-CHECKCALL','gh-welfare','allowed','Welfare escalation',true,false,false),
  ('KNOW-GH-CHECKCALL','gh-rota','allowed','Rota rules',true,false,false),
  ('KNOW-GH-CHECKCALL','gh-incident','allowed','Incident management',true,false,true),
  ('KNOW-GH-WELFARE','gh-checkcall','allowed','Check-call procedure',true,false,false),
  ('KNOW-GH-WELFARE','gh-welfare','allowed','Welfare escalation',true,false,false),
  ('KNOW-GH-WELFARE','gh-rota','allowed','Rota rules',true,false,false),
  ('KNOW-GH-WELFARE','gh-incident','allowed','Incident management',true,false,true),
  ('KNOW-GH-ROTA','gh-checkcall','allowed','Check-call procedure',true,false,false),
  ('KNOW-GH-ROTA','gh-welfare','allowed','Welfare escalation',true,false,false),
  ('KNOW-GH-ROTA','gh-rota','allowed','Rota rules',true,false,false),
  ('KNOW-GH-ROTA','gh-incident','allowed','Incident management',true,false,true),
  ('KNOW-GH-INCIDENT','gh-checkcall','allowed','Check-call procedure',true,false,false),
  ('KNOW-GH-INCIDENT','gh-welfare','allowed','Welfare escalation',true,false,false),
  ('KNOW-GH-INCIDENT','gh-rota','allowed','Rota rules',true,false,false),
  ('KNOW-GH-INCIDENT','gh-incident','allowed','Incident management',true,false,true),
  ('KNOW-LH-TENANCY','lh-tenancy','allowed','Tenancy workflow',true,false,false),
  ('KNOW-LH-TENANCY','lh-maint','allowed','Maintenance process',true,false,false),
  ('KNOW-LH-TENANCY','lh-comp','allowed','Compliance reference',true,false,false),
  ('KNOW-LH-TENANCY','lh-tenant','allowed','Tenant support',true,false,false),
  ('KNOW-LH-MAINT','lh-tenancy','allowed','Tenancy workflow',true,false,false),
  ('KNOW-LH-MAINT','lh-maint','allowed','Maintenance process',true,false,false),
  ('KNOW-LH-MAINT','lh-comp','allowed','Compliance reference',true,false,false),
  ('KNOW-LH-MAINT','lh-tenant','allowed','Tenant support',true,false,false),
  ('KNOW-LH-COMP','lh-tenancy','allowed','Tenancy workflow',true,false,false),
  ('KNOW-LH-COMP','lh-maint','allowed','Maintenance process',true,false,false),
  ('KNOW-LH-COMP','lh-comp','allowed','Compliance reference',true,false,false),
  ('KNOW-LH-COMP','lh-tenant','allowed','Tenant support',true,false,false),
  ('KNOW-WD-PLAN','wd-planner','allowed','Planning workflow',true,false,false),
  ('KNOW-WD-PLAN','wd-rsvp','allowed','RSVP rules',true,false,false),
  ('KNOW-WD-PLAN','wd-supplier','allowed','Supplier guidance',true,false,false),
  ('KNOW-WD-RSVP','wd-planner','allowed','Planning workflow',true,false,false),
  ('KNOW-WD-RSVP','wd-rsvp','allowed','RSVP rules',true,false,false),
  ('KNOW-WD-RSVP','wd-supplier','allowed','Supplier guidance',true,false,false),
  ('KNOW-WD-SUPPLIER','wd-planner','allowed','Planning workflow',true,false,false),
  ('KNOW-WD-SUPPLIER','wd-rsvp','allowed','RSVP rules',true,false,false),
  ('KNOW-WD-SUPPLIER','wd-supplier','allowed','Supplier guidance',true,false,false),
  ('KNOW-TF-PROMPT','tf-master','allowed','Build orchestration',true,false,false),
  ('KNOW-TF-PROMPT','tf-code','allowed','Code generation',true,false,false),
  ('KNOW-TF-PROMPT','tf-test','allowed','UAT reference',true,false,false),
  ('KNOW-TF-PROMPT','tf-publishing','allowed','Publishing procedure',true,false,true),
  ('KNOW-TF-SANDBOX','tf-master','allowed','Build orchestration',true,false,false),
  ('KNOW-TF-SANDBOX','tf-code','allowed','Code generation',true,false,false),
  ('KNOW-TF-SANDBOX','tf-test','allowed','UAT reference',true,false,false),
  ('KNOW-TF-SANDBOX','tf-publishing','allowed','Publishing procedure',true,false,true),
  ('KNOW-TF-UAT','tf-master','allowed','Build orchestration',true,false,false),
  ('KNOW-TF-UAT','tf-code','allowed','Code generation',true,false,false),
  ('KNOW-TF-UAT','tf-test','allowed','UAT reference',true,false,false),
  ('KNOW-TF-UAT','tf-publishing','allowed','Publishing procedure',true,false,true),
  ('KNOW-TF-PUBLISH','tf-master','allowed','Build orchestration',true,false,false),
  ('KNOW-TF-PUBLISH','tf-code','allowed','Code generation',true,false,false),
  ('KNOW-TF-PUBLISH','tf-test','allowed','UAT reference',true,false,false),
  ('KNOW-TF-PUBLISH','tf-publishing','allowed','Publishing procedure',true,false,true),
  ('KNOW-INC-CHECKCALL','gh-checkcall','allowed','Known issue reference',true,false,false),
  ('KNOW-INC-CHECKCALL','core-diagnostics','allowed','Repeated problem detection',true,false,false),
  ('KNOW-INC-PAYROLL','qg-payment','allowed','Repeated problem detection',true,false,true)
) AS v(knowledge_key, agent_key, access_state, purpose, retrieval_allowed, modification_allowed, approval_required)
JOIN public.ai_knowledge_sources k ON k.knowledge_key = v.knowledge_key
JOIN public.ai_operations_agents a ON a.agent_key = v.agent_key
ON CONFLICT (knowledge_source_id, agent_id) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  purpose = EXCLUDED.purpose,
  environment = EXCLUDED.environment,
  can_read = EXCLUDED.can_read,
  can_retrieve = EXCLUDED.can_retrieve,
  can_reference = EXCLUDED.can_reference,
  can_update_metadata = EXCLUDED.can_update_metadata,
  approval_required = EXCLUDED.approval_required,
  risk_limit = EXCLUDED.risk_limit,
  is_active = EXCLUDED.is_active;
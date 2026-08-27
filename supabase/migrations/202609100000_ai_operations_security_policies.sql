-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 07: SECURITY + POLICY ENGINE LIVE PERSISTENCE
--
-- Creates the live Security & Policy Engine foundation:
--   * ai_security_policies   — governance/security policy registry (mutable).
--   * ai_policy_evaluations  — append-oriented policy evaluation evidence.
--
-- Safety:
--   * RLS enabled on both tables, reusing public.internal_role().
--   * Policies: SELECT for any authenticated internal staff; INSERT/UPDATE for
--     owner/admin; DELETE owner-only (no delete UI exists).
--   * Evaluations: append-oriented — SELECT for staff, INSERT owner/admin only,
--     no UPDATE/DELETE policies.
--   * policy_id → ai_security_policies uses ON DELETE RESTRICT so evaluation
--     history survives policy removal.
--   * Anonymous writes blocked; no service-role keys in browser code.
--   * No policy is enforced against production runtime. The evaluator is a
--     non-executing simulation.
--
-- This file is idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_security_policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_security_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  effect text,
  scope text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  subject_type text,
  subject_reference text,
  action_pattern text,
  risk_level text,
  environment text,
  priority text,
  status text,
  condition_summary text,
  requirements jsonb,
  approval_required boolean NOT NULL DEFAULT false,
  audit_required boolean NOT NULL DEFAULT true,
  owner_team text,
  version text,
  effective_from date,
  expires_at date,
  last_reviewed_at date,
  next_review_at date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_security_policies_effect_check CHECK (effect IN ('allow','allow_with_conditions','require_approval','restrict','deny','audit_only')),
  CONSTRAINT ai_security_policies_status_check CHECK (status IN ('active','draft','review_required','disabled','superseded','expired')),
  CONSTRAINT ai_security_policies_risk_check CHECK (risk_level IN ('green','amber','red')),
  CONSTRAINT ai_security_policies_env_check CHECK (environment IN ('production','staging','sandbox','development')),
  CONSTRAINT ai_security_policies_priority_check CHECK (priority IN ('low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS idx_ai_security_policies_category ON public.ai_security_policies(category);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_effect ON public.ai_security_policies(effect);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_scope ON public.ai_security_policies(scope);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_site_id ON public.ai_security_policies(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_agent_id ON public.ai_security_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_environment ON public.ai_security_policies(environment);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_status ON public.ai_security_policies(status);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_active ON public.ai_security_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_security_policies_priority ON public.ai_security_policies(priority);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_security_policies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_security_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_security_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_security_policies_select ON public.ai_security_policies;
CREATE POLICY ai_security_policies_select ON public.ai_security_policies
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_security_policies_insert ON public.ai_security_policies;
CREATE POLICY ai_security_policies_insert ON public.ai_security_policies
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_security_policies_update ON public.ai_security_policies;
CREATE POLICY ai_security_policies_update ON public.ai_security_policies
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_security_policies_delete ON public.ai_security_policies;
CREATE POLICY ai_security_policies_delete ON public.ai_security_policies
  FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ---------------------------------------------------------------------------
-- ai_policy_evaluations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_policy_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_key text NOT NULL UNIQUE,
  occurred_at timestamptz,
  policy_id uuid REFERENCES public.ai_security_policies(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.ai_approvals(id) ON DELETE SET NULL,
  subject_type text,
  subject_reference text,
  requested_action text,
  requested_risk text,
  environment text,
  result text,
  effect text,
  matched boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT false,
  reason text,
  condition_summary text,
  correlation_id text,
  actor_type text,
  actor_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_occurred ON public.ai_policy_evaluations(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_policy_id ON public.ai_policy_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_site_id ON public.ai_policy_evaluations(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_agent_id ON public.ai_policy_evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_run_id ON public.ai_policy_evaluations(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_result ON public.ai_policy_evaluations(result);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_effect ON public.ai_policy_evaluations(effect);
CREATE INDEX IF NOT EXISTS idx_ai_policy_evaluations_correlation ON public.ai_policy_evaluations(correlation_id);

ALTER TABLE public.ai_policy_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_policy_evaluations_select ON public.ai_policy_evaluations;
CREATE POLICY ai_policy_evaluations_select ON public.ai_policy_evaluations
  FOR SELECT TO public USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_policy_evaluations_insert ON public.ai_policy_evaluations;
CREATE POLICY ai_policy_evaluations_insert ON public.ai_policy_evaluations
  FOR INSERT TO public WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- Initial policy migration (29 demo policies, all group-wide).
-- Idempotent: ON CONFLICT (policy_key) DO UPDATE. No duplicate policy keys.
-- All 29 policies are group-wide (site_id = NULL, agent_id = NULL); their
-- demo target id arrays remain demo supporting metadata.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_security_policies (
  policy_key, name, description, category, effect, scope, site_id, agent_id,
  subject_type, subject_reference, action_pattern, risk_level, environment, priority, status,
  condition_summary, requirements, approval_required, audit_required, owner_team, version,
  effective_from, next_review_at, is_active, notes
) VALUES
('POL-CREDENTIALS','No raw credential access','AI agents may never access raw credentials, API keys, tokens or secrets under any circumstance. Only safe reference identifiers are permitted.','security','deny','group',NULL,NULL,'action','Credential access','Credential access','red','production','critical','active','Credential access is denied unconditionally and logged to the audit trail.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.1','2026-07-01','2026-10-01',true,'Non-negotiable baseline. No exception path exists.'),
('POL-SECRETS-PROMPT','Production secrets excluded from prompts','Production secrets must never be included in model prompts, context or tool input. Secrets are stored externally and hidden from agent memory.','security','deny','group',NULL,NULL,'action','Secret exposure','Secret exposure','red','production','critical','active','Prompt secret exposure is denied and quarantined.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Secrets are injected at runtime via secure reference, never into prompt text.'),
('POL-RLS','RLS modification requires approval','Agents cannot modify row-level security policies without explicit human approval from the security team.','data_access','require_approval','group',NULL,NULL,'action','Modify RLS','Modify RLS','red','production','critical','active','RLS changes require dual human approval before execution.',jsonb_build_object('min_approvers',2),true,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Dual sign-off required for any RLS change.'),
('POL-AUTH-CHANGE','Authentication changes require human approval','Any change to authentication flows, identity providers or sign-in behaviour requires human security approval.','security','require_approval','group',NULL,NULL,'action','Authentication change','Authentication change','red','production','critical','active','Authentication changes require dual human approval.',jsonb_build_object('min_approvers',2),true,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Identity-critical change requires dual sign-off.'),
('POL-DATA-DELETE','Production data deletion denied by default','Deleting production data is denied by default. Any deletion requires a formal exception and human approval.','data_access','deny','group',NULL,NULL,'action','Delete production data','Delete production data','red','production','critical','active','Production deletion is denied by default; governed exceptions only.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Deletions only via a governed data-deletion workflow, never directly by agents.'),
('POL-DEPLOY','Production deployments require approval','Publishing or deploying to production requires explicit human approval, including Forge release builds and site publishes.','deployment','require_approval','group',NULL,NULL,'action','Production deployment','Production deployment','red','production','critical','active','Production deployments require dual approval and completed UAT.',jsonb_build_object('min_approvers',2),true,true,'Group AI Operations','v1.1','2026-07-01','2026-10-01',true,'UAT must be complete before production publish.'),
('POL-KNOWLEDGE-SCOPE','Restricted knowledge cannot be used outside scope','Restricted or confidential knowledge sources cannot be retrieved or referenced outside their assigned site or agent scope.','knowledge_access','restrict','group',NULL,NULL,'action','Restricted knowledge retrieval','Restricted knowledge retrieval','red','production','critical','active','Restricted knowledge is limited to its assigned scope.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Classification of restricted/confidential must be visibly enforced.'),
('POL-DEV-PROD','Development agents cannot act on production','Agents scoped to development or sandbox environments cannot perform actions in production.','environment','deny','group',NULL,NULL,'action','Cross-environment action','Cross-environment action','red','production','critical','active','Development-scoped agents are denied production actions.',jsonb_build_object('min_approvers',0),false,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Environment isolation is enforced at the execution gate.'),
('POL-SANDBOX-ISOLATION','Sandbox operations remain isolated','Operations performed in sandbox environments cannot leak into staging or production.','environment','restrict','group',NULL,NULL,'action','Sandbox operation','Sandbox operation','amber','sandbox','high','active','Sandbox operations are restricted to the sandbox scope.',jsonb_build_object('min_approvers',0),false,true,'Forge Build Team','v1.0','2026-07-01','2026-10-01',true,'Sandbox isolation is a hard boundary.'),
('POL-PROD-CONFIRM','Production actions require environment confirmation','Any action targeting production requires an explicit environment confirmation step before execution.','environment','require_approval','group',NULL,NULL,'action','Production action','Production action','amber','production','high','active','Production actions require an environment confirmation.',jsonb_build_object('min_approvers',1),true,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Confirmation is a lightweight human checkpoint for production actions.'),
('POL-SUPABASE-WRITE','Supabase production writes restricted','Supabase production writes are restricted to approved tables and non-critical records; all other writes require approval.','tool_access','restrict','group',NULL,NULL,'action','Supabase production write','Supabase production write','red','production','critical','active','Production writes are restricted to approved, non-critical targets.',jsonb_build_object('min_approvers',1),true,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Reads are allowed; writes are gated.'),
('POL-N8N','n8n execution limited to approved workflows','n8n execution is limited to explicitly approved workflows. Production workflow edits, credential changes and deletion are denied.','tool_access','restrict','group',NULL,NULL,'action','n8n workflow execution','n8n workflow execution','amber','production','high','active','n8n execution is restricted to the approved workflow list.',jsonb_build_object('min_approvers',1),true,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Approved workflow list is maintained centrally.'),
('POL-STRIPE','Stripe refund / payment changes require approval','Stripe refunds and payment configuration changes require finance approval before execution.','tool_access','require_approval','group',NULL,NULL,'action','Stripe refund / payment change','Stripe refund / payment change','red','production','critical','active','Refunds and payment changes require finance approval.',jsonb_build_object('min_approvers',1),true,true,'Finance','v1.0','2026-07-01','2026-10-01',true,'Finance-critical change requires human sign-off.'),
('POL-GITHUB','GitHub production changes require approval','Merging or pushing to production branches on GitHub requires human approval.','tool_access','require_approval','group',NULL,NULL,'action','GitHub production change','GitHub production change','red','production','critical','active','Production branch changes require approval.',jsonb_build_object('min_approvers',1),true,true,'Forge Build Team','v1.0','2026-07-01','2026-10-01',true,'Branch protection and approval required.'),
('POL-READDY-PUBLISH','Readdy publishing requires approval','Publishing sites or projects through Readdy requires approval from the build owner before going live.','tool_access','require_approval','group',NULL,NULL,'action','Readdy publish','Readdy publish','red','production','critical','active','Publishing requires approval before going live.',jsonb_build_object('min_approvers',1),true,true,'Forge Build Team','v1.0','2026-07-01','2026-10-01',true,'Publish is gated behind the release approval workflow.'),
('POL-MODEL-RESTRICTED','Restricted workloads require approved providers','Workloads handling restricted or sensitive data must use approved providers and models only.','model_usage','restrict','group',NULL,NULL,'action','Restricted model workload','Restricted model workload','amber','production','high','active','Restricted workloads are limited to approved providers.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Approved provider list maintained centrally.'),
('POL-LOCAL-PREFER','Local models preferred for sensitive data','Where data-handling policy requires local processing, local models are preferred over cloud models.','model_usage','allow_with_conditions','group',NULL,NULL,'action','Sensitive-data model selection','Sensitive-data model selection','amber','production','medium','active','Local models preferred; cloud allowed under conditions.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Cloud models are permitted when local capacity is unavailable and data permits.'),
('POL-FALLBACK-CAPABILITY','Fallback models must meet required capabilities','Fallback models must satisfy the required capabilities (tool support, vision, context) of the primary model.','model_usage','allow_with_conditions','group',NULL,NULL,'action','Fallback model routing','Fallback model routing','amber','production','medium','active','Fallback allowed when capabilities match.',jsonb_build_object('min_approvers',0),false,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Capability parity is checked before fallback routing.'),
('POL-NO-SELF-APPROVE','Critical agents cannot self-approve','Critical agents can never approve their own actions. Separation of duties is enforced for high-risk requests.','approval','deny','group',NULL,NULL,'action','Self-approval','Self-approval','red','production','critical','active','Critical agents cannot approve their own actions.',jsonb_build_object('min_approvers',0),false,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'The recommending agent is never treated as its own approver.'),
('POL-SEPARATION','Separation of duties for RED actions','RED-risk actions require separation of duties: requester, approver and executor must be distinct.','approval','require_approval','group',NULL,NULL,'action','RED-risk action','RED-risk action','red','production','critical','active','RED actions require separation of duties and dual approval.',jsonb_build_object('min_approvers',2),true,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Requester, approver and executor must be distinct roles.'),
('POL-DISABLED-NO-WORK','Disabled agents cannot receive new work','Disabled or paused agents cannot receive new tasks. Queued work is reassigned.','agent_access','deny','group',NULL,NULL,'action','Assign work to disabled agent','Assign work to disabled agent','amber','production','high','active','Disabled agents cannot receive new work.',jsonb_build_object('min_approvers',0),false,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Disabled agents are excluded from routing.'),
('POL-AUTONOMY','Agent actions cannot exceed autonomy level','An agent cannot perform actions beyond its configured autonomy level. Higher autonomy requires reconfiguration.','agent_access','restrict','group',NULL,NULL,'action','Autonomy escalation','Autonomy escalation','amber','production','high','active','Actions are restricted to the agent autonomy ceiling.',jsonb_build_object('min_approvers',0),false,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Autonomy is a hard ceiling per agent.'),
('POL-PRIVACY','Customer personal data access is restricted','Access to customer personal data is restricted to approved support and diagnostics agents on a need-to-know basis.','privacy','restrict','group',NULL,NULL,'action','Personal data access','Personal data access','red','production','critical','active','Personal data access is restricted to approved agents.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Least-privilege access to personal data only.'),
('POL-RETENTION','Agent logs retained per retention policy','Agent logs and audit trails are retained according to the group retention schedule and not modified by agents.','retention','audit_only','group',NULL,NULL,'action','Log retention','Log retention','amber','production','medium','active','Retention is audit-only; logs are immutable.',jsonb_build_object('min_approvers',0),false,true,'Group AI Operations','v1.0','2026-07-01','2026-10-01',true,'Audit-only policy; logs are retained and immutable.'),
('POL-COST','High-cost model usage requires approval','High-cost model usage (e.g. premium reasoning models on large volumes) requires cost-owner approval.','cost','require_approval','group',NULL,NULL,'action','High-cost model usage','High-cost model usage','amber','production','medium','active','High-cost model usage requires cost-owner approval.',jsonb_build_object('min_approvers',1),true,true,'Finance','v1.0','2026-07-01','2026-10-01',true,'Cost guardrail for premium model usage.'),
('POL-AUDIT','All RED actions audit-logged','Every RED-risk action is fully audit-logged with immutable evidence before, during and after execution.','audit','audit_only','group',NULL,NULL,'action','RED-risk action','RED-risk action','red','production','critical','active','RED actions are always audit-logged.',jsonb_build_object('min_approvers',0),false,true,'Security Working Group','v1.0','2026-07-01','2026-10-01',true,'Audit logging is non-negotiable for RED actions.'),
('POL-DRAFT-MODEL-GOV','Model governance working draft','Draft policy for consolidating model governance rules across all providers. Not yet enforced.','model_usage','audit_only','group',NULL,NULL,'action','Model governance','Model governance','amber','production','medium','draft','Draft policy is not yet enforced.',jsonb_build_object('min_approvers',0),false,false,'Security Working Group','v0.3','2026-09-01','2026-09-15',true,'Draft only - no enforcement.'),
('POL-REVIEW-COST','Cost guardrail under review','Existing cost guardrail flagged for review after threshold changes. Currently still active but under review.','cost','require_approval','group',NULL,NULL,'action','High-cost model usage','High-cost model usage','amber','production','medium','review_required','Cost guardrail still enforced while under review.',jsonb_build_object('min_approvers',1),true,true,'Finance','v1.0','2026-07-01','2026-08-25',true,'Threshold changed; policy requires re-approval.'),
('POL-SUPERSEDED-NOTIFY','Legacy notification policy (superseded)','Superseded notification policy replaced by the current notification routing rules.','other','allow','group',NULL,NULL,'action','Notification','Notification','green','production','low','superseded','Superseded; no longer enforced.',jsonb_build_object('min_approvers',0),false,false,'Group AI Operations','v1.1','2026-06-15','2026-08-12',true,'Superseded - retained for history only.')
ON CONFLICT (policy_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  subject_type = EXCLUDED.subject_type,
  subject_reference = EXCLUDED.subject_reference,
  action_pattern = EXCLUDED.action_pattern,
  risk_level = EXCLUDED.risk_level,
  environment = EXCLUDED.environment,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  condition_summary = EXCLUDED.condition_summary,
  requirements = EXCLUDED.requirements,
  approval_required = EXCLUDED.approval_required,
  audit_required = EXCLUDED.audit_required,
  owner_team = EXCLUDED.owner_team,
  version = EXCLUDED.version,
  effective_from = EXCLUDED.effective_from,
  next_review_at = EXCLUDED.next_review_at,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes;
-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 08: TOOLS + CONNECTIONS LIVE PERSISTENCE
--
-- Creates the live Tools & Connections foundation:
--   * ai_tool_connections   — approved tools/systems/integrations registry.
--   * ai_tool_agent_access  — agent → tool access assignments (append-oriented,
--                             revoked via is_active=false, never deleted).
--
-- Safety:
--   * RLS enabled on both tables, reusing public.internal_role().
--   * Connections: SELECT for authenticated staff; INSERT/UPDATE owner/admin;
--     no delete policy (no delete UI exists).
--   * Agent access: SELECT staff; INSERT/UPDATE owner/admin; no DELETE policy.
--   * connection_id → ai_tool_connections ON DELETE RESTRICT (access survives
--     connection removal blocking); agent_id → ai_operations_agents RESTRICT.
--   * credential_reference / authentication_type are safe labels only — never
--     values. No secrets are stored.
--   * No external connectivity is performed — the registry is metadata only.
--
-- This file is idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_tool_connections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_tool_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  provider text,
  scope text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  connection_type text,
  environment text,
  status text,
  health text,
  risk_level text,
  authentication_type text,
  credential_reference text,
  endpoint_reference text,
  allowed_operations jsonb,
  restricted_operations jsonb,
  approval_required boolean NOT NULL DEFAULT false,
  audit_required boolean NOT NULL DEFAULT true,
  owner_team text,
  technical_owner text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_summary text,
  configuration_state text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tool_connections_status_check CHECK (status IN ('connected','degraded','disconnected','not_configured','disabled','error','unknown')),
  CONSTRAINT ai_tool_connections_health_check CHECK (health IN ('healthy','warning','critical','unknown')),
  CONSTRAINT ai_tool_connections_risk_check CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT ai_tool_connections_env_check CHECK (environment IN ('production','staging','sandbox','development')),
  CONSTRAINT ai_tool_connections_config_check CHECK (configuration_state IN ('complete','partial','missing','invalid','not_required'))
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_category ON public.ai_tool_connections(category);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_provider ON public.ai_tool_connections(provider);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_site_id ON public.ai_tool_connections(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_status ON public.ai_tool_connections(status);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_health ON public.ai_tool_connections(health);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_environment ON public.ai_tool_connections(environment);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_risk ON public.ai_tool_connections(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_tool_connections_active ON public.ai_tool_connections(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_tool_connections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_tool_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_tool_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_tool_connections_select ON public.ai_tool_connections;
CREATE POLICY ai_tool_connections_select ON public.ai_tool_connections
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_tool_connections_insert ON public.ai_tool_connections;
CREATE POLICY ai_tool_connections_insert ON public.ai_tool_connections
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_tool_connections_update ON public.ai_tool_connections;
CREATE POLICY ai_tool_connections_update ON public.ai_tool_connections
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_tool_agent_access
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_tool_agent_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.ai_tool_connections(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.ai_operations_agents(id) ON DELETE RESTRICT,
  access_level text,
  allowed_operations jsonb,
  restricted_operations jsonb,
  approval_required boolean NOT NULL DEFAULT false,
  risk_limit text,
  environment text,
  reason text,
  granted_by text,
  granted_at timestamptz,
  reviewed_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tool_agent_access_unique UNIQUE (connection_id, agent_id),
  CONSTRAINT ai_tool_agent_access_level_check CHECK (access_level IN ('read','write','execute','read_write','restricted')),
  CONSTRAINT ai_tool_agent_access_risk_check CHECK (risk_limit IN ('low','medium','high','critical')),
  CONSTRAINT ai_tool_agent_access_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_agent_access_connection ON public.ai_tool_agent_access(connection_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_agent_access_agent ON public.ai_tool_agent_access(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_agent_access_level ON public.ai_tool_agent_access(access_level);
CREATE INDEX IF NOT EXISTS idx_ai_tool_agent_access_environment ON public.ai_tool_agent_access(environment);
CREATE INDEX IF NOT EXISTS idx_ai_tool_agent_access_active ON public.ai_tool_agent_access(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_tool_agent_access;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_tool_agent_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_tool_agent_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_tool_agent_access_select ON public.ai_tool_agent_access;
CREATE POLICY ai_tool_agent_access_select ON public.ai_tool_agent_access
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_tool_agent_access_insert ON public.ai_tool_agent_access;
CREATE POLICY ai_tool_agent_access_insert ON public.ai_tool_agent_access
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_tool_agent_access_update ON public.ai_tool_agent_access;
CREATE POLICY ai_tool_agent_access_update ON public.ai_tool_agent_access
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- Initial connection migration (17 demo connections, all group-wide).
-- Idempotent: ON CONFLICT (connection_key) DO UPDATE. No credential values.
-- allowed_operations = green + amber operation groups; restricted = red.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_tool_connections (
  connection_key, name, description, category, provider, scope, site_id, connection_type,
  environment, status, health, risk_level, authentication_type, credential_reference,
  allowed_operations, restricted_operations, approval_required, audit_required,
  owner_team, technical_owner, configuration_state, notes
) VALUES
('CON-SUPABASE','Supabase','Group-wide database, authentication and storage backend used by every platform.','database','Supabase','Group-wide',NULL,'database','production','connected','healthy','critical','service_role_key','supabase-group-prod','["Read approved tables","Query safe operational metadata","Run diagnostics","Update approved non-critical records","Correct approved configuration"]','["Modify RLS","Delete production records","Change authentication","Access service-role credentials","Run migrations"]',true,true,'DFP Core Team','DFP Core Team','complete','Central data plane. Red-class actions (RLS, schema, deletes) are always human-approved.'),
('CON-N8N','n8n','Workflow automation platform driving cross-group orchestration and repair actions.','automation','n8n','Group-wide',NULL,'workflow','production','connected','warning','high','api_key','n8n-group-core','["Read workflow status","Read execution result","List workflows","Retry approved workflow","Restart known-safe workflow"]','["Modify production workflow","Change credentials","Delete workflow"]',true,true,'DFP Core Team','DFP Core Team','complete','Production workflows are gated; red-class edits require approval.'),
('CON-STRIPE','Stripe','Payment and billing provider for subscriptions, invoices and refunds across the group.','billing','Stripe','Group-wide',NULL,'payment','production','connected','healthy','critical','api_key','stripe-group-prod','["Read invoices","Read subscription state","Generate billing reports","Update billing metadata","Correct approved invoice"]','["Issue refunds","Modify billing plans","Change payout config"]',true,true,'DFP Finance','DFP Finance','complete','Finance-critical. Refunds and billing changes require human approval.'),
('CON-EMAIL','Resend / Email','Transactional and notification email delivery for staff and customers.','email','Resend','Group-wide',NULL,'email','production','connected','warning','high','api_key','resend-group-prod','["Send approved notifications","Read delivery status","Send approved communications"]','["Modify sending domain","Change SMTP credentials"]',false,true,'DFP Core Team','DFP Core Team','complete','Pre-approved templates only. No unsolicited outreach without approval.'),
('CON-GITHUB','GitHub','Source control and CI for every group platform repository.','repository','GitHub','Group-wide',NULL,'vcs','production','connected','healthy','high','token','github-group-org','["Read repository","Read PR status","List branches","Open pull request","Update non-production branch"]','["Merge to production","Delete branch","Modify branch protection"]',true,true,'DFP Core Team','DFP Core Team','complete','Deploy branches and merges to production require release approval.'),
('CON-READDY','Readdy','AI website generation and publishing platform powering client builds.','website_builder','Readdy','Group-wide',NULL,'platform','production','connected','healthy','medium','api_key','readdy-group','["Read project metadata","Generate page layout","Publish to staging"]','["Publish to production","Delete project"]',false,true,'DFP Core Team','DFP Core Team','complete','Publishing is gated behind release approval in The Forge.'),
('CON-MODEL','AI Model Providers','Model inference layer powering every agent across the group.','ai_model','Anthropic / OpenAI','Group-wide',NULL,'model','production','connected','healthy','critical','api_key','model-gateway-group','["Run inference","Read usage metrics","Switch fallback model"]','["Modify provider credentials","Change routing policy"]',false,true,'DFP Core Team','DFP Core Team','complete','Usage metered per agent; no model-provider keys exposed to agents.'),
('CON-MONITORING','Monitoring Service','Observability and alerting for platform health and agent telemetry.','monitoring','Monitoring','Group-wide',NULL,'monitoring','production','connected','healthy','high','api_key','monitoring-group','["Read metrics","Raise alert","Generate reports","Acknowledge alert"]','["Modify alert rules","Suppress production alerts"]',false,true,'DFP Core Team','DFP Core Team','complete','Read-only telemetry; no corrective action by agents.'),
('CON-NOTIFY','Notification Service','In-app and push notification delivery for staff and customers.','notifications','Notifications','Group-wide',NULL,'notification','production','connected','healthy','medium','api_key','notify-group','["Send approved notification","Read delivery status","Send batch notification"]','["Modify notification templates","Change delivery config"]',false,true,'DFP Core Team','DFP Core Team','complete','Pre-approved notification templates only.'),
('CON-AUTH','Authentication','Identity and session management across group platforms.','authentication','Supabase Auth','Group-wide',NULL,'auth','production','connected','healthy','critical','service_role_key','auth-group','["Read auth events","Verify sessions","Reset approved session"]','["Change authentication","Modify permissions","Revoke access controls"]',true,true,'DFP Security','DFP Security','complete','Identity-critical. Auth and permission changes require security review.'),
('CON-KB','Knowledge Base','Curated support and operational knowledge used by support agents.','knowledge_base','Knowledge','Group-wide',NULL,'knowledge','production','connected','healthy','low','none','kb-group','["Retrieve articles","Recommend article","Draft article"]','["Publish article","Delete article"]',false,false,'DFP Core Team','DFP Core Team','complete','Read + recommend only; content edits are human-curated.'),
('CON-SITE-API','Site API','Internal platform APIs used by agents for read/write operational actions.','site_api','Site API','Group-wide',NULL,'api','production','connected','healthy','high','api_key','site-api-group','["Read records","Read operational metadata","Update non-critical records","Retry failed job"]','["Delete production records","Change permissions"]',true,true,'DFP Core Team','DFP Core Team','complete','Scoped per-site APIs; destructive actions require approval.'),
('CON-STORAGE','Storage','File and asset storage for uploads, evidence and media across platforms.','storage','Supabase Storage','Group-wide',NULL,'storage','production','connected','healthy','medium','service_role_key','storage-group','["Read uploaded files","Store generated asset","Update non-critical asset"]','["Delete production files","Modify bucket policy"]',false,true,'DFP Core Team','DFP Core Team','complete','Uploads constrained to safe buckets; no public secret storage.'),
('CON-SEARCH','Search','Full-text search index for records, articles and customers.','search','Search','Group-wide',NULL,'search','production','degraded','warning','medium','none','search-group','["Search records","Read index status","Rebuild non-critical index"]','["Modify index schema","Drop production index"]',false,false,'DFP Core Team','DFP Core Team','partial','Index lag under investigation on GuardianHub customer search.'),
('CON-ANALYTICS','Analytics','Product and operational analytics for reporting and insights.','analytics','Analytics','Group-wide',NULL,'analytics','production','not_configured','unknown','medium','none','analytics-group','["Read analytics","Generate reports","Export analytics dataset"]','["Modify analytics pipeline"]',false,false,'DFP Core Team','DFP Core Team','missing','Analytics pipeline not yet configured — awaiting ingestion setup.'),
('CON-INFRA','Hosting (Vercel)','Production hosting and edge deployment for every group platform.','infrastructure','Vercel','Group-wide',NULL,'hosting','production','connected','healthy','critical','token','vercel-group','["Read deployment status","Deploy to staging"]','["Deploy to production","Rollback production"]',true,true,'DFP Core Team','DFP Core Team','complete','Production deploys gated behind release approval.'),
('CON-LEGACY','Legacy Reporting Service','Deprecated legacy reporting pipeline retained in the registry for audit reference.','other','Legacy Reporting','Group-wide',NULL,'other','production','disconnected','unknown','low','none','legacy-reporting','["Read historical report"]','["Modify retired pipeline"]',false,true,'DFP Core Team','DFP Core Team','partial','Retired in favour of the Analytics connection. No agents currently use this service.')
ON CONFLICT (connection_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  provider = EXCLUDED.provider,
  scope = EXCLUDED.scope,
  connection_type = EXCLUDED.connection_type,
  environment = EXCLUDED.environment,
  status = EXCLUDED.status,
  health = EXCLUDED.health,
  risk_level = EXCLUDED.risk_level,
  authentication_type = EXCLUDED.authentication_type,
  credential_reference = EXCLUDED.credential_reference,
  allowed_operations = EXCLUDED.allowed_operations,
  restricted_operations = EXCLUDED.restricted_operations,
  approval_required = EXCLUDED.approval_required,
  audit_required = EXCLUDED.audit_required,
  owner_team = EXCLUDED.owner_team,
  technical_owner = EXCLUDED.technical_owner,
  configuration_state = EXCLUDED.configuration_state,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- Agent access migration (36 rows) — resolved by connection_key + agent_key.
-- Idempotent via ON CONFLICT (connection_id, agent_id). No credential values.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_tool_agent_access (
  connection_id, agent_id, access_level, allowed_operations, restricted_operations,
  approval_required, risk_limit, environment, is_active
) VALUES
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SUPABASE'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-orchestrator'),'read_write','["Read tables","Query metadata"]','["Modify RLS","Delete records"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SUPABASE'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-data-health'),'read','["Read tables","Run integrity checks"]','["Modify schema"]',false,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SUPABASE'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-diagnostics'),'read','["Read tables","Query diagnostics"]','["Write production data"]',false,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SUPABASE'),(SELECT id FROM ai_operations_agents WHERE agent_key='qg-match'),'read','["Read guards","Read shifts"]','["Modify payments"]',false,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SUPABASE'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-database'),'read_write','["Draft migrations"]','["Apply migrations"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-N8N'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-orchestrator'),'execute','["Read workflow status","Retry approved workflow"]','["Modify workflow","Change credentials"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-N8N'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-repair'),'execute','["Read execution result"]','["Modify production workflow"]',true,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-N8N'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-master'),'execute','["Run build workflow"]','["Modify workflow"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-STRIPE'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-billing'),'read','["Read invoices","Read subscription state"]','["Issue refunds","Modify billing"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-STRIPE'),(SELECT id FROM ai_operations_agents WHERE agent_key='qg-payment'),'read','["Read payment records"]','["Modify payroll"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-STRIPE'),(SELECT id FROM ai_operations_agents WHERE agent_key='lh-rent'),'read','["Read rent ledger"]','["Issue refunds"]',true,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-EMAIL'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-comms'),'write','["Send approved template"]','["Send unsolicited outreach"]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-EMAIL'),(SELECT id FROM ai_operations_agents WHERE agent_key='wd-comms'),'write','["Send guest update"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-EMAIL'),(SELECT id FROM ai_operations_agents WHERE agent_key='lh-comms'),'write','["Send tenancy notice"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-GITHUB'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-code'),'read_write','["Read repository","Open PR"]','["Merge to production"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-GITHUB'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-master'),'read','["Read repository"]','["Merge to production"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-GITHUB'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-publishing'),'execute','["Trigger deploy"]','["Direct push"]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-READDY'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-publishing'),'execute','["Publish approved site"]','[]',true,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-READDY'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-page'),'read_write','["Generate page layout"]','[]',false,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-MODEL'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-orchestrator'),'execute','["Run inference"]','[]',false,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-MODEL'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-code'),'execute','["Run inference"]','[]',false,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-MONITORING'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-monitoring'),'read','["Read metrics","Raise alert"]','["Take corrective action"]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-MONITORING'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-diagnostics'),'read','["Read metrics"]','[]',false,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-MONITORING'),(SELECT id FROM ai_operations_agents WHERE agent_key='gh-welfare'),'read','["Read welfare signals"]','[]',false,'high','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-NOTIFY'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-comms'),'write','["Send notification"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-AUTH'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-security'),'read','["Read auth events"]','["Change authentication","Modify permissions"]',true,'critical','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-AUTH'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-auth'),'read_write','["Review auth flow"]','["Modify auth config"]',true,'critical','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-KB'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-knowledge'),'read','["Retrieve articles"]','["Publish article"]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-KB'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-support'),'read','["Retrieve articles"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SITE-API'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-support'),'read_write','["Read ticket","Update non-critical record"]','["Delete records"]',true,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SITE-API'),(SELECT id FROM ai_operations_agents WHERE agent_key='qg-match'),'read_write','["Produce match recommendation"]','["Confirm assignment"]',true,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-STORAGE'),(SELECT id FROM ai_operations_agents WHERE agent_key='wd-photo'),'read_write','["Read uploaded media"]','[]',false,'medium','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-STORAGE'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-asset'),'read_write','["Store generated asset"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-SEARCH'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-support'),'read','["Search records"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-ANALYTICS'),(SELECT id FROM ai_operations_agents WHERE agent_key='core-reporting'),'read','["Read analytics"]','[]',false,'low','production',true),
((SELECT id FROM ai_tool_connections WHERE connection_key='CON-INFRA'),(SELECT id FROM ai_operations_agents WHERE agent_key='tf-publishing'),'execute','["Trigger deploy"]','["Direct rollback"]',true,'high','production',true)
ON CONFLICT (connection_id, agent_id) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  allowed_operations = EXCLUDED.allowed_operations,
  restricted_operations = EXCLUDED.restricted_operations,
  approval_required = EXCLUDED.approval_required,
  risk_limit = EXCLUDED.risk_limit,
  environment = EXCLUDED.environment,
  is_active = EXCLUDED.is_active;
-- ============================================================================
-- DFP AI OPERATIONS — PHASE 2 PROMPT 09: MODELS + AI PROVIDERS LIVE PERSISTENCE
--
-- Creates the live Models & AI Providers foundation:
--   * ai_model_providers       — provider catalogue (registry metadata only).
--   * ai_operations_models     — model registry (dedicated AI Operations name;
--                                no relationship to the unrelated ai_models).
--   * ai_agent_model_assignments — agent → model assignments (append-oriented,
--                                revoked via is_active=false, never deleted).
--
-- Safety:
--   * RLS enabled on all three tables, reusing public.internal_role().
--   * Providers/Models: SELECT for authenticated staff; INSERT/UPDATE for
--     owner/admin; no DELETE policy (no delete UI exists).
--   * Assignments: SELECT staff; INSERT/UPDATE owner/admin; no DELETE policy.
--   * provider_id → ai_model_providers ON DELETE RESTRICT;
--     agent_id → ai_operations_agents ON DELETE RESTRICT;
--     model_id → ai_operations_models ON DELETE RESTRICT.
--   * credential_reference / endpoint_reference are safe labels only — never
--     values. No secrets are stored.
--   * No external connectivity / model calls are performed — registry metadata
--     only (no OpenAI, Anthropic or Ollama requests).
--
-- This file is idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT).
-- The unrelated `ai_models` table is NOT touched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_model_providers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_model_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  provider_type text,
  hosting_type text,
  environment text,
  status text,
  health text,
  credential_reference text,
  endpoint_reference text,
  region text,
  data_residency text,
  supports_chat boolean NOT NULL DEFAULT false,
  supports_reasoning boolean NOT NULL DEFAULT false,
  supports_vision boolean NOT NULL DEFAULT false,
  supports_embeddings boolean NOT NULL DEFAULT false,
  supports_tools boolean NOT NULL DEFAULT false,
  supports_streaming boolean NOT NULL DEFAULT false,
  cost_tracking_enabled boolean NOT NULL DEFAULT false,
  health_monitoring_enabled boolean NOT NULL DEFAULT false,
  owner_team text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_providers_type_check CHECK (provider_type IN ('local','cloud','hybrid','internal')),
  CONSTRAINT ai_model_providers_status_check CHECK (status IN ('available','degraded','unavailable','disabled','not_configured','unknown')),
  CONSTRAINT ai_model_providers_health_check CHECK (health IN ('healthy','warning','critical','unknown')),
  CONSTRAINT ai_model_providers_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_model_providers_type ON public.ai_model_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_model_providers_env ON public.ai_model_providers(environment);
CREATE INDEX IF NOT EXISTS idx_ai_model_providers_status ON public.ai_model_providers(status);
CREATE INDEX IF NOT EXISTS idx_ai_model_providers_health ON public.ai_model_providers(health);
CREATE INDEX IF NOT EXISTS idx_ai_model_providers_active ON public.ai_model_providers(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_model_providers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_model_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_model_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_model_providers_select ON public.ai_model_providers;
CREATE POLICY ai_model_providers_select ON public.ai_model_providers
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_model_providers_insert ON public.ai_model_providers;
CREATE POLICY ai_model_providers_insert ON public.ai_model_providers
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_model_providers_update ON public.ai_model_providers;
CREATE POLICY ai_model_providers_update ON public.ai_model_providers
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_operations_models
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_operations_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL UNIQUE,
  provider_id uuid NOT NULL REFERENCES public.ai_model_providers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  display_name text,
  model_reference text,
  description text,
  model_type text,
  hosting_type text,
  environment text,
  status text,
  health text,
  context_window integer,
  max_output_tokens integer,
  supports_reasoning boolean NOT NULL DEFAULT false,
  supports_vision boolean NOT NULL DEFAULT false,
  supports_embeddings boolean NOT NULL DEFAULT false,
  supports_tools boolean NOT NULL DEFAULT false,
  supports_code boolean NOT NULL DEFAULT false,
  input_cost_per_million numeric,
  output_cost_per_million numeric,
  currency text,
  latency_class text,
  quality_tier text,
  risk_level text,
  data_policy text,
  fallback_priority integer,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_operations_models_status_check CHECK (status IN ('available','degraded','unavailable','disabled','not_configured','unknown')),
  CONSTRAINT ai_operations_models_health_check CHECK (health IN ('healthy','warning','critical','unknown')),
  CONSTRAINT ai_operations_models_env_check CHECK (environment IN ('production','staging','sandbox','development')),
  CONSTRAINT ai_operations_models_risk_check CHECK (risk_level IN ('low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS idx_ai_operations_models_provider ON public.ai_operations_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_type ON public.ai_operations_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_env ON public.ai_operations_models(environment);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_status ON public.ai_operations_models(status);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_health ON public.ai_operations_models(health);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_risk ON public.ai_operations_models(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_default ON public.ai_operations_models(is_default);
CREATE INDEX IF NOT EXISTS idx_ai_operations_models_active ON public.ai_operations_models(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_operations_models;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_operations_models FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_operations_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_operations_models_select ON public.ai_operations_models;
CREATE POLICY ai_operations_models_select ON public.ai_operations_models
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_operations_models_insert ON public.ai_operations_models;
CREATE POLICY ai_operations_models_insert ON public.ai_operations_models
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_operations_models_update ON public.ai_operations_models;
CREATE POLICY ai_operations_models_update ON public.ai_operations_models
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- ai_agent_model_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_agent_model_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_operations_agents(id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES public.ai_operations_models(id) ON DELETE RESTRICT,
  assignment_type text NOT NULL,
  priority integer,
  environment text,
  max_cost_per_run numeric,
  allowed_risk_level text,
  fallback_enabled boolean NOT NULL DEFAULT false,
  reason text,
  assigned_by text,
  assigned_at timestamptz,
  reviewed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_model_assignments_unique UNIQUE (agent_id, model_id, assignment_type),
  CONSTRAINT ai_agent_model_assignments_type_check CHECK (assignment_type IN ('primary','fallback','specialist','embedding','vision','coding')),
  CONSTRAINT ai_agent_model_assignments_risk_check CHECK (allowed_risk_level IN ('low','medium','high','critical')),
  CONSTRAINT ai_agent_model_assignments_env_check CHECK (environment IN ('production','staging','sandbox','development'))
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_model_assignments_agent ON public.ai_agent_model_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_model_assignments_model ON public.ai_agent_model_assignments(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_model_assignments_type ON public.ai_agent_model_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_model_assignments_env ON public.ai_agent_model_assignments(environment);
CREATE INDEX IF NOT EXISTS idx_ai_agent_model_assignments_active ON public.ai_agent_model_assignments(is_active);

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_agent_model_assignments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_agent_model_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_agent_model_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_agent_model_assignments_select ON public.ai_agent_model_assignments;
CREATE POLICY ai_agent_model_assignments_select ON public.ai_agent_model_assignments
  FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
DROP POLICY IF EXISTS ai_agent_model_assignments_insert ON public.ai_agent_model_assignments;
CREATE POLICY ai_agent_model_assignments_insert ON public.ai_agent_model_assignments
  FOR INSERT TO authenticated WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));
DROP POLICY IF EXISTS ai_agent_model_assignments_update ON public.ai_agent_model_assignments;
CREATE POLICY ai_agent_model_assignments_update ON public.ai_agent_model_assignments
  FOR UPDATE TO authenticated USING (public.internal_role() = ANY (ARRAY['owner','admin'])) WITH CHECK (public.internal_role() = ANY (ARRAY['owner','admin']));

-- ---------------------------------------------------------------------------
-- Initial provider migration (4 demo providers). Idempotent. No credentials.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_model_providers (
  provider_key, name, description, provider_type, hosting_type, environment, status, health,
  credential_reference, endpoint_reference, region, data_residency,
  supports_chat, supports_reasoning, supports_vision, supports_embeddings, supports_tools, supports_streaming,
  cost_tracking_enabled, health_monitoring_enabled, owner_team, notes
) VALUES
('PROV-OLLAMA','Local Ollama','Self-hosted local inference runtime for on-premise DFP models. No external provider involved; data never leaves the group network.','local','local','production','available','healthy',NULL,'dfp-gpu-cluster (local)','On-premise','local',true,true,false,true,true,true,true,false,'DFP Core Team','Local runtime. No live connectivity probe is performed — status is registry metadata.'),
('PROV-OPENAI','OpenAI','Cloud model provider for general, coding and embedding workloads across the group.','cloud','cloud','production','available','healthy','openai-group-prod','api.openai.com','US','external',true,true,true,true,true,true,true,true,'DFP Core Team','Cloud provider. No API calls are performed from the registry.'),
('PROV-ANTHROPIC','Anthropic','Cloud model provider for general reasoning, support and vision workloads across the group.','cloud','cloud','production','available','healthy','anthropic-group-prod','api.anthropic.com','US','external',true,true,true,false,true,true,true,true,'DFP Core Team','Cloud provider. No API calls are performed from the registry.'),
('PROV-INTERNAL','Internal / Future Provider','Reserved for a future DFP-proprietary model. Not yet provisioned — no credentials or endpoints exist.','internal','local','development','not_configured','unknown',NULL,NULL,NULL,'local',false,false,false,false,false,false,false,false,'DFP Core Team','Future-state placeholder. No credentials or endpoints exist.')
ON CONFLICT (provider_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  provider_type = EXCLUDED.provider_type,
  hosting_type = EXCLUDED.hosting_type,
  environment = EXCLUDED.environment,
  status = EXCLUDED.status,
  health = EXCLUDED.health,
  credential_reference = EXCLUDED.credential_reference,
  endpoint_reference = EXCLUDED.endpoint_reference,
  region = EXCLUDED.region,
  data_residency = EXCLUDED.data_residency,
  supports_chat = EXCLUDED.supports_chat,
  supports_reasoning = EXCLUDED.supports_reasoning,
  supports_vision = EXCLUDED.supports_vision,
  supports_embeddings = EXCLUDED.supports_embeddings,
  supports_tools = EXCLUDED.supports_tools,
  supports_streaming = EXCLUDED.supports_streaming,
  cost_tracking_enabled = EXCLUDED.cost_tracking_enabled,
  health_monitoring_enabled = EXCLUDED.health_monitoring_enabled,
  owner_team = EXCLUDED.owner_team,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- Initial model migration (13 demo models). Idempotent. No secrets.
-- provider_id resolved from provider_key. No insert into unrelated ai_models.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_operations_models (
  model_key, provider_id, name, description, model_type, hosting_type, environment, status, health,
  context_window, max_output_tokens, supports_reasoning, supports_vision, supports_embeddings,
  supports_tools, supports_code, input_cost_per_million, output_cost_per_million, currency,
  latency_class, quality_tier, risk_level, data_policy, fallback_priority, is_default, is_active, notes
) VALUES
('MOD-CLAUDE-SONNET',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-ANTHROPIC'),'Claude Sonnet','General-purpose reasoning model used as the default for core and site-specific agents across the group.','general','cloud','production','available','healthy',200000,8000,true,true,false,true,true,3.00,15.00,'USD','Medium','High','medium','external_provider',1,true,true,'Default general-purpose model. Vision-capable for document and image tasks.'),
('MOD-CLAUDE-OPUS',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-ANTHROPIC'),'Claude Opus','Highest-quality reasoning model reserved for complex planning, risk assessment and high-value decisions.','reasoning','cloud','production','available','healthy',200000,4000,true,true,false,true,true,15.00,75.00,'USD','Slow','Very High','high','external_provider',NULL,false,true,'Reserved for orchestrator planning and high-risk reasoning.'),
('MOD-CLAUDE-HAIKU',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-ANTHROPIC'),'Claude Haiku','Fast, low-cost model for high-volume classification, triage and summarisation tasks.','classification','cloud','production','available','healthy',200000,4000,false,false,false,true,false,0.25,1.25,'USD','Fast','Medium','low','external_provider',1,false,true,'Used by support and triage agents for fast classification.'),
('MOD-VISION',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-ANTHROPIC'),'Claude 3.5 Vision','Vision-capable variant for image and document analysis used by moderation and document agents.','vision','cloud','production','available','healthy',200000,4000,true,true,false,true,true,3.00,15.00,'USD','Medium','High','medium','external_provider',NULL,false,true,'Vision workloads: photo-moderation and document analysis.'),
('MOD-GPT4O',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OPENAI'),'GPT-4o','General-purpose model used as the default for The Forge coding and generation agents.','coding','cloud','production','available','healthy',128000,16000,true,true,false,true,true,2.50,10.00,'USD','Medium','High','medium','external_provider',NULL,false,true,'Default coding model.'),
('MOD-GPT4O-MINI',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OPENAI'),'GPT-4o mini','Fast, low-cost model for lightweight generation, summaries and fallback routing.','summarisation','cloud','production','available','healthy',128000,16000,false,true,false,true,true,0.15,0.60,'USD','Fast','Medium','low','external_provider',1,false,true,'Used for lightweight summarisation and cloud fallback.'),
('MOD-EMBED',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OPENAI'),'text-embedding-3-small','Embedding model for semantic search, retrieval and vector indexing across knowledge and records.','embeddings','cloud','production','available','healthy',8000,1500,false,false,true,false,false,0.02,NULL,'USD','Fast','High','low','external_provider',NULL,false,true,'Embeddings for knowledge-base and search vector indexing.'),
('MOD-LLAMA-70B',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OLLAMA'),'Llama 3.1 70B','Self-hosted local coding model for on-premise generation where data cannot leave the group network.','coding','local','production','available','healthy',128000,8000,true,false,false,true,true,NULL,NULL,NULL,'Slow','Medium','low','local_processing',NULL,false,true,'Local coding model for sensitive or on-premise-constrained generation.'),
('MOD-LLAMA-8B',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OLLAMA'),'Llama 3.1 8B','Lightweight local general-purpose model used as a fast local fallback and for low-sensitivity tasks.','general','local','production','available','healthy',128000,4000,false,false,false,true,false,NULL,NULL,NULL,'Fast','Low','low','local_processing',2,false,true,'Local fallback model for fast, low-sensitivity tasks.'),
('MOD-MISTRAL',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OLLAMA'),'Mistral 7B','Lightweight local summarisation model for on-premise text condensation.','summarisation','local','production','available','healthy',32000,2000,false,false,false,false,false,NULL,NULL,NULL,'Fast','Low','low','local_processing',NULL,false,true,'Local summarisation for low-sensitivity documents.'),
('MOD-CODESTRAL',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OLLAMA'),'Codestral 22B','Local code-specialist model for on-premise code generation and review.','coding','local','production','degraded','warning',32000,4000,false,false,false,true,true,NULL,NULL,NULL,'Medium','Medium','medium','local_processing',NULL,false,true,'Local code-specialist model currently degraded under GPU contention.'),
('MOD-LEGACY',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-OPENAI'),'GPT-3.5 Turbo (Legacy)','Deprecated legacy model retained for audit reference. No agents currently use it.','general','cloud','production','disabled','unknown',16000,4000,false,false,false,true,false,0.50,1.50,'USD','Fast','Low','low','external_provider',NULL,false,false,'Retired in favour of GPT-4o mini. Retained for audit reference only.'),
('MOD-INTERNAL',(SELECT id FROM ai_model_providers WHERE provider_key='PROV-INTERNAL'),'DFP Internal Model (Future)','Reserved for a future DFP-proprietary model. Not yet provisioned.','reasoning','local','development','not_configured','unknown',NULL,NULL,false,false,false,false,false,NULL,NULL,NULL,NULL,NULL,'low','planned',NULL,false,false,'Future-state placeholder. No credentials or endpoints exist.')
ON CONFLICT (model_key) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  model_type = EXCLUDED.model_type,
  hosting_type = EXCLUDED.hosting_type,
  environment = EXCLUDED.environment,
  status = EXCLUDED.status,
  health = EXCLUDED.health,
  context_window = EXCLUDED.context_window,
  max_output_tokens = EXCLUDED.max_output_tokens,
  supports_reasoning = EXCLUDED.supports_reasoning,
  supports_vision = EXCLUDED.supports_vision,
  supports_embeddings = EXCLUDED.supports_embeddings,
  supports_tools = EXCLUDED.supports_tools,
  supports_code = EXCLUDED.supports_code,
  input_cost_per_million = EXCLUDED.input_cost_per_million,
  output_cost_per_million = EXCLUDED.output_cost_per_million,
  currency = EXCLUDED.currency,
  latency_class = EXCLUDED.latency_class,
  quality_tier = EXCLUDED.quality_tier,
  risk_level = EXCLUDED.risk_level,
  data_policy = EXCLUDED.data_policy,
  fallback_priority = EXCLUDED.fallback_priority,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- Agent → model assignment migration.
-- Matches the existing safe text fields primary_model_reference /
-- fallback_model_reference (format "Provider / Model") against the migrated
-- model names. The existing text fields are left intact (backward-compatible).
-- Idempotent via ON CONFLICT (agent_id, model_id, assignment_type). No
-- invented matches — only exact model-name matches are created.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_agent_model_assignments (
  agent_id, model_id, assignment_type, priority, environment, fallback_enabled,
  reason, assigned_by, assigned_at, is_active
)
SELECT
  a.id,
  m.id,
  'primary',
  1,
  a.environment,
  false,
  'Migrated from primary_model_reference',
  'migration',
  now(),
  true
FROM public.ai_operations_agents a
JOIN public.ai_operations_models m
  ON m.name = split_part(a.primary_model_reference, ' / ', 2)
WHERE a.primary_model_reference IS NOT NULL
  AND a.primary_model_reference <> ''
ON CONFLICT (agent_id, model_id, assignment_type) DO UPDATE SET
  priority = EXCLUDED.priority,
  environment = EXCLUDED.environment,
  fallback_enabled = EXCLUDED.fallback_enabled,
  is_active = EXCLUDED.is_active;

INSERT INTO public.ai_agent_model_assignments (
  agent_id, model_id, assignment_type, priority, environment, fallback_enabled,
  reason, assigned_by, assigned_at, is_active
)
SELECT
  a.id,
  m.id,
  'fallback',
  2,
  a.environment,
  true,
  'Migrated from fallback_model_reference',
  'migration',
  now(),
  true
FROM public.ai_operations_agents a
JOIN public.ai_operations_models m
  ON m.name = split_part(a.fallback_model_reference, ' / ', 2)
WHERE a.fallback_model_reference IS NOT NULL
  AND a.fallback_model_reference <> ''
ON CONFLICT (agent_id, model_id, assignment_type) DO UPDATE SET
  priority = EXCLUDED.priority,
  environment = EXCLUDED.environment,
  fallback_enabled = EXCLUDED.fallback_enabled,
  is_active = EXCLUDED.is_active;
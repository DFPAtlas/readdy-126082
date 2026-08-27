-- ============================================================================
-- AI OPERATIONS — PHASE 2 PROMPT 01: CORE FOUNDATION + RLS
-- ============================================================================
-- Creates the first controlled production-readiness persistence layer for the
-- DFP Command AI Operations platform. Scope is strictly limited to six core
-- tables: ai_sites, ai_operations_agents, ai_tasks, ai_runs, ai_run_steps,
-- ai_approvals. No agent execution, n8n, or model calls are enabled by this
-- migration.
--
-- NOTE ON NAMING: `ai_agents` already exists in this project for an unrelated
-- feature (the GarageFlow/email AI assistant registry), so the AI Operations
-- agent registry uses the distinct name `ai_operations_agents` to avoid
-- overwriting it.
--
-- Auth model: reuses public.internal_role() (internal_user_roles: owner/admin/
-- viewer). No second authentication system is introduced.
-- ----------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. CORE TABLES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key text NOT NULL UNIQUE,
  name text NOT NULL,
  product_name text,
  domain text,
  description text,
  business_type text,
  environment text NOT NULL DEFAULT 'development',
  operational_status text NOT NULL DEFAULT 'unknown',
  ai_status text NOT NULL DEFAULT 'not_configured',
  criticality text,
  owner_team text,
  repository_reference text,
  readdy_reference text,
  supabase_reference text,
  n8n_reference text,
  billing_provider text,
  email_provider text,
  authentication_provider text,
  hosting_provider text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_operations_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  agent_type text,
  category text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'development',
  status text NOT NULL DEFAULT 'not_configured',
  health text NOT NULL DEFAULT 'unknown',
  risk_level text,
  autonomy_level text,
  owner_team text,
  escalation_team text,
  primary_model_reference text,
  fallback_model_reference text,
  prompt_version_reference text,
  current_task text,
  current_run_id uuid,
  queue_count integer NOT NULL DEFAULT 0,
  success_rate numeric,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  task_type text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  requested_by text,
  trigger_source text,
  priority text,
  risk_level text,
  environment text NOT NULL DEFAULT 'development',
  status text NOT NULL DEFAULT 'draft',
  approval_required boolean NOT NULL DEFAULT false,
  verification_required boolean NOT NULL DEFAULT false,
  uat_required boolean NOT NULL DEFAULT false,
  audit_required boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  task_id uuid REFERENCES public.ai_tasks(id) ON DELETE SET NULL,
  parent_run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  root_run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  correlation_id text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  priority text,
  risk_level text,
  environment text NOT NULL DEFAULT 'development',
  queue_position integer,
  current_step integer,
  total_steps integer,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer,
  retry_count integer NOT NULL DEFAULT 0,
  estimated_cost numeric,
  actual_cost numeric,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary text,
  result_summary text,
  approval_required boolean NOT NULL DEFAULT false,
  approval_id uuid,
  verification_required boolean NOT NULL DEFAULT false,
  uat_required boolean NOT NULL DEFAULT false,
  audit_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ai_runs(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  name text,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  risk_level text,
  approval_required boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms bigint,
  input_summary text,
  output_summary text,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_run_steps_run_step_key UNIQUE (run_id, step_number)
);

CREATE TABLE IF NOT EXISTS public.ai_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_key text NOT NULL UNIQUE,
  title text,
  description text,
  site_id uuid REFERENCES public.ai_sites(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  requested_action text,
  request_type text,
  risk_class text,
  severity text,
  environment text NOT NULL DEFAULT 'development',
  status text NOT NULL DEFAULT 'pending',
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  required_team text,
  minimum_approvers integer NOT NULL DEFAULT 1,
  current_approval_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  business_justification text,
  reasoning_summary text,
  expected_result text,
  potential_impact text,
  rollback_available boolean NOT NULL DEFAULT false,
  rollback_summary text,
  verification_required boolean NOT NULL DEFAULT false,
  uat_required boolean NOT NULL DEFAULT false,
  audit_required boolean NOT NULL DEFAULT false,
  decision text,
  decision_reason text,
  decision_actor text,
  decision_at timestamptz,
  conditions jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ai_sites_environment_idx ON public.ai_sites (environment);
CREATE INDEX IF NOT EXISTS ai_sites_operational_status_idx ON public.ai_sites (operational_status);
CREATE INDEX IF NOT EXISTS ai_sites_ai_status_idx ON public.ai_sites (ai_status);

CREATE INDEX IF NOT EXISTS ai_operations_agents_site_id_idx ON public.ai_operations_agents (site_id);
CREATE INDEX IF NOT EXISTS ai_operations_agents_status_idx ON public.ai_operations_agents (status);
CREATE INDEX IF NOT EXISTS ai_operations_agents_category_idx ON public.ai_operations_agents (category);
CREATE INDEX IF NOT EXISTS ai_operations_agents_environment_idx ON public.ai_operations_agents (environment);

CREATE INDEX IF NOT EXISTS ai_tasks_site_id_idx ON public.ai_tasks (site_id);
CREATE INDEX IF NOT EXISTS ai_tasks_status_idx ON public.ai_tasks (status);
CREATE INDEX IF NOT EXISTS ai_tasks_task_type_idx ON public.ai_tasks (task_type);
CREATE INDEX IF NOT EXISTS ai_tasks_created_at_idx ON public.ai_tasks (created_at);

CREATE INDEX IF NOT EXISTS ai_runs_task_id_idx ON public.ai_runs (task_id);
CREATE INDEX IF NOT EXISTS ai_runs_site_id_idx ON public.ai_runs (site_id);
CREATE INDEX IF NOT EXISTS ai_runs_agent_id_idx ON public.ai_runs (agent_id);
CREATE INDEX IF NOT EXISTS ai_runs_status_idx ON public.ai_runs (status);
CREATE INDEX IF NOT EXISTS ai_runs_created_at_idx ON public.ai_runs (created_at);
CREATE INDEX IF NOT EXISTS ai_runs_correlation_id_idx ON public.ai_runs (correlation_id);

CREATE INDEX IF NOT EXISTS ai_run_steps_run_id_idx ON public.ai_run_steps (run_id);
CREATE INDEX IF NOT EXISTS ai_run_steps_status_idx ON public.ai_run_steps (status);

CREATE INDEX IF NOT EXISTS ai_approvals_site_id_idx ON public.ai_approvals (site_id);
CREATE INDEX IF NOT EXISTS ai_approvals_agent_id_idx ON public.ai_approvals (agent_id);
CREATE INDEX IF NOT EXISTS ai_approvals_run_id_idx ON public.ai_approvals (run_id);
CREATE INDEX IF NOT EXISTS ai_approvals_status_idx ON public.ai_approvals (status);
CREATE INDEX IF NOT EXISTS ai_approvals_requested_at_idx ON public.ai_approvals (requested_at);
CREATE INDEX IF NOT EXISTS ai_approvals_expires_at_idx ON public.ai_approvals (expires_at);

-- ---------------------------------------------------------------------------
-- 3. UPDATED_AT TRIGGERS (reuse existing public.set_updated_at())
-- ---------------------------------------------------------------------------
CREATE TRIGGER ai_sites_set_updated_at BEFORE UPDATE ON public.ai_sites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_operations_agents_set_updated_at BEFORE UPDATE ON public.ai_operations_agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_tasks_set_updated_at BEFORE UPDATE ON public.ai_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_runs_set_updated_at BEFORE UPDATE ON public.ai_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_approvals_set_updated_at BEFORE UPDATE ON public.ai_approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Least privilege: authenticated Command Centre staff (internal_role() IS
--    NOT NULL) may read; only owner/admin may write; only owner may delete.
--    Anonymous access is denied (no policies for the anon role).
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_operations_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_approvals ENABLE ROW LEVEL SECURITY;

-- ai_sites
CREATE POLICY ai_sites_select ON public.ai_sites FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_sites_insert ON public.ai_sites FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_sites_update ON public.ai_sites FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin')) WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_sites_delete ON public.ai_sites FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ai_operations_agents
CREATE POLICY ai_operations_agents_select ON public.ai_operations_agents FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_operations_agents_insert ON public.ai_operations_agents FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_operations_agents_update ON public.ai_operations_agents FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin')) WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_operations_agents_delete ON public.ai_operations_agents FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ai_tasks
CREATE POLICY ai_tasks_select ON public.ai_tasks FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_tasks_insert ON public.ai_tasks FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_tasks_update ON public.ai_tasks FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin')) WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_tasks_delete ON public.ai_tasks FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ai_runs
CREATE POLICY ai_runs_select ON public.ai_runs FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_runs_insert ON public.ai_runs FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_runs_update ON public.ai_runs FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin')) WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_runs_delete ON public.ai_runs FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ai_run_steps
CREATE POLICY ai_run_steps_select ON public.ai_run_steps FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_run_steps_insert ON public.ai_run_steps FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_run_steps_update ON public.ai_run_steps FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin')) WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_run_steps_delete ON public.ai_run_steps FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ai_approvals (governance: write restricted to owner/admin, delete owner only)
CREATE POLICY ai_approvals_select ON public.ai_approvals FOR SELECT TO authenticated USING (public.internal_role() IS NOT NULL);
CREATE POLICY ai_approvals_insert ON public.ai_approvals FOR INSERT TO authenticated WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_approvals_update ON public.ai_approvals FOR UPDATE TO authenticated USING (public.internal_role() IN ('owner','admin')) WITH CHECK (public.internal_role() IN ('owner','admin'));
CREATE POLICY ai_approvals_delete ON public.ai_approvals FOR DELETE TO authenticated USING (public.internal_role() = 'owner');

-- ---------------------------------------------------------------------------
-- 5. SEED (TEST / SANDBOX ONLY — schema verification, not production data)
-- ---------------------------------------------------------------------------
-- A single, clearly-labelled TEST/SANDBOX record per table to verify foreign
-- keys and RLS wiring. environment = 'sandbox', is_active = false.
-- Intentionally NOT a bulk copy of the demo registries.
-- ---------------------------------------------------------------------------
-- INSERT INTO public.ai_sites (... ) VALUES ('TEST / SANDBOX Site', ...);
-- INSERT INTO public.ai_operations_agents (... ) VALUES ('TEST / SANDBOX Agent', ...);
-- INSERT INTO public.ai_tasks (... ) VALUES ('TEST / SANDBOX Task', ...);
-- INSERT INTO public.ai_runs (... ) VALUES ('TEST / SANDBOX Run', ...);
-- INSERT INTO public.ai_run_steps (... ) VALUES ('TEST / SANDBOX Step', ...);
-- INSERT INTO public.ai_approvals (... ) VALUES ('TEST / SANDBOX Approval', ...);
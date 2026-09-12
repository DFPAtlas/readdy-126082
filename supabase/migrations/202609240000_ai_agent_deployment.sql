-- ============================================================================
-- AI Operations — Agent Deployment subpage (persistence extension).
--
-- Prompt 03: minimal, reviewed persistence extension to `ai_operations_agents`
-- to support the guided agent-deployment wizard:
--   * parent_agent_id  → sub-agent → site manager relationship (self-FK).
--   * workflow_id      → explicit agent → approved n8n workflow mapping.
--   * runtime_reference→ safe label (runtime bridge node key); no credential.
--   * responsibility   → short structured responsibility summary (NOT notes).
--   * setup_stage      → last completed wizard stage (draft resume).
--   * last_validated_at / last_validation_result → latest validation outcome.
--   * deployment_status→ 'draft' | 'ready'. There is NO 'deployed' state —
--                        activation is not connected (recorded honestly).
--
-- Server-side safety (least privilege + validation):
--   * Self-parenting blocked            → CHECK (parent_agent_id <> id).
--   * Cycles blocked                    → BEFORE trigger walks the parent chain.
--   * Cross-site parent blocked         → BEFORE trigger (same-site manager).
--   * RLS unchanged                     → reuses existing owner/admin write
--                                          policies on ai_operations_agents.
--
-- Creating an agent NEVER starts a workflow, alters runtime gates, or enables
-- execution. status remains 'not_configured'; activation is unsupported.
-- ============================================================================

ALTER TABLE public.ai_operations_agents
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.ai_operations_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workflow_id uuid REFERENCES public.ai_n8n_workflow_registry(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS runtime_reference text,
  ADD COLUMN IF NOT EXISTS responsibility text,
  ADD COLUMN IF NOT EXISTS setup_stage text,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_validation_result text,
  ADD COLUMN IF NOT EXISTS deployment_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_scope text;

-- Self-parenting is never valid.
ALTER TABLE public.ai_operations_agents
  DROP CONSTRAINT IF EXISTS ai_operations_agents_no_self_parent;
ALTER TABLE public.ai_operations_agents
  ADD CONSTRAINT ai_operations_agents_no_self_parent CHECK (parent_agent_id IS DISTINCT FROM id);

CREATE INDEX IF NOT EXISTS ai_operations_agents_parent_idx ON public.ai_operations_agents (parent_agent_id);
CREATE INDEX IF NOT EXISTS ai_operations_agents_workflow_idx ON public.ai_operations_agents (workflow_id);

-- ---------------------------------------------------------------------------
-- Cycle + cross-site parent guard (BEFORE INSERT / UPDATE).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_agents_prevent_parent_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cursor_id uuid := NEW.parent_agent_id;
  depth integer := 0;
BEGIN
  IF NEW.parent_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.site_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ai_operations_agents p
      WHERE p.id = NEW.parent_agent_id
        AND p.site_id IS DISTINCT FROM NEW.site_id
    ) THEN
      RAISE EXCEPTION 'Parent manager must belong to the same site.';
    END IF;
  END IF;

  WHILE cursor_id IS NOT NULL AND depth < 100 LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'Parent assignment would create a cycle.';
    END IF;
    SELECT parent_agent_id INTO cursor_id
      FROM public.ai_operations_agents
      WHERE id = cursor_id;
    depth := depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_operations_agents_parent_cycle_guard ON public.ai_operations_agents;
CREATE TRIGGER ai_operations_agents_parent_cycle_guard
  BEFORE INSERT OR UPDATE OF parent_agent_id, site_id ON public.ai_operations_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_agents_prevent_parent_cycle();
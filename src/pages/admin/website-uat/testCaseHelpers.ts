import { supabase } from '@/lib/supabase';

// ── Test case priority constants ─────────────────────────────────────────

export const TEST_CASE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const TEST_CASE_PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const TEST_CASE_PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-foreground-500/10 text-foreground-400',
  medium: 'bg-sky-500/10 text-sky-400',
  high: 'bg-amber-500/10 text-amber-400',
  critical: 'bg-red-500/10 text-red-400',
};

export const TEST_CASE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-foreground-500/10 text-foreground-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  archived: 'bg-foreground-500/10 text-foreground-600',
};

// ── Plan / scenario resolution ───────────────────────────────────────────

export interface ResolvedScenario {
  planId: string;
  scenarioId: string;
}

/**
 * Resolves (or lazily creates) the active test plan and the job-scoped
 * scenario required to attach a test case. A test case can never be orphaned:
 * scenario_id is mandatory, so this always returns a valid scenario id.
 *
 * Plan:      reuse the oldest non-archived plan for the project, else create one.
 * Scenario:  reuse the deterministic "<job title> Core Validation" scenario,
 *            else create one under the active plan.
 */
export async function resolvePlanAndScenario(
  projectId: string,
  projectName: string,
  jobTitle: string,
): Promise<ResolvedScenario> {
  // 1. Find an existing non-archived plan for the project.
  let planId: string | null = null;
  const { data: plans, error: planLookupErr } = await supabase
    .from('uat_test_plans')
    .select('id')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  if (planLookupErr) throw planLookupErr;

  if (plans && plans.length > 0) {
    planId = plans[0].id;
  } else {
    const { data: newPlan, error: planErr } = await supabase
      .from('uat_test_plans')
      .insert({
        project_id: projectId,
        name: `${projectName} UAT Plan`,
        objective: `Structured tester validation for ${projectName}.`,
        status: 'draft',
      })
      .select('id')
      .single();
    if (planErr) throw planErr;
    planId = newPlan.id;
  }

  // 2. Find or create the job-scoped scenario under the active plan.
  const scenarioTitle = `${jobTitle} Core Validation`;
  const { data: scenarios, error: scenarioLookupErr } = await supabase
    .from('uat_test_scenarios')
    .select('id')
    .eq('plan_id', planId)
    .eq('title', scenarioTitle)
    .limit(1);
  if (scenarioLookupErr) throw scenarioLookupErr;

  if (scenarios && scenarios.length > 0) {
    return { planId, scenarioId: scenarios[0].id };
  }

  const { data: newScenario, error: scenarioErr } = await supabase
    .from('uat_test_scenarios')
    .insert({
      plan_id: planId,
      title: scenarioTitle,
      description: 'Core acceptance checks for this UAT test run.',
      user_role: 'UAT Tester',
      business_journey: 'Tester validates the published website against the assigned acceptance cases.',
      priority: 'medium',
      expected_outcome: 'All required test cases can be completed and accurately recorded.',
    })
    .select('id')
    .single();
  if (scenarioErr) throw scenarioErr;

  return { planId, scenarioId: newScenario.id };
}

/**
 * Generates a readable, collision-free project-scoped reference (UAT-001, …).
 * Only parses existing `UAT-NNN` references in the same project; does not
 * mutate any existing reference.
 */
export async function generateReference(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('uat_test_cases')
    .select('reference')
    .eq('project_id', projectId);
  if (error) throw error;

  let maxNum = 0;
  (data || []).forEach((row: { reference?: string | null }) => {
    const match = (row.reference || '').match(/^UAT-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  });

  return `UAT-${String(maxNum + 1).padStart(3, '0')}`;
}

/** Returns the next sort_order for a new case within a job (max + 1). */
export async function nextSortOrder(jobId: string): Promise<number> {
  const { data, error } = await supabase
    .from('uat_test_cases')
    .select('sort_order')
    .eq('job_id', jobId);
  if (error) throw error;
  const max = (data || []).reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
  return max + 1;
}
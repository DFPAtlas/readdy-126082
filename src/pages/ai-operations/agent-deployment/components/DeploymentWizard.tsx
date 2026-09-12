// ============================================================================
// DFP AI Operations — Agent Deployment wizard (Prompt 03).
//
// A six-step guided workflow: identity → manager → runtime → permissions →
// validate → review. The draft is persisted to Supabase on every step change
// (so it reopens correctly after refresh) and never starts a workflow, alters
// a runtime gate, or enables execution.
// ============================================================================

import { useMemo, useState } from 'react';
import { useDeployment } from '@/pages/ai-operations/agent-deployment/deploymentStore';
import { validateDeployment, resultSummary } from '@/pages/ai-operations/agent-deployment/deploymentLogic';
import {
  SETUP_STAGES,
  SETUP_STAGE_LABELS,
  type DeploymentData,
  type DeploymentDraft,
  type SetupStage,
} from '@/pages/ai-operations/agent-deployment/types';
import IdentityStep from '@/pages/ai-operations/agent-deployment/components/steps/IdentityStep';
import ManagerStep from '@/pages/ai-operations/agent-deployment/components/steps/ManagerStep';
import RuntimeStep from '@/pages/ai-operations/agent-deployment/components/steps/RuntimeStep';
import PermissionsStep from '@/pages/ai-operations/agent-deployment/components/steps/PermissionsStep';
import ValidateStep from '@/pages/ai-operations/agent-deployment/components/steps/ValidateStep';
import ReviewStep from '@/pages/ai-operations/agent-deployment/components/steps/ReviewStep';

const STEPS = [IdentityStep, ManagerStep, RuntimeStep, PermissionsStep, ValidateStep, ReviewStep];

interface DeploymentWizardProps {
  initial: DeploymentDraft;
  onClose: () => void;
  onSaved: (draft: DeploymentDraft) => void;
}

export default function DeploymentWizard({ initial, onClose, onSaved }: DeploymentWizardProps) {
  const { sites, agents, workflows, runtimes, sitesAvailable, agentsAvailable, saveDraft, canWrite } = useDeployment();
  const [draft, setDraft] = useState<DeploymentDraft>(initial);
  const [step, setStep] = useState(() => SETUP_STAGES.indexOf(initial.setupStage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const data: DeploymentData = { sites, agents, workflows, runtimes, sitesAvailable, agentsAvailable };

  const summary = useMemo(
    () => validateDeployment(draft, agents, sites, workflows, runtimes),
    [draft, agents, sites, workflows, runtimes],
  );

  const patch = (p: Partial<DeploymentDraft>) => setDraft((d) => ({ ...d, ...p }));

  const persist = async (next: DeploymentDraft): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const res = await saveDraft(next);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    const withId = res.agentId ? { ...next, agentId: res.agentId } : next;
    setDraft(withId);
    setSavedAt(new Date());
    onSaved(withId);
    return true;
  };

  const goTo = async (index: number) => {
    if (saving) return;
    if (index === step) return;
    const next = { ...draft, setupStage: SETUP_STAGES[index] };
    const ok = await persist(next);
    if (ok) setStep(index);
  };

  const saveDraftNow = async () => {
    await persist({ ...draft });
  };

  const validateNow = async () => {
    const result = validateDeployment(draft, agents, sites, workflows, runtimes);
    const now = new Date();
    const next: DeploymentDraft = {
      ...draft,
      setupStage: 'validate' as SetupStage,
      deploymentStatus: result.ready ? 'ready' : 'draft',
      lastValidatedAt: now.toISOString(),
      lastValidationResult: resultSummary(result),
    };
    const ok = await persist(next);
    if (ok) setStep(SETUP_STAGES.length - 1);
  };

  const StepComponent = STEPS[step];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-heading font-bold text-foreground-50">Deploy Agent</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {draft.name.trim() ? draft.name.trim() : 'New agent'} · step {step + 1} of {SETUP_STAGES.length}
          </p>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 hover:text-foreground-100 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-close-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Cancel
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {SETUP_STAGES.map((stage, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={stage}
              onClick={() => void goTo(i)}
              className={`inline-flex items-center gap-2 text-xs font-label rounded-full px-3 py-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'bg-accent-500 text-background-950 font-semibold'
                  : isDone
                    ? 'bg-accent-500/10 text-accent-400'
                    : 'text-foreground-500 hover:text-foreground-200'
              }`}
            >
              <span className={`w-4 h-4 flex items-center justify-center ${isDone ? '' : 'opacity-70'}`}>
                {isDone ? <i className="ri-check-line"></i> : <i className="ri-circle-line"></i>}
              </span>
              {SETUP_STAGE_LABELS[stage]}
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Step content */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <StepComponent draft={draft} patch={patch} data={data} checks={summary.checks} canWrite={canWrite} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => void goTo(step - 1)}
              disabled={saving}
              className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <i className="ri-arrow-left-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {savedAt && (
            <span className="text-[11px] font-label text-foreground-600">
              Saved {savedAt.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}

          <button
            onClick={saveDraftNow}
            disabled={saving || !canWrite}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="ri-save-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Save draft
          </button>

          {(step === 4 || step === 5) && (
            <button
              onClick={validateNow}
              disabled={saving || !canWrite}
              className="inline-flex items-center gap-2 text-xs font-label bg-secondary-500 hover:bg-secondary-400 text-background-950 rounded-md px-3 py-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className="ri-shield-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Validate setup
            </button>
          )}

          {step < SETUP_STAGES.length - 1 ? (
            <button
              onClick={() => void goTo(step + 1)}
              disabled={saving || !canWrite}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Next
              <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
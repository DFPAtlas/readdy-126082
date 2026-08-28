import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRuntimeControls, refreshControls, findMasterSwitch, findRiskGate } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { evaluateRuntimeExecution, type RuntimeGateContext } from '@/lib/ai-operations/runtimeControls';

export interface RuntimeEligibilityProps {
  agentName: string;
  /** True when the agent exists in the live registry (registry presence only). */
  registryReady: boolean;
  /** True when a model is assigned in the registry. */
  modelAssigned: boolean;
}

export default function RuntimeEligibility({ agentName, registryReady, modelAssigned }: RuntimeEligibilityProps) {
  const { controls } = useRuntimeControls();

  useEffect(() => {
    void refreshControls();
  }, []);

  const master = findMasterSwitch(controls);
  const riskGate = findRiskGate(controls);

  const ctx: RuntimeGateContext = {
    masterKillSwitch: master ? { enabled: master.enabled, execution_allowed: master.execution_allowed } : null,
    environment: 'production',
    productionEnabled: false,
    siteGate: null,
    hasSite: false,
    agentGate: null,
    hasAgent: true,
    riskLevel: 'green',
    riskCeiling: (riskGate?.risk_ceiling as 'green' | 'amber' | 'red' | null) ?? 'green',
    approvalState: null,
    policyEffect: null,
    runtimeConfigured: false,
    runtimeHealthy: false,
    toolsReady: false,
    modelReady: modelAssigned,
    knowledgeReady: false,
    schedulerVerified: false,
    runtimeAvailable: false,
  };

  const decision = evaluateRuntimeExecution(ctx);

  const blockingGates = decision.gates.filter((g) => g.state === 'block').map((g) => g.label);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <i className="ri-git-close-pull-request-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Eligibility</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
          Runtime Blocked
        </span>
      </div>

      <div className="space-y-1.5">
        <EligibilityRow
          ok={registryReady}
          label="Registry Ready"
          okNote="Present in the live agent registry."
          badNote="Not present in the live registry."
        />
        <EligibilityRow
          ok={false}
          label="Runtime Execution"
          okNote="Runtime execution allowed."
          badNote="Master kill switch is active — runtime blocked."
        />
        <EligibilityRow
          ok={false}
          label="Model Provider Connectivity"
          okNote="Required model provider configured and reachable."
          badNote="Model provider not configured / not verified."
        />
        <EligibilityRow
          ok={false}
          label="Required Runtime Dependencies"
          okNote="Required dependencies (n8n, tools, knowledge) verified."
          badNote="Required runtime dependencies not configured."
        />
      </div>

      {blockingGates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-background-200/60">
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Blocking gates</p>
          <div className="flex flex-wrap gap-1.5">
            {blockingGates.map((label) => (
              <span key={label} className="inline-flex items-center gap-1 text-[11px] font-label text-foreground-500 bg-background-50 border border-background-300/60 rounded-full px-2 py-0.5 whitespace-nowrap">
                <i className="ri-close-circle-line text-red-400 w-3 h-3 flex items-center justify-center"></i>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-foreground-600 mt-3 leading-relaxed">
        <strong className="text-foreground-400">{agentName}</strong> is not runnable — registry presence does not imply runtime eligibility. See{' '}
        <Link to="/ai-operations/runtime-controls" className="text-accent-400 hover:text-accent-300 cursor-pointer">Runtime Controls</Link> for the full gate evaluation.
      </p>
    </section>
  );
}

function EligibilityRow({ ok, label, okNote, badNote }: { ok: boolean; label: string; okNote: string; badNote: string }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-foreground-100">{label}</p>
        <p className="text-xs text-foreground-500 mt-0.5">{ok ? okNote : badNote}</p>
      </div>
      {ok ? (
        <i className="ri-checkbox-circle-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
      ) : (
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
      )}
    </div>
  );
}
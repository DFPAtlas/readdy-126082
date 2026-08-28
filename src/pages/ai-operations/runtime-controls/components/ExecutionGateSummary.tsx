import { useEffect } from 'react';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { useRuntimeControls, refreshControls, findMasterSwitch, findRiskGate } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { evaluateRuntimeExecution, type RuntimeGateContext, type RuntimeExecutionState } from '@/lib/ai-operations/runtimeControls';
import GateEvaluation from '@/pages/ai-operations/runtime-controls/components/GateEvaluation';

function approvalToState(status: string | undefined): RuntimeGateContext['approvalState'] {
  if (status === 'approved' || status === 'approved_with_conditions') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'expired';
  if (status === 'pending' || status === 'under_review') return 'pending';
  return 'none';
}

export default function ExecutionGateSummary({ orchestration }: { orchestration: AiOrchestration }) {
  const { controls } = useRuntimeControls();

  useEffect(() => {
    void refreshControls();
  }, []);

  const master = findMasterSwitch(controls);
  const riskGate = findRiskGate(controls);

  const riskClass = orchestration.riskClass as 'green' | 'amber' | 'red' | undefined;

  const ctx: RuntimeGateContext = {
    masterKillSwitch: master ? { enabled: master.enabled, execution_allowed: master.execution_allowed } : null,
    environment: orchestration.environment ?? 'production',
    productionEnabled: false,
    siteGate: null,
    hasSite: !!orchestration.siteId && orchestration.siteId !== 'group',
    agentGate: null,
    hasAgent: !!orchestration.primaryAgentId,
    riskLevel: riskClass ?? 'green',
    riskCeiling: (riskGate?.risk_ceiling as 'green' | 'amber' | 'red' | null) ?? 'green',
    approvalState: approvalToState(orchestration.approvalGate?.status),
    policyEffect: null,
    runtimeConfigured: false,
    runtimeHealthy: false,
    toolsReady: false,
    modelReady: false,
    knowledgeReady: false,
    schedulerVerified: false,
    runtimeAvailable: false,
  };

  const decision = evaluateRuntimeExecution(ctx);

  return <GateEvaluation gates={decision.gates} state={decision.state as RuntimeExecutionState} />;
}
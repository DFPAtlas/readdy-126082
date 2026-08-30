import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRuntimeControls, refreshControls, findMasterSwitch } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { evaluateRuntimeExecution, buildDefaultGateContext } from '@/lib/ai-operations/runtimeControls';
import MasterKillSwitch from '@/pages/ai-operations/runtime-controls/components/MasterKillSwitch';
import EmergencyRuntimeFreeze from '@/pages/ai-operations/runtime-controls/components/EmergencyRuntimeFreeze';
import GatesPanel from '@/pages/ai-operations/runtime-controls/components/GatesPanel';
import GateEvaluation from '@/pages/ai-operations/runtime-controls/components/GateEvaluation';
import ControlHistory from '@/pages/ai-operations/runtime-controls/components/ControlHistory';
import ExecutionGatewayPanel from '@/pages/ai-operations/runtime-controls/components/ExecutionGatewayPanel';
import N8nConnectorPanel from '@/pages/ai-operations/runtime-controls/components/N8nConnectorPanel';
import RuntimeMessageBoundary from '@/pages/ai-operations/runtime-controls/components/RuntimeMessageBoundary';
import CallbackChannel from '@/pages/ai-operations/runtime-controls/components/CallbackChannel';
import PrivateRuntimeBridge from '@/pages/ai-operations/runtime-controls/components/PrivateRuntimeBridge';
import TransportProbeVerification from '@/pages/ai-operations/runtime-controls/components/TransportProbeVerification';
import OllamaInferenceProbeVerification from '@/pages/ai-operations/runtime-controls/components/OllamaInferenceProbeVerification';
import N8nSandboxProbeVerification from '@/pages/ai-operations/runtime-controls/components/N8nSandboxProbeVerification';
import RuntimeChainProbeVerification from '@/pages/ai-operations/runtime-controls/components/RuntimeChainProbeVerification';
import AgentDryRunProbeVerification from '@/pages/ai-operations/runtime-controls/components/AgentDryRunProbeVerification';
import ToolAccessDenialProbeVerification from '@/pages/ai-operations/runtime-controls/components/ToolAccessDenialProbeVerification';
import ToolAccessGrantProbeVerification from '@/pages/ai-operations/runtime-controls/components/ToolAccessGrantProbeVerification';
import ReadonlyToolProbeVerification from '@/pages/ai-operations/runtime-controls/components/ReadonlyToolProbeVerification';
import DiagnosticRunVerification from '@/pages/ai-operations/runtime-controls/components/DiagnosticRunVerification';
import ApprovalGatedRunVerification from '@/pages/ai-operations/runtime-controls/components/ApprovalGatedRunVerification';
import RuntimeFailureGovernance from '@/pages/ai-operations/runtime-controls/components/RuntimeFailureGovernance';

export default function RuntimeControlsPage() {
  const { controls, loading, error } = useRuntimeControls();

  useEffect(() => {
    void refreshControls();
  }, []);

  const master = findMasterSwitch(controls);
  const decision = evaluateRuntimeExecution(
    buildDefaultGateContext(master ? { enabled: master.enabled, execution_allowed: master.execution_allowed } : null),
  );

  if (loading && controls.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Loading runtime controls…</span>
        </div>
      </div>
    );
  }

  if (error && controls.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-alert-line text-red-400 text-2xl w-6 h-6 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-lg font-bold text-foreground-50 mb-2">Runtime controls unavailable</h1>
          <p className="text-sm text-foreground-500 mb-6">{error}</p>
          <button
            onClick={() => void refreshControls()}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Runtime Controls &amp; Execution Gates</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              <i className="ri-shield-cross-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Governance only
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-3xl">
            The central runtime safety-control layer that governs whether any AI Operations execution is allowed. These are governance controls only — nothing here executes an agent, workflow, model or tool, and no control change independently enables production.
          </p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 bg-background-100 border border-background-200/60 rounded-lg px-3 py-2">
          <i className="ri-lock-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center"></i>
          <span className="text-xs font-label text-foreground-100">Production Enabled = 0 · Overall NO-GO</span>
        </div>
      </div>

      {error && controls.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-3 flex items-start gap-3">
          <i className="ri-alert-line text-amber-400 text-lg w-5 h-5 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-amber-300/90">{error}</p>
        </div>
      )}

      {/* Master kill switch */}
      <MasterKillSwitch />

      {/* Emergency runtime freeze (Prompt 24C — block new dispatch, contain in-flight) */}
      <EmergencyRuntimeFreeze />

      {/* Site / agent / risk gates */}
      <GatesPanel />

      {/* Deterministic gate evaluation */}
      <GateEvaluation gates={decision.gates} state={decision.state} />

      {/* Execution gateway (deny-only runtime boundary) */}
      <ExecutionGatewayPanel />

      {/* n8n connector (read-only metadata adapter, dry-run only) */}
      <N8nConnectorPanel />

      {/* Runtime message boundary (signed inbound callbacks) */}
      <RuntimeMessageBoundary />

      {/* n8n callback channel (verification + recording only) */}
      <CallbackChannel />

      {/* Private runtime bridge (outbound-first local runtime connectivity) */}
      <PrivateRuntimeBridge />

      {/* Dry-run transport verification (cloud → HAL → cloud control-message path) */}
      <TransportProbeVerification />

      {/* Controlled Ollama sandbox inference probe (Prompt 11A fixed diagnostic) */}
      <OllamaInferenceProbeVerification />

      {/* Controlled n8n sandbox workflow probe (Prompt 12 fixed diagnostic) */}
      <N8nSandboxProbeVerification />

      {/* Controlled multi-runtime chain probe (Prompt 13 fixed n8n → Ollama diagnostic) */}
      <RuntimeChainProbeVerification />

      {/* Controlled registered-agent dry-run probe (Prompt 14 fixed agent → model diagnostic) */}
      <AgentDryRunProbeVerification />

      {/* Controlled tool access denial probe (Prompt 15 cloud-side authorization check) */}
      <ToolAccessDenialProbeVerification />

      {/* Controlled tool access grant probe (Prompt 16 cloud-side authorization check) */}
      <ToolAccessGrantProbeVerification />

      {/* Controlled read-only tool probe (Prompt 17 first callable read-only tool) */}
      <ReadonlyToolProbeVerification />

      {/* Runtime-backed diagnostic run (Prompt 18 first persisted task/run lifecycle) */}
      <DiagnosticRunVerification />

      {/* Human approval-gated run (Prompt 19 first approval-gated diagnostic lifecycle) */}
      <ApprovalGatedRunVerification />
      <RuntimeFailureGovernance />

      {/* Change history */}
      <ControlHistory />

      {/* Cross-link */}
      <div className="flex items-center gap-3 text-xs text-foreground-600">
        <i className="ri-information-line w-4 h-4 flex items-center justify-center"></i>
        <p>
          Runtime controls work alongside <Link to="/ai-operations/runtime-health" className="text-accent-400 hover:text-accent-300 cursor-pointer">Runtime Health</Link> and are reflected in the{' '}
          <Link to="/ai-operations/readiness" className="text-accent-400 hover:text-accent-300 cursor-pointer">Production Readiness</Link> audit. Execution remains disabled in this phase.
        </p>
      </div>
    </div>
  );
}
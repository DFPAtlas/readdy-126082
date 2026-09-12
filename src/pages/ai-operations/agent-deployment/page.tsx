// ============================================================================
// DFP AI Operations — Agent Deployment subpage (Prompt 03).
//
// Group-wide agent setup and deployment-readiness workflow. Lists saved agent
// setups and launches the six-step guided wizard. Everything persists through
// the existing authorised registry services; nothing starts a workflow or
// alters a runtime gate.
// ============================================================================

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DeploymentProvider,
  useDeployment,
} from '@/pages/ai-operations/agent-deployment/deploymentStore';
import { draftFromAgent } from '@/pages/ai-operations/agent-deployment/deploymentLogic';
import { newDraft, type DeploymentDraft } from '@/pages/ai-operations/agent-deployment/types';
import SetupList from '@/pages/ai-operations/agent-deployment/components/SetupList';
import DeploymentWizard from '@/pages/ai-operations/agent-deployment/components/DeploymentWizard';
import type { AiAgentRow } from '@/lib/ai-operations';

function DeploymentPage() {
  const { sites, agents, workflows, runtimes, loading, error, canWrite } = useDeployment();
  const [wizardDraft, setWizardDraft] = useState<DeploymentDraft | null>(null);

  const siteName = useMemo(() => {
    const m = new Map(sites.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? 'Unknown site';
  }, [sites]);

  const agentName = useMemo(() => {
    const m = new Map(agents.map((a) => [a.id, a.name]));
    return (id: string) => m.get(id) ?? 'Unknown agent';
  }, [agents]);

  const workflowName = useMemo(() => {
    const m = new Map(workflows.map((w) => [w.id, w.name ?? w.workflow_key]));
    return (id: string) => m.get(id) ?? 'Unknown workflow';
  }, [workflows]);

  const runtimeName = useMemo(() => {
    const m = new Map(runtimes.map((n) => [n.node_key, n.name ?? n.node_key]));
    return (key: string) => m.get(key) ?? key;
  }, [runtimes]);

  const startNew = () => setWizardDraft(newDraft());
  const continueSetup = (agent: AiAgentRow) => setWizardDraft(draftFromAgent(agent));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Agent Deployment</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              Registry only
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Guided setup and deployment-readiness for agents across every Digital Footprint site. Saving a setup records registry metadata only — it never starts a workflow or alters a runtime gate.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <Link
            to="/ai-operations/agents"
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-database-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Agent Registry
          </Link>
          {canWrite && (
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Deploy Agent
            </button>
          )}
        </div>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-full h-8 bg-background-200/60 rounded-md"></div>
            </div>
          ))}
          <p className="text-xs font-label text-foreground-600 pt-2">Loading agent registry…</p>
        </div>
      )}

      {!loading && error && !wizardDraft && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-cloud-off-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Agent registry unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2 max-w-lg mx-auto">{error}</p>
        </div>
      )}

      {/* Wizard or list */}
      {!loading && wizardDraft ? (
        <DeploymentWizard
          initial={wizardDraft}
          onClose={() => setWizardDraft(null)}
          onSaved={() => {
            // The provider refreshes the agent list after each save; keep the
            // wizard open so the operator can continue between steps.
          }}
        />
      ) : !loading && !error ? (
        <SetupList
          agents={agents}
          siteName={siteName}
          agentName={agentName}
          workflowName={workflowName}
          runtimeName={runtimeName}
          onContinue={continueSetup}
          canWrite={canWrite}
        />
      ) : null}

      {/* Activation honesty note */}
      {!loading && !wizardDraft && !error && (
        <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-1">Deployment status</p>
          <p className="text-sm text-foreground-500">
            Registration, validation and deployment are kept distinct. Activation is not connected — a saved setup that passes validation is marked &ldquo;Ready for deployment&rdquo;, never &ldquo;Deployed&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AgentDeploymentPage() {
  return (
    <DeploymentProvider>
      <DeploymentPage />
    </DeploymentProvider>
  );
}
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAgents } from '@/pages/ai-operations/agents/AgentsContext';
import { useAgentIntegrations } from '@/pages/ai-operations/agents/detail/agentIntegrations';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import AgentHeader from '@/pages/ai-operations/agents/detail/components/AgentHeader';
import AgentOverview from '@/pages/ai-operations/agents/detail/components/AgentOverview';
import ModelConfiguration from '@/pages/ai-operations/agents/detail/components/ModelConfiguration';
import KnowledgeSources from '@/pages/ai-operations/agents/detail/components/KnowledgeSources';
import LiveModelConfiguration from '@/pages/ai-operations/agents/detail/components/LiveModelConfiguration';
import LiveKnowledgeSources from '@/pages/ai-operations/agents/detail/components/LiveKnowledgeSources';
import LiveAgentTools from '@/pages/ai-operations/agents/detail/components/LiveAgentTools';
import SecurityPolicies from '@/pages/ai-operations/agents/detail/components/SecurityPolicies';
import CostUsage from '@/pages/ai-operations/agents/detail/components/CostUsage';
import AgentTools from '@/pages/ai-operations/agents/detail/components/AgentTools';
import DataPermissions from '@/pages/ai-operations/agents/detail/components/DataPermissions';
import ActionPermissions from '@/pages/ai-operations/agents/detail/components/ActionPermissions';
import ApprovalPolicy from '@/pages/ai-operations/agents/detail/components/ApprovalPolicy';
import AgentDependencies from '@/pages/ai-operations/agents/detail/components/AgentDependencies';
import RecentRuns from '@/pages/ai-operations/agents/detail/components/RecentRuns';
import AgentEvents from '@/pages/ai-operations/agents/detail/components/AgentEvents';
import AgentFormModal from '@/pages/ai-operations/agents/components/AgentFormModal';
import RuntimeEligibility from '@/pages/ai-operations/runtime-controls/components/RuntimeEligibility';
import AgentRuntimeRequestReadiness from '@/pages/ai-operations/runtime-controls/components/AgentRuntimeRequestReadiness';
import AgentN8nMapping from '@/pages/ai-operations/runtime-controls/components/AgentN8nMapping';

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { agents, mode, updateAgent, setAgentStatus, sites, sitesAvailable } = useAgents();
  const [editOpen, setEditOpen] = useState(false);

  const live = mode === 'live';
  const integrations = useAgentIntegrations(agentId ?? '', live);

  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-robot-2-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Agent not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested agent does not exist in the registry.</p>
        <Link
          to="/ai-operations/agents"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data source + live/demo distinction */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <DataSourceBadge mode={mode} />
        <p className="text-xs text-foreground-500">
          {live
            ? 'Live Agent Record — base identity, registered tool access, model assignments and knowledge permissions are read from Supabase. Sections below the divider remain supporting metadata with no production runtime yet.'
            : mode === 'demo'
              ? 'Demo Data — this agent record is from the mock registry.'
              : 'Live agent data is unavailable; the registry may be in an error state.'}
        </p>
      </div>

      <AgentHeader
        agent={agent}
        onEdit={() => setEditOpen(true)}
        onPause={() => void setAgentStatus(agent.id, 'paused')}
        onDisable={() => void setAgentStatus(agent.id, 'disabled')}
      />

      <AgentOverview agent={agent} />

      {/* Runtime eligibility (derived from the gate evaluator — not registry) */}
      <RuntimeEligibility
        agentName={agent.name}
        registryReady={live}
        modelAssigned={live ? integrations.models.items.length > 0 : !!agent.model?.primaryModel}
      />

      {/* Future-runtime request readiness (gateway view, no execution) */}
      <AgentRuntimeRequestReadiness agentName={agent.name} />

      {/* n8n runtime mapping (display-only, execution disabled) */}
      <AgentN8nMapping agentName={agent.name} />

      {/* Live cross-module wiring (tools / models / knowledge) */}
      {live ? (
        <>
          <LiveModelConfiguration state={integrations.models.state} items={integrations.models.items} />
          <LiveKnowledgeSources state={integrations.knowledge.state} items={integrations.knowledge.items} />
          <LiveAgentTools state={integrations.tools.state} items={integrations.tools.items} />
        </>
      ) : (
        <>
          <ModelConfiguration model={agent.model} />
          <KnowledgeSources agentId={agent.id} />
          <AgentTools tools={agent.tools} />
        </>
      )}

      {/* Still supporting / runtime-pending metadata — no live production tables yet */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-background-200/60"></div>
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">
          Supporting Metadata · Runtime Pending
        </span>
        <div className="h-px flex-1 bg-background-200/60"></div>
      </div>

      <DataPermissions permissions={agent.dataPermissions} />
      <ActionPermissions actions={agent.actionPermissions} />
      <SecurityPolicies agentId={agent.id} />
      <CostUsage agentId={agent.id} />
      <ApprovalPolicy policy={agent.approvalPolicy} />
      <AgentDependencies dependencies={agent.dependencies} />
      <RecentRuns runs={agent.runs} />
      <AgentEvents events={agent.events} />

      <AgentFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        agent={agent}
        mode={mode}
        sites={sites}
        sitesAvailable={sitesAvailable}
        onSave={(record) => updateAgent(agent.id, record)}
      />
    </div>
  );
}
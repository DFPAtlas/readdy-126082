// ============================================================================
// DFP AI Operations — Agent Deployment — saved setup list.
//
// Read-only list of every registered agent as a "saved setup", showing role,
// site, parent manager, runtime + workflow mapping, setup stage and the last
// validation result. Actions: Continue setup (reopens the wizard) and View
// agent (links into the Central Agent Registry detail page).
// ============================================================================

import { Link } from 'react-router-dom';
import type { AiAgentRow } from '@/lib/ai-operations';
import { deriveRole } from '@/pages/ai-operations/agent-deployment/deploymentLogic';
import {
  ROLE_LABELS,
  SETUP_STAGE_LABELS,
  type SetupStage,
} from '@/pages/ai-operations/agent-deployment/types';

interface SetupListProps {
  agents: AiAgentRow[];
  siteName: (id: string) => string;
  agentName: (id: string) => string;
  workflowName: (id: string) => string;
  runtimeName: (key: string) => string;
  onContinue: (agent: AiAgentRow) => void;
  canWrite: boolean;
}

const stagePill = (stage: string | null) => {
  if (!stage) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-500 whitespace-nowrap">Not started</span>;
  }
  const key = stage as SetupStage;
  const label = SETUP_STAGE_LABELS[key] ?? 'Not started';
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-400 whitespace-nowrap">{label}</span>;
};

function resultPill(result: string | null) {
  if (!result) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-500 whitespace-nowrap">Not validated</span>;
  }
  const failed = /failed|blocked/i.test(result);
  const passed = /passed/i.test(result);
  const tone = failed ? 'border-red-500/30 text-red-400' : passed ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border ${tone} whitespace-nowrap`}>{result}</span>;
}

function rolePill(role: ReturnType<typeof deriveRole>) {
  const tones = {
    site_manager: 'border-accent-500/30 text-accent-400',
    sub_agent: 'border-secondary-500/30 text-secondary-300',
    shared_agent: 'border-background-300/50 text-foreground-400',
  } as const;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border ${tones[role]} whitespace-nowrap`}>{ROLE_LABELS[role]}</span>;
}

function SetupCard({
  agent,
  siteName,
  agentName,
  workflowName,
  runtimeName,
  onContinue,
  canWrite,
}: Omit<SetupListProps, 'agents'> & { agent: AiAgentRow }) {
  const role = deriveRole(agent);
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground-200">{agent.name}</p>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5">{agent.site_id ? siteName(agent.site_id) : 'Group-wide'}</p>
        </div>
        {rolePill(role)}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {stagePill(agent.setup_stage)}
        {resultPill(agent.last_validation_result)}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-label text-foreground-500">
        <div>
          <span className="text-foreground-600">Parent:</span> {agent.parent_agent_id ? agentName(agent.parent_agent_id) : '—'}
        </div>
        <div>
          <span className="text-foreground-600">Runtime:</span> {agent.runtime_reference ? runtimeName(agent.runtime_reference) : '—'}
        </div>
        <div className="col-span-2">
          <span className="text-foreground-600">Workflow:</span> {agent.workflow_id ? workflowName(agent.workflow_id) : '—'}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {canWrite && (
          <button
            onClick={() => onContinue(agent)}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-pencil-line w-4 h-4 flex items-center justify-center"></i>
            Continue setup
          </button>
        )}
        <Link
          to={`/ai-operations/agents/${agent.agent_key}`}
          className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 hover:text-foreground-100 border border-background-300/50 rounded-md px-2.5 py-1.5 hover:border-background-300/80 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
          View agent
        </Link>
      </div>
    </div>
  );
}

export default function SetupList(props: SetupListProps) {
  const { agents } = props;
  if (agents.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
        <i className="ri-robot-2-line text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto"></i>
        <h2 className="text-base font-heading font-semibold text-foreground-100 mt-4">No agents registered yet</h2>
        <p className="text-sm text-foreground-500 mt-2 max-w-md mx-auto">
          Use the guided wizard to set up and validate your first agent across the group.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-background-100 border border-background-200/60 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">Runtime</th>
                <th className="px-4 py-3 font-medium">Workflow</th>
                <th className="px-4 py-3 font-medium">Setup Stage</th>
                <th className="px-4 py-3 font-medium">Validation</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{agent.name}</td>
                  <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{agent.site_id ? props.siteName(agent.site_id) : 'Group-wide'}</td>
                  <td className="px-4 py-3">{rolePill(deriveRole(agent))}</td>
                  <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{agent.parent_agent_id ? props.agentName(agent.parent_agent_id) : '—'}</td>
                  <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{agent.runtime_reference ? props.runtimeName(agent.runtime_reference) : '—'}</td>
                  <td className="px-4 py-3 text-foreground-500 font-label max-w-[180px] truncate" title={agent.workflow_id ? props.workflowName(agent.workflow_id) : ''}>{agent.workflow_id ? props.workflowName(agent.workflow_id) : '—'}</td>
                  <td className="px-4 py-3">{stagePill(agent.setup_stage)}</td>
                  <td className="px-4 py-3">{resultPill(agent.last_validation_result)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {props.canWrite && (
                        <button
                          onClick={() => props.onContinue(agent)}
                          className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                        >
                          Continue setup
                        </button>
                      )}
                      <Link
                        to={`/ai-operations/agents/${agent.agent_key}`}
                        className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 hover:text-foreground-100 border border-background-300/50 rounded-md px-2.5 py-1.5 hover:border-background-300/80 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {agents.map((agent) => (
          <SetupCard key={agent.id} agent={agent} siteName={props.siteName} agentName={props.agentName} workflowName={props.workflowName} runtimeName={props.runtimeName} onContinue={props.onContinue} canWrite={props.canWrite} />
        ))}
      </div>
    </>
  );
}
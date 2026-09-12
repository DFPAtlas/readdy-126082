// ============================================================================
// DFP AI Operations — Group Agent Network selection details panel.
//
// Read-only details for the selected node (centre / site / agent), with a
// stable link into the existing agent or site detail page. This is the
// "agent-selection details area" that Prompt 02 builds on.
// ============================================================================

import { Link } from 'react-router-dom';
import {
  AI_INFRA_STATE_META,
} from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import {
  MASTER_AGENT_STATE_META,
  NETWORK_AGENT_STATE_META,
  ASSIGNMENT_ISSUE_LABEL,
  TONE_HEX,
  type GroupNetworkModel,
  type NetworkAgent,
  type NetworkSite,
} from '@/pages/ai-operations/network/networkSelectors';
import type { SelectTarget } from '@/pages/ai-operations/network/NetworkDiagram';

function findAgent(model: GroupNetworkModel, id: string): NetworkAgent | null {
  for (const a of model.center.sharedAgents) if (a.id === id) return a;
  for (const s of model.sites) {
    for (const a of s.managers) if (a.id === id) return a;
    for (const a of s.workers) if (a.id === id) return a;
  }
  return null;
}

function findSite(model: GroupNetworkModel, siteKey: string): NetworkSite | null {
  return model.sites.find((s) => s.siteKey === siteKey) ?? null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gn-detail-row">
      <span className="gn-detail-label">{label}</span>
      <span className="gn-detail-value">{children}</span>
    </div>
  );
}

function AgentLines({ agents }: { agents: NetworkAgent[] }) {
  if (agents.length === 0) return <span className="gn-muted">None</span>;
  return (
    <div className="space-y-1.5">
      {agents.map((a) => (
        <Link
          key={a.id}
          to={`/ai-operations/agents/${a.agentKey}`}
          className="gn-detail-agent"
        >
          <span className="gn-node-title" title={a.name}>{a.name}</span>
          <span className="gn-pill" style={{ color: TONE_HEX[a.tone], borderColor: `${TONE_HEX[a.tone]}44`, background: `${TONE_HEX[a.tone]}12` }}>
            {NETWORK_AGENT_STATE_META[a.status].label}
          </span>
        </Link>
      ))}
    </div>
  );
}

function CenterDetails({ model }: { model: GroupNetworkModel }) {
  const orch = model.center.orchestrator;
  const orchMeta = orch ? MASTER_AGENT_STATE_META[orch.state] : null;
  const oversight = AI_INFRA_STATE_META[model.center.oversight.state];
  const hal = model.center.hal ? AI_INFRA_STATE_META[model.center.hal.state] : null;

  return (
    <>
      <Row label="Orchestrator">{orch ? orch.name : 'Not registered'}</Row>
      <Row label="Orchestrator state">{orch ? orchMeta?.label : '—'}</Row>
      {orch?.currentTask && <Row label="Current task">{orch.currentTask}</Row>}
      <Row label="TRON oversight">
        <span style={{ color: TONE_HEX[oversight.tone] }}>{oversight.label}</span>
      </Row>
      <Row label="HAL execution host">
        <span style={{ color: hal ? TONE_HEX[hal.tone] : TONE_HEX.secondary }}>
          {hal ? hal.label : 'Not registered'}
        </span>
      </Row>
      {model.center.oversight.detail && <Row label="Oversight detail">{model.center.oversight.detail}</Row>}
      <div className="gn-detail-divider" />
      <div className="gn-detail-subhead">Shared / group agents</div>
      <AgentLines agents={model.center.sharedAgents} />
    </>
  );
}

function SiteDetails({ site }: { site: NetworkSite }) {
  return (
    <>
      <Row label="Site">{site.name}</Row>
      <Row label="Key">{site.siteKey}</Row>
      <Row label="Assignment">
        <span style={{ color: TONE_HEX[site.assignmentIssue === 'no_manager' ? 'amber' : site.assignmentIssue === 'multiple_managers' ? 'red' : 'emerald'] }}>
          {ASSIGNMENT_ISSUE_LABEL[site.assignmentIssue]}
        </span>
      </Row>
      <div className="gn-detail-divider" />
      <div className="gn-detail-subhead">Manager{site.managers.length === 1 ? '' : 's'}</div>
      <AgentLines agents={site.managers} />
      <div className="gn-detail-subhead mt-3">Sub-agents ({site.workers.length})</div>
      <AgentLines agents={site.workers} />
      <Link to={`/ai-operations/sites/${site.siteKey}`} className="gn-detail-link">
        <i className="ri-external-link-line"></i> Open site AI Ops
      </Link>
    </>
  );
}

function AgentDetails({ agent }: { agent: NetworkAgent }) {
  const meta = NETWORK_AGENT_STATE_META[agent.status];
  return (
    <>
      <Row label="Agent">{agent.name}</Row>
      <Row label="Category">{agent.categoryLabel}</Row>
      <Row label="Status">
        <span style={{ color: TONE_HEX[agent.tone] }}>{meta.label}</span>
      </Row>
      <Row label="Current task">{agent.currentTask || 'No active task'}</Row>
      {agent.lastActivity && <Row label="Last activity">{agent.lastActivity}</Row>}
      {agent.hasLiveEvidence && (
        <Row label="Run evidence">
          <span style={{ color: TONE_HEX.emerald }}>Fresh working run</span>
        </Row>
      )}
      <Link to={`/ai-operations/agents/${agent.agentKey}`} className="gn-detail-link">
        <i className="ri-external-link-line"></i> Open agent detail
      </Link>
    </>
  );
}

interface AgentDetailPanelProps {
  model: GroupNetworkModel;
  selected: SelectTarget;
  onClose: () => void;
}

export default function AgentDetailPanel({ model, selected, onClose }: AgentDetailPanelProps) {
  let title: string;
  let body: React.ReactNode;

  if (selected.kind === 'center') {
    title = 'DFP Group Oversight';
    body = <CenterDetails model={model} />;
  } else if (selected.kind === 'site') {
    const site = findSite(model, selected.siteKey);
    title = site ? site.name : 'Site';
    body = site ? <SiteDetails site={site} /> : <span className="gn-muted">Site not found.</span>;
  } else {
    const agent = findAgent(model, selected.agentId);
    title = agent ? agent.name : 'Agent';
    body = agent ? <AgentDetails agent={agent} /> : <span className="gn-muted">Agent not found.</span>;
  }

  return (
    <aside className="gn-detail-panel" aria-label="Selection details">
      <div className="gn-detail-head">
        <span className="gn-detail-title">{title}</span>
        <button type="button" onClick={onClose} className="gn-zoom-btn" title="Close details">
          <i className="ri-close-line"></i>
        </button>
      </div>
      <div className="gn-detail-body">{body}</div>
    </aside>
  );
}
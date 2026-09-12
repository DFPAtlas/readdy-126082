// ============================================================================
// DFP AI Operations — Group Agent Network list view (mobile / small screens).
//
// An expandable site/agent list that mirrors the radial diagram: a centre
// summary, a shared-agents section, then one collapsible block per site with
// its manager(s) and sub-agents. Honest states (manager not assigned,
// duplicate managers) are preserved.
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AI_INFRA_STATE_META,
} from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import {
  NETWORK_AGENT_STATE_META,
  ASSIGNMENT_ISSUE_LABEL,
  TONE_HEX,
  type GroupNetworkModel,
  type NetworkSite,
  type NetworkAgent,
} from '@/pages/ai-operations/network/networkSelectors';
import type { SelectTarget } from '@/pages/ai-operations/network/NetworkDiagram';

function AgentRow({ agent }: { agent: NetworkAgent }) {
  const meta = NETWORK_AGENT_STATE_META[agent.status];
  return (
    <Link to={`/ai-operations/agents/${agent.agentKey}`} className="gn-list-agent">
      <span className="gn-list-agent-head">
        <span className="gn-node-title" title={agent.name}>{agent.name}</span>
        <span
          className="gn-pill"
          style={{ color: TONE_HEX[agent.tone], borderColor: `${TONE_HEX[agent.tone]}44`, background: `${TONE_HEX[agent.tone]}12` }}
        >
          {meta.label}
        </span>
      </span>
      <span className="gn-node-sub">{agent.categoryLabel}</span>
      <span className="gn-node-task">{agent.currentTask || 'No active task'}</span>
    </Link>
  );
}

function SiteBlock({ site }: { site: NetworkSite }) {
  const [open, setOpen] = useState(false);
  const issueTone =
    site.assignmentIssue === 'no_manager' ? 'amber' : site.assignmentIssue === 'multiple_managers' ? 'red' : 'emerald';

  return (
    <div className="gn-list-site">
      <button type="button" onClick={() => setOpen((o) => !o)} className="gn-list-site-head">
        <span className="gn-node-badge" style={{ background: site.colorHex }}>{site.initials}</span>
        <span className="gn-list-site-name" title={site.name}>{site.name}</span>
        <span className="gn-pill" style={{ color: TONE_HEX[issueTone], borderColor: `${TONE_HEX[issueTone]}44`, background: `${TONE_HEX[issueTone]}12` }}>
          {ASSIGNMENT_ISSUE_LABEL[site.assignmentIssue]}
        </span>
        <span className="gn-list-count">{site.managers.length + site.workers.length}</span>
        <i className={open ? 'ri-arrow-up-s-line gn-list-chevron' : 'ri-arrow-down-s-line gn-list-chevron'}></i>
      </button>

      {open && (
        <div className="gn-list-site-body">
          <div className="gn-detail-subhead">Manager{site.managers.length === 1 ? '' : 's'}</div>
          {site.managers.length === 0 ? (
            <span className="gn-muted">Manager not assigned</span>
          ) : (
            site.managers.map((m) => <AgentRow key={m.id} agent={m} />)
          )}
          <div className="gn-detail-subhead mt-2">Sub-agents ({site.workers.length})</div>
          {site.workers.length === 0 ? (
            <span className="gn-muted">No sub-agents</span>
          ) : (
            site.workers.map((w) => <AgentRow key={w.id} agent={w} />)
          )}
        </div>
      )}
    </div>
  );
}

interface NetworkListViewProps {
  model: GroupNetworkModel;
  onSelect: (t: SelectTarget) => void;
}

export default function NetworkListView({ model, onSelect }: NetworkListViewProps) {
  const [sharedOpen, setSharedOpen] = useState(false);
  const orch = model.center.orchestrator;
  const oversight = AI_INFRA_STATE_META[model.center.oversight.state];
  const hal = model.center.hal ? AI_INFRA_STATE_META[model.center.hal.state] : null;

  return (
    <div className="gn-list" role="list">
      {/* Centre summary */}
      <button type="button" onClick={() => onSelect({ kind: 'center' })} className="gn-list-center">
        <i className="ri-radar-line gn-list-center-icon"></i>
        <span className="gn-list-center-main">
          <span className="gn-node-title">DFP Group Oversight</span>
          <span className="gn-node-sub">
            {orch ? orch.name : 'Orchestrator not registered'} · TRON {oversight.label} · HAL {hal ? hal.label : 'not registered'}
          </span>
        </span>
      </button>

      {/* Shared agents */}
      {model.center.sharedAgents.length > 0 && (
        <div className="gn-list-site">
          <button type="button" onClick={() => setSharedOpen((o) => !o)} className="gn-list-site-head">
            <span className="gn-node-badge gn-node-badge-shared">G</span>
            <span className="gn-list-site-name">Shared / group agents</span>
            <span className="gn-list-count">{model.center.sharedAgents.length}</span>
            <i className={sharedOpen ? 'ri-arrow-up-s-line gn-list-chevron' : 'ri-arrow-down-s-line gn-list-chevron'}></i>
          </button>
          {sharedOpen && (
            <div className="gn-list-site-body">
              {model.center.sharedAgents.map((a) => <AgentRow key={a.id} agent={a} />)}
            </div>
          )}
        </div>
      )}

      {model.sites.map((site) => (
        <SiteBlock key={site.siteKey} site={site} />
      ))}

      {model.sites.length === 0 && <div className="gn-muted gn-list-empty">No sites match the current filters.</div>}
    </div>
  );
}
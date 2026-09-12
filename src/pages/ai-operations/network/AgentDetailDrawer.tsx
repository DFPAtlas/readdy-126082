// ============================================================================
// DFP AI Operations — Agent detail drawer (right-side on desktop, full-screen
// on mobile). Opened by clicking a manager or sub-agent in the network.
//
// Read-only detail surface: identity, site, category, assigned manager,
// registered configuration status, explicit runtime + workflow mappings,
// current/last-successful execution, latest alerts, pending approvals, and the
// site manager's live report (four separate signals). No credentials, raw
// workflow JSON, private message bodies or execution payloads are shown.
//
// Controls: registry pause/disable is delegated to the existing agent detail
// page (authorised action); actual runtime pause/stop is NOT supported and is
// shown honestly as unavailable. Emergency freeze lives on the runtime-controls
// page (link only). No frontend-only buttons that fake a success state.
// ============================================================================

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  NETWORK_AGENT_STATE_META,
  TONE_HEX,
  type Tone,
} from '@/pages/ai-operations/network/networkSelectors';
import { getAgentDetail, type AgentDetailModel } from '@/pages/ai-operations/network/agentDetailSelectors';
import type { SiteManagerReport } from '@/pages/ai-operations/network/siteManagerReportSelectors';

function toneHex(t: Tone | 'muted' | 'green' | 'amber' | 'red'): string {
  if (t === 'muted' || t === 'secondary') return TONE_HEX.secondary;
  if (t === 'green' || t === 'emerald') return TONE_HEX.emerald;
  if (t === 'amber') return TONE_HEX.amber;
  if (t === 'red') return TONE_HEX.red;
  return TONE_HEX.accent;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gn-detail-row">
      <span className="gn-detail-label">{label}</span>
      <span className="gn-detail-value">{children}</span>
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="gn-pill" style={{ color, borderColor: `${color}44`, background: `${color}12` }}>
      {label}
    </span>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <div className="gn-detail-subhead gn-drawer-subhead">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <span className="gn-muted">{text}</span>;
}

function ReportSection({ report }: { report: SiteManagerReport | null }) {
  if (!report) return null;
  const reportingColor = toneHex(report.reportingTone);
  const workflowColor = toneHex(report.workflowStatusTone);
  const businessColor = toneHex(report.businessHealthTone);

  return (
    <>
      <Subhead>Manager report</Subhead>
      {report.source === 'not_mapped' ? (
        <Empty text="No report mapping configured for this site." />
      ) : report.source === 'unavailable' ? (
        <Empty text="Report query unavailable." />
      ) : (
        <div className="gn-drawer-report">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-foreground-100 truncate">
              {report.manager ?? report.workflowLabel ?? 'Manager'}
            </span>
            <span className="font-mono text-[9px] text-foreground-500 tabular-nums">
              {report.observedAt ? `${report.ageLabel} ago` : '—'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Pill color={reportingColor} label={`REPORT ${report.reportingLabel}`} />
            {report.workflowStatusLabel && <Pill color={workflowColor} label={report.workflowStatusLabel} />}
            {report.businessHealth && <Pill color={businessColor} label={`BUSINESS ${report.businessHealth}`} />}
          </div>
          {report.reasons.length > 0 && (
            <div className="mt-1.5 text-[10px] text-foreground-500 leading-snug">
              {report.reasons.join(' · ')}
            </div>
          )}
          {report.metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {report.metrics.map((m) => (
                <div key={m.key} className="flex flex-col leading-none">
                  <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground-100">
                    {m.value == null ? <span className="text-foreground-600">Unavail.</span> : m.truncated ? `${m.value}+` : m.value}
                  </span>
                  <span className="text-[7px] font-label tracking-[0.08em] text-foreground-600 uppercase mt-0.5">{m.label}</span>
                </div>
              ))}
            </div>
          )}
          {report.anyTruncated && (
            <div className="mt-1 text-[9px] font-label tracking-wide text-foreground-600">
              OBSERVED ROWS · QUERY LIMIT REACHED
            </div>
          )}
          <div className="mt-1 text-[9px] font-label tracking-wide text-foreground-600">
            OVERSEER {report.overseer ?? '—'} · INTENDED (NOT VERIFIED)
          </div>
        </div>
      )}
    </>
  );
}

function RunsSection({ detail }: { detail: AgentDetailModel }) {
  return (
    <>
      <Subhead>Execution</Subhead>
      <Row label="Current execution">
        {detail.currentRun ? (
          <span style={{ color: TONE_HEX.amber }}>{detail.currentRun.status.toUpperCase()}</span>
        ) : (
          <span className="gn-muted">None in flight</span>
        )}
      </Row>
      {detail.currentRun?.summary && (
        <Row label="Current task">{detail.currentRun.summary}</Row>
      )}
      <Row label="Last success">
        {detail.lastSuccessfulRun ? (
          <span style={{ color: TONE_HEX.emerald }}>{detail.lastSuccessfulRun.completedAt ? detail.lastSuccessfulRun.durationLabel ?? 'Completed' : 'Completed'}</span>
        ) : (
          <span className="gn-muted">No successful execution recorded</span>
        )}
      </Row>

      {detail.recentRuns.length > 0 && (
        <>
          <Subhead>Recent runs</Subhead>
          <div className="gn-drawer-runs">
            {detail.recentRuns.map((r) => (
              <Link
                key={r.runKey}
                to={`/ai-operations/runs/${r.runKey}`}
                className="gn-drawer-run"
              >
                <span className="font-mono text-[9px] text-foreground-400 tabular-nums">{r.runKey}</span>
                <span className="gn-pill" style={{ color: toneHex(r.status === 'completed' || r.status === 'partially_completed' ? 'green' : r.status === 'failed' || r.status === 'timed_out' || r.status === 'blocked' ? 'red' : r.status === 'working' ? 'amber' : 'secondary'), borderColor: `${toneHex(r.status === 'completed' || r.status === 'partially_completed' ? 'green' : r.status === 'failed' || r.status === 'timed_out' || r.status === 'blocked' ? 'red' : r.status === 'working' ? 'amber' : 'secondary')}44`, background: `${toneHex(r.status === 'completed' || r.status === 'partially_completed' ? 'green' : r.status === 'failed' || r.status === 'timed_out' || r.status === 'blocked' ? 'red' : r.status === 'working' ? 'amber' : 'secondary')}12` }}>
                  {r.status.toUpperCase()}
                </span>
                {r.durationLabel && <span className="text-[9px] text-foreground-500">{r.durationLabel}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function AlertsApprovals({ detail }: { detail: AgentDetailModel }) {
  return (
    <>
      <Subhead>Latest findings · alerts</Subhead>
      {detail.alerts.length === 0 ? (
        <Empty text="No active alerts." />
      ) : (
        <div className="gn-drawer-list">
          {detail.alerts.slice(0, 5).map((a) => (
            <Link key={a.alertKey} to={`/ai-operations/alerts/${a.alertKey}`} className="gn-drawer-item">
              <span className="gn-status-dot" style={{ background: toneHex(a.severity === 'critical' || a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'secondary') }} />
              <span className="flex-1 min-w-0 truncate text-[10px] text-foreground-200">{a.title}</span>
              <span className="text-[8px] font-label text-foreground-500 uppercase">{a.severity}</span>
            </Link>
          ))}
        </div>
      )}

      <Subhead>Pending approvals</Subhead>
      {detail.approvals.length === 0 ? (
        <Empty text="No pending approvals." />
      ) : (
        <div className="gn-drawer-list">
          {detail.approvals.slice(0, 5).map((ap) => (
            <Link key={ap.approvalKey} to={`/ai-operations/approvals/${ap.approvalKey}`} className="gn-drawer-item">
              <i className="ri-shield-check-line text-[12px] text-amber-400"></i>
              <span className="flex-1 min-w-0 truncate text-[10px] text-foreground-200">{ap.requestedAction}</span>
              <span className="text-[8px] font-label text-foreground-500 uppercase">{ap.status.replace(/_/g, ' ')}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function RuntimeWorkflow({ detail }: { detail: AgentDetailModel }) {
  return (
    <>
      <Subhead>Assigned runtime</Subhead>
      <Row label="Host">{detail.runtime.hostName}</Row>
      <Row label="Execution">
        <span style={{ color: detail.runtime.executionEnabled ? TONE_HEX.emerald : TONE_HEX.amber }}>
          {detail.runtime.executionEnabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </Row>
      {detail.runtime.agentGate && (
        <Row label="Agent gate">
          <span style={{ color: detail.runtime.agentGate.execution_allowed ? TONE_HEX.emerald : TONE_HEX.red }}>
            {detail.runtime.agentGate.execution_allowed ? 'EXECUTION ALLOWED' : 'EXECUTION BLOCKED'}
          </span>
        </Row>
      )}
      <Row label="Runtime stop">
        <span className="gn-muted">Unavailable — no runtime pause/stop path is configured</span>
      </Row>

      <Subhead>Assigned workflows</Subhead>
      {detail.workflows.length === 0 ? (
        <Empty text="No explicit workflow mapping." />
      ) : (
        <div className="gn-drawer-list">
          {detail.workflows.map((w) => (
            <div key={w.workflowKey} className="gn-drawer-item">
              <i className="ri-flow-chart text-[12px] text-accent-400"></i>
              <span className="flex-1 min-w-0 truncate text-[10px] text-foreground-200" title={w.workflowKey}>
                {w.name}
              </span>
              <span className="text-[8px] font-label text-foreground-500 uppercase whitespace-nowrap">
                {w.runtimeStatus ?? w.executionMode ?? 'mapped'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ControlsSection({ detail }: { detail: AgentDetailModel }) {
  const registryPaused = detail.status === 'paused';
  const registryDisabled = detail.status === 'disabled' || detail.status === 'not_configured';
  return (
    <>
      <Subhead>Controls</Subhead>
      <Row label="Registry state">
        <span style={{ color: registryPaused ? TONE_HEX.amber : registryDisabled ? TONE_HEX.secondary : TONE_HEX.emerald }}>
          {registryPaused ? 'PAUSED (REGISTRY)' : registryDisabled ? detail.status.toUpperCase() : detail.status.toUpperCase()}
        </span>
      </Row>
      <div className="gn-drawer-controls">
        <Link to={`/ai-operations/agents/${detail.agentKey}`} className="gn-detail-link">
          <i className="ri-settings-3-line"></i> Manage in Agent Registry (pause / disable)
        </Link>
        <Link to="/ai-operations/runtime-controls" className="gn-detail-link">
          <i className="ri-shut-down-line"></i> Runtime controls &amp; emergency freeze
        </Link>
      </div>
      <p className="gn-drawer-note">
        Registry pause/disable is separate from runtime execution. Runtime pause/stop is not
        connected — no frontend-only control is offered here.
      </p>
    </>
  );
}

interface AgentDetailDrawerProps {
  agentId: string;
  onClose: () => void;
}

export default function AgentDetailDrawer({ agentId, onClose }: AgentDetailDrawerProps) {
  const detail = getAgentDetail(agentId);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusMeta = detail ? NETWORK_AGENT_STATE_META[detail.status as keyof typeof NETWORK_AGENT_STATE_META] : undefined;
  const statusTone = detail ? (detail.health === 'warning' || detail.status === 'degraded' ? 'amber' : 'secondary') : 'secondary';

  return (
    <div className="gn-drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="gn-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={detail ? `${detail.name} details` : 'Agent details'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gn-drawer-head">
          <div className="min-w-0">
            <div className="gn-drawer-title">{detail?.name ?? 'Agent'}</div>
            <div className="gn-drawer-subtitle">
              {detail?.categoryLabel ?? ''}
              {detail?.siteName ? ` · ${detail.siteName}` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} className="gn-zoom-btn" title="Close">
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="gn-drawer-body">
          {!detail ? (
            <div className="gn-muted py-8 text-center">Agent not found in the live registry.</div>
          ) : (
            <>
              <Row label="Status">
                <span style={{ color: statusMeta ? TONE_HEX[statusMeta.tone] : TONE_HEX[statusTone as Tone] }}>
                  {statusMeta ? statusMeta.label : detail.status.toUpperCase()}
                </span>
              </Row>
              <Row label="Agent key">
                <span className="font-mono text-[10px]">{detail.agentKey}</span>
              </Row>
              <Row label="Category">{detail.categoryLabel}</Row>
              {detail.autonomy && <Row label="Autonomy">{detail.autonomy.replace(/_/g, ' ')}</Row>}
              <Row label="Assigned manager">
                {detail.assignedManagerName ? (
                  <span>{detail.assignedManagerName}</span>
                ) : (
                  <span className="gn-muted">Manager not assigned</span>
                )}
              </Row>
              {detail.duplicateManagers && (
                <Row label="Assignment">
                  <span style={{ color: TONE_HEX.red }}>Duplicate managers · issue</span>
                </Row>
              )}
              {detail.description && <Row label="Description">{detail.description}</Row>}

              <div className="gn-detail-divider" />

              <RuntimeWorkflow detail={detail} />
              <div className="gn-detail-divider" />
              <RunsSection detail={detail} />
              <div className="gn-detail-divider" />
              <ReportSection report={detail.report} />
              <div className="gn-detail-divider" />
              <AlertsApprovals detail={detail} />
              <div className="gn-detail-divider" />
              <ControlsSection detail={detail} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
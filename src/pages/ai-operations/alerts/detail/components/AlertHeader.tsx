import { Link } from 'react-router-dom';
import type { AiAlert, AlertStatus } from '@/pages/ai-operations/types';
import { SEVERITY, ALERT_STATUS, ALERT_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const ACTIONS: { key: string; label: string; icon: string; status: AlertStatus }[] = [
  { key: 'ack', label: 'Acknowledge', icon: 'ri-check-line', status: 'acknowledged' },
  { key: 'investigate', label: 'Start Investigation', icon: 'ri-search-eye-line', status: 'investigating' },
  { key: 'escalate', label: 'Escalate', icon: 'ri-arrow-up-line', status: 'escalated' },
  { key: 'monitor', label: 'Mark Monitoring', icon: 'ri-pulse-line', status: 'monitoring' },
  { key: 'resolve', label: 'Mark Resolved', icon: 'ri-check-double-line', status: 'resolved' },
  { key: 'close', label: 'Close Incident', icon: 'ri-checkbox-circle-line', status: 'closed' },
];

export default function AlertHeader({ alert, onAction }: { alert: AiAlert; onAction: (status: AlertStatus) => void }) {
  const sev = SEVERITY[alert.severity];
  const status = ALERT_STATUS[alert.status];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/alerts" className="hover:text-foreground-200 transition-colors cursor-pointer">Alerts &amp; Incidents</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{alert.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{alert.title}</h1>
            <StatusPill tone={sev.tone} label={sev.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={status.tone} label={status.label} />
            <span className="text-xs font-label text-foreground-500">{ALERT_TYPE_LABELS[alert.type]}</span>
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            {alert.siteName} · <span className="font-mono">{alert.id}</span> · <span className="font-mono">{alert.incidentId}</span> · Detected {alert.detectedAt}
          </p>
        </div>
      </div>

      {/* Local incident controls */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => onAction(a.status)}
              disabled={alert.status === a.status}
              className={`inline-flex items-center gap-1.5 text-xs font-label rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                alert.status === a.status
                  ? 'bg-background-50 border-background-300/60 text-foreground-500 cursor-not-allowed'
                  : 'bg-background-50 border-background-300/60 text-foreground-200 hover:text-foreground-100 hover:border-accent-500/40'
              }`}
            >
              <i className={`${a.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-3">
          Operational status only — automated remediation is not connected. Updates persist to the live registry and are audited.
        </p>
      </div>
    </div>
  );
}
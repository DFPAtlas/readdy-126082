import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { AlertStatus } from '@/pages/ai-operations/types';
import { useAlerts } from '@/pages/ai-operations/alerts/AlertsContext';
import AlertHeader from '@/pages/ai-operations/alerts/detail/components/AlertHeader';
import IncidentSummary from '@/pages/ai-operations/alerts/detail/components/IncidentSummary';
import RelatedRecords from '@/pages/ai-operations/alerts/detail/components/RelatedRecords';
import IncidentTimeline from '@/pages/ai-operations/alerts/detail/components/IncidentTimeline';
import DiagnosticsSummary from '@/pages/ai-operations/alerts/detail/components/DiagnosticsSummary';
import KnownIssueMatch from '@/pages/ai-operations/alerts/detail/components/KnownIssueMatch';
import ImpactAssessment from '@/pages/ai-operations/alerts/detail/components/ImpactAssessment';
import ResponsePlan from '@/pages/ai-operations/alerts/detail/components/ResponsePlan';
import Governance from '@/pages/ai-operations/alerts/detail/components/Governance';
import Resolution from '@/pages/ai-operations/alerts/detail/components/Resolution';
import Escalation from '@/pages/ai-operations/alerts/detail/components/Escalation';
import Recurrence from '@/pages/ai-operations/alerts/detail/components/Recurrence';
import { getAuditByAlert } from '@/pages/ai-operations/audit/selectors';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import NotificationEscalation from '@/pages/ai-operations/notifications/components/NotificationEscalation';

export default function AlertDetailPage() {
  const { alertId } = useParams<{ alertId: string }>();
  const { getAlert, updateStatus, createIncidentFromAlert, mode } = useAlerts();
  const [incidentMsg, setIncidentMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const alert = getAlert(alertId ?? '');

  if (!alert) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-alert-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Alert not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested alert does not exist in the registry.</p>
        <Link
          to="/ai-operations/alerts"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Alerts &amp; Incidents
        </Link>
      </div>
    );
  }

  const handleAction = (status: AlertStatus) => {
    void updateStatus(alert.id, status);
  };

  const handleCreateIncident = async () => {
    setIncidentMsg(null);
    const res = await createIncidentFromAlert(alert.id);
    if (res.error) {
      setIncidentMsg({ tone: 'error', text: res.error });
    } else {
      setIncidentMsg({ tone: 'success', text: 'Incident created — registered and audited. Automated remediation is not connected.' });
    }
  };

  return (
    <div className="space-y-6">
      <AlertHeader alert={alert} onAction={handleAction} />

      {/* Create incident control (live mode only) */}
      {mode === 'live' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCreateIncident}
            className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Create Incident from Alert
          </button>
          <p className="text-[11px] font-label text-foreground-600">
            Creates an incident case, links this alert and records an audit event. No remediation or notifications are triggered.
          </p>
          {incidentMsg && (
            <span className={`text-[11px] font-label ${incidentMsg.tone === 'success' ? 'text-emerald-400' : 'text-red-400'} whitespace-nowrap`}>
              {incidentMsg.text}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <IncidentSummary alert={alert} />
        <RelatedRecords alert={alert} />
      </div>

      <IncidentTimeline events={alert.timeline} />

      {/* Demo Supporting Metadata divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-background-200/60"></div>
        <span className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Demo Supporting Metadata</span>
        <div className="h-px flex-1 bg-background-200/60"></div>
      </div>
      <p className="text-[11px] font-label text-foreground-600 -mt-4">
        Detailed diagnostics, response planning, governance, escalation and recurrence detail below are demo supporting metadata — no live monitoring, remediation or notification runtime is connected.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DiagnosticsSummary alert={alert} />
        <KnownIssueMatch alert={alert} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ImpactAssessment alert={alert} />
        <ResponsePlan />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Governance alert={alert} />
        <Resolution alert={alert} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Escalation alert={alert} />
        <Recurrence alert={alert} />
      </div>

      <NotificationEscalation alert={alert} />

      <RecentAuditEvents title="Incident Audit Events" events={getAuditByAlert(alert.id)} emptyMessage="No audit events linked to this incident yet." />
    </div>
  );
}
import { Link } from 'react-router-dom';
import type { AiAuditEvent } from '@/pages/ai-operations/types';
import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_OUTCOME,
  RISK_CLASS,
  SEVERITY,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function relatedRecordLabel(e: AiAuditEvent): { label: string; to: string | null } {
  if (e.runId) return { label: e.runId, to: `/ai-operations/runs/${e.runId}` };
  if (e.approvalId) return { label: e.approvalId, to: `/ai-operations/approvals/${e.approvalId}` };
  if (e.orchestrationId) return { label: e.orchestrationId, to: `/ai-operations/orchestrator/${e.orchestrationId}` };
  if (e.alertId) return { label: e.alertId, to: `/ai-operations/alerts/${e.alertId}` };
  if (e.policyId) return { label: e.policyId, to: `/ai-operations/security/policies/${e.policyId}` };
  return { label: '—', to: null };
}

export default function AuditLog({ events }: { events: AiAuditEvent[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Audit Log</h3>
        <span className="text-[11px] font-label text-foreground-600">{events.length} events</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Event</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Agent / Actor</th>
              <th className="px-4 py-2.5 font-medium">Outcome</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium">Related Record</th>
              <th className="px-4 py-2.5 font-medium">Evidence</th>
              <th className="px-4 py-2.5 font-medium">Review</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const outcome = AUDIT_OUTCOME[e.outcome];
              const risk = RISK_CLASS[e.risk];
              const related = relatedRecordLabel(e);
              return (
                <tr key={e.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{e.timestamp}</td>
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/audit/${e.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {e.action}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 mt-0.5">{AUDIT_EVENT_TYPE_LABELS[e.eventType]} · <span className="font-mono">{e.id}</span></p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.siteName}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.agentName || e.actorTeam}</td>
                  <td className="px-4 py-3"><StatusPill tone={outcome.tone} label={outcome.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                  <td className="px-4 py-3">
                    {related.to ? (
                      <Link to={related.to} className="font-mono text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap">
                        {related.label}
                      </Link>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-label ${e.evidenceIds.length ? 'text-emerald-400' : 'text-foreground-600'}`}>
                      {e.evidenceIds.length} item{e.evidenceIds.length === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.reviewRequired ? (
                      <StatusPill tone="amber" label="Required" />
                    ) : (
                      <span className="text-[11px] font-label text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/audit/${e.id}`}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {events.map((e) => {
          const outcome = AUDIT_OUTCOME[e.outcome];
          const severity = SEVERITY[e.severity];
          const related = relatedRecordLabel(e);
          return (
            <Link key={e.id} to={`/ai-operations/audit/${e.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{e.action}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{AUDIT_EVENT_TYPE_LABELS[e.eventType]} · {e.siteName} · {e.timestamp}</p>
                </div>
                <StatusPill tone={outcome.tone} label={outcome.label} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={severity.tone} label={severity.label} />
                {e.reviewRequired && <StatusPill tone="amber" label="Review required" />}
                {related.to && <span className="font-mono text-accent-400">{related.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
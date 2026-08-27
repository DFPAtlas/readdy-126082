import { Link } from 'react-router-dom';
import type { AiAuditEvent } from '@/pages/ai-operations/types';

export default function RelatedRecords({ event }: { event: AiAuditEvent }) {
  const links: { label: string; value: string; to: string | null }[] = [
    { label: 'Site', value: event.siteName, to: event.siteId !== 'group' ? `/ai-operations/sites/${event.siteId}` : null },
    { label: 'Agent', value: event.agentName, to: event.agentId ? `/ai-operations/agents/${event.agentId}` : null },
    { label: 'Run', value: event.runId ?? '', to: event.runId ? `/ai-operations/runs/${event.runId}` : null },
    { label: 'Orchestration', value: event.orchestrationId ?? '', to: event.orchestrationId ? `/ai-operations/orchestrator/${event.orchestrationId}` : null },
    { label: 'Approval', value: event.approvalId ?? '', to: event.approvalId ? `/ai-operations/approvals/${event.approvalId}` : null },
    { label: 'Alert', value: event.alertId ?? '', to: event.alertId ? `/ai-operations/alerts/${event.alertId}` : null },
    { label: 'Policy', value: event.policyId ?? '', to: event.policyId ? `/ai-operations/security/policies/${event.policyId}` : null },
    { label: 'Tool', value: event.toolId ?? '', to: event.toolId ? `/ai-operations/tools/${event.toolId}` : null },
    { label: 'Model', value: event.modelId ?? '', to: event.modelId ? `/ai-operations/models/${event.modelId}` : null },
    { label: 'Knowledge', value: event.knowledgeId ?? '', to: event.knowledgeId ? `/ai-operations/knowledge/${event.knowledgeId}` : null },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Related Records</h4>
      </div>
      <div className="divide-y divide-background-200/40">
        {links.map((l) => (
          <div key={l.label} className="px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{l.label}</span>
            {l.to ? (
              <Link to={l.to} className="text-sm font-medium text-accent-400 hover:text-accent-300 transition-colors cursor-pointer font-mono whitespace-nowrap">
                {l.value}
              </Link>
            ) : (
              <span className="text-sm text-foreground-600">—</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}